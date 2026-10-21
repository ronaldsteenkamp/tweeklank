import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type ColorTokens } from './tokens';

export type ThemePref = 'system' | 'light' | 'dark';

type ThemeValue = {
  colors: ColorTokens;
  scheme: 'light' | 'dark';
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
};

const STORAGE_KEY = 'tweeklank.themePref';
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
    return {
      colors: scheme === 'dark' ? dark : light,
      scheme,
      pref,
      setPref: (next) => {
        setPrefState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
    };
  }, [pref, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme buiten ThemeProvider');
  return ctx;
}
