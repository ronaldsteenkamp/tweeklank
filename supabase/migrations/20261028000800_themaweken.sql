-- Themaweken: series van 7 dagvragen met een titel, een korte intro en een afsluitende oefening.
--
-- * De vragen van een serie staan gewoon in daily_questions (met series_id en series_step), zodat
--   antwoorden, zichtbaarheid, archief en Realtime precies hetzelfde werken.
-- * De gewone rotatie slaat seriesvragen over.
-- * Na de eerste 60 gewone vragen biedt de app op een rustig moment (nadat je zelf hebt geantwoord)
--   een serie aan. Jullie kiezen samen: pas als jullie allebei dezelfde serie kiezen, start die de
--   volgende dag. Wie eerst kiest, ziet "wacht op …".
-- * Een actieve serie gaat voor de gewone rotatie; daarna gaat die verder waar hij was.
-- * "Nu niet" verbergt het aanbod 14 dagen voor jou (alleen voor jou).

create table public.question_series (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  position     integer not null unique,
  title        text not null check (char_length(title) between 3 and 60),
  intro        text not null check (char_length(intro) between 10 and 400),
  exercise_id  bigint references public.exercises (id) on delete set null
);

alter table public.daily_questions add column if not exists series_id bigint references public.question_series (id) on delete cascade;
alter table public.daily_questions add column if not exists series_step smallint check (series_step between 1 and 7);
alter table public.daily_questions add constraint daily_questions_series_step
  check ((series_id is null) = (series_step is null));
create unique index if not exists daily_questions_series_step_idx on public.daily_questions (series_id, series_step);

create table public.couple_series (
  couple_id    uuid not null references public.couples (id) on delete cascade,
  series_id    bigint not null references public.question_series (id) on delete cascade,
  status       text not null default 'actief' check (status in ('actief', 'klaar')),
  started_on   date not null,
  created_at   timestamptz not null default now(),
  primary key (couple_id, series_id)
);
create unique index couple_series_one_active on public.couple_series (couple_id) where status = 'actief';
create index couple_series_series_idx on public.couple_series (series_id);

