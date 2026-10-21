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
