// Gisteren inhalen: wanneer de kaart "Gisteren nog open" verschijnt. Getest in __tests__/catchup.test.ts

export type YesterdayQuestion = {
  day: string;
  question_id: number;
  text: string;
  depth: 1 | 2 | 3;
  answered: boolean;
  partner_answered: boolean;
  /** je hebt gisteren vandaag ingehaald */
  caught_up: boolean;
};

export type YesterdayView = 'open' | 'ingehaald' | null;

/** 'open': nog te beantwoorden. 'ingehaald': vandaag ingehaald, toon het gesprek nog even. null: niets tonen. */
export function yesterdayView(y: YesterdayQuestion | null | undefined): YesterdayView {
  if (!y) return null;
  if (!y.answered) return 'open';
  return y.caught_up ? 'ingehaald' : null;
}
