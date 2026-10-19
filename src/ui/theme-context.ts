/**
 * useTheme: resolves the active Theme from the stored theme mode
 * (light / dark / system) plus the device colour scheme.
 */
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../store/settings-store';
import { themeForMode, type Theme } from './theme';

export function useTheme(): Theme {
  const mode = useSettingsStore((s) => s.themeMode);
  const systemDark = useColorScheme() === 'dark';
  return themeForMode(mode, systemDark);
}
