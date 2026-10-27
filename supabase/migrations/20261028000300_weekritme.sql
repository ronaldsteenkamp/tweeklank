-- Weekritme in plaats van een dagelijkse reeks.
--
-- * Een samen-dag is een dag waarop jullie allebei de dagvraag hebben beantwoord (ook als een van
--   jullie die de dag erna heeft ingehaald).
-- * Het koppel kiest een weekdoel van 3 t/m 7 samen-dagen (standaard 5). Een nieuw doel geldt vanaf
--   de huidige week; eerdere weken houden het doel dat toen gold.
-- * De reeks is het aantal opeenvolgende weken (zondag t/m zaterdag, Amsterdamse kalenderdagen) waarin
--   het doel is gehaald. De lopende week telt pas mee als het doel gehaald is; tot die tijd breekt hij niets.
-- * In de eerste week van een koppel telt het doel hoogstens het aantal dagen dat er nog over was.
--   Zo verliezen bestaande en nieuwe koppels niets door halverwege een week te beginnen.
-- * Een gepauzeerde week (ook als de pauze maar een deel van de week raakt) telt niet mee en breekt niets.
-- * Er wordt nooit per partner bijgehouden of getoond wie er een dag miste.

-------------------------------------------------------------------------------
-- Datumhulpjes
-------------------------------------------------------------------------------

-- Kalenderdag in Amsterdam voor een tijdstip (zomer- en wintertijd via de tijdzonedatabase)
create or replace function public.ams_day(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_at at time zone 'Europe/Amsterdam')::date;
$$;

create or replace function public.ams_today()
returns date
language sql
stable
set search_path = ''
as $$
  select public.ams_day(now());
$$;

-- Zondag van de week waarin een dag valt
create or replace function public.week_start(p_day date)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_day - extract(dow from p_day)::int;
$$;

-------------------------------------------------------------------------------
-- Tabellen
-------------------------------------------------------------------------------

create table public.couple_week_goals (
  couple_id   uuid not null references public.couples (id) on delete cascade,
  from_week   date not null check (extract(dow from from_week) = 0),
  goal        smallint not null check (goal between 3 and 7),
  created_at  timestamptz not null default now(),
  primary key (couple_id, from_week)
);

create table public.couple_pauses (
  id          bigint generated always as identity primary key,
  couple_id   uuid not null references public.couples (id) on delete cascade,
  start_day   date not null,
  end_day     date,  -- laatste gepauzeerde dag; null = tot een van jullie hem uitzet
  created_at  timestamptz not null default now(),
  constraint pause_order check (end_day is null or end_day >= start_day)
);

create index couple_pauses_couple_idx on public.couple_pauses (couple_id, start_day);

alter table public.couple_week_goals enable row level security;
alter table public.couple_pauses     enable row level security;

-- Lezen: alleen je eigen koppel. Schrijven alleen via de functies hieronder.
create policy "weekdoel lezen" on public.couple_week_goals
  for select to authenticated using (couple_id = (select public.my_couple_id()));
create policy "pauzes lezen" on public.couple_pauses
  for select to authenticated using (couple_id = (select public.my_couple_id()));

-------------------------------------------------------------------------------
-- Rekenen (intern)
-------------------------------------------------------------------------------

create or replace function public.couple_week_goal(p_couple uuid, p_week date)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select g.goal from public.couple_week_goals g
     where g.couple_id = p_couple and g.from_week <= p_week
     order by g.from_week desc limit 1),
    5
  )::smallint;
$$;

create or replace function public.couple_week_paused(p_couple uuid, p_week date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.couple_pauses p
    where p.couple_id = p_couple
      and p.start_day <= p_week + 6
      and (p.end_day is null or p.end_day >= p_week)
  );
$$;

