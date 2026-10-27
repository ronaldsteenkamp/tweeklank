import { SOLO_OPENER, SOLO_OPENER_INTRO, SOLO_PARAGRAPHS, SOLO_TITLE, wordCount } from '../src/lib/solo';

describe('solo-kaart', () => {
  const all = [SOLO_TITLE, ...SOLO_PARAGRAPHS, SOLO_OPENER_INTRO, SOLO_OPENER];

  it('telt woorden', () => {
    expect(wordCount(['een twee', ' drie  '])).toBe(3);
  });

  it('de uitleg is hoogstens 120 woorden', () => {
    expect(wordCount(SOLO_PARAGRAPHS)).toBeLessThanOrEqual(120);
  });

  it('noemt geen aantallen, datums of schuld bij een van beiden', () => {
    const text = all.join(' ');
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/gemist|heeft nog niet|jouw schuld|zijn schuld|haar schuld/i);
    expect(text).toMatch(/niemands schuld/);
  });
});
