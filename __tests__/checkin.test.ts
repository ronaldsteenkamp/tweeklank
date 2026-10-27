import { latestOwnMonth, lowScales, previousMonth, shift, shiftsFor, type Checkin } from '../src/lib/checkin';

const row = (user: string, month: string, v: [number, number, number, number], wish: string | null = null): Checkin => ({
  id: Math.random(),
  user_id: user,
  month,
  connection: v[0],
  appreciated: v[1],
  conflict: v[2],
  time_together: v[3],
  wish,
});

describe('maandelijkse check-in', () => {
  it('rekent de vorige maand uit, ook over de jaargrens', () => {
    expect(previousMonth('2026-11-01')).toBe('2026-10-01');
    expect(previousMonth('2027-01-01')).toBe('2026-12-01');
  });

  it('toont alleen een verschuiving', () => {
    expect(shift(4, 3)).toBe('iets meer');
    expect(shift(3, 3)).toBe('gelijk');
    expect(shift(1, 5)).toBe('iets minder');
    expect(shift(3, null)).toBeNull();
  });

  const rows = [
    row('a', '2026-10-01', [2, 4, 3, 3]),
    row('a', '2026-11-01', [2, 5, 3, 2]),
    row('b', '2026-10-01', [4, 4, 3, 2]),
    row('b', '2026-11-01', [4, 3, 3, 4]),
  ];

  it('per persoon per schaal', () => {
    expect(shiftsFor(rows, 'a', '2026-11-01')).toEqual({
      connection: 'gelijk',
      appreciated: 'iets meer',
      conflict: 'gelijk',
      time_together: 'iets minder',
    });
    expect(shiftsFor(rows, 'b', '2026-12-01')).toEqual({});
  });

  it('signaleert twee maanden op rij 1 of 2, zonder te zeggen bij wie', () => {
    expect(lowScales(rows, '2026-11-01')).toEqual(['connection']);
    expect(lowScales(rows, '2026-10-01')).toEqual([]);
    expect(lowScales([row('a', '2026-11-01', [1, 1, 1, 1])], '2026-11-01')).toEqual([]);
  });

  it('vindt je meest recente check-in', () => {
    expect(latestOwnMonth(rows, 'a')).toBe('2026-11-01');
    expect(latestOwnMonth(rows, 'c')).toBeNull();
  });
});
