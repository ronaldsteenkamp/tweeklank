// "Een jaar geleden": kop boven het antwoord van de vorige keer. Getest in __tests__/yearAgo.test.ts

export type YearAgoAnswer = { day: string; user_id: string; body: string; mine: boolean };

const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;

/** Kop voor de vorige keer: "Een jaar geleden schreef je…" als het minstens 11 maanden geleden is. */
export function yearAgoTitle(previousDay: string, today: string): string {
  const days = dayNumber(today) - dayNumber(previousDay);
  if (days >= 330 && days < 700) return 'Een jaar geleden schreef je…';
  if (days >= 700) return `${Math.round(days / 365)} jaar geleden schreef je…`;
  return 'De vorige keer schreef je…';
}
