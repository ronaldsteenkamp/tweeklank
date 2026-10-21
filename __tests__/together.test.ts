import {
  daysUntil,
  filterIdeas,
  nextOccurrence,
  parseDateParts,
  relativeLabel,
  sortDates,
  sortPlans,
  yearsAt,
  type DateIdea,
  type ImportantDate,
  type Plan,
} from '../src/lib/together';

describe('nextOccurrence (zelfde regels als de database)', () => {
  it.each([
    ['2020-03-15', true, '2026-03-10', '2026-03-15'],
    ['2020-03-05', true, '2026-03-10', '2027-03-05'],
    ['2020-12-31', true, '2026-12-31', '2026-12-31'],
    ['2020-01-01', true, '2026-12-31', '2027-01-01'],
    ['2024-02-29', true, '2026-02-20', '2026-02-28'],
    ['2024-02-29', true, '2028-02-01', '2028-02-29'],
    ['2026-01-01', false, '2026-03-10', null],
    ['2026-05-01', false, '2026-03-10', '2026-05-01'],
    ['2027-06-01', true, '2026-03-10', '2027-06-01'],
  ] as const)('%s (jaarlijks: %s) vanaf %s → %s', (date, yearly, today, expected) => {
    expect(nextOccurrence(date, yearly, today)).toBe(expected);
  });
});

describe('datums', () => {
  it('telt dagen, ook over een jaargrens en zomertijd', () => {
    expect(daysUntil('2026-03-17', '2026-03-10')).toBe(7);
    expect(daysUntil('2027-01-02', '2026-12-30')).toBe(3);
    expect(daysUntil('2026-03-30', '2026-03-28')).toBe(2);
  });

  it('geeft een leesbaar label', () => {
    expect(relativeLabel(0)).toBe('Vandaag');
    expect(relativeLabel(1)).toBe('Morgen');
    expect(relativeLabel(12)).toBe('Over 12 dagen');
  });

  it('berekent jaren voor een jubileum', () => {
    expect(yearsAt('2020-03-17', '2026-03-17')).toBe(6);
  });

  it('sorteert op eerstvolgende datum, voorbije eenmalige onderaan', () => {
    const d = (id: number, date: string, yearly: boolean): ImportantDate => ({
      id, title: `D${id}`, kind: 'anders', date, yearly, remind_days_before: 1, created_by: 'u',
    });
    const sorted = sortDates([d(1, '2020-12-01', true), d(2, '2026-01-01', false), d(3, '2020-04-01', true)], '2026-03-10');
    expect(sorted.map((x) => x.id)).toEqual([3, 1, 2]);
    expect(sorted[2].next).toBeNull();
  });

  it('valideert ingevoerde datums', () => {
    expect(parseDateParts('29', '2', '2028')).toBe('2028-02-29');
    expect(parseDateParts('29', '2', '2026')).toBeNull();
    expect(parseDateParts('31', '4', '2026')).toBeNull();
    expect(parseDateParts('5', '13', '2026')).toBeNull();
    expect(parseDateParts('a', '1', '2026')).toBeNull();
    expect(parseDateParts(' 7', '3 ', '2026')).toBe('2026-03-07');
  });
});

describe('ideeën en plannen', () => {
  const idea = (id: number, budget: DateIdea['budget'], setting: DateIdea['setting']): DateIdea => ({
    id, slug: `di-${id}`, position: id, title: `Idee ${id}`, description: '', budget, setting, minutes: 60,
  });
  const ideas = [idea(2, 'gratis', 'buiten'), idea(1, '€€', 'binnen'), idea(3, 'gratis', 'binnen')];

  it('filtert op budget en binnen/buiten', () => {
    expect(filterIdeas(ideas, { budget: null, setting: null }).map((i) => i.id)).toEqual([1, 2, 3]);
    expect(filterIdeas(ideas, { budget: 'gratis', setting: null }).map((i) => i.id)).toEqual([2, 3]);
    expect(filterIdeas(ideas, { budget: 'gratis', setting: 'binnen' }).map((i) => i.id)).toEqual([3]);
  });

  it('zet open plannen met datum bovenaan en afgeronde onderaan', () => {
    const p = (id: number, planned_for: string | null, done: boolean, created_at = '2026-01-01'): Plan => ({
      id, title: `P${id}`, notes: null, planned_for, done, created_at, created_by: 'u',
    });
    const sorted = sortPlans([p(1, null, false, '2026-01-01'), p(2, '2026-05-01', true), p(3, '2026-04-01', false), p(4, null, false, '2026-02-01')]);
    expect(sorted.map((x) => x.id)).toEqual([3, 4, 1, 2]);
  });
});