create table public.series_votes (
  couple_id   uuid not null references public.couples (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  series_id   bigint not null references public.question_series (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (couple_id, user_id)
);
create index series_votes_series_idx on public.series_votes (series_id);
create index series_votes_user_idx on public.series_votes (user_id);

alter table public.profiles add column if not exists series_snoozed_until date;

alter table public.question_series enable row level security;
alter table public.couple_series   enable row level security;
alter table public.series_votes    enable row level security;

create policy "series lezen" on public.question_series for select to authenticated using (true);
create policy "eigen series lezen" on public.couple_series
  for select to authenticated using (couple_id = (select public.my_couple_id()));
create policy "keuzes lezen" on public.series_votes
  for select to authenticated using (couple_id = (select public.my_couple_id()));
-- schrijven alleen via de functies hieronder

-------------------------------------------------------------------------------
-- Rotatie: seriesvragen niet in de gewone rij
-------------------------------------------------------------------------------

create or replace function public.pick_regular_question(p_couple uuid, p_today date)
returns table (question_id bigint, repeat_of date)
language sql
stable
security definer
set search_path = ''
as $$
  with last_asked as (
    select cd.question_id, max(cd.day) as day
    from public.couple_daily cd
    join public.daily_questions q on q.id = cd.question_id and q.series_id is null
    where cd.couple_id = p_couple and cd.day < p_today
    group by cd.question_id
  ),
  unseen as (
    select q.id as question_id, null::date as repeat_of, 0 as pass, q.position, null::date as day
    from public.daily_questions q
    where q.series_id is null
      and not exists (select 1 from last_asked l where l.question_id = q.id)
  ),
  oldest as (
    select l.question_id, l.day as repeat_of, 1 as pass, q.position, l.day
    from last_asked l
    join public.daily_questions q on q.id = l.question_id
  )
  select c.question_id, c.repeat_of
  from (select * from unseen union all select * from oldest) c
  order by c.pass, c.day nulls first, c.position
  limit 1;
$$;

-- Volgende vraag van een actieve serie (of niets). Zet de serie op 'klaar' bij de laatste stap.
create or replace function public.next_series_question(p_couple uuid, p_today date)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series  bigint;
  v_done    int;
  v_qid     bigint;
begin
  select cs.series_id into v_series
  from public.couple_series cs
  where cs.couple_id = p_couple and cs.status = 'actief' and cs.started_on <= p_today;
  if v_series is null then
    return null;
  end if;

  select count(*) into v_done
  from public.couple_daily cd
  join public.daily_questions q on q.id = cd.question_id
  where cd.couple_id = p_couple and q.series_id = v_series;

  select q.id into v_qid from public.daily_questions q where q.series_id = v_series and q.series_step = v_done + 1;
  if v_qid is null or v_done + 1 >= 7 then
    update public.couple_series set status = 'klaar' where couple_id = p_couple and series_id = v_series;
  end if;
  return v_qid;
end;
$$;

drop function if exists public.get_today_question();

create function public.get_today_question()
returns table (
  day                   date,
  question_id           bigint,
  text                  text,
  depth                 smallint,
  answered              boolean,
  partner_answered      boolean,
  streak                integer,
  repeat_of             date,
  series_title          text,
  series_intro          text,
  series_step           smallint,
  series_exercise_slug  text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := public.my_couple_id();
  v_today   date := public.ams_today();
  v_qid     bigint;
  v_repeat  date;
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_couple is null or public.my_partner_id() is null then
    raise exception 'geen_partner';
  end if;

  if not exists (select 1 from public.couple_daily cd where cd.couple_id = v_couple and cd.day = v_today) then
    v_qid := public.next_series_question(v_couple, v_today);
    if v_qid is null then
      select p.question_id, p.repeat_of into v_qid, v_repeat from public.pick_regular_question(v_couple, v_today) p;
    end if;
    if v_qid is null then
      raise exception 'geen_vragen';
    end if;
    insert into public.couple_daily (couple_id, day, question_id, repeat_of)
    values (v_couple, v_today, v_qid, v_repeat)
    on conflict do nothing;
  end if;

  return query
  select cd.day, q.id, q.text, q.depth,
         exists (select 1 from public.daily_answers a
                 where a.couple_id = v_couple and a.day = v_today and a.user_id = v_uid),
         exists (select 1 from public.daily_answers a
                 where a.couple_id = v_couple and a.day = v_today and a.user_id <> v_uid),
         public.couple_streak_at(v_couple, v_today),
         cd.repeat_of,
         s.title,
         s.intro,
         q.series_step,
         e.slug
  from public.couple_daily cd
  join public.daily_questions q on q.id = cd.question_id
  left join public.question_series s on s.id = q.series_id
  left join public.exercises e on e.id = s.exercise_id
  where cd.couple_id = v_couple and cd.day = v_today;
end;
$$;

-------------------------------------------------------------------------------
-- Samen een serie kiezen
-------------------------------------------------------------------------------

-- Het aanbod: series die jullie nog niet deden, met wie wat koos. Leeg als het (nog) geen rustig moment is.
-- Rustig moment: na de eerste 60 gewone vragen, geen actieve serie, je hebt vandaag geantwoord en je
-- hebt het aanbod niet weggezet. Heeft je partner al gekozen, dan zie je het aanbod hoe dan ook.
create or replace function public.get_series_offer()
returns table (
  series_id      bigint,
  slug           text,
  title          text,
  intro          text,
  i_chose        boolean,
  partner_chose  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select public.my_couple_id() as couple, auth.uid() as uid, public.ams_today() as today
  ),
  ok as (
    select me.* from me
    where me.couple is not null
      and public.my_partner_id() is not null
      and not exists (select 1 from public.couple_series cs where cs.couple_id = me.couple and cs.status = 'actief')
      and (
        exists (select 1 from public.series_votes v where v.couple_id = me.couple and v.user_id <> me.uid)
        or (
          (select count(*) from public.couple_daily cd
             join public.daily_questions q on q.id = cd.question_id and q.series_id is null
           where cd.couple_id = me.couple) >= 60
          and exists (select 1 from public.daily_answers a where a.couple_id = me.couple and a.day = me.today and a.user_id = me.uid)
          and coalesce((select p.series_snoozed_until from public.profiles p where p.id = me.uid), me.today - 1) < me.today
        )
      )
  )
  select s.id, s.slug, s.title, s.intro,
         exists (select 1 from public.series_votes v where v.couple_id = ok.couple and v.user_id = ok.uid and v.series_id = s.id),
         exists (select 1 from public.series_votes v where v.couple_id = ok.couple and v.user_id <> ok.uid and v.series_id = s.id)
  from ok
  cross join public.question_series s
  where not exists (select 1 from public.couple_series cs where cs.couple_id = ok.couple and cs.series_id = s.id)
  order by s.position;
$$;

-- Kies een serie. Kiest je partner dezelfde, dan start hij morgen (of vandaag als er nog geen vraag is).
-- Geeft 'gestart' of 'wacht' terug.
create or replace function public.choose_series(p_series bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := public.my_couple_id();
  v_today   date := public.ams_today();
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_couple is null or public.my_partner_id() is null then
    raise exception 'geen_partner';
  end if;
  if not exists (select 1 from public.question_series s where s.id = p_series)
     or exists (select 1 from public.couple_series cs where cs.couple_id = v_couple and cs.series_id = p_series) then
    raise exception 'serie_niet_beschikbaar';
  end if;
  if exists (select 1 from public.couple_series cs where cs.couple_id = v_couple and cs.status = 'actief') then
    raise exception 'serie_al_bezig';
  end if;

  insert into public.series_votes (couple_id, user_id, series_id) values (v_couple, v_uid, p_series)
  on conflict (couple_id, user_id) do update set series_id = excluded.series_id, created_at = now();

  if exists (select 1 from public.series_votes v where v.couple_id = v_couple and v.user_id <> v_uid and v.series_id = p_series) then
    insert into public.couple_series (couple_id, series_id, started_on)
    values (v_couple, p_series,
            case when exists (select 1 from public.couple_daily cd where cd.couple_id = v_couple and cd.day = v_today)
                 then v_today + 1 else v_today end);
    delete from public.series_votes v where v.couple_id = v_couple;
    return 'gestart';
  end if;
  return 'wacht';
end;
$$;

-- Je keuze intrekken, of het aanbod 14 dagen wegzetten (alleen voor jou)
create or replace function public.dismiss_series_offer(p_snooze boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'niet_ingelogd';
  end if;
  delete from public.series_votes v where v.user_id = auth.uid();
  if p_snooze then
    update public.profiles set series_snoozed_until = public.ams_today() + 14 where id = auth.uid();
  end if;
end;
$$;

revoke execute on function
  public.pick_regular_question(uuid, date),
  public.next_series_question(uuid, date),
  public.get_today_question(),
  public.get_series_offer(),
  public.choose_series(bigint),
  public.dismiss_series_offer(boolean)
from public, anon;
revoke execute on function public.pick_regular_question(uuid, date), public.next_series_question(uuid, date) from authenticated;
grant execute on function
  public.get_today_question(),
  public.get_series_offer(),
  public.choose_series(bigint),
  public.dismiss_series_offer(boolean)
to authenticated;
