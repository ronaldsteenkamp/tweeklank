import { yesterdayView, type YesterdayQuestion } from '../src/lib/catchup';

const y = (patch: Partial<YesterdayQuestion>): YesterdayQuestion => ({
  day: '2026-10-26',
  question_id: 1,
  text: 'Vraag?',
  depth: 1,
  answered: false,
  partner_answered: false,
  caught_up: false,
  ...patch,
});

describe('gisteren inhalen', () => {
  it('toont niets als er gisteren geen vraag was', () => {
    expect(yesterdayView(null)).toBeNull();
    expect(yesterdayView(undefined)).toBeNull();
  });

  it('toont de vraag zolang je die niet hebt beantwoord', () => {
    expect(yesterdayView(y({}))).toBe('open');
    expect(yesterdayView(y({ partner_answered: true }))).toBe('open');
  });

  it('toont het gesprek nog even als je vandaag hebt ingehaald', () => {
    expect(yesterdayView(y({ answered: true, caught_up: true }))).toBe('ingehaald');
  });

  it('toont niets als je gisteren al op tijd antwoordde', () => {
    expect(yesterdayView(y({ answered: true }))).toBeNull();
  });
});
