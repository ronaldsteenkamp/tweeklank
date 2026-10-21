-- Eenmalig draaien in de Supabase SQL Editor (NIET als migratie: er staan projectgeheimen in).
-- Kan veilig opnieuw gedraaid worden.
--
-- Vooraf:
--   1. npx supabase functions deploy send-push --no-verify-jwt
--   2. npx supabase secrets set PUSH_WEBHOOK_SECRET=<lange willekeurige tekst>
--   3. Vul hieronder je project-URL en DEZELFDE geheime tekst in.

create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
declare
  v_url    constant text := 'https://JOUW-PROJECT-REF.supabase.co';  -- ← aanpassen
  v_secret constant text := 'ZELFDE-WAARDE-ALS-PUSH_WEBHOOK_SECRET';  -- ← aanpassen
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'tweeklank_project_url';
  if v_id is null then perform vault.create_secret(v_url, 'tweeklank_project_url');
  else perform vault.update_secret(v_id, v_url); end if;

  select id into v_id from vault.secrets where name = 'tweeklank_push_secret';
  if v_id is null then perform vault.create_secret(v_secret, 'tweeklank_push_secret');
  else perform vault.update_secret(v_id, v_secret); end if;
end;
$$;

-- Roept de Edge Function send-push aan (asynchroon via pg_net)
create or replace function public.notify_push(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'tweeklank_project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'tweeklank_push_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url     := v_url || '/functions/v1/send-push',
    body    := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tweeklank-secret', v_secret)
  );
end;
$$;

revoke execute on function public.notify_push(jsonb) from public, anon, authenticated;

-- "Partner heeft geantwoord": bij elk nieuw antwoord
create or replace function public.on_daily_answer_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_push(jsonb_build_object(
    'type', 'INSERT', 'table', 'daily_answers', 'record', jsonb_build_object('id', new.id)
  ));
  return new;
end;
$$;

drop trigger if exists daily_answers_push on public.daily_answers;
create trigger daily_answers_push
  after insert on public.daily_answers
  for each row execute function public.on_daily_answer_insert();

-- "De vraag van vandaag staat klaar": om 07:00 én 08:00 UTC; de functie verstuurt
-- alleen op het moment dat het in Amsterdam 9 uur is (werkt dus in zomer- én wintertijd).
do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname like 'tweeklank-dagvraag-%';
end;
$$;
select cron.schedule('tweeklank-dagvraag-07', '0 7 * * *', $$select public.notify_push('{"type":"daily"}'::jsonb)$$);
select cron.schedule('tweeklank-dagvraag-08', '0 8 * * *', $$select public.notify_push('{"type":"daily"}'::jsonb)$$);
