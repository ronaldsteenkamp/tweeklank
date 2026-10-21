-- Het geheim voor send-push staat in Supabase Vault (tweeklank_push_secret).
-- De Edge Function leest het via deze functie, zodat je het niet ook nog handmatig
-- als Edge Function-secret hoeft in te stellen. Alleen service_role mag hem aanroepen.

create or replace function public.push_webhook_secret()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (select decrypted_secret from vault.decrypted_secrets where name = 'tweeklank_push_secret');
end;
$$;

revoke execute on function public.push_webhook_secret() from public, anon, authenticated;
grant execute on function public.push_webhook_secret() to service_role;
