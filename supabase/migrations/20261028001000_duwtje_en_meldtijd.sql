-- "Ik denk aan je" en een eigen tijd voor de dagmelding.
--
-- * Eén duwtje per persoon per dag, afgedwongen in de database (unique + controle in de RPC).
-- * De melding bevat alleen de naam: "[naam] denkt aan je". Nooit iets over wel of niet antwoorden.
-- * De ontvanger kan duwtjes uitzetten. De verzender ziet dan alleen dat de knop niet beschikbaar is.
-- * Iedereen kiest een uur voor de dagmelding (standaard 9:00 Amsterdamse tijd). Eén cronjob per uur
--   bedient alleen wie dat uur gekozen heeft. Een logboek per dag voorkomt een dubbele melding als de klok
--   teruggaat, en het vorige uur telt mee zodat een overgeslagen uur (klok vooruit) niemand mist.

alter table public.profiles add column if not exists notify_nudges boolean not null default true;
alter table public.profiles add column if not exists notify_hour smallint not null default 9 check (notify_hour between 0 and 23);

create table public.nudges (
  id          bigint generated always as identity primary key,
  couple_id   uuid not null references public.couples (id) on delete cascade,
  from_user   uuid not null references public.profiles (id) on delete cascade,
  to_user     uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  created_at  timestamptz not null default now(),
  unique (from_user, day)
);
create index nudges_couple_idx on public.nudges (couple_id);
create index nudges_to_user_idx on public.nudges (to_user);

alter table public.nudges enable row level security;
-- Je ziet alleen je eigen verstuurde duwtjes (om te weten of je vandaag al iets stuurde).
create policy "eigen duwtjes lezen" on public.nudges
  for select to authenticated using (from_user = (select auth.uid()));
-- versturen alleen via send_nudge()

-- Kan ik vandaag een duwtje sturen? available is false als je partner ze heeft uitgezet of geen
-- meldingen kan ontvangen; de reden geven we bewust niet terug.
create or replace function public.nudge_status()
returns table (available boolean, sent_today boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select p.notify_nudges from public.profiles p where p.id = public.my_partner_id()), false)
      and exists (select 1 from public.push_tokens t where t.user_id = public.my_partner_id()),
    exists (select 1 from public.nudges n where n.from_user = auth.uid() and n.day = public.ams_today());
$$;

create or replace function public.send_nudge()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_partner  uuid := public.my_partner_id();
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_partner is null then
    raise exception 'geen_partner';
  end if;
  if not (select n.available from public.nudge_status() n) then
    raise exception 'duwtje_niet_beschikbaar';
  end if;
  insert into public.nudges (couple_id, from_user, to_user, day)
  values (public.my_couple_id(), v_uid, v_partner, public.ams_today())
  on conflict (from_user, day) do nothing;
  if not found then
    raise exception 'duwtje_al_verstuurd';
  end if;
end;
$$;

-- Melding voor een duwtje: alleen de naam van de verzender (voor de Edge Function).
create or replace function public.push_targets_nudge(p_nudge bigint)
returns table (token text, sender_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.token, coalesce(nullif(s.display_name, ''), 'Je partner')
  from public.nudges n
  join public.profiles s on s.id = n.from_user
  join public.profiles r on r.id = n.to_user and r.notify_nudges
  join public.push_tokens t on t.user_id = n.to_user
  where n.id = p_nudge;
$$;

-------------------------------------------------------------------------------
-- Eigen meldtijd
-------------------------------------------------------------------------------

-- Wie kreeg vandaag al de melding van het uur? (alleen voor de Edge Function)
create table public.push_daily_log (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  day      date not null,
  primary key (user_id, day)
);
alter table public.push_daily_log enable row level security;
-- geen policies: alleen service_role (via de functies hieronder)

-- Claimt de gebruikers voor dit uur (Amsterdamse tijd): wie dit uur of het vorige uur koos en vandaag
-- nog niets kreeg. Geeft hun id's terug en legt vast dat ze vandaag bediend zijn.
create or replace function public.claim_hourly_users(p_hour integer, p_today date default public.ams_today())
returns setof uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.push_daily_log (user_id, day)
  select p.id, p_today
  from public.profiles p
  where p.notify_hour in (p_hour, p_hour - 1)
  on conflict do nothing
  returning user_id;
$$;

drop function if exists public.push_targets_new_question();
create function public.push_targets_new_question(p_users uuid[])
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
  where t.user_id = any (p_users)
    and (select count(*) from public.couple_members m2 where m2.couple_id = m.couple_id) = 2;
$$;

drop function if exists public.push_targets_date_reminders(date);
create function public.push_targets_date_reminders(p_users uuid[], p_today date default public.ams_today())
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
  where m.user_id = any (p_users)
    and n.next is not null
    and (n.next - p_today = d.remind_days_before or n.next = p_today);
$$;

revoke execute on function
  public.nudge_status(),
  public.send_nudge(),
  public.push_targets_nudge(bigint),
  public.claim_hourly_users(integer, date),
  public.push_targets_new_question(uuid[]),
  public.push_targets_date_reminders(uuid[], date)
from public, anon;
grant execute on function public.nudge_status(), public.send_nudge() to authenticated;
revoke execute on function
  public.push_targets_nudge(bigint),
  public.claim_hourly_users(integer, date),
  public.push_targets_new_question(uuid[]),
  public.push_targets_date_reminders(uuid[], date)
from authenticated;
grant execute on function
  public.push_targets_nudge(bigint),
  public.claim_hourly_users(integer, date),
  public.push_targets_new_question(uuid[]),
  public.push_targets_date_reminders(uuid[], date)
to service_role;
