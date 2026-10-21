// Verstuurt pushmeldingen via de Expo Push API.
//
// Aanroepen (alleen met de geheime header x-tweeklank-secret = PUSH_WEBHOOK_SECRET):
//   * Database Webhook op INSERT in daily_answers  → body { type: 'INSERT', record: { id } }
//   * pg_cron om 07:00 en 08:00 UTC                 → body { type: 'daily' }  (verstuurt alleen als het 9 uur is in Amsterdam)
//
// Deploy: npx supabase functions deploy send-push --no-verify-jwt
//         npx supabase secrets set PUSH_WEBHOOK_SECRET=<lange willekeurige tekst>
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  chunk,
  EXPO_PUSH_URL,
  invalidTokens,
  isAmsterdamHour,
  newQuestionMessages,
  partnerAnsweredMessages,
  type PushMessage,
  type PushTicket,
} from '../_shared/push.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function send(messages: PushMessage[]): Promise<{ sent: number; invalid: string[] }> {
  const invalid: string[] = [];
  for (const batch of chunk(messages)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Expo push: HTTP ${res.status}`);
    const { data } = (await res.json()) as { data: PushTicket[] };
    invalid.push(...invalidTokens(batch, data ?? []));
  }
  return { sent: messages.length, invalid };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-tweeklank-secret') !== secret) return json({ error: 'forbidden' }, 403);
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const payload = await req.json().catch(() => ({}));
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let messages: PushMessage[] = [];

  if (payload.type === 'INSERT' && payload.table === 'daily_answers' && payload.record?.id) {
    const { data, error } = await admin.rpc('push_targets_partner_answered', { p_answer: payload.record.id });
    if (error) return json({ error: error.message }, 500);
    messages = partnerAnsweredMessages(data ?? []);
  } else if (payload.type === 'daily') {
    if (!payload.force && !isAmsterdamHour(new Date(), 9)) return json({ skipped: 'niet 9 uur in Amsterdam' });
    const { data, error } = await admin.rpc('push_targets_new_question');
    if (error) return json({ error: error.message }, 500);
    messages = newQuestionMessages((data ?? []).map((r: { token: string }) => r.token));
  } else {
    return json({ error: 'onbekend type' }, 400);
  }

  const result = await send(messages);
  if (result.invalid.length) await admin.from('push_tokens').delete().in('token', result.invalid);
  return json(result);
});
