/**
 * Censoris design tokens — the single source of truth for colours, spacing,
 * radii and type. Brand: classical Roman authority + modern software craft.
 * Restrained, stone-and-ledger feel. No gradients as decoration.
 *
 * The tailwind.config.js mirrors these hex values for NativeWind classes.
 * Keep both in sync.
 */

export const palette = {
  marble: '#EEF1F3',
  basalt: '#1E2227',
  tyrian: '#5B1F4E',
  bronze: '#8E5B22',
  verdigris: '#2F6B62',
  // Dark theme
  darkBg: '#16181C',
  darkSurface: '#1F2227',
  darkText: '#E8EAED',
  darkPrimary: '#8A3A78',
  darkAccent: '#D9A25F',
  darkPositive: '#6FB8AC',
} as const;

export interface Theme {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    primary: string;
    onPrimary: string;
    accent: string;
    positive: string;
    danger: string;
    warning: string;
    border: string;
    inputBackground: string;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
  spacing: (n: number) => number;
  /** Minimum touch target per accessibility guidance. */
  touchTargetMin: number;
}

const spacing = (n: number) => n * 4;

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: '#EEF1F3', // Marble
    surface: '#FFFFFF',
    text: '#1E2227', // Basalt
    textMuted: '#5A6169', // 5.3:1 on Marble
    primary: '#5B1F4E', // Tyrian
    onPrimary: '#FFFFFF',
    accent: '#8E5B22', // Bronze
    positive: '#2F6B62', // Verdigris
    danger: '#9B2C2C',
    warning: '#8A5A00',
    border: '#D5DBE0',
    inputBackground: '#F7F9FA',
  },
  radius: { sm: 3, md: 5, lg: 8 },
  spacing,
  touchTargetMin: 48,
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: '#16181C',
    surface: '#1F2227',
    text: '#E8EAED',
    textMuted: '#9AA0A6', // 6.4:1 on dark background
    primary: '#8A3A78',
    onPrimary: '#FFFFFF',
    accent: '#D9A25F',
    positive: '#6FB8AC',
    danger: '#E07575',
    warning: '#E0B457',
    border: '#2C3138',
    inputBackground: '#22262C',
  },
  radius: { sm: 3, md: 5, lg: 8 },
  spacing,
  touchTargetMin: 48,
};

export type ThemeMode = 'light' | 'dark' | 'system';

export function themeForMode(mode: ThemeMode, systemDark: boolean): Theme {
  if (mode === 'system') return systemDark ? darkTheme : lightTheme;
  return mode === 'dark' ? darkTheme : lightTheme;
}
