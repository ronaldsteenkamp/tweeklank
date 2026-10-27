// Zet een account over naar een nieuwe telefoon.
//
// De oude telefoon maakt een overzetcode (public.create_transfer_code). De nieuwe telefoon stuurt
// die code hierheen en krijgt een eenmalige token_hash terug, waarmee de app via
// supabase.auth.verifyOtp een sessie voor hetzelfde account opent.
//
// Deploy: npx supabase functions deploy transfer-account --no-verify-jwt
// (de nieuwe telefoon is nog niet ingelogd; de code zelf is het bewijs)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { transferEmail } from '../_shared/transfer.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let code = '';
  try {
    code = String((await req.json())?.code ?? '');
  } catch {
    return json({ error: 'code_onbekend' }, 400);
  }
  if (!/^[A-Za-z0-9 -]{8,20}$/.test(code)) return json({ error: 'code_onbekend' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const claim = await admin.rpc('claim_transfer_code', { p_code: code });
  if (claim.error || !claim.data) return json({ error: 'code_onbekend' }, 400);
  const userId = claim.data as string;

  const found = await admin.auth.admin.getUserById(userId);
  if (found.error || !found.data.user) return json({ error: 'code_onbekend' }, 400);

  // Een inloglink kan alleen bij een e-mailadres; een account zonder e-mail krijgt een intern adres.
  let email = found.data.user.email;
  if (!email) {
    email = transferEmail(userId);
    const upd = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (upd.error) return json({ error: 'mislukt', detail: upd.error.message }, 500);
  }

  // generateLink verstuurt zelf geen e-mail; we geven alleen de eenmalige token_hash terug.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) return json({ error: 'mislukt', detail: link.error.message }, 500);

  return json({ token_hash: link.data.properties.hashed_token });
});
