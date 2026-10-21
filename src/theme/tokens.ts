// Kleurpalet van Tweeklank: terracotta, zand en salie.
// Contrast van tekstcombinaties wordt getoetst in __tests__/contrast.test.ts (WCAG AA, ≥ 4.5:1).

export type ColorTokens = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  accent: string;
  danger: string;
};

export const light: ColorTokens = {
  background: '#FBF6F0',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EADF',
  border: '#E3D6C8',
  text: '#2B2320',
  textMuted: '#6B5D55',
  primary: '#A84B26',
  onPrimary: '#FFFFFF',
  secondary: '#4F6B55',
  onSecondary: '#FFFFFF',
  accent: '#E9B872',
  danger: '#A3312B',
};

export const dark: ColorTokens = {
  background: '#1C1714',
  surface: '#27201C',
  surfaceAlt: '#322923',
  border: '#46392F',
  text: '#F3EBE3',
  textMuted: '#BBAEA4',
  primary: '#E8916B',
  onPrimary: '#1C1714',
  secondary: '#9DBBA3',
  onSecondary: '#1C1714',
  accent: '#E9B872',
  danger: '#F08A80',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

// Lettergroottes zijn basiswaarden; React Native schaalt ze mee met de systeeminstelling.
export const font = { small: 14, body: 17, large: 20, title: 26, display: 34 } as const;
