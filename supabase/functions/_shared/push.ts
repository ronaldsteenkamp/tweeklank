// Pure hulplogica voor pushmeldingen (geen Deno- of Node-API's), zodat Jest het kan testen.

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: 'default';
  data: { url: string };
};

export type PushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_BATCH_SIZE = 100;

export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

export function chunk<T>(items: T[], size: number = EXPO_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function message(to: string, title: string, body: string, url: string): PushMessage {
  return { to, title, body, sound: 'default', channelId: 'default', data: { url } };
}

/** Bevat nooit de inhoud van het antwoord, alleen de naam van de schrijver. */
export function partnerAnsweredMessages(targets: { token: string; author_name: string }[]): PushMessage[] {
  return targets
    .filter((t) => isExpoPushToken(t.token))
    .map((t) =>
      message(t.token, `${t.author_name} heeft geantwoord`, 'Geef jouw antwoord om dat van je partner te lezen.', '/vandaag'),
    );
}

export function newQuestionMessages(tokens: string[]): PushMessage[] {
  return [...new Set(tokens)]
    .filter(isExpoPushToken)
    .map((t) => message(t, 'De vraag van vandaag staat klaar', 'Neem even de tijd voor elkaar.', '/vandaag'));
}

/** Tokens die Expo als niet (meer) geregistreerd meldt; die ruimen we op. */
export function invalidTokens(messages: PushMessage[], tickets: PushTicket[]): string[] {
  return tickets.flatMap((ticket, i) =>
    ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' && messages[i] ? [messages[i].to] : [],
  );
}

/** Is het op dit moment het opgegeven uur in Amsterdam? (cron draait in UTC, dus om zomer-/wintertijd heen) */
export function isAmsterdamHour(at: Date, hour: number): boolean {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false }).format(at);
  return Number(h) === hour;
}

/** Herinnering aan een belangrijke datum, bijv. "Over 7 dagen: Jubileum". */
export function dateReminderMessages(rows: { token: string; title: string; days_until: number }[]): PushMessage[] {
  return rows
    .filter((r) => isExpoPushToken(r.token))
    .map((r) => {
      const when = r.days_until === 0 ? 'Vandaag' : r.days_until === 1 ? 'Morgen' : `Over ${r.days_until} dagen`;
      const body = r.days_until === 0 ? 'Maak er samen iets moois van.' : 'Tijd om er iets leuks voor te bedenken?';
      return message(r.token, `${when}: ${r.title}`, body, '/datums');
    });
}
