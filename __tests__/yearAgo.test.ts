import { yearAgoTitle } from '../src/lib/yearAgo';

describe('een jaar geleden', () => {
  it('noemt een jaar als het ongeveer een jaar geleden is', () => {
    expect(yearAgoTitle('2025-10-27', '2026-10-27')).toBe('Een jaar geleden schreef je…');
    expect(yearAgoTitle('2025-12-01', '2026-10-27')).toBe('Een jaar geleden schreef je…');
  });

  it('noemt meer jaren als het langer geleden is', () => {
    expect(yearAgoTitle('2024-10-27', '2026-10-27')).toBe('2 jaar geleden schreef je…');
  });

  it('zegt "de vorige keer" als het minder dan een jaar geleden is', () => {
    expect(yearAgoTitle('2026-05-01', '2026-10-27')).toBe('De vorige keer schreef je…');
  });
});
