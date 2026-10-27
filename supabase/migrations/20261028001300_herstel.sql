-- Herstel: een manier bewaren om terug te komen bij een account zonder e-mail.
--
-- Een overzetcode is 15 minuten geldig en dus niet om te bewaren. Daarom is er ook een herstelcode:
-- 16 tekens (ongeveer 80 bits, niet te raden), lang geldig, één keer te gebruiken. Net als bij de
-- overzetcode staat alleen een hash in de database en wisselt alleen de Edge Function transfer-account
-- hem in. Een nieuwe herstelcode vervangt de vorige.

alter table public.transfer_codes add column if not exists kind text not null default 'overzet'
  check (kind in ('overzet', 'herstel'));

-- De herinneringskaart "Bewaar een manier om terug te komen" komt één keer op Vandaag.
alter table public.profiles add column if not exists recovery_card_seen boolean not null default false;

-- Een nieuwe overzetcode laat een bewaarde herstelcode met rust.
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

  delete from public.transfer_codes t where (t.user_id = v_uid and t.kind = 'overzet') or t.expires_at < now();

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

-- Maakt een herstelcode van 16 tekens. Een eerdere herstelcode vervalt.
create or replace function public.create_recovery_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  i       int;
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;

  delete from public.transfer_codes t where t.user_id = v_uid and t.kind = 'herstel';

  loop
    -- Cryptografisch willekeurig: gen_random_uuid gebruikt een sterke bron. Byte 6 en 8 van een uuid
    -- bevatten vaste versiebits; die slaan we over. 256 is deelbaar door 32, dus elk teken is uniform.
    v_code := '';
    while char_length(v_code) < 16 loop
      v_bytes := uuid_send(gen_random_uuid());
      for i in 0..15 loop
        if i not in (6, 8) and char_length(v_code) < 16 then
          v_code := v_code || substr(v_alpha, 1 + (get_byte(v_bytes, i) % 32), 1);
        end if;
      end loop;
    end loop;
    begin
      insert into public.transfer_codes (code_hash, user_id, kind, expires_at)
      values (public.transfer_code_hash(v_code), v_uid, 'herstel', now() + interval '10 years');
      exit;
    exception when unique_violation then
      -- zeldzame botsing: nieuwe code proberen
    end;
  end loop;

  update public.profiles set recovery_card_seen = true where id = v_uid;
  return v_code;
end;
$$;

-- Heb ik een bewaarde herstelcode? (alleen ja/nee)
create or replace function public.has_recovery_code()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.transfer_codes t where t.user_id = auth.uid() and t.kind = 'herstel' and t.expires_at > now());
$$;

revoke execute on function public.create_recovery_code(), public.has_recovery_code() from public, anon;
grant execute on function public.create_recovery_code(), public.has_recovery_code() to authenticated;
