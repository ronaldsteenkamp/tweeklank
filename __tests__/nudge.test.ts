import { hourLabel, nudgeHint, shiftHour } from '../src/lib/nudge';

describe('duwtje en meldtijd', () => {
  it('toont het uur', () => {
    expect(hourLabel(9)).toBe('9:00');
    expect(hourLabel(0)).toBe('0:00');
  });

  it('schuift het uur rond de klok', () => {
    expect(shiftHour(9, 1)).toBe(10);
    expect(shiftHour(23, 1)).toBe(0);
    expect(shiftHour(0, -1)).toBe(23);
  });

  it('zegt niet waarom de knop niet beschikbaar is', () => {
    expect(nudgeHint({ available: false, sent_today: false }, 'Sam')).toBe('Nu niet beschikbaar.');
    expect(nudgeHint(null, 'Sam')).toBe('Nu niet beschikbaar.');
    expect(nudgeHint({ available: true, sent_today: true }, 'Sam')).toMatch(/^Verstuurd/);
    expect(nudgeHint({ available: true, sent_today: false }, 'Sam')).not.toMatch(/antwoord/);
  });
});
