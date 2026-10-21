import { contrastRatio } from '../src/lib/contrast';
import { dark, light, type ColorTokens } from '../src/theme/tokens';

const pairs: [keyof ColorTokens, keyof ColorTokens][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceAlt'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['textMuted', 'surfaceAlt'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['onPrimary', 'primary'],
  ['secondary', 'surface'],
  ['onSecondary', 'secondary'],
  ['danger', 'surface'],
  ['danger', 'background'],
];

describe.each([
  ['licht', light],
  ['donker', dark],
])('contrast %s thema (WCAG AA ≥ 4.5)', (_name, theme) => {
  it.each(pairs)('%s op %s', (fg, bg) => {
    expect(contrastRatio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('contrast vaste combinaties', () => {
  it('Pill: donkere tekst op honing (accent) in beide thema\'s', () => {
    expect(contrastRatio('#2B2320', light.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#2B2320', dark.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['licht', light],
    ['donker', dark],
  ] as const)('%s: actieve keuzeknop en afgevinkte tekst', (_n, t) => {
    expect(contrastRatio(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.textMuted, t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.secondary, t.surfaceAlt)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.primary, t.surfaceAlt)).toBeGreaterThanOrEqual(4.5);
  });
});
