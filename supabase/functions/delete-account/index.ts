// Verwijdert het account van de ingelogde gebruiker, inclusief alle gedeelde koppeldata.
// Deploy: npx supabase functions deploy delete-account
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Niet ingelogd', { status: 401, headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return new Response('Niet ingelogd', { status: 401, headers: cors });

  // Eerst ontkoppelen (verwijdert alle gedeelde data), daarna het account zelf.
  const leave = await userClient.rpc('leave_couple');
  if (leave.error) return new Response(leave.error.message, { status: 500, headers: cors });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const del = await admin.auth.admin.deleteUser(data.user.id);
  if (del.error) return new Response(del.error.message, { status: 500, headers: cors });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