-- Aantal samen-dagen tussen twee dagen (inclusief)
create or replace function public.couple_together_days(p_couple uuid, p_from date, p_to date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from (
    select a.day
    from public.daily_answers a
    where a.couple_id = p_couple and a.day between p_from and p_to
    group by a.day
    having count(distinct a.user_id) >= 2
  ) d;
$$;

-- Het doel dat in een week echt geldt: in de eerste week hoogstens het aantal resterende dagen
create or replace function public.couple_effective_goal(p_couple uuid, p_week date)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select least(
    public.couple_week_goal(p_couple, p_week),
    greatest(1, (p_week + 6) - greatest(p_week, coalesce(
      (select min(cd.day) from public.couple_daily cd where cd.couple_id = p_couple), p_week)) + 1)
  )::smallint;
$$;

-- Reeks in weken op een gegeven dag. Vervangt de dagelijkse reeks (zelfde naam en aanroep).
create or replace function public.couple_streak_at(p_couple uuid, p_today date)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current  date := public.week_start(p_today);
  v_week     date := v_current;
  v_first    date;
  v_streak   int := 0;
  v_done     int;
begin
  select min(cd.day) into v_first from public.couple_daily cd where cd.couple_id = p_couple and cd.day <= p_today;
  if v_first is null then
    return 0;
  end if;

  -- hoogstens tien jaar terug
  for i in 1..520 loop
    exit when v_week + 6 < v_first;
    if not public.couple_week_paused(p_couple, v_week) then
      v_done := public.couple_together_days(p_couple, v_week, least(v_week + 6, p_today));
      if v_done >= public.couple_effective_goal(p_couple, v_week) then
        v_streak := v_streak + 1;
      elsif v_week <> v_current then
        exit;  -- een afgelopen week zonder het doel: hier stopt de reeks
      end if;
      -- de lopende week zonder het doel (nog) breekt niets
    end if;
    v_week := v_week - 7;
  end loop;

  return v_streak;
end;
$$;

-------------------------------------------------------------------------------
-- Voor de app
-------------------------------------------------------------------------------

-- Hoe staat het ritme er deze week voor? Alleen totalen voor het koppel, nooit per persoon.
create or replace function public.my_week()
returns table (
  week_start      date,
  together_days   integer,
  goal            smallint,
  chosen_goal     smallint,
  streak          integer,
  week_paused     boolean,
  pause_active    boolean,
  pause_end       date
)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (select public.my_couple_id() as id, public.ams_today() as today),
  w as (select c.id, c.today, public.week_start(c.today) as ws from c where c.id is not null),
  p as (
    select p.end_day
    from public.couple_pauses p, w
    where p.couple_id = w.id and p.start_day <= w.today and (p.end_day is null or p.end_day >= w.today)
    order by p.start_day desc limit 1
  )
  select w.ws,
         public.couple_together_days(w.id, w.ws, w.today),
         public.couple_effective_goal(w.id, w.ws),
         public.couple_week_goal(w.id, w.ws),
         public.couple_streak_at(w.id, w.today),
         public.couple_week_paused(w.id, w.ws),
         exists (select 1 from p),
         (select p.end_day from p)
  from w;
$$;

create or replace function public.set_week_goal(p_goal integer)
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
  if v_couple is null or public.my_partner_id() is null then
    raise exception 'geen_partner';
  end if;
  if p_goal is null or p_goal not between 3 and 7 then
    raise exception 'ongeldig_weekdoel';
  end if;
  insert into public.couple_week_goals (couple_id, from_week, goal)
  values (v_couple, public.week_start(public.ams_today()), p_goal)
  on conflict (couple_id, from_week) do update set goal = excluded.goal, created_at = now();
end;
$$;

-- Pauze voor 1, 2 of 4 weken vanaf vandaag, of (null) tot een van jullie hem uitzet
create or replace function public.start_pause(p_weeks integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid := public.my_couple_id();
  v_today  date := public.ams_today();
begin
  if auth.uid() is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_couple is null or public.my_partner_id() is null then
    raise exception 'geen_partner';
  end if;
  if p_weeks is not null and p_weeks not in (1, 2, 4) then
    raise exception 'ongeldige_pauze';
  end if;
  if exists (
    select 1 from public.couple_pauses p
    where p.couple_id = v_couple and (p.end_day is null or p.end_day >= v_today)
  ) then
    raise exception 'al_gepauzeerd';
  end if;
  insert into public.couple_pauses (couple_id, start_day, end_day)
  values (v_couple, v_today, case when p_weeks is null then null else v_today + 7 * p_weeks - 1 end);
end;
$$;

-- Pauze uitzetten. Een pauze van vandaag zelf verdwijnt helemaal; anders eindigt hij gisteren.
create or replace function public.stop_pause()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid := public.my_couple_id();
  v_today  date := public.ams_today();
begin
  if auth.uid() is null then
    raise exception 'niet_ingelogd';
  end if;
  delete from public.couple_pauses p
  where p.couple_id = v_couple and p.start_day >= v_today;
  update public.couple_pauses p
  set end_day = v_today - 1
  where p.couple_id = v_couple and p.start_day < v_today and (p.end_day is null or p.end_day >= v_today);
end;
$$;

-------------------------------------------------------------------------------
-- Rechten
-------------------------------------------------------------------------------

revoke execute on function
  public.ams_day(timestamptz),
  public.week_start(date),
  public.couple_week_goal(uuid, date),
  public.couple_week_paused(uuid, date),
  public.couple_together_days(uuid, date, date),
  public.couple_effective_goal(uuid, date),
  public.my_week(),
  public.set_week_goal(integer),
  public.start_pause(integer),
  public.stop_pause()
from public, anon;

grant execute on function
  public.ams_day(timestamptz),
  public.week_start(date),
  public.my_week(),
  public.set_week_goal(integer),
  public.start_pause(integer),
  public.stop_pause()
to authenticated;

-- Intern: kunnen over elk koppel rekenen, dus niet rechtstreeks aanroepbaar
revoke execute on function
  public.couple_week_goal(uuid, date),
  public.couple_week_paused(uuid, date),
  public.couple_together_days(uuid, date, date),
  public.couple_effective_goal(uuid, date),
  public.couple_streak_at(uuid, date)
from authenticated;
