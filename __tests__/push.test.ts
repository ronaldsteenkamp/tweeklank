import {
  chunk,
  dateReminderMessages,
  invalidTokens,
  isAmsterdamHour,
  isExpoPushToken,
  newQuestionMessages,
  partnerAnsweredMessages,
} from '../supabase/functions/_shared/push';

describe('pushmeldingen', () => {
  it('herkent Expo-pushtokens', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('ongeldig')).toBe(false);
  });

  it('verdeelt berichten in batches van 100', () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    expect(chunk(items).map((c) => c.length)).toEqual([100, 100, 50]);
    expect(chunk([])).toEqual([]);
  });

  it('noemt de naam maar nooit de inhoud van het antwoord', () => {
    const [m] = partnerAnsweredMessages([{ token: 'ExponentPushToken[b]', author_name: 'Anna' }]);
    expect(m.title).toBe('Anna heeft geantwoord');
    expect(m.to).toBe('ExponentPushToken[b]');
    expect(m.data.url).toBe('/vandaag');
  });

  it('dagmelding: dubbele en ongeldige tokens vallen weg', () => {
    const msgs = newQuestionMessages(['ExponentPushToken[a]', 'ExponentPushToken[a]', 'kapot']);
    expect(msgs).toHaveLength(1);
  });

  it('vindt tokens die niet meer geregistreerd zijn', () => {
    const msgs = newQuestionMessages(['ExponentPushToken[a]', 'ExponentPushToken[b]', 'ExponentPushToken[c]']);
    const tickets = [
      { status: 'ok' as const, id: '1' },
      { status: 'error' as const, details: { error: 'DeviceNotRegistered' } },
      { status: 'error' as const, details: { error: 'MessageRateExceeded' } },
    ];
    expect(invalidTokens(msgs, tickets)).toEqual(['ExponentPushToken[b]']);
  });

  it('9 uur in Amsterdam, zomer en winter', () => {
    expect(isAmsterdamHour(new Date('2026-01-10T08:00:00Z'), 9)).toBe(true);
    expect(isAmsterdamHour(new Date('2026-01-10T07:00:00Z'), 9)).toBe(false);
    expect(isAmsterdamHour(new Date('2026-07-10T07:00:00Z'), 9)).toBe(true);
    expect(isAmsterdamHour(new Date('2026-07-10T08:00:00Z'), 9)).toBe(false);
  });

  it('maakt datumherinneringen', () => {
    const msgs = dateReminderMessages([
      { token: 'ExponentPushToken[a]', title: 'Jubileum', days_until: 7 },
      { token: 'ExponentPushToken[a]', title: 'Verjaardag Sam', days_until: 0 },
      { token: 'ExponentPushToken[a]', title: 'Concert', days_until: 1 },
    ]);
    expect(msgs.map((m) => m.title)).toEqual(['Over 7 dagen: Jubileum', 'Vandaag: Verjaardag Sam', 'Morgen: Concert']);
    expect(msgs[0].data.url).toBe('/datums');
  });
});
