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
