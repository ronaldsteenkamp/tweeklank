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
