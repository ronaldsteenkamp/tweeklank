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
