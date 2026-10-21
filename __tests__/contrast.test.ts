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
