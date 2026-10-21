-- Rest van de installatie voor project 'tweeklank' (qexufuyxaxvsyaelpfkr).
-- Deel 1 t/m 3 van de kernmigratie staan er al. Plak dit hele bestand in de SQL Editor en klik op Run.
begin;

-------------------------------------------------------------------------------
-- RPC's: koppelen
-------------------------------------------------------------------------------

-- Maakt (zo nodig) een koppel aan met de aanroeper als eerste lid en geeft een nieuwe code terug.
-- Eerdere ongebruikte codes van dit koppel vervallen.
create or replace function public.create_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid;
  v_code    text;
  v_alpha   constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i         int;
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;

  v_couple := public.my_couple_id();
  if v_couple is null then
    insert into public.couples default values returning id into v_couple;
    insert into public.couple_members (couple_id, user_id) values (v_couple, v_uid);
  elsif (select count(*) from public.couple_members m where m.couple_id = v_couple) >= 2 then
    raise exception 'al_gekoppeld';
  end if;

  delete from public.invites i2 where i2.couple_id = v_couple and i2.used_at is null;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    begin
      insert into public.invites (code, couple_id, created_by) values (v_code, v_couple, v_uid);
      exit;
    exception when unique_violation then
      -- zeldzame botsing: nieuwe code proberen
    end;
  end loop;

  return query select inv.code, inv.expires_at from public.invites inv where inv.code = v_code;
end;
$$;

-- Wisselt een code in. Als de aanroeper zelf al een (nog lege) uitnodiging had, vervalt die.
create or replace function public.redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_invite   public.invites%rowtype;
  v_mine     uuid;
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;

  select * into v_invite
  from public.invites
  where code = upper(btrim(p_code))
  for update;

  if not found then
    raise exception 'code_onbekend';
  elsif v_invite.used_at is not null then
    raise exception 'code_gebruikt';
  elsif v_invite.expires_at < now() then
    raise exception 'code_verlopen';
  elsif v_invite.created_by = v_uid then
    raise exception 'eigen_code';
  end if;

  v_mine := public.my_couple_id();
  if v_mine is not null then
    if (select count(*) from public.couple_members where couple_id = v_mine) >= 2 then
      raise exception 'al_gekoppeld';
    end if;
    -- eigen wachtende uitnodiging opruimen (dit koppel heeft nog geen gedeelde data)
    delete from public.couples where id = v_mine;
  end if;

  insert into public.couple_members (couple_id, user_id) values (v_invite.couple_id, v_uid);
  update public.invites set used_at = now(), used_by = v_uid where code = v_invite.code;

  return v_invite.couple_id;
end;
$$;

-- Ontkoppelen: verwijdert het koppel en daarmee (via cascade) alle gedeelde data.
create or replace function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid := public.my_couple_id();
begin
  if auth.uid() is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_couple is not null then
    delete from public.couples where id = v_couple;
  end if;
end;
$$;

-------------------------------------------------------------------------------
-- RPC's: dagelijkse vraag en streak
-------------------------------------------------------------------------------

-- Streak op een gegeven dag: aantal opeenvolgende dagen (eindigend op p_today, of op gisteren
-- als vandaag nog niet door beiden beantwoord is) waarop beide partners antwoordden.
-- Intern: niet direct aanroepbaar door clients (zie grants onderaan).
create or replace function public.couple_streak_at(p_couple uuid, p_today date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with complete as (
    select day
    from public.daily_answers
    where couple_id = p_couple and day <= p_today
    group by day
    having count(distinct user_id) >= 2
  ),
  anchor as (
    select case when exists (select 1 from complete where day = p_today)
                then p_today else p_today - 1 end as d
  ),
  ranked as (
    select (select d from anchor) - day as gap,
           row_number() over (order by day desc) - 1 as rn
    from complete
    where day <= (select d from anchor)
  )
  select count(*)::int from ranked where gap = rn;
$$;

create or replace function public.my_streak()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.couple_streak_at(public.my_couple_id(), public.ams_today()), 0);
$$;

-- Haalt de vraag van vandaag op en wijst die zo nodig toe (op volgorde, daarna opnieuw rond).
create or replace function public.get_today_question()
returns table (
  day               date,
  question_id       bigint,
  text              text,
  depth             smallint,
  answered          boolean,
  partner_answered  boolean,
  streak            integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := public.my_couple_id();
  v_today   date := public.ams_today();
  v_count   int;
  v_total   int;
  v_qid     bigint;
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_couple is null or public.my_partner_id() is null then
    raise exception 'geen_partner';
  end if;

  if not exists (select 1 from public.couple_daily cd where cd.couple_id = v_couple and cd.day = v_today) then
    select count(*) into v_count from public.couple_daily cd where cd.couple_id = v_couple;
    select count(*) into v_total from public.daily_questions;
    if v_total = 0 then
      raise exception 'geen_vragen';
    end if;
    select q.id into v_qid
    from public.daily_questions q
    order by q.position
    offset (v_count % v_total)
    limit 1;

    insert into public.couple_daily (couple_id, day, question_id)
    values (v_couple, v_today, v_qid)
    on conflict do nothing;
  end if;

  return query
  select cd.day, q.id, q.text, q.depth,
         exists (select 1 from public.daily_answers a
                 where a.couple_id = v_couple and a.day = v_today and a.user_id = v_uid),
         exists (select 1 from public.daily_answers a
                 where a.couple_id = v_couple and a.day = v_today and a.user_id <> v_uid),
         public.couple_streak_at(v_couple, v_today)
  from public.couple_daily cd
  join public.daily_questions q on q.id = cd.question_id
  where cd.couple_id = v_couple and cd.day = v_today;
end;
$$;

-------------------------------------------------------------------------------
-- Row level security
-------------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.couples           enable row level security;
alter table public.couple_members    enable row level security;
alter table public.invites           enable row level security;
alter table public.daily_questions   enable row level security;
alter table public.couple_daily      enable row level security;
alter table public.daily_answers     enable row level security;
alter table public.answer_reactions  enable row level security;

-- profiles: jezelf en je partner
create policy "profiel lezen: zelf of partner" on public.profiles
  for select to authenticated
  using (id = auth.uid() or id = public.my_partner_id());

create policy "profiel wijzigen: alleen zelf" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- couples: alleen je eigen koppel; alleen de jubileumdatum is aanpasbaar
create policy "koppel lezen" on public.couples
  for select to authenticated
  using (id = public.my_couple_id());

create policy "koppel wijzigen" on public.couples
  for update to authenticated
  using (id = public.my_couple_id())
  with check (id = public.my_couple_id());

revoke update on public.couples from anon, authenticated;
grant update (anniversary) on public.couples to authenticated;

-- couple_members: leden van je eigen koppel (schrijven alleen via RPC's)
create policy "leden lezen" on public.couple_members
  for select to authenticated
  using (couple_id = public.my_couple_id());

-- invites: alleen eigen codes zien (inwisselen via redeem_invite)
create policy "eigen uitnodigingen lezen" on public.invites
  for select to authenticated
  using (created_by = auth.uid());

-- daily_questions: content, leesbaar voor ingelogde gebruikers
create policy "dagvragen lezen" on public.daily_questions
  for select to authenticated
  using (true);

-- couple_daily: eigen koppel (aanmaken via get_today_question)
create policy "vraag van de dag lezen" on public.couple_daily
  for select to authenticated
  using (couple_id = public.my_couple_id());

-- daily_answers: kern van de zichtbaarheid
create policy "antwoord lezen: eigen, of partner na eigen antwoord" on public.daily_answers
  for select to authenticated
  using (
    user_id = auth.uid()
    or (couple_id = public.my_couple_id() and public.has_answered(couple_id, day))
  );

create policy "antwoord geven: alleen vandaag, eigen koppel" on public.daily_answers
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and couple_id = public.my_couple_id()
    and day = public.ams_today()
  );

create policy "antwoord aanpassen: alleen vandaag" on public.daily_answers
  for update to authenticated
  using (user_id = auth.uid() and day = public.ams_today())
  with check (
    user_id = auth.uid()
    and couple_id = public.my_couple_id()
    and day = public.ams_today()
  );
-- bewust geen delete-policy: antwoorden kun je niet intrekken nadat je partner ze zag

-- answer_reactions
create policy "reacties lezen" on public.answer_reactions
  for select to authenticated
  using (public.can_see_answer(answer_id));

create policy "reageren op antwoord van partner" on public.answer_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_see_answer(answer_id)
    and exists (
      select 1 from public.daily_answers a
      where a.id = answer_id and a.user_id <> auth.uid()
    )
  );

create policy "eigen reactie verwijderen" on public.answer_reactions
  for delete to authenticated
  using (user_id = auth.uid());

-------------------------------------------------------------------------------
-- Rechten op functies
-------------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.ams_today(),
  public.my_couple_id(),
  public.my_partner_id(),
  public.has_answered(uuid, date),
  public.can_see_answer(bigint),
  public.create_invite(),
  public.redeem_invite(text),
  public.leave_couple(),
  public.my_streak(),
  public.get_today_question()
to authenticated;

revoke execute on function public.couple_streak_at(uuid, date) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;

-------------------------------------------------------------------------------
-- Realtime (alleen als de Supabase-publicatie bestaat; RLS geldt ook voor Realtime)
-------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.daily_answers, public.answer_reactions;
  end if;
end;
$$;

-- ===== 20261021000200_content_daily_questions.sql =====
-- Startcontent: 60 dagelijkse vragen (origineel geschreven voor Tweeklank).
-- Diepgang: 1 = luchtig, 2 = persoonlijk, 3 = diep.
-- Uitbreiden? Maak een nieuwe migratie met extra rijen en hogere position-waarden.

