-- "Ons jaar": het overzicht wordt volledig op het toestel gemaakt uit gegevens die jullie al konden zien.
-- In de database staat alleen of jullie allebei toestemming geven om het overzicht van een bepaald jaar
-- als afbeelding te delen. Zonder toestemming van allebei kun je het alleen zelf bekijken.

create table public.year_share_consents (
  couple_id     uuid not null references public.couples (id) on delete cascade,
  period_start  date not null,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (couple_id, period_start, user_id)
);
create index year_share_consents_user_idx on public.year_share_consents (user_id);

alter table public.year_share_consents enable row level security;

create policy "deeltoestemming lezen" on public.year_share_consents
  for select to authenticated using (couple_id = (select public.my_couple_id()));
create policy "eigen deeltoestemming geven" on public.year_share_consents
  for insert to authenticated
  with check (couple_id = (select public.my_couple_id()) and user_id = (select auth.uid()));
create policy "eigen deeltoestemming intrekken" on public.year_share_consents
  for delete to authenticated
  using (couple_id = (select public.my_couple_id()) and user_id = (select auth.uid()));
