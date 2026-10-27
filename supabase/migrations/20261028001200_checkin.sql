-- Maandelijkse check-in "Hoe gaat het met ons?"
--
-- * Open vanaf de eerste van de maand, een week lang (dag 1 t/m 7, Amsterdamse tijd).
-- * Vier schaalvragen van 1 t/m 5 en één open vraag. Eén keer per persoon per maand; daarna definitief.
-- * Dezelfde zichtbaarheidsregel als bij de dagvraag: de antwoorden van je partner zie je pas als je
--   zelf de check-in van die maand hebt ingevuld.
-- * De app toont alleen verschuivingen ten opzichte van de vorige maand, geen totaalscore.
-- * Ontkoppelen wist alles (cascade via couples).

create table public.checkins (
  id             bigint generated always as identity primary key,
  couple_id      uuid not null references public.couples (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  month          date not null check (extract(day from month) = 1),
  connection     smallint not null check (connection between 1 and 5),
  appreciated    smallint not null check (appreciated between 1 and 5),
  conflict       smallint not null check (conflict between 1 and 5),
  time_together  smallint not null check (time_together between 1 and 5),
  wish           text check (char_length(btrim(wish)) between 1 and 500),
  created_at     timestamptz not null default now(),
  unique (couple_id, user_id, month)
);
create index checkins_user_idx on public.checkins (user_id);

-- Is de check-in van deze maand nu open? (dag 1 t/m 7)
create or replace function public.checkin_open_month()
returns date
language sql
stable
set search_path = ''
as $$
  select case when extract(day from public.ams_today()) <= 7
              then date_trunc('month', public.ams_today())::date end;
$$;

-- Heeft de ingelogde gebruiker de check-in van deze maand ingevuld?
create or replace function public.has_checked_in(p_couple uuid, p_month date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.checkins c
    where c.couple_id = p_couple and c.month = p_month and c.user_id = auth.uid()
  );
$$;

alter table public.checkins enable row level security;

create policy "check-in lezen: eigen, of partner na eigen check-in" on public.checkins
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (couple_id = (select public.my_couple_id()) and public.has_checked_in(couple_id, month))
  );

create policy "check-in invullen: deze maand, eerste week" on public.checkins
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and couple_id = (select public.my_couple_id())
    and month = (select public.checkin_open_month())
  );
-- geen update- of delete-policy: een ingevulde check-in is definitief

revoke execute on function public.checkin_open_month(), public.has_checked_in(uuid, date) from public, anon;
grant execute on function public.checkin_open_month(), public.has_checked_in(uuid, date) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.checkins;
  end if;
end;
$$;
