// Alle "dag"-logica volgt Europe/Amsterdam, net als public.ams_today() in de database.
export const APP_TIME_ZONE = 'Europe/Amsterdam';

/** Kalenderdag in Amsterdam als 'YYYY-MM-DD'. */
export function amsterdamDay(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** 'YYYY-MM-DD' → bijv. 'dinsdag 21 oktober' (met jaartal als het een ander jaar is). */
export function formatDayNl(isoDay: string, today: string = amsterdamDay()): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const sameYear = isoDay.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

/** Relatieve dagnaam voor het archief: 'Vandaag', 'Gisteren' of de datum. */
export function relativeDayNl(isoDay: string, today: string = amsterdamDay()): string {
  if (isoDay === today) return 'Vandaag';
  const t = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const d = Date.UTC(+isoDay.slice(0, 4), +isoDay.slice(5, 7) - 1, +isoDay.slice(8, 10));
  if (t - d === 86_400_000) return 'Gisteren';
  const label = formatDayNl(isoDay, today);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
