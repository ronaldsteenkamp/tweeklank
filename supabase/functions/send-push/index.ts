// Verstuurt pushmeldingen via de Expo Push API.
//
// Aanroepen (alleen met de geheime header x-tweeklank-secret):
//   * trigger op INSERT in daily_answers  → body { type: 'INSERT', table: 'daily_answers', record: { id } }
//   * trigger op INSERT in nudges         → body { type: 'INSERT', table: 'nudges', record: { id } }
//   * pg_cron elk heel uur (UTC)          → body { type: 'hourly' }  (dagvraag + datumherinneringen voor
//                                           iedereen die dit uur, Amsterdamse tijd, als meldtijd koos)
//   Testen: { type: 'hourly', hour: 9 } bedient wie 9 uur koos en vandaag nog niets kreeg.
//
// Het geheim leest de functie uit Vault (tweeklank_push_secret, via public.push_webhook_secret()).
// Deploy: npx supabase functions deploy send-push --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  amsterdamHour,
  chunk,
  dateReminderMessages,
  EXPO_PUSH_URL,
  invalidTokens,
  newQuestionMessages,
  nudgeMessages,
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

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Hetzelfde geheim dat de database-trigger en cron-jobs meesturen (Vault: tweeklank_push_secret).
let cachedSecret: string | null = null;
async function webhookSecret(): Promise<string | null> {
  if (!cachedSecret) {
    const { data } = await admin.rpc('push_webhook_secret');
    cachedSecret = typeof data === 'string' && data.length > 0 ? data : null;
  }
  return cachedSecret;
}

Deno.serve(async (req) => {
  const secret = await webhookSecret();
  if (!secret || req.headers.get('x-tweeklank-secret') !== secret) return json({ error: 'forbidden' }, 403);
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const payload = await req.json().catch(() => ({}));

  let messages: PushMessage[] = [];

  if (payload.type === 'INSERT' && payload.table === 'daily_answers' && payload.record?.id) {
    const { data, error } = await admin.rpc('push_targets_partner_answered', { p_answer: payload.record.id });
    if (error) return json({ error: error.message }, 500);
    messages = partnerAnsweredMessages(data ?? []);
  } else if (payload.type === 'INSERT' && payload.table === 'nudges' && payload.record?.id) {
    const { data, error } = await admin.rpc('push_targets_nudge', { p_nudge: payload.record.id });
    if (error) return json({ error: error.message }, 500);
    messages = nudgeMessages(data ?? []);
  } else if (payload.type === 'hourly' || payload.type === 'daily') {
    // 'daily' kwam van de oude cron-jobs; die worden door supabase/sql/cron-en-webhook.sql vervangen
    const hour = Number.isInteger(payload.hour) ? payload.hour : amsterdamHour(new Date());
    const claimed = await admin.rpc('claim_hourly_users', { p_hour: hour });
    if (claimed.error) return json({ error: claimed.error.message }, 500);
    const users = (claimed.data ?? []) as string[];
    if (users.length === 0) return json({ sent: 0, hour });
    const { data, error } = await admin.rpc('push_targets_new_question', { p_users: users });
    if (error) return json({ error: error.message }, 500);
    const reminders = await admin.rpc('push_targets_date_reminders', { p_users: users });
    if (reminders.error) return json({ error: reminders.error.message }, 500);
    messages = [
      ...newQuestionMessages((data ?? []).map((r: { token: string }) => r.token)),
      ...dateReminderMessages(reminders.data ?? []),
    ];
  } else {
    return json({ error: 'onbekend type' }, 400);
  }

  const result = await send(messages);
  if (result.invalid.length) await admin.from('push_tokens').delete().in('token', result.invalid);
  return json(result);
});