insert into public.daily_questions (slug, position, depth, text) values
  ('dv-001', 1,  1, 'Welk klein moment van vandaag zou je nog een keer willen beleven?'),
  ('dv-002', 2,  1, 'Als we morgen een vrije dag hadden zonder verplichtingen, hoe zou jouw ideale ochtend eruitzien?'),
  ('dv-003', 3,  2, 'Wat is iets wat ik doe waardoor jij je gezien voelt, ook al merk ik het zelf misschien niet?'),
  ('dv-004', 4,  1, 'Welk liedje brengt je direct terug naar een bepaalde zomer?'),
  ('dv-005', 5,  2, 'Waar ben je op dit moment stiekem trots op, maar heb je nog aan niemand verteld?'),
  ('dv-006', 6,  1, 'Welk gerecht zou je willen leren maken, het liefst samen met mij?'),
  ('dv-007', 7,  3, 'Wanneer voelde je je de afgelopen tijd eenzaam, ook al was ik in de buurt?'),
  ('dv-008', 8,  1, 'Als ons leven een film was, welk genre zou het nu zijn, en welk genre zou je willen?'),
  ('dv-009', 9,  2, 'Welke gewoonte van je ouders heb je overgenomen zonder dat je het eigenlijk wilde?'),
  ('dv-010', 10, 1, 'Wat is de beste tweedehands of afgedankte vondst die je ooit hebt gedaan?'),
  ('dv-011', 11, 2, 'Waarover maak je je deze week de meeste zorgen?'),
  ('dv-012', 12, 1, 'Welke plek in onze buurt zou je mij graag eens laten zien?'),
  ('dv-013', 13, 3, 'Wat heb je van mij nodig op dagen dat het niet goed met je gaat, en vind je het moeilijk om daarom te vragen?'),
  ('dv-014', 14, 1, 'Met welk dier zou je een dag willen ruilen, en waarom juist dat dier?'),
  ('dv-015', 15, 2, 'Wat is een compliment dat je ooit kreeg en nooit bent vergeten?'),
  ('dv-016', 16, 1, 'Welk klusje in huis doe je eigenlijk best graag?'),
  ('dv-017', 17, 2, 'Welke droom van vroeger heb je losgelaten, en vind je dat jammer?'),
  ('dv-018', 18, 1, 'Welke traditie zouden wij samen kunnen beginnen?'),
  ('dv-019', 19, 3, 'Waar ben je bang voor als je aan onze toekomst denkt?'),
  ('dv-020', 20, 1, 'Wat zou je doen met een onverwachte middag helemaal voor jezelf?'),
  ('dv-021', 21, 2, 'Wanneer voelde je je de afgelopen maand echt verbonden met mij?'),
  ('dv-022', 22, 1, 'Welk boek, welke serie of welke podcast zou je mij aanraden, en waarom?'),
  ('dv-023', 23, 2, 'Welke kant van jezelf laat je bijna nooit aan anderen zien?'),
  ('dv-024', 24, 1, 'Wat is jouw favoriete geur, en waar doet die je aan denken?'),
  ('dv-025', 25, 3, 'Is er iets uit ons verleden waar je nog steeds over nadenkt en dat we nooit goed hebben uitgepraat?'),
  ('dv-026', 26, 1, 'Als je één vaardigheid meteen zou kunnen beheersen, welke kies je?'),
  ('dv-027', 27, 2, 'Hoe merk jij dat ik gestrest ben, nog voordat ik het zelf zeg?'),
  ('dv-028', 28, 1, 'Welk moment van ons eerste jaar samen herinner je je het levendigst?'),
  ('dv-029', 29, 2, 'Waar zou je meer tijd voor willen maken, als je eerlijk bent?'),
  ('dv-030', 30, 3, 'Wat betekent "thuis" voor jou, los van een adres?'),
  ('dv-031', 31, 1, 'Wat is de grappigste misser die je ooit hebt gemaakt waar anderen bij waren?'),
  ('dv-032', 32, 2, 'Welke persoon heeft de meeste invloed gehad op wie je nu bent?'),
  ('dv-033', 33, 1, 'Strand, bos of stad: waar laad jij het beste op?'),
  ('dv-034', 34, 2, 'Is er iets wat je graag vaker van mij zou horen?'),
  ('dv-035', 35, 3, 'Hoe ga jij om met boosheid, en heb je dat zo van huis uit meegekregen?'),
  ('dv-036', 36, 1, 'Welk kinderspelletje zou je nu nog steeds met plezier spelen?'),
  ('dv-037', 37, 2, 'Welk besluit heb je ooit genomen waar je nu nog blij mee bent?'),
  ('dv-038', 38, 1, 'Als we een weekend weg zouden gaan zonder plan, welke kant zou je op willen rijden?'),
  ('dv-039', 39, 3, 'Waarin ben je de afgelopen jaren het meest veranderd?'),
  ('dv-040', 40, 1, 'Wat is het lekkerste dat je ooit op vakantie hebt gegeten?'),
  ('dv-041', 41, 2, 'Wanneer voel jij je het meest jezelf?'),
  ('dv-042', 42, 1, 'Welke kleine luxe zou je jezelf wat vaker willen gunnen?'),
  ('dv-043', 43, 2, 'Welke vriendschap zou je graag nieuw leven inblazen?'),
  ('dv-044', 44, 3, 'Wat zou je tegen jezelf van vijftien jaar willen zeggen?'),
  ('dv-045', 45, 1, 'Welk object in ons huis zou je als eerste redden, mensen en dieren niet meegerekend?'),
  ('dv-046', 46, 2, 'Hoe zou jouw perfecte zondag samen eruitzien, van begin tot eind?'),
  ('dv-047', 47, 1, 'Over welk onderwerp kun jij urenlang praten zonder je te vervelen?'),
  ('dv-048', 48, 3, 'Wanneer heb je je het meest door mij gesteund gevoeld?'),
  ('dv-049', 49, 2, 'Wat is iets wat je dit jaar nog wilt leren of proberen?'),
  ('dv-050', 50, 1, 'Welk woord gebruik ik volgens jou het vaakst?'),
  ('dv-051', 51, 2, 'Welke verwachting over relaties had je vroeger, en die blijkt nu anders te zijn?'),
  ('dv-052', 52, 1, 'Als je een eigen winkeltje of café zou beginnen, wat zou het worden?'),
  ('dv-053', 53, 3, 'Wat zou je willen dat ik beter begreep over jouw verleden?'),
  ('dv-054', 54, 1, 'Wat is een geluid waar je blij van wordt?'),
  ('dv-055', 55, 2, 'Op welk moment van de dag denk je het vaakst aan mij?'),
  ('dv-056', 56, 2, 'Welke rol speel jij meestal in een groep vrienden?'),
  ('dv-057', 57, 3, 'Hoe wil je dat wij over twintig jaar op deze periode terugkijken?'),
  ('dv-058', 58, 1, 'Welke regel zou je invoeren als je één dag het land mocht besturen?'),
  ('dv-059', 59, 2, 'Wat heb je onlangs van mij geleerd, groot of klein?'),
  ('dv-060', 60, 3, 'Waarvoor ben je mij dankbaar, maar heb je dat nog nooit hardop gezegd?')
on conflict (slug) do nothing;

-- ===== 20261021000300_push.sql =====
-- Pushmeldingen: tokens per toestel + functies die bepalen wie een melding krijgt.
-- Versturen gebeurt in de Edge Function send-push (zie supabase/functions/send-push).

