import { goalReached, pauseLabel, PAUSE_OPTIONS, streakLabel, WEEK_GOALS, weekLabel } from '../src/lib/rhythm';

describe('weekritme', () => {
  it('toont samen-dagen van deze week', () => {
    expect(weekLabel({ together_days: 4, goal: 5 })).toBe('4 van 5 samen-dagen deze week');
    expect(weekLabel({ together_days: 0, goal: 3 })).toBe('0 van 3 samen-dagen deze week');
  });

  it('toont de reeks in weken, en niets zonder reeks', () => {
    expect(streakLabel(12)).toBe('12 weken op rij');
    expect(streakLabel(1)).toBe('1 week op rij');
    expect(streakLabel(0)).toBeNull();
  });

  it('beschrijft de pauze rustig', () => {
    expect(pauseLabel({ week_paused: true, pause_active: true, pause_end: '2026-11-07' }, '2026-10-27')).toBe(
      'Jullie ritme staat op pauze tot en met zaterdag 7 november.',
    );
    expect(pauseLabel({ week_paused: true, pause_active: true, pause_end: null })).toBe(
      'Jullie ritme staat op pauze tot een van jullie hem uitzet.',
    );
    expect(pauseLabel({ week_paused: true, pause_active: false, pause_end: null })).toMatch(/telt niet mee/);
    expect(pauseLabel({ week_paused: false, pause_active: false, pause_end: null })).toBeNull();
  });

  it('herkent een gehaald doel', () => {
    expect(goalReached({ together_days: 5, goal: 5 })).toBe(true);
    expect(goalReached({ together_days: 4, goal: 5 })).toBe(false);
  });

  it('biedt de afgesproken keuzes', () => {
    expect([...WEEK_GOALS]).toEqual([3, 4, 5, 6, 7]);
    expect(PAUSE_OPTIONS.map((o) => o.weeks)).toEqual([1, 2, 4, null]);
  });

  it('gebruikt geen verliestaal', () => {
    const texts = [
      weekLabel({ together_days: 1, goal: 7 }),
      pauseLabel({ week_paused: true, pause_active: false, pause_end: null }),
      ...PAUSE_OPTIONS.map((o) => o.label),
    ].join(' ');
    expect(texts).not.toMatch(/kwijt|verloren|gebroken|gemist|mislukt|helaas/i);
  });
});
