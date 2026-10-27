-- Samen kaarten spelen op afstand: één partner kiest of schudt, het toestel van de ander volgt live
-- via Realtime dezelfde kaart. De sessie is tijdelijk: hij verloopt na 2 uur en wordt gewist bij
-- afsluiten. Er wordt alleen bijgehouden welke kaart open ligt, geen geschiedenis.

create table public.card_sessions (
  couple_id    uuid primary key references public.couples (id) on delete cascade,
  theme_id     bigint not null references public.themes (id) on delete cascade,
  question_id  bigint not null references public.theme_questions (id) on delete cascade,
  started_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '2 hours'
);
create index card_sessions_theme_idx on public.card_sessions (theme_id);
create index card_sessions_question_idx on public.card_sessions (question_id);
create index card_sessions_started_by_idx on public.card_sessions (started_by);

alter table public.card_sessions enable row level security;
create policy "speelsessie lezen" on public.card_sessions
  for select to authenticated
  using (couple_id = (select public.my_couple_id()) and expires_at > now());
-- schrijven alleen via de functies hieronder

-- Verlopen sessies opruimen (bij elke actie; zo blijft er nooit lang iets staan)
create or replace function public.purge_card_sessions()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.card_sessions where expires_at <= now();
$$;

-- Start (of neem over) een sessie op een kaart, of ga naar een andere kaart. Alleen kaarten die het
-- koppel mag zien (18+ alleen met dubbele toestemming).
create or replace function public.show_card_together(p_question bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid := public.my_couple_id();
  v_theme  bigint;
begin
  if auth.uid() is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_couple is null or public.my_partner_id() is null then
    raise exception 'geen_partner';
  end if;
  select q.theme_id into v_theme from public.theme_questions q where q.id = p_question;
  if v_theme is null or not public.theme_visible(v_theme) then
    raise exception 'kaart_niet_beschikbaar';
  end if;
  perform public.purge_card_sessions();
  insert into public.card_sessions (couple_id, theme_id, question_id, started_by)
  values (v_couple, v_theme, p_question, auth.uid())
  on conflict (couple_id) do update
    set question_id = excluded.question_id,
        updated_at = now(),
        -- een ander thema is een nieuwe sessie: opnieuw 2 uur
        theme_id = excluded.theme_id,
        started_by = case when card_sessions.theme_id = excluded.theme_id then card_sessions.started_by else excluded.started_by end,
        expires_at = case when card_sessions.theme_id = excluded.theme_id then card_sessions.expires_at else now() + interval '2 hours' end;
end;
$$;

create or replace function public.end_card_session()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.card_sessions where couple_id = public.my_couple_id() or expires_at <= now();
$$;

revoke execute on function public.purge_card_sessions(), public.show_card_together(bigint), public.end_card_session() from public, anon;
revoke execute on function public.purge_card_sessions() from authenticated;
grant execute on function public.show_card_together(bigint), public.end_card_session() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.card_sessions;
  end if;
end;
$$;