create table public.push_tokens (
  token       text primary key check (char_length(token) between 10 and 300),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android')),
  updated_at  timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "eigen tokens lezen" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "eigen token verwijderen" on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

-- Registreren loopt via register_push_token (geen insert/update-policy).
-- Een toestel kan van eigenaar wisselen (uitloggen, ander account): token overnemen mag,
-- maar alleen via deze functie, zodat je nooit andermans rij kunt lezen.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'niet_ingelogd';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- Wie krijgt "partner heeft geantwoord"? De partner van de schrijver, als die dat wil.
-- Geeft ook de naam van de schrijver terug (nooit de inhoud van het antwoord).
create or replace function public.push_targets_partner_answered(p_answer bigint)
returns table (token text, author_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.token, coalesce(nullif(author.display_name, ''), 'Je partner')
  from public.daily_answers a
  join public.profiles author on author.id = a.user_id
  join public.couple_members m on m.couple_id = a.couple_id and m.user_id <> a.user_id
  join public.profiles p on p.id = m.user_id and p.notify_partner_answered
  join public.push_tokens t on t.user_id = m.user_id
  where a.id = p_answer;
$$;

-- Wie krijgt "de vraag van vandaag staat klaar"? Iedereen in een compleet koppel die dat wil.
create or replace function public.push_targets_new_question()
returns table (token text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.token
  from public.push_tokens t
  join public.profiles p on p.id = t.user_id and p.notify_new_question
  join public.couple_members m on m.user_id = t.user_id
  where (select count(*) from public.couple_members m2 where m2.couple_id = m.couple_id) = 2;
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

revoke execute on function
  public.push_targets_partner_answered(bigint),
  public.push_targets_new_question()
from public, anon, authenticated;
grant execute on function
  public.push_targets_partner_answered(bigint),
  public.push_targets_new_question()
to service_role;

-- ===== 20261021000400_quiz.sql =====
-- Quizzen "Hoe goed ken je me?"
-- Iedere partner beantwoordt per vraag twee dingen: wat hij/zij zelf kiest ('self')
-- en wat hij/zij denkt dat de partner kiest ('guess').

create table public.quizzes (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  title        text not null,
  description  text not null,
  position     integer not null unique
);

create table public.quiz_questions (
  id        bigint generated always as identity primary key,
  slug      text not null unique,
  quiz_id   bigint not null references public.quizzes (id) on delete cascade,
  position  smallint not null,
  prompt    text not null check (char_length(prompt) between 5 and 200),
  options   jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 3 and 4),
  unique (quiz_id, position)
);

create table public.quiz_responses (
  couple_id     uuid not null references public.couples (id) on delete cascade,
  quiz_id       bigint not null references public.quizzes (id) on delete cascade,
  question_id   bigint not null references public.quiz_questions (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('self', 'guess')),
  option_index  smallint not null check (option_index >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (couple_id, question_id, user_id, kind)
);

create index quiz_responses_quiz_idx on public.quiz_responses (couple_id, quiz_id);

-- Vraag moet bij de quiz horen en de gekozen optie moet bestaan
create or replace function public.validate_quiz_response()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_quiz bigint;
  v_len  int;
begin
  select quiz_id, jsonb_array_length(options) into v_quiz, v_len
  from public.quiz_questions where id = new.question_id;
  if v_quiz is distinct from new.quiz_id then
    raise exception 'vraag_hoort_niet_bij_quiz';
  end if;
  if new.option_index >= v_len then
    raise exception 'ongeldige_optie';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger quiz_responses_validate
  before insert or update on public.quiz_responses
  for each row execute function public.validate_quiz_response();

-- Heeft deze gebruiker (binnen zijn/haar huidige koppel) alle vragen voor zichzelf én voor de partner ingevuld?
create or replace function public.quiz_completed_by(p_quiz bigint, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*) from public.quiz_responses r
    where r.quiz_id = p_quiz
      and r.user_id = p_user
      and r.couple_id = (select couple_id from public.couple_members where user_id = p_user)
  ) = 2 * (select count(*) from public.quiz_questions q where q.quiz_id = p_quiz)
  and exists (select 1 from public.quiz_questions q where q.quiz_id = p_quiz);
$$;

-- Overzicht voor de quizlijst
create or replace function public.quiz_overview()
returns table (
  quiz_id         bigint,
  slug            text,
  title           text,
  description     text,
  question_count  integer,
  my_progress     integer,
  partner_done    boolean,
  my_score        integer,
  partner_score   integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := public.my_couple_id();
  v_partner uuid := public.my_partner_id();
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_partner is null then
    raise exception 'geen_partner';
  end if;

  return query
  with base as (
    select z.id, z.slug, z.title, z.description, z.position,
           (select count(*)::int from public.quiz_questions q where q.quiz_id = z.id) as qcount,
           (select count(*)::int from public.quiz_responses r
              where r.quiz_id = z.id and r.couple_id = v_couple and r.user_id = v_uid) as progress,
           public.quiz_completed_by(z.id, v_uid) as me_done,
           public.quiz_completed_by(z.id, v_partner) as partner_done
    from public.quizzes z
  )
  select b.id, b.slug, b.title, b.description, b.qcount, b.progress, b.partner_done,
         case when b.me_done and b.partner_done then (
           select count(*)::int
           from public.quiz_responses g
           join public.quiz_responses s
             on s.couple_id = g.couple_id and s.question_id = g.question_id
            and s.user_id = v_partner and s.kind = 'self'
           where g.couple_id = v_couple and g.quiz_id = b.id and g.user_id = v_uid
             and g.kind = 'guess' and g.option_index = s.option_index
         ) end,
         case when b.me_done and b.partner_done then (
           select count(*)::int
           from public.quiz_responses g
           join public.quiz_responses s
             on s.couple_id = g.couple_id and s.question_id = g.question_id
            and s.user_id = v_uid and s.kind = 'self'
           where g.couple_id = v_couple and g.quiz_id = b.id and g.user_id = v_partner
             and g.kind = 'guess' and g.option_index = s.option_index
         ) end
  from base b
  order by b.position;
end;
$$;

-- Volledige uitslag, pas beschikbaar als jullie allebei klaar zijn
create or replace function public.quiz_result(p_quiz bigint)
returns table (
  question_id    bigint,
  "position"     smallint,
  prompt         text,
  options        jsonb,
  my_self        smallint,
  partner_self   smallint,
  my_guess       smallint,
  partner_guess  smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := public.my_couple_id();
  v_partner uuid := public.my_partner_id();
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_partner is null then
    raise exception 'geen_partner';
  end if;
  if not (public.quiz_completed_by(p_quiz, v_uid) and public.quiz_completed_by(p_quiz, v_partner)) then
    raise exception 'quiz_niet_klaar';
  end if;

  return query
  select q.id, q.position, q.prompt, q.options,
    (select r.option_index from public.quiz_responses r where r.couple_id = v_couple and r.question_id = q.id and r.user_id = v_uid and r.kind = 'self'),
    (select r.option_index from public.quiz_responses r where r.couple_id = v_couple and r.question_id = q.id and r.user_id = v_partner and r.kind = 'self'),
    (select r.option_index from public.quiz_responses r where r.couple_id = v_couple and r.question_id = q.id and r.user_id = v_uid and r.kind = 'guess'),
    (select r.option_index from public.quiz_responses r where r.couple_id = v_couple and r.question_id = q.id and r.user_id = v_partner and r.kind = 'guess')
  from public.quiz_questions q
  where q.quiz_id = p_quiz
  order by q.position;
end;
$$;

-------------------------------------------------------------------------------
-- RLS
-------------------------------------------------------------------------------

alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_responses enable row level security;

create policy "quizzen lezen" on public.quizzes for select to authenticated using (true);
create policy "quizvragen lezen" on public.quiz_questions for select to authenticated using (true);

-- Partnerantwoorden pas zichtbaar als je de quiz zelf hebt afgerond (niet spieken)
create policy "quizantwoorden lezen" on public.quiz_responses
  for select to authenticated
  using (
    user_id = auth.uid()
    or (couple_id = public.my_couple_id() and public.quiz_completed_by(quiz_id, auth.uid()))
  );

-- Invullen en aanpassen alleen zolang je zelf nog niet klaar bent
create policy "quizantwoord geven" on public.quiz_responses
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and couple_id = public.my_couple_id()
    and not public.quiz_completed_by(quiz_id, auth.uid())
  );

create policy "quizantwoord aanpassen" on public.quiz_responses
  for update to authenticated
  using (user_id = auth.uid() and not public.quiz_completed_by(quiz_id, auth.uid()))
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());
-- geen delete-policy

revoke execute on function
  public.quiz_completed_by(bigint, uuid),
  public.quiz_overview(),
  public.quiz_result(bigint),
  public.validate_quiz_response()
from public, anon;
grant execute on function
  public.quiz_completed_by(bigint, uuid),
  public.quiz_overview(),
  public.quiz_result(bigint)
to authenticated;

-- ===== 20261021000500_content_quizzes.sql =====
-- Startcontent: 5 quizzen × 10 vragen (origineel geschreven voor Tweeklank).
-- Vragen staan in de ik-vorm: je beantwoordt ze voor jezelf en raadt daarna wat je partner koos.
-- Uitbreiden? Nieuwe migratie met extra rijen; slugs moeten uniek blijven.

insert into public.quizzes (slug, position, title, description) values
  ('qz-dagelijks', 1, 'Dagelijkse dingen', 'Ochtendritme, thuiskomen en kleine gewoontes: hoe goed ken je de gewone dagen van je partner?'),
  ('qz-eten', 2, 'Eten & drinken', 'Van ontbijt tot toetje: weet jij wat er op het bord van je partner hoort?'),
  ('qz-vrijetijd', 3, 'Vrije tijd & reizen', 'Vakanties, hobby''s en vrije dagen: wat maakt je partner blij als er niets hoeft?'),
  ('qz-gevoel', 4, 'Gevoel & karakter', 'Hoe reageert je partner op tegenslag, kritiek of liefde? Deze quiz gaat een laagje dieper.'),
  ('qz-toekomst', 5, 'Dromen & toekomst', 'Waar droomt je partner van? Over wonen, werk, avontuur en later samen.')
on conflict (slug) do nothing;

insert into public.quiz_questions (slug, quiz_id, position, prompt, options)
select v.slug, z.id, v.position, v.prompt, v.options::jsonb
from (values
  ('qz-dagelijks-01', 'qz-dagelijks', 1, 'Hoe begin ik het liefst mijn dag?', '["Rustig, met koffie of thee", "Meteen in actie", "Zo lang mogelijk snoozen", "Met muziek of een podcast"]'),
  ('qz-dagelijks-02', 'qz-dagelijks', 2, 'Wat doe ik als eerste als ik thuiskom?', '["Schoenen uit en op de bank", "Iets te eten pakken", "Mijn telefoon checken", "Vertellen hoe mijn dag was"]'),
  ('qz-dagelijks-03', 'qz-dagelijks', 3, 'Hoe ziet mijn ideale zaterdagavond eruit?', '["Thuis met een film", "Uit eten", "Afspreken met vrienden", "Vroeg naar bed"]'),
  ('qz-dagelijks-04', 'qz-dagelijks', 4, 'Welk huishoudelijk klusje vind ik het vervelendst?', '["Afwassen", "Stofzuigen", "Was opvouwen", "Badkamer schoonmaken"]'),
  ('qz-dagelijks-05', 'qz-dagelijks', 5, 'Hoe ga ik om met mijn wekker?', '["Ik sta meteen op", "Eén keer snoozen", "Meerdere keren snoozen", "Ik ben al wakker voordat hij gaat"]'),
  ('qz-dagelijks-06', 'qz-dagelijks', 6, 'Wat is mijn favoriete moment van de dag?', '["De ochtend", "De middag", "De vroege avond", "Laat op de avond"]'),
  ('qz-dagelijks-07', 'qz-dagelijks', 7, 'Hoe houd ik het liefst contact met vrienden?', '["Appen", "Bellen", "Spontaan langsgaan", "Iets plannen in de agenda"]'),
  ('qz-dagelijks-08', 'qz-dagelijks', 8, 'Waar laat ik meestal mijn sleutels?', '["Altijd op dezelfde plek", "In mijn jaszak", "Overal en nergens", "In mijn tas"]'),
  ('qz-dagelijks-09', 'qz-dagelijks', 9, 'Hoe kom ik het liefst tot rust na een drukke dag?', '["Sporten of wandelen", "Een serie kijken", "Lezen", "Praten met iemand"]'),
  ('qz-dagelijks-10', 'qz-dagelijks', 10, 'Wat zit er bijna altijd in mijn tas of zakken?', '["Iets lekkers", "Oordopjes", "Een oplaadkabel", "Bonnetjes en papiertjes"]'),
  ('qz-eten-01', 'qz-eten', 1, 'Wat bestel ik het liefst als we eten laten bezorgen?', '["Pizza", "Sushi", "Indiaas of Thais", "Friet en snacks"]'),
  ('qz-eten-02', 'qz-eten', 2, 'Hoe drink ik mijn koffie of thee?', '["Zwart of puur", "Met melk", "Met suiker", "Ik drink geen koffie of thee"]'),
  ('qz-eten-03', 'qz-eten', 3, 'Welke maaltijd sla ik als eerste over als ik weinig tijd heb?', '["Ontbijt", "Lunch", "Avondeten", "Ik sla nooit iets over"]'),
  ('qz-eten-04', 'qz-eten', 4, 'Wat is mijn ideale toetje?', '["Iets met chocolade", "Fruit", "IJs", "Kaas"]'),
  ('qz-eten-05', 'qz-eten', 5, 'Hoe sta ik in de keuken?', '["Ik kook graag uitgebreid", "Snel en simpel", "Ik volg het recept precies", "Ik laat het koken liever aan een ander over"]'),
  ('qz-eten-06', 'qz-eten', 6, 'Wat zou ik nooit willen eten?', '["Spruitjes", "Orgaanvlees", "Insecten", "Rauwe oesters"]'),
  ('qz-eten-07', 'qz-eten', 7, 'Wat is mijn favoriete snack bij een film?', '["Popcorn", "Chips", "Snoep", "Nootjes"]'),
  ('qz-eten-08', 'qz-eten', 8, 'Hoe ontbijt ik op een vrije dag?', '["Uitgebreid, met eitjes", "Brood met beleg", "Yoghurt of muesli", "Pas tegen de middag iets"]'),
  ('qz-eten-09', 'qz-eten', 9, 'Welke keuken zou ik elke week kunnen eten?', '["Italiaans", "Mexicaans", "Japans", "Hollandse pot"]'),
  ('qz-eten-10', 'qz-eten', 10, 'Hoe pittig mag mijn eten zijn?', '["Helemaal niet pittig", "Een klein beetje", "Lekker pittig", "Hoe heter hoe beter"]'),
  ('qz-vrijetijd-01', 'qz-vrijetijd', 1, 'Wat is voor mij de ideale vakantie?', '["Strand en zon", "Een stedentrip", "Natuur en wandelen", "Een rondreis"]'),
  ('qz-vrijetijd-02', 'qz-vrijetijd', 2, 'Hoe pak ik mijn koffer in?', '["Dagen van tevoren, met een lijstje", "De avond ervoor", "Op het laatste moment", "Ik neem altijd veel te veel mee"]'),
  ('qz-vrijetijd-03', 'qz-vrijetijd', 3, 'Wat doe ik het liefst op een regenachtige zondag?', '["Spelletjes spelen", "Een film of serie kijken", "Bakken of koken", "Toch naar buiten"]'),
  ('qz-vrijetijd-04', 'qz-vrijetijd', 4, 'Welke sport kijk of doe ik het liefst?', '["Voetbal", "Wielrennen", "Tennis", "Ik heb niet zoveel met sport"]'),
  ('qz-vrijetijd-05', 'qz-vrijetijd', 5, 'Waar zou ik ooit nog naartoe willen reizen?', '["Japan", "IJsland", "Zuid-Amerika", "Zuidelijk Afrika"]'),
  ('qz-vrijetijd-06', 'qz-vrijetijd', 6, 'Wat neem ik altijd mee op vakantie?', '["Een boek", "Een goede camera", "Mijn eigen kussen", "Snacks voor onderweg"]'),
  ('qz-vrijetijd-07', 'qz-vrijetijd', 7, 'Hoe ziet mijn perfecte verjaardag eruit?', '["Een groot feest", "Een etentje met een paar mensen", "Iets onverwachts met z''n tweeën", "Liefst zo min mogelijk aandacht"]'),
  ('qz-vrijetijd-08', 'qz-vrijetijd', 8, 'Welk uitje past het best bij mij?', '["Een muziekfestival", "Een theatervoorstelling", "Een museumnacht", "Een rommelmarkt"]'),
  ('qz-vrijetijd-09', 'qz-vrijetijd', 9, 'Hoe plan ik een dagje uit?', '["Alles tot in detail", "Een globaal idee", "Helemaal spontaan", "Ik laat het plannen aan een ander over"]'),
  ('qz-vrijetijd-10', 'qz-vrijetijd', 10, 'Welke hobby zou ik nog willen oppakken?', '["Een instrument leren spelen", "Schilderen of tekenen", "Een nieuwe taal", "Een nieuwe sport"]'),
  ('qz-gevoel-01', 'qz-gevoel', 1, 'Hoe reageer ik meestal als ik boos ben?', '["Ik zeg het meteen", "Ik trek me even terug", "Ik word stil", "Ik ga iets doen om het kwijt te raken"]'),
  ('qz-gevoel-02', 'qz-gevoel', 2, 'Waarmee maak je me het blijst?', '["Een lief berichtje", "Een kleine verrassing", "Samen tijd doorbrengen", "Een knuffel"]'),
  ('qz-gevoel-03', 'qz-gevoel', 3, 'Wat heb ik nodig als ik verdrietig ben?', '["Iemand die luistert", "Afleiding", "Even alleen zijn", "Hulp bij een oplossing"]'),
  ('qz-gevoel-04', 'qz-gevoel', 4, 'Hoe neem ik grote beslissingen?', '["Op mijn gevoel", "Met een lijstje voor- en nadelen", "Ik vraag iedereen om advies", "Ik stel het zo lang mogelijk uit"]'),
  ('qz-gevoel-05', 'qz-gevoel', 5, 'Waar ben ik het vaakst onzeker over?', '["Mijn uiterlijk", "Mijn werk of studie", "Wat anderen van me vinden", "De toekomst"]'),
  ('qz-gevoel-06', 'qz-gevoel', 6, 'Hoe ga ik om met kritiek?', '["Ik denk er rustig over na", "Ik schiet in de verdediging", "Ik lig er wakker van", "Ik leg het snel naast me neer"]'),
  ('qz-gevoel-07', 'qz-gevoel', 7, 'Wat waardeer ik het meest in een vriendschap?', '["Eerlijkheid", "Humor", "Betrouwbaarheid", "Dat ik mezelf kan zijn"]'),
  ('qz-gevoel-08', 'qz-gevoel', 8, 'Wanneer voel ik me het meest zelfverzekerd?', '["Als ik iets goed heb gedaan", "Als ik me goed voel in mijn lijf", "Als ik me gesteund voel", "Als ik goed voorbereid ben"]'),
  ('qz-gevoel-09', 'qz-gevoel', 9, 'Hoe laat ik het liefst merken dat ik om iemand geef?', '["Met woorden", "Door dingen voor iemand te doen", "Met aanraking", "Met kleine cadeautjes"]'),
  ('qz-gevoel-10', 'qz-gevoel', 10, 'Wat is mijn grootste valkuil?', '["Te veel piekeren", "Ongeduld", "Moeilijk nee kunnen zeggen", "Dingen uitstellen"]'),
  ('qz-toekomst-01', 'qz-toekomst', 1, 'Waar zou ik over tien jaar het liefst wonen?', '["In een stad", "In een dorp", "Aan zee", "In het buitenland"]'),
  ('qz-toekomst-02', 'qz-toekomst', 2, 'Wat doe ik met een onverwachte meevaller van 10.000 euro?', '["Sparen", "Een mooie reis maken", "Iets voor ons huis", "Een deel weggeven"]'),
  ('qz-toekomst-03', 'qz-toekomst', 3, 'Welke baan zou ik kiezen als geld geen rol speelde?', '["Iets creatiefs", "Iets met mensen of zorg", "Iets in de natuur", "Mijn eigen bedrijf"]'),
  ('qz-toekomst-04', 'qz-toekomst', 4, 'Hoe kijk ik naar ouder worden?', '["Ik kijk ernaar uit", "Ik denk er liever niet aan", "Ik vind het spannend", "Ik leef vooral in het nu"]'),
  ('qz-toekomst-05', 'qz-toekomst', 5, 'Welk huis past bij mijn toekomstdroom?', '["Een oud huis met karakter", "Iets moderns en lichts", "Een klein huisje met veel buiten", "Een woonboot"]'),
  ('qz-toekomst-06', 'qz-toekomst', 6, 'Wat wil ik ooit nog bereiken?', '["Een boek schrijven", "Een marathon lopen", "Iets maken dat blijft bestaan", "Een andere taal vloeiend spreken"]'),
  ('qz-toekomst-07', 'qz-toekomst', 7, 'Hoe zou ik later mijn dagen willen vullen?', '["Reizen", "Vrijwilligerswerk", "Tuinieren en klussen", "Veel tijd met familie en vrienden"]'),
  ('qz-toekomst-08', 'qz-toekomst', 8, 'Wat vind ik het belangrijkst in ons leven samen?', '["Avontuur", "Rust en stabiliteit", "Samen groeien", "Veel lachen"]'),
  ('qz-toekomst-09', 'qz-toekomst', 9, 'Welk dier zou ik later graag in huis hebben?', '["Een hond", "Een kat", "Kippen in de tuin", "Liever geen huisdier"]'),
  ('qz-toekomst-10', 'qz-toekomst', 10, 'Hoe zou ik ons jubileum over 25 jaar vieren?', '["Met een groot feest", "Met een reis met z''n tweeën", "Terug naar de plek waar het begon", "Rustig thuis, gewoon wij"]')
) as v(slug, quiz_slug, position, prompt, options)
join public.quizzes z on z.slug = v.quiz_slug
on conflict (slug) do nothing;

-- ===== 20261021000600_cards.sql =====
-- Gesprekskaarten: thema's met vragen, diepgang 1 (luchtig) t/m 3 (diep).
-- Thema's met is_explicit = true (18+) zijn alleen zichtbaar als BEIDE partners
-- zelf opt-in hebben gegeven en hun leeftijd hebben bevestigd.

create table public.themes (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  name         text not null,
  description  text not null,
  icon         text not null,
  is_explicit  boolean not null default false,
  position     integer not null unique
);

create table public.theme_questions (
  id        bigint generated always as identity primary key,
  slug      text not null unique,
  theme_id  bigint not null references public.themes (id) on delete cascade,
  position  smallint not null,
  text      text not null check (char_length(text) between 5 and 300),
  depth     smallint not null check (depth between 1 and 3),
  unique (theme_id, position)
);

create table public.card_marks (
  couple_id    uuid not null references public.couples (id) on delete cascade,
  question_id  bigint not null references public.theme_questions (id) on delete cascade,
  kind         text not null check (kind in ('besproken', 'favoriet')),
  created_by   uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (couple_id, question_id, kind)
);

-- 18+ staat aan voor een koppel als beide leden opt-in hebben gegeven (met leeftijdsbevestiging)
create or replace function public.couple_explicit_enabled(p_couple uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_couple is not null
     and (
       select count(*) from public.couple_members m
       join public.profiles p on p.id = m.user_id
       where m.couple_id = p_couple
         and p.explicit_opt_in
         and p.adult_confirmed_at is not null
     ) = 2;
$$;

create or replace function public.theme_visible(p_theme bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.themes t
    where t.id = p_theme
      and (not t.is_explicit or public.couple_explicit_enabled(public.my_couple_id()))
  );
$$;

alter table public.themes          enable row level security;
alter table public.theme_questions enable row level security;
alter table public.card_marks      enable row level security;

create policy "thema's lezen" on public.themes
  for select to authenticated
  using (not is_explicit or public.couple_explicit_enabled(public.my_couple_id()));

create policy "themavragen lezen" on public.theme_questions
  for select to authenticated
  using (public.theme_visible(theme_id));

create policy "markeringen lezen" on public.card_marks
  for select to authenticated
  using (couple_id = public.my_couple_id());

create policy "markering plaatsen" on public.card_marks
  for insert to authenticated
  with check (
    couple_id = public.my_couple_id()
    and created_by = auth.uid()
    and exists (select 1 from public.theme_questions q where q.id = question_id and public.theme_visible(q.theme_id))
  );

create policy "markering weghalen" on public.card_marks
  for delete to authenticated
  using (couple_id = public.my_couple_id());

revoke execute on function
  public.couple_explicit_enabled(uuid),
  public.theme_visible(bigint)
from public, anon;
grant execute on function
  public.couple_explicit_enabled(uuid),
  public.theme_visible(bigint)
to authenticated;

-- ===== 20261021000700_content_cards.sql =====
-- Startcontent gesprekskaarten (origineel geschreven voor Tweeklank):
-- 8 thema's × 15 vragen (5 luchtig, 5 persoonlijk, 5 diep) + de 18+-set 'Verlangen'.
-- De 18+-set is alleen zichtbaar als beide partners opt-in hebben gegeven (zie RLS in _cards.sql).

insert into public.themes (slug, position, name, description, icon, is_explicit) values
  ('th-dromen', 1, 'Dromen', 'Over wat je hoopt, wilt proberen en stiekem nog eens wilt doen.', 'sparkles-outline', false),
  ('th-nabijheid', 2, 'Nabijheid', 'Over aanraking, tederheid en je gezien voelen.', 'heart-outline', false),
  ('th-geld', 3, 'Geld', 'Over sparen, uitgeven en wat geld voor je betekent.', 'wallet-outline', false),
  ('th-familie', 4, 'Familie', 'Over waar je vandaan komt en wat je daarvan meeneemt.', 'people-outline', false),
  ('th-toekomst', 5, 'Toekomst', 'Over wonen, werken en de jaren die nog komen.', 'compass-outline', false),
  ('th-humor', 6, 'Humor', 'Over lachen, gekke momenten en wat jou aan het gniffelen krijgt.', 'happy-outline', false),
  ('th-onenigheid', 7, 'Onenigheid', 'Over ruzie maken, het weer goedmaken en elkaar beter begrijpen.', 'chatbox-ellipses-outline', false),
  ('th-samenleven', 8, 'Samen leven', 'Over gewoontes, aandacht en de kleine dingen van elke dag.', 'home-outline', false),
  ('th-verlangen', 9, 'Verlangen (18+)', 'Openhartige vragen over seks, fantasieën en grenzen. Alleen zichtbaar als jullie dit allebei hebben aangezet.', 'flame-outline', true)
on conflict (slug) do nothing;

insert into public.theme_questions (slug, theme_id, position, depth, text)
select v.slug, t.id, v.position, v.depth, v.text
from (values
  ('th-dromen-01', 'th-dromen', 1, 1, 'Als je morgen een jaar vrij kreeg met behoud van salaris, wat zou je doen?'),
  ('th-dromen-02', 'th-dromen', 2, 1, 'Welke droom had je als kind over later?'),
  ('th-dromen-03', 'th-dromen', 3, 1, 'In welk land zou je een jaar willen wonen?'),
  ('th-dromen-04', 'th-dromen', 4, 1, 'Met welke bekende persoon zou je een dag willen meelopen?'),
  ('th-dromen-05', 'th-dromen', 5, 1, 'Welk avontuur zou je graag samen met mij beleven?'),
  ('th-dromen-06', 'th-dromen', 6, 2, 'Welke droom heb je nog nooit hardop uitgesproken?'),
  ('th-dromen-07', 'th-dromen', 7, 2, 'Wat zou je proberen als je zeker wist dat het niet kon mislukken?'),
  ('th-dromen-08', 'th-dromen', 8, 2, 'Welke droom van mij zou jij graag helpen waarmaken?'),
  ('th-dromen-09', 'th-dromen', 9, 2, 'Waar dagdroom je de laatste tijd vaak over?'),
  ('th-dromen-10', 'th-dromen', 10, 2, 'Welk talent van jezelf zou je meer ruimte willen geven?'),
  ('th-dromen-11', 'th-dromen', 11, 3, 'Welke droom heb je opgegeven, en hoe kijk je daar nu op terug?'),
  ('th-dromen-12', 'th-dromen', 12, 3, 'Wat houdt je tegen om aan je grootste droom te beginnen?'),
  ('th-dromen-13', 'th-dromen', 13, 3, 'Hoe zou je leven eruitzien als je alleen naar je hart luisterde?'),
  ('th-dromen-14', 'th-dromen', 14, 3, 'Welke droom heb je die ons allebei zou veranderen?'),
  ('th-dromen-15', 'th-dromen', 15, 3, 'Wat wil je dat mensen later over jou zeggen?'),
  ('th-nabijheid-01', 'th-nabijheid', 1, 1, 'Waar lig je het liefst dicht tegen me aan: op de bank, in bed of ergens anders?'),
  ('th-nabijheid-02', 'th-nabijheid', 2, 1, 'Welke kleine aanraking van mij vind je heerlijk?'),
  ('th-nabijheid-03', 'th-nabijheid', 3, 1, 'Wat was ons mooiste romantische moment tot nu toe?'),
  ('th-nabijheid-04', 'th-nabijheid', 4, 1, 'Welk liedje doet je aan ons denken?'),
  ('th-nabijheid-05', 'th-nabijheid', 5, 1, 'Waar zou je graag een romantisch weekend met mij doorbrengen?'),
  ('th-nabijheid-06', 'th-nabijheid', 6, 2, 'Wanneer voel je je het meest aantrekkelijk?'),
  ('th-nabijheid-07', 'th-nabijheid', 7, 2, 'Wat doe ik waardoor jij je geliefd voelt?'),
  ('th-nabijheid-08', 'th-nabijheid', 8, 2, 'Hoe laat jij het liefst merken dat je behoefte hebt aan nabijheid?'),
  ('th-nabijheid-09', 'th-nabijheid', 9, 2, 'Wat zouden we vaker kunnen doen om dichter bij elkaar te komen?'),
  ('th-nabijheid-10', 'th-nabijheid', 10, 2, 'Wanneer voelde je je de afgelopen tijd echt gezien door mij?'),
  ('th-nabijheid-11', 'th-nabijheid', 11, 3, 'Wat vind je moeilijk om te vragen als het om nabijheid gaat?'),
  ('th-nabijheid-12', 'th-nabijheid', 12, 3, 'Hoe houden we het bespreekbaar als onze behoeften verschillen?'),
  ('th-nabijheid-13', 'th-nabijheid', 13, 3, 'Wat heb je nodig om je helemaal veilig bij mij te voelen?'),
  ('th-nabijheid-14', 'th-nabijheid', 14, 3, 'Is er iets in onze intimiteit dat je zou willen veranderen?'),
  ('th-nabijheid-15', 'th-nabijheid', 15, 3, 'Hoe is jouw kijk op intimiteit veranderd sinds je mij kent?'),
  ('th-geld-01', 'th-geld', 1, 1, 'Wat is de beste aankoop die je ooit hebt gedaan?'),
  ('th-geld-02', 'th-geld', 2, 1, 'Ben jij eerder een spaarder of een uitgever?'),
  ('th-geld-03', 'th-geld', 3, 1, 'Wat zou je kopen als je morgen 500 euro vond?'),
  ('th-geld-04', 'th-geld', 4, 1, 'Waaraan gaf je als kind je zakgeld uit?'),
  ('th-geld-05', 'th-geld', 5, 1, 'Aan welke kleine luxe geef je graag geld uit?'),
  ('th-geld-06', 'th-geld', 6, 2, 'Hoe werd er bij jou thuis vroeger over geld gepraat?'),
  ('th-geld-07', 'th-geld', 7, 2, 'Waar maak jij je wel eens zorgen over als het om geld gaat?'),
  ('th-geld-08', 'th-geld', 8, 2, 'Vanaf welk bedrag wil je een aankoop eerst samen bespreken?'),
  ('th-geld-09', 'th-geld', 9, 2, 'Waarvoor zou je graag samen willen sparen?'),
  ('th-geld-10', 'th-geld', 10, 2, 'Hoe voelt het voor jou om geld te lenen of uit te lenen?'),
  ('th-geld-11', 'th-geld', 11, 3, 'Wat betekent financiële zekerheid voor jou?'),
  ('th-geld-12', 'th-geld', 12, 3, 'Hoe verdelen we het eerlijk als een van ons meer verdient?'),
  ('th-geld-13', 'th-geld', 13, 3, 'Welke angst rond geld neem je mee uit je verleden?'),
  ('th-geld-14', 'th-geld', 14, 3, 'Hoe zouden we omgaan met een flinke financiële tegenvaller?'),
  ('th-geld-15', 'th-geld', 15, 3, 'Wat wil je met geld bereiken, voor ons en voor anderen?'),
  ('th-familie-01', 'th-familie', 1, 1, 'Welke familietraditie vond je vroeger het leukst?'),
  ('th-familie-02', 'th-familie', 2, 1, 'Op welk familielid lijk jij het meest?'),
  ('th-familie-03', 'th-familie', 3, 1, 'Wat was het lekkerste gerecht bij jullie thuis?'),
  ('th-familie-04', 'th-familie', 4, 1, 'Welk familieverhaal wordt altijd weer verteld?'),
  ('th-familie-05', 'th-familie', 5, 1, 'Hoe vierden jullie thuis verjaardagen?'),
  ('th-familie-06', 'th-familie', 6, 2, 'Wat heb je van je ouders meegekregen waar je dankbaar voor bent?'),
  ('th-familie-07', 'th-familie', 7, 2, 'Welke rol had jij in je gezin toen je opgroeide?'),
  ('th-familie-08', 'th-familie', 8, 2, 'Hoe vaak zou je je familie het liefst zien?'),
  ('th-familie-09', 'th-familie', 9, 2, 'Wat vind je lastig aan feestdagen met familie?'),
  ('th-familie-10', 'th-familie', 10, 2, 'Welke traditie uit jouw familie wil je zeker doorgeven?'),
  ('th-familie-11', 'th-familie', 11, 3, 'Wat wil je juist anders doen dan je ouders deden?'),
  ('th-familie-12', 'th-familie', 12, 3, 'Is er iets in je familie dat nog pijn doet?'),
  ('th-familie-13', 'th-familie', 13, 3, 'Hoe kunnen we elkaar steunen als het met onze families schuurt?'),
  ('th-familie-14', 'th-familie', 14, 3, 'Wat betekent familie voor jou, los van bloedbanden?'),
  ('th-familie-15', 'th-familie', 15, 3, 'Hoe zie jij de zorg voor onze ouders als ze ouder worden?'),
  ('th-toekomst-01', 'th-toekomst', 1, 1, 'Hoe zie je ons over vijf jaar op een zondagochtend?'),
  ('th-toekomst-02', 'th-toekomst', 2, 1, 'Hoe ziet ons huis er in jouw dromen uit?'),
  ('th-toekomst-03', 'th-toekomst', 3, 1, 'Welke reis moeten we zeker nog samen maken?'),
  ('th-toekomst-04', 'th-toekomst', 4, 1, 'Welk huisdier zou je ooit willen hebben?'),
  ('th-toekomst-05', 'th-toekomst', 5, 1, 'Wat wil je volgend jaar voor het eerst doen?'),
  ('th-toekomst-06', 'th-toekomst', 6, 2, 'Hoe belangrijk is werk voor jou over tien jaar?'),
  ('th-toekomst-07', 'th-toekomst', 7, 2, 'Waar zou je het liefst oud worden?'),
  ('th-toekomst-08', 'th-toekomst', 8, 2, 'Welke gewoonte willen we over twintig jaar nog steeds hebben?'),
  ('th-toekomst-09', 'th-toekomst', 9, 2, 'Wat moet er gebeuren voordat je echt tevreden bent met je leven?'),
  ('th-toekomst-10', 'th-toekomst', 10, 2, 'Hoe denk je over kinderen, of over het leven dat we nu samen hebben?'),
  ('th-toekomst-11', 'th-toekomst', 11, 3, 'Waar ben je onzeker over als je aan onze toekomst denkt?'),
  ('th-toekomst-12', 'th-toekomst', 12, 3, 'Wat zou je doen als een van ons ver weg een droombaan kreeg?'),
  ('th-toekomst-13', 'th-toekomst', 13, 3, 'Hoe blijven we elkaar verrassen als het leven gewoon wordt?'),
  ('th-toekomst-14', 'th-toekomst', 14, 3, 'Wat wil je echt bereikt hebben als je later terugkijkt?'),
  ('th-toekomst-15', 'th-toekomst', 15, 3, 'Hoe willen we omgaan met tegenslag die we nu nog niet kennen?'),
  ('th-humor-01', 'th-humor', 1, 1, 'Welk filmpje kun je nog steeds niet zonder lachen bekijken?'),
  ('th-humor-02', 'th-humor', 2, 1, 'Wat is het gekste dat je ooit voor een weddenschap hebt gedaan?'),
  ('th-humor-03', 'th-humor', 3, 1, 'Welk moment met mij was achteraf hilarisch?'),
  ('th-humor-04', 'th-humor', 4, 1, 'Welke grap vertel jij steeds opnieuw?'),
  ('th-humor-05', 'th-humor', 5, 1, 'Wie in je omgeving maakt jou het hardst aan het lachen?'),
  ('th-humor-06', 'th-humor', 6, 2, 'Waar kun jij om lachen terwijl anderen het helemaal niet grappig vinden?'),
  ('th-humor-07', 'th-humor', 7, 2, 'Wat is je meest gênante moment ooit?'),
  ('th-humor-08', 'th-humor', 8, 2, 'Wanneer moest je lachen terwijl het echt niet kon?'),
  ('th-humor-09', 'th-humor', 9, 2, 'Welke eigenaardigheid van mij vind je eigenlijk best grappig?'),
  ('th-humor-10', 'th-humor', 10, 2, 'Hoe kan ik jou het snelst opvrolijken?'),
  ('th-humor-11', 'th-humor', 11, 3, 'Wanneer helpt humor jou om iets moeilijks te dragen?'),
  ('th-humor-12', 'th-humor', 12, 3, 'Wanneer was een grap van mij eigenlijk niet zo leuk voor jou?'),
  ('th-humor-13', 'th-humor', 13, 3, 'Lach jij wel eens om te verbergen hoe je je echt voelt?'),
  ('th-humor-14', 'th-humor', 14, 3, 'Hoe houden we het luchtig als het tussen ons even zwaar is?'),
  ('th-humor-15', 'th-humor', 15, 3, 'Welk moment van samen lachen zou je nooit willen vergeten?'),
  ('th-onenigheid-01', 'th-onenigheid', 1, 1, 'Waarover hebben wij de gekste discussie ooit gehad?'),
  ('th-onenigheid-02', 'th-onenigheid', 2, 1, 'Hoe koel jij het liefst af na een irritatie?'),
  ('th-onenigheid-03', 'th-onenigheid', 3, 1, 'Over welk klein ding in huis verschillen wij het vaakst van mening?'),
  ('th-onenigheid-04', 'th-onenigheid', 4, 1, 'Ben jij snel boos en snel weer goed, of duurt het bij jou langer?'),
  ('th-onenigheid-05', 'th-onenigheid', 5, 1, 'Wat is voor jou een lief gebaar om het weer goed te maken?'),
  ('th-onenigheid-06', 'th-onenigheid', 6, 2, 'Hoe werd er bij jou thuis ruziegemaakt?'),
  ('th-onenigheid-07', 'th-onenigheid', 7, 2, 'Wat heb je van mij nodig als je boos bent?'),
  ('th-onenigheid-08', 'th-onenigheid', 8, 2, 'Welke opmerking van mij raakt je meer dan ik misschien doorheb?'),
  ('th-onenigheid-09', 'th-onenigheid', 9, 2, 'Hoe merk ik het best dat je ergens mee zit?'),
  ('th-onenigheid-10', 'th-onenigheid', 10, 2, 'Wat helpt jou om sorry te zeggen?'),
  ('th-onenigheid-11', 'th-onenigheid', 11, 3, 'Over welk onderwerp durf je eigenlijk niet goed met mij in discussie te gaan?'),
  ('th-onenigheid-12', 'th-onenigheid', 12, 3, 'Van welke ruzie tussen ons heb je het meest geleerd?'),
  ('th-onenigheid-13', 'th-onenigheid', 13, 3, 'Wat zou je willen dat ik doe als ik boos op je ben?'),
  ('th-onenigheid-14', 'th-onenigheid', 14, 3, 'Hoe kunnen we een ruzie stoppen voordat die uit de hand loopt?'),
  ('th-onenigheid-15', 'th-onenigheid', 15, 3, 'Is er iets waarvoor je me nog niet helemaal hebt vergeven?'),
  ('th-samenleven-01', 'th-samenleven', 1, 1, 'Wat is jouw favoriete gewoonte van ons samen?'),
  ('th-samenleven-02', 'th-samenleven', 2, 1, 'Wie van ons is de ochtendmens en wie de avondmens?'),
  ('th-samenleven-03', 'th-samenleven', 3, 1, 'Wat is het leukste dat we de afgelopen maand samen hebben gedaan?'),
  ('th-samenleven-04', 'th-samenleven', 4, 1, 'Welk klusje doe je stiekem graag voor mij?'),
  ('th-samenleven-05', 'th-samenleven', 5, 1, 'Hoe ziet onze perfecte doordeweekse avond eruit?'),
  ('th-samenleven-06', 'th-samenleven', 6, 2, 'Wanneer voel je je op een gewone dag het meest verbonden met mij?'),
  ('th-samenleven-07', 'th-samenleven', 7, 2, 'Hoe verdelen we de taken in huis, en voelt dat eerlijk voor jou?'),
  ('th-samenleven-08', 'th-samenleven', 8, 2, 'Hoeveel tijd voor jezelf heb je nodig om je goed te voelen?'),
  ('th-samenleven-09', 'th-samenleven', 9, 2, 'Wat zou je willen dat ik vaker vraag over jouw dag?'),
  ('th-samenleven-10', 'th-samenleven', 10, 2, 'Welk moment van de dag zouden we beter samen kunnen benutten?'),
  ('th-samenleven-11', 'th-samenleven', 11, 3, 'Wanneer voel je je naast mij toch alleen?'),
  ('th-samenleven-12', 'th-samenleven', 12, 3, 'Wat vind je moeilijk aan samenleven, als je eerlijk bent?'),
  ('th-samenleven-13', 'th-samenleven', 13, 3, 'Hoe blijven we elkaar zien als het leven druk wordt?'),
  ('th-samenleven-14', 'th-samenleven', 14, 3, 'Wat heb je van mij nodig om je echt thuis te voelen?'),
  ('th-samenleven-15', 'th-samenleven', 15, 3, 'Wat is iets kleins dat ik kan doen en dat voor jou veel betekent?'),
  ('th-verlangen-01', 'th-verlangen', 1, 1, 'Op welk moment van de dag heb jij het vaakst zin in seks?'),
  ('th-verlangen-02', 'th-verlangen', 2, 1, 'Wat is voor jou het lekkerste begin van een vrijpartij?'),
  ('th-verlangen-03', 'th-verlangen', 3, 1, 'Welke plek in huis, behalve het bed, vind je spannend om te vrijen?'),
  ('th-verlangen-04', 'th-verlangen', 4, 1, 'Wat vind je aantrekkelijk aan mijn lichaam?'),
  ('th-verlangen-05', 'th-verlangen', 5, 1, 'In welk kledingstuk vind je mij sexy?'),
  ('th-verlangen-06', 'th-verlangen', 6, 2, 'Wat zou je graag vaker willen in ons seksleven?'),
  ('th-verlangen-07', 'th-verlangen', 7, 2, 'Hoe laat je mij het liefst weten dat je zin hebt?'),
  ('th-verlangen-08', 'th-verlangen', 8, 2, 'Is er iets wat je ooit samen zou willen uitproberen in bed?'),
  ('th-verlangen-09', 'th-verlangen', 9, 2, 'Aan welke vrijpartij van ons denk je nog vaak terug?'),
  ('th-verlangen-10', 'th-verlangen', 10, 2, 'Hoe belangrijk is voorspel voor jou, en wat maakt het goed?'),
  ('th-verlangen-11', 'th-verlangen', 11, 3, 'Heb je een fantasie die je nog nooit met mij hebt gedeeld?'),
  ('th-verlangen-12', 'th-verlangen', 12, 3, 'Waar liggen jouw grenzen, en hoe wil je dat ik daarmee omga?'),
  ('th-verlangen-13', 'th-verlangen', 13, 3, 'Hoe maken we het makkelijker om ''nee'' of ''nu even niet'' te zeggen?'),
  ('th-verlangen-14', 'th-verlangen', 14, 3, 'Wat maakt het voor jou lastig om over seks te praten?'),
  ('th-verlangen-15', 'th-verlangen', 15, 3, 'Hoe houden we ons seksleven levendig als we ouder worden?')
) as v(slug, theme_slug, position, depth, text)
join public.themes t on t.slug = v.theme_slug
on conflict (slug) do nothing;

-- ===== 20261021000800_exercises.sql =====
-- Oefeningen & tips: korte oefeningen die je samen doet, en een gedeeld logboek.

create table public.exercises (
  id        bigint generated always as identity primary key,
  slug      text not null unique,
  position  integer not null unique,
  title     text not null,
  category  text not null check (category in ('communicatie', 'waardering', 'conflict', 'verbinding')),
  minutes   smallint not null check (minutes between 1 and 240),
  intro     text not null,
  steps     jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 2 and 8),
  why       text not null
);

create table public.exercise_completions (
  id            bigint generated always as identity primary key,
  couple_id     uuid not null references public.couples (id) on delete cascade,
  exercise_id   bigint not null references public.exercises (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  completed_at  timestamptz not null default now(),
  note          text check (char_length(btrim(note)) between 1 and 500)
);

create index exercise_completions_couple_idx on public.exercise_completions (couple_id, exercise_id);

alter table public.exercises            enable row level security;
alter table public.exercise_completions enable row level security;

create policy "oefeningen lezen" on public.exercises
  for select to authenticated using (true);

create policy "logboek lezen" on public.exercise_completions
  for select to authenticated
  using (couple_id = public.my_couple_id());

create policy "oefening afvinken" on public.exercise_completions
  for insert to authenticated
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());

create policy "eigen afvinking weghalen" on public.exercise_completions
  for delete to authenticated
  using (user_id = auth.uid() and couple_id = public.my_couple_id());

-- ===== 20261021000900_content_exercises.sql =====
-- Startcontent: 12 oefeningen, in eigen woorden gebaseerd op algemeen bekende inzichten uit de relatiepsychologie.
-- Geen therapie: bij ernstige problemen is hulp van een professional verstandig.

insert into public.exercises (slug, position, title, category, minutes, intro, steps, why) values
  ('ex-luisteren', 1, 'Echt luisteren', 'communicatie', 15, 'Om de beurt vertellen en luisteren, zonder te onderbreken.', '["Spreek af wie begint. Die vertelt vijf minuten over iets wat hem of haar bezighoudt.", "De ander luistert alleen: geen advies, geen eigen verhaal. Knikken en doorvragen mag wel.", "Vat daarna in je eigen woorden samen wat je hoorde en vraag: ''Klopt dat?''", "Wissel van rol."]'::jsonb, 'Je voelt je pas begrepen als je merkt dat de ander je verhaal echt heeft gehoord. Samenvatten maakt dat zichtbaar en voorkomt misverstanden.'),
  ('ex-ikboodschap', 2, 'Zeg het vanuit jezelf', 'communicatie', 10, 'Een ergernis bespreekbaar maken zonder dat het als een aanval klinkt.', '["Denk aan een kleine ergernis van de afgelopen week.", "Maak er een zin van: ''Ik voel me … als … omdat … Ik zou graag …''", "Zeg je zin tegen je partner. Die luistert en zegt alleen: ''Dank je, ik hoor je.''", "Wissel van rol en bespreek daarna hoe het voelde."]'::jsonb, 'Een zin die met ''jij'' begint, klinkt al snel als een verwijt. Praten vanuit jezelf nodigt uit tot begrip in plaats van verdediging.'),
  ('ex-waardering', 3, 'Drie dingen van vandaag', 'waardering', 5, 'Elke avond even stilstaan bij wat goed ging.', '["Neem ''s avonds een rustig moment samen.", "Noem allebei drie dingen die je vandaag in de ander waardeerde, hoe klein ook.", "Wees concreet: niet ''je bent lief'', maar ''fijn dat je koffie voor me zette''.", "Houd dit een week lang vol."]'::jsonb, 'Aandacht voor wat goed gaat, zet kleine irritaties in perspectief. Concrete waardering voelt bovendien echter dan een algemeen compliment.'),
  ('ex-timeout', 4, 'Even pauze', 'conflict', 20, 'Een afgesproken manier om een ruzie te onderbreken voordat die uit de hand loopt.', '["Spreek nu, op een rustig moment, een stopwoord of gebaar af.", "Merkt een van jullie tijdens een ruzie dat het te hoog oploopt? Gebruik dan het stopwoord. Jullie stoppen allebei, zonder laatste woord.", "Neem minstens twintig minuten voor jezelf. Doe iets rustgevends en speel de ruzie niet opnieuw af in je hoofd.", "Kom op een afgesproken tijd terug en begin met de vraag: ''Wat had je eigenlijk nodig?''"]'::jsonb, 'Bij hevige emoties luister je slecht en zeg je dingen die je niet meent. Een pauze geeft je lichaam tijd om te kalmeren, zodat je daarna wel tot elkaar komt.'),
  ('ex-herstel', 5, 'Het weer goedmaken', 'conflict', 10, 'Samen een manier vinden om na onenigheid weer naar elkaar toe te komen.', '["Denk allebei terug aan een recente onenigheid.", "Vertel wat je zelf anders had kunnen doen. Alleen over jezelf, niet over de ander.", "Bedenk samen een zinnetje of gebaar waarmee je midden in een ruzie laat merken: ''Ik wil hier samen uitkomen.''", "Spreek af dat jullie zo''n poging altijd serieus nemen, ook als je nog boos bent."]'::jsonb, 'Ruzie hoort bij elke relatie. Het verschil zit in hoe snel en hoe goed je het weer goedmaakt. Een afgesproken gebaar maakt die eerste stap makkelijker.'),
  ('ex-weekgesprek', 6, 'Hoe gaat het met ons?', 'verbinding', 30, 'Een vast moment in de week om bij te praten over jullie relatie.', '["Kies een vast moment in de week, bijvoorbeeld zondagavond.", "Begin met wat er deze week goed ging en wat je in de ander waardeerde.", "Bespreek daarna één ding dat beter kan en kies samen een kleine, concrete stap.", "Kijk vooruit: wat staat er volgende week op de planning en waarbij heb je elkaar nodig?", "Sluit af met iets leuks om naar uit te kijken."]'::jsonb, 'Kleine irritaties groeien als je ze laat liggen. Een vast moment maakt het normaal om ze te bespreken voordat ze groot worden.'),
  ('ex-wens', 7, 'Een wens in plaats van een verwijt', 'communicatie', 10, 'Ontdekken welke wens er achter een verwijt zit.', '["Schrijf allebei een verwijt op dat je de ander wel eens maakt, zoals ''Je helpt nooit met koken''.", "Zoek de wens erachter: wat zou je eigenlijk graag willen?", "Maak er een concreet verzoek van, zoals: ''Wil jij op woensdag koken?''", "Lees je verzoeken aan elkaar voor en spreek af wat haalbaar is."]'::jsonb, 'Achter bijna elk verwijt zit een wens. Spreek je die wens uit, dan weet de ander wat hij of zij kan doen, in plaats van zich alleen aangevallen te voelen.'),
  ('ex-knuffel', 8, 'Een lange knuffel', 'verbinding', 2, 'Een dagelijks moment om even samen te landen.', '["Spreek af om elkaar vandaag minstens één keer twintig seconden lang te knuffelen.", "Laat niet eerder los, ook als het even ongemakkelijk voelt.", "Let op je ademhaling en probeer samen rustiger te ademen.", "Maak er een vast ritueel van, bijvoorbeeld bij thuiskomen."]'::jsonb, 'Een korte knuffel is een groet. Een lange knuffel geeft je lichaam de kans om echt te ontspannen en voelt als even samen thuiskomen.'),
  ('ex-briefje', 9, 'Een dankbaarheidsbriefje', 'waardering', 15, 'Op papier zetten wat je de ander niet vaak genoeg zegt.', '["Pak allebei pen en papier, of een notitie op je telefoon.", "Schrijf een kort briefje over iets wat de ander voor je heeft betekend, nu of vroeger.", "Wees specifiek: wat deed de ander, en wat deed dat met jou?", "Lees het briefje voor, of verstop het ergens waar de ander het later vindt."]'::jsonb, 'Op papier zeg je soms makkelijker wat je in het dagelijks leven vergeet te zeggen. Een briefje kun je bovendien bewaren en teruglezen.'),
  ('ex-schermvrij', 10, 'Een uur zonder schermen', 'verbinding', 60, 'Een uur echte aandacht voor elkaar.', '["Kies een avond deze week en leg allebei je telefoon een uur in een andere kamer.", "Bedenk vooraf iets om samen te doen: koken, wandelen, een spelletje of gewoon praten.", "Wil je toch naar je telefoon grijpen? Zeg het hardop en lach erom.", "Vertel elkaar na afloop hoe het voelde."]'::jsonb, 'Schermen trekken ongemerkt veel aandacht weg. Een uur zonder geeft ruimte aan de kleine gesprekken die anders niet ontstaan.'),
  ('ex-stress', 11, 'Stress van de dag delen', 'communicatie', 20, 'Elkaar steunen bij wat er buiten jullie relatie speelt.', '["Vertel om de beurt wat je vandaag stress gaf, los van jullie relatie: werk, familie of iets anders.", "Wie luistert, staat aan jouw kant en toont begrip. Geen advies, tenzij je erom vraagt.", "Vraag aan het eind: ''Wat zou je nu helpen?''", "Wissel van rol."]'::jsonb, 'Als je stress van buitenaf samen bespreekt, voel je je een team. Begrip helpt meestal meer dan een snelle oplossing.'),
  ('ex-toekomstdroom', 12, 'Een droom voor ons samen', 'verbinding', 30, 'Samen vooruitkijken en één eerste stap zetten.', '["Bedenk allebei een droom voor jullie samen, over vijf jaar.", "Vertel je droom zo levendig mogelijk: waar zijn jullie, wat doen jullie en hoe voelt het?", "Vraag door op de droom van de ander: waarom is dit zo belangrijk voor je?", "Kies samen één kleine stap die jullie deze maand al in die richting kunnen zetten."]'::jsonb, 'Gedeelde dromen geven richting en verbinding. Door ze uit te spreken, ontdek je ook wat de ander echt belangrijk vindt.')
on conflict (slug) do nothing;

-- ===== 20261021001000_together.sql =====
-- Samen plannen: date-ideeën (content), een gedeelde plannenlijst en belangrijke datums met herinneringen.

-------------------------------------------------------------------------------
-- Date-ideeën (content)
-------------------------------------------------------------------------------

create table public.date_ideas (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  position     integer not null unique,
  title        text not null,
  description  text not null,
  budget       text not null check (budget in ('gratis', '€', '€€', '€€€')),
  setting      text not null check (setting in ('binnen', 'buiten')),
  minutes      integer not null check (minutes between 15 and 4320)
);

-------------------------------------------------------------------------------
-- Gedeelde plannen
-------------------------------------------------------------------------------

create table public.plans (
  id            bigint generated always as identity primary key,
  couple_id     uuid not null references public.couples (id) on delete cascade,
  created_by    uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  notes         text check (char_length(notes) <= 1000),
  date_idea_id  bigint references public.date_ideas (id) on delete set null,
  planned_for   date,
  done          boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index plans_couple_idx on public.plans (couple_id);

create trigger plans_touch
  before update on public.plans
  for each row execute function public.touch_updated_at();

-------------------------------------------------------------------------------
-- Belangrijke datums
-------------------------------------------------------------------------------

create table public.important_dates (
  id                  bigint generated always as identity primary key,
  couple_id           uuid not null references public.couples (id) on delete cascade,
  created_by          uuid not null references public.profiles (id) on delete cascade,
  title               text not null check (char_length(btrim(title)) between 1 and 80),
  kind                text not null check (kind in ('jubileum', 'verjaardag', 'anders')),
  date                date not null,
  yearly              boolean not null default true,
  remind_days_before  smallint not null default 1 check (remind_days_before in (0, 1, 3, 7, 14)),
  created_at          timestamptz not null default now()
);

create index important_dates_couple_idx on public.important_dates (couple_id);

-- Dezelfde datum in een bepaald jaar; 29 februari valt in een gewoon jaar op 28 februari.
create or replace function public.date_in_year(p_date date, p_year int)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(
    p_year,
    extract(month from p_date)::int,
    least(
      extract(day from p_date)::int,
      extract(day from (make_date(p_year, extract(month from p_date)::int, 1) + interval '1 month - 1 day'))::int
    )
  );
$$;

-- Eerstvolgende keer (vandaag of later) dat een datum valt; null als een eenmalige datum voorbij is.
create or replace function public.next_occurrence(p_date date, p_yearly boolean, p_today date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_date >= p_today then p_date
    when not p_yearly then null
    when public.date_in_year(p_date, extract(year from p_today)::int) >= p_today
      then public.date_in_year(p_date, extract(year from p_today)::int)
    else public.date_in_year(p_date, extract(year from p_today)::int + 1)
  end;
$$;

-- Wie krijgt vandaag een herinnering? (alleen voor de Edge Function, via service_role)
create or replace function public.push_targets_date_reminders(p_today date default public.ams_today())
returns table (token text, title text, kind text, days_until integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.token, d.title, d.kind, (n.next - p_today)::int
  from public.important_dates d
  cross join lateral (select public.next_occurrence(d.date, d.yearly, p_today) as next) n
  join public.couple_members m on m.couple_id = d.couple_id
  join public.profiles p on p.id = m.user_id and p.notify_dates
  join public.push_tokens t on t.user_id = m.user_id
  where n.next is not null
    and (n.next - p_today = d.remind_days_before or n.next = p_today);
$$;

-------------------------------------------------------------------------------
-- RLS
-------------------------------------------------------------------------------

alter table public.date_ideas      enable row level security;
alter table public.plans           enable row level security;
alter table public.important_dates enable row level security;

create policy "date-ideeën lezen" on public.date_ideas for select to authenticated using (true);

create policy "plannen lezen" on public.plans
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "plan toevoegen" on public.plans
  for insert to authenticated with check (couple_id = public.my_couple_id() and created_by = auth.uid());
create policy "plan aanpassen" on public.plans
  for update to authenticated using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
create policy "plan verwijderen" on public.plans
  for delete to authenticated using (couple_id = public.my_couple_id());

create policy "datums lezen" on public.important_dates
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "datum toevoegen" on public.important_dates
  for insert to authenticated with check (couple_id = public.my_couple_id() and created_by = auth.uid());
create policy "datum aanpassen" on public.important_dates
  for update to authenticated using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
create policy "datum verwijderen" on public.important_dates
  for delete to authenticated using (couple_id = public.my_couple_id());

-- Alleen inhoudelijke kolommen zijn aanpasbaar (niet het koppel of de maker)
revoke update on public.plans, public.important_dates from anon, authenticated;
grant update (title, notes, date_idea_id, planned_for, done) on public.plans to authenticated;
grant update (title, kind, date, yearly, remind_days_before) on public.important_dates to authenticated;

revoke execute on function
  public.date_in_year(date, int),
  public.next_occurrence(date, boolean, date),
  public.push_targets_date_reminders(date)
from public, anon;
grant execute on function public.date_in_year(date, int), public.next_occurrence(date, boolean, date) to authenticated;
revoke execute on function public.push_targets_date_reminders(date) from authenticated;
grant execute on function public.push_targets_date_reminders(date) to service_role;

-- ===== 20261021001100_content_date_ideas.sql =====
-- Startcontent: date-ideeën (origineel geschreven voor Tweeklank).

insert into public.date_ideas (slug, position, title, description, budget, setting, minutes) values
  ('di-01', 1, 'Picknick in het park', 'Neem allebei één verrassing mee voor in de mand.', 'gratis', 'buiten', 120),
  ('di-02', 2, 'Zonsopkomst kijken', 'Zet de wekker vroeg, neem een thermoskan mee en zoek een plek met uitzicht.', 'gratis', 'buiten', 90),
  ('di-03', 3, 'Samen een nieuw recept koken', 'Kies een keuken die jullie nog nooit samen hebben gekookt.', '€', 'binnen', 120),
  ('di-04', 4, 'Spelletjesavond', 'Haal een oud bordspel tevoorschijn of leer samen een nieuw kaartspel.', 'gratis', 'binnen', 120),
  ('di-05', 5, 'Fietstocht met koffiestop', 'Kies een dorp in de buurt waar jullie nooit komen en fiets erheen voor koffie met iets lekkers.', '€', 'buiten', 180),
  ('di-06', 6, 'Museumbezoek', 'Kies allebei één kunstwerk dat je de ander wilt laten zien, en vertel waarom.', '€€', 'binnen', 150),
  ('di-07', 7, 'Filmavond met thema', 'Kies een thema, kook iets wat erbij past en kijk twee films achter elkaar.', '€', 'binnen', 240),
  ('di-08', 8, 'Sterren kijken', 'Zoek een donkere plek buiten de stad, neem een kleed mee en gebruik een sterrenkaart-app.', 'gratis', 'buiten', 90),
  ('di-09', 9, 'Samen een workshop volgen', 'Pottenbakken, salsa of brood bakken: iets wat voor jullie allebei nieuw is.', '€€€', 'binnen', 180),
  ('di-10', 10, 'Oude foto''s bekijken', 'Kies foto''s van voordat jullie elkaar kenden en vertel de verhalen erachter.', 'gratis', 'binnen', 60),
  ('di-11', 11, 'Ontbijt op bed', 'Om de beurt: de een verrast, de ander mag uitslapen.', '€', 'binnen', 60),
  ('di-12', 12, 'Wandelen zonder doel', 'Kies bij elk kruispunt om de beurt links of rechts en kijk waar jullie uitkomen.', 'gratis', 'buiten', 90),
  ('di-13', 13, 'Kringloop-uitdaging', 'Geef elkaar tien euro en zoek in de kringloopwinkel het leukste cadeautje voor de ander.', '€', 'binnen', 90),
  ('di-14', 14, 'Een nieuwe sport proberen', 'Probeer iets wat geen van beiden kent, zoals boulderen of suppen.', '€€', 'buiten', 120),
  ('di-15', 15, 'Dansen in de woonkamer', 'Maak samen een afspeellijst met liedjes die iets voor jullie betekenen.', 'gratis', 'binnen', 45),
  ('di-16', 16, 'Een dag naar zee', 'Ook in de winter: uitwaaien, warme chocolademelk en vis eten.', '€€', 'buiten', 360),
  ('di-17', 17, 'Een brief aan later', 'Schrijf samen een brief aan jullie zelf over vijf jaar en bewaar hem goed.', 'gratis', 'binnen', 60),
  ('di-18', 18, 'Concert in een klein zaaltje', 'Kies een band of artiest die jullie allebei nog niet kennen.', '€€', 'binnen', 180),
  ('di-19', 19, 'Proeverij thuis', 'Proef blind vijf soorten chocolade, kaas of thee en geef ze een cijfer.', '€', 'binnen', 60),
  ('di-20', 20, 'Kruiden of groente kweken', 'Zet samen kruiden of groente in potten en verzorg ze de komende weken.', '€', 'buiten', 90),
  ('di-21', 21, 'Eten in een onbekende keuken', 'Ga naar een restaurant met een keuken die nieuw is en laat de ander bestellen.', '€€€', 'binnen', 150),
  ('di-22', 22, 'Boswandeling met soep', 'Neem soep in een thermoskan mee en zoek een mooi plekje voor de lunch.', 'gratis', 'buiten', 180),
  ('di-23', 23, 'Puzzelavond', 'Leg samen een puzzel van duizend stukjes, met muziek en iets lekkers erbij.', '€', 'binnen', 180),
  ('di-24', 24, 'Fotowandeling', 'Kies een thema, zoals ''rood'' of ''iets geks'', en maak allebei tien foto''s.', 'gratis', 'buiten', 90),
  ('di-25', 25, 'Dagje naar een andere stad', 'Neem de trein naar een stad waar jullie nog nooit samen waren.', '€€', 'buiten', 480),
  ('di-26', 26, 'Karaoke', 'Thuis of in een café: kies voor elkaar een liedje uit.', '€', 'binnen', 120),
  ('di-27', 27, 'Samen vrijwilligen', 'Help een dagdeel mee bij een voedselbank, dierenasiel of buurtproject.', 'gratis', 'buiten', 240),
  ('di-28', 28, 'Wellness thuis', 'Kaarsen, een voetenbad en om de beurt een massage.', '€', 'binnen', 90),
  ('di-29', 29, 'Escape room', 'Werk samen tegen de klok en ontdek hoe jullie als team werken.', '€€', 'binnen', 90),
  ('di-30', 30, 'Zelf pizza maken', 'Maak het deeg zelf en beleg elk een helft zoals de ander het lekker vindt.', '€', 'binnen', 120),
  ('di-31', 31, 'Verrassingsfilm in de bioscoop', 'Laat de ander een film kiezen zonder te verklappen welke.', '€€', 'binnen', 150),
  ('di-32', 32, 'Kanoën', 'Huur een kano en ontdek de stad of de natuur vanaf het water.', '€€', 'buiten', 180),
  ('di-33', 33, 'Jullie eerste date overdoen', 'Ga terug naar de plek van jullie eerste afspraak, of doe opnieuw wat jullie toen deden.', '€€', 'binnen', 150),
  ('di-34', 34, 'Samen iets nieuws leren', 'Volg een gratis online les, bijvoorbeeld gebarentaal of een nieuwe taal, en oefen samen.', 'gratis', 'binnen', 60),
  ('di-35', 35, 'Marktdag', 'Koop op de markt alleen wat er vers is en verzin er samen een maaltijd bij.', '€', 'buiten', 180),
  ('di-36', 36, 'Avond bij de vuurkorf', 'Marshmallows roosteren, een deken om en verhalen vertellen.', '€', 'buiten', 120),
  ('di-37', 37, 'Boekwinkel-date', 'Kies voor elkaar een boek uit en schrijf er een persoonlijke boodschap in.', '€€', 'binnen', 90),
  ('di-38', 38, 'Naar de sterrenwacht', 'Leer iets nieuws over het heelal en praat erna over de grote vragen.', '€€', 'binnen', 120),
  ('di-39', 39, 'Fietsen langs het water', 'Neem een route langs een rivier of meer en stop bij een terras.', 'gratis', 'buiten', 180),
  ('di-40', 40, 'Weekendje weg', 'Boek een eenvoudig huisje, laat de laptops thuis en plan zo weinig mogelijk.', '€€€', 'buiten', 2880),
  ('di-41', 41, 'Elkaars portret tekenen', 'Teken elkaar in tien minuten en lach samen om het resultaat.', '€', 'binnen', 60),
  ('di-42', 42, 'Toerist in je eigen stad', 'Doe een stadswandeling of rondvaart alsof jullie hier voor het eerst zijn.', '€€', 'buiten', 150)
on conflict (slug) do nothing;

commit;
