-- Tweeklank: kernschema (accounts, koppelen, dagelijkse vraag, reacties, streaks)
--
-- Uitgangspunten
-- * RLS staat aan op elke tabel. Een gebruiker ziet alleen eigen data en die van de gekoppelde partner.
-- * Alles wat met koppelen of de dagvraag te maken heeft, loopt via RPC's (security definer)
--   die zelf controleren wie de aanroeper is (auth.uid()).
-- * "Vandaag" is altijd de kalenderdag in Europe/Amsterdam.

-------------------------------------------------------------------------------
-- Hulpfuncties
-------------------------------------------------------------------------------

create or replace function public.ams_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Amsterdam')::date;
$$;

-------------------------------------------------------------------------------
-- Profielen
-------------------------------------------------------------------------------

create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  display_name             text not null default '' check (char_length(display_name) <= 40),
  birthday                 date,
  notify_new_question      boolean not null default true,
  notify_partner_answered  boolean not null default true,
  notify_dates             boolean not null default true,
  explicit_opt_in          boolean not null default false,
  adult_confirmed_at       timestamptz,
  created_at               timestamptz not null default now(),
  -- 18+-content kan alleen aan na een leeftijdsbevestiging
  constraint explicit_requires_adult check (not explicit_opt_in or adult_confirmed_at is not null)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- Koppels
-------------------------------------------------------------------------------

create table public.couples (
  id           uuid primary key default gen_random_uuid(),
  anniversary  date,
  created_at   timestamptz not null default now()
);

create table public.couple_members (
  couple_id  uuid not null references public.couples (id) on delete cascade,
  user_id    uuid not null unique references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create or replace function public.enforce_max_two_members()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- rij vergrendelen zodat twee gelijktijdige inwisselingen elkaar niet passeren
  perform 1 from public.couples where id = new.couple_id for update;
  if (select count(*) from public.couple_members where couple_id = new.couple_id) >= 2 then
    raise exception 'koppel_vol';
  end if;
  return new;
end;
$$;

create trigger couple_members_max_two
  before insert on public.couple_members
  for each row execute function public.enforce_max_two_members();

create table public.invites (
  code        text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  used_at     timestamptz,
  used_by     uuid references public.profiles (id) on delete set null
);

create index invites_couple_idx on public.invites (couple_id);

-- Het koppel van de ingelogde gebruiker (of null). Security definer om recursie in RLS te vermijden.
create or replace function public.my_couple_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select couple_id from public.couple_members where user_id = auth.uid();
$$;

create or replace function public.my_partner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id
  from public.couple_members m
  where m.couple_id = public.my_couple_id()
    and m.user_id <> auth.uid();
$$;

-------------------------------------------------------------------------------
-- Dagelijkse vraag
-------------------------------------------------------------------------------

create table public.daily_questions (
  id        bigint generated always as identity primary key,
  slug      text not null unique,
  text      text not null check (char_length(text) between 5 and 300),
  depth     smallint not null check (depth between 1 and 3),
  position  integer not null unique
);

create table public.couple_daily (
  couple_id    uuid not null references public.couples (id) on delete cascade,
  day          date not null,
  question_id  bigint not null references public.daily_questions (id),
  created_at   timestamptz not null default now(),
  primary key (couple_id, day)
);

create table public.daily_answers (
  id          bigint generated always as identity primary key,
  couple_id   uuid not null,
  day         date not null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (couple_id, day, user_id),
  -- een antwoord hoort altijd bij een toegewezen vraag van dat koppel op die dag
  foreign key (couple_id, day) references public.couple_daily (couple_id, day) on delete cascade
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger daily_answers_touch
  before update on public.daily_answers
  for each row execute function public.touch_updated_at();

-- Heeft de ingelogde gebruiker zelf al geantwoord op de vraag van deze dag?
create or replace function public.has_answered(p_couple uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.daily_answers
    where couple_id = p_couple and day = p_day and user_id = auth.uid()
  );
$$;

-- Mag de ingelogde gebruiker dit antwoord zien? (eigen antwoord, of dat van de partner na eigen antwoord)
create or replace function public.can_see_answer(p_answer bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.daily_answers a
    where a.id = p_answer
      and (
        a.user_id = auth.uid()
        or (a.couple_id = public.my_couple_id() and public.has_answered(a.couple_id, a.day))
      )
  );
$$;

create table public.answer_reactions (
  id          bigint generated always as identity primary key,
  answer_id   bigint not null references public.daily_answers (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  emoji       text check (char_length(emoji) between 1 and 16),
  message     text check (char_length(btrim(message)) between 1 and 500),
  created_at  timestamptz not null default now(),
  constraint reaction_has_content check (emoji is not null or message is not null)
);

create index answer_reactions_answer_idx on public.answer_reactions (answer_id);

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
