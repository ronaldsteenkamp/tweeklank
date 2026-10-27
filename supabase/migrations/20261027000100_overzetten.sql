-- Account overzetten naar een nieuwe telefoon.
--
-- Een account zonder e-mail staat alleen op de telefoon. Om toch van telefoon te wisselen,
-- maakt de oude telefoon een overzetcode (8 tekens, 15 minuten geldig, één keer te gebruiken).
-- De nieuwe telefoon geeft die code aan de Edge Function `transfer-account`, die er een sessie
-- voor hetzelfde account van maakt. Alleen een hash van de code staat in de database.

create table public.transfer_codes (
  code_hash  text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

create index transfer_codes_user_id_idx on public.transfer_codes (user_id);

-- Geen policies: niemand leest of schrijft deze tabel rechtstreeks, alleen via de functies hieronder.
alter table public.transfer_codes enable row level security;
revoke all on public.transfer_codes from anon, authenticated;

create or replace function public.transfer_code_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex');
$$;

-- Maakt een nieuwe overzetcode voor jezelf. Een eerdere, nog ongebruikte code vervalt.
create or replace function public.create_transfer_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_exp   timestamptz;
  i       int;
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;

  delete from public.transfer_codes t where t.user_id = v_uid or t.expires_at < now();

  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    begin
      insert into public.transfer_codes (code_hash, user_id)
      values (public.transfer_code_hash(v_code), v_uid)
      returning transfer_codes.expires_at into v_exp;
      exit;
    exception when unique_violation then
      -- zeldzame botsing: nieuwe code proberen
    end;
  end loop;

  return query select v_code, v_exp;
end;
$$;

-- Wisselt een overzetcode in en geeft het bijbehorende account terug. Alleen voor de Edge Function.
create or replace function public.claim_transfer_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  delete from public.transfer_codes t
  where t.code_hash = public.transfer_code_hash(p_code) and t.expires_at > now()
  returning t.user_id into v_uid;

  delete from public.transfer_codes t where t.expires_at < now();

  if v_uid is null then
    raise exception 'code_onbekend';
  end if;
  return v_uid;
end;
$$;

revoke execute on function public.transfer_code_hash(text) from public, anon, authenticated;
revoke execute on function public.create_transfer_code() from public, anon;
grant execute on function public.create_transfer_code() to authenticated;
revoke execute on function public.claim_transfer_code(text) from public, anon, authenticated;
grant execute on function public.claim_transfer_code(text) to service_role;
