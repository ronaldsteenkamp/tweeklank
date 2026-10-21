import { amsterdamDay, formatDayNl, relativeDayNl } from '../src/lib/dates';

describe('amsterdamDay', () => {
  it('wisselt om middernacht Amsterdamse tijd (wintertijd, UTC+1)', () => {
    expect(amsterdamDay(new Date('2026-01-15T22:59:00Z'))).toBe('2026-01-15');
    expect(amsterdamDay(new Date('2026-01-15T23:00:00Z'))).toBe('2026-01-16');
  });

  it('wisselt om middernacht Amsterdamse tijd (zomertijd, UTC+2)', () => {
    expect(amsterdamDay(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(amsterdamDay(new Date('2026-07-01T22:00:00Z'))).toBe('2026-07-02');
  });

  it('klopt rond de overgang naar zomertijd (29 maart 2026)', () => {
    expect(amsterdamDay(new Date('2026-03-28T22:30:00Z'))).toBe('2026-03-28');
    expect(amsterdamDay(new Date('2026-03-29T01:30:00Z'))).toBe('2026-03-29');
    expect(amsterdamDay(new Date('2026-03-29T21:59:00Z'))).toBe('2026-03-29');
    expect(amsterdamDay(new Date('2026-03-29T22:00:00Z'))).toBe('2026-03-30');
  });

  it('klopt rond de overgang naar wintertijd (25 oktober 2026)', () => {
    expect(amsterdamDay(new Date('2026-10-24T21:59:00Z'))).toBe('2026-10-24');
    expect(amsterdamDay(new Date('2026-10-24T22:00:00Z'))).toBe('2026-10-25');
    expect(amsterdamDay(new Date('2026-10-25T22:59:00Z'))).toBe('2026-10-25');
    expect(amsterdamDay(new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
  });
});

describe('formatDayNl / relativeDayNl', () => {
  it('formatteert in het Nederlands', () => {
    expect(formatDayNl('2026-10-21', '2026-10-21')).toBe('woensdag 21 oktober');
    expect(formatDayNl('2025-12-31', '2026-10-21')).toBe('woensdag 31 december 2025');
  });

  it('geeft Vandaag en Gisteren, ook over een jaargrens', () => {
    expect(relativeDayNl('2026-10-21', '2026-10-21')).toBe('Vandaag');
    expect(relativeDayNl('2026-10-20', '2026-10-21')).toBe('Gisteren');
    expect(relativeDayNl('2025-12-31', '2026-01-01')).toBe('Gisteren');
    expect(relativeDayNl('2026-10-18', '2026-10-21')).toBe('Zondag 18 oktober');
  });
});
