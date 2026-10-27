// Themaweken: teksten voor het aanbod en de voortgang. Getest in __tests__/series.test.ts

export type SeriesOffer = {
  series_id: number;
  slug: string;
  title: string;
  intro: string;
  i_chose: boolean;
  partner_chose: boolean;
};

/** "Themaweek Geld en wij · dag 3 van 7" */
export function seriesLabel(title: string, step: number): string {
  return `Themaweek ${title} · dag ${step} van 7`;
}

/** Wat het koppel ziet bij het aanbod: wie koos wat, en of je wacht. */
export function offerStatus(offers: SeriesOffer[], partnerName: string): string | null {
  const mine = offers.find((o) => o.i_chose);
  const theirs = offers.find((o) => o.partner_chose);
  if (mine && theirs && mine.series_id !== theirs.series_id) {
    return `Jij koos ${mine.title}, ${partnerName} koos ${theirs.title}. Kies dezelfde om te beginnen.`;
  }
  if (mine) return `Je koos ${mine.title}. Wacht op ${partnerName}.`;
  if (theirs) return `${partnerName} koos ${theirs.title}. Kies die ook om te beginnen, of kies een andere.`;
  return null;
}

/** Op de laatste dag van een themaweek volgt de afsluitende oefening. */
export function isSeriesFinale(step: number | null, exerciseSlug: string | null): boolean {
  return step === 7 && !!exerciseSlug;
}
