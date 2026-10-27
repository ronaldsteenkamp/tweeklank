// "Ik denk aan je" en de eigen meldtijd. Getest in __tests__/nudge.test.ts

export type NudgeStatus = { available: boolean; sent_today: boolean };

/** "9:00" */
export function hourLabel(hour: number): string {
  return `${hour}:00`;
}

/** Een uur eerder of later, rond de klok (23 → 0). */
export function shiftHour(hour: number, delta: number): number {
  return (((hour + delta) % 24) + 24) % 24;
}

/** Tekst bij de knop. Als hij niet beschikbaar is, zeggen we bewust niet waarom. */
export function nudgeHint(status: NudgeStatus | null, partnerName: string): string {
  if (!status || !status.available) return 'Nu niet beschikbaar.';
  if (status.sent_today) return `Verstuurd. ${partnerName} krijgt een seintje.`;
  return `${partnerName} krijgt een melding zonder inhoud: "denkt aan je".`;
}
