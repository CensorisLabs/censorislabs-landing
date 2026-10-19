/**
 * Root layout.
 *
 * Boot sequence:
 * 1. Load fonts (Cinzel, Inter, Noto per script).
 * 2. Open SQLite + run migrations, hydrate settings store.
 * 3. If the user enabled the app lock and the inactivity timeout elapsed (or
 *    this is a cold start), show the LockScreen instead of the app.
 * 4. Render the Expo Router stack.
 *
 * Everything works offline; no network is touched anywhere in boot.
 */
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useTranslation } from 'react-i18next';

import { fonts } from '../src/ui/fonts';
import { useTheme } from '../src/ui/theme-context';
import { useSettingsStore } from '../src/store/settings-store';
import { useLockStore } from '../src/store/lock-store';
import { LockScreen } from '../src/features/settings/LockScreen';
import '../src/i18n';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fonts);
  const theme = useTheme();
  const { t } = useTranslation();

  const hydrated = useSettingsStore((s) => s.hydrated);
  const lockEnabled = useSettingsStore((s) => s.lockEnabled);
  const locked = useLockStore((s) => s.locked);
  const lock = useLockStore((s) => s.lock);
  const noteActivity = useLockStore((s) => s.noteActivity);

  // Hydrate settings (and therefore SQLite) once at startup.
  useEffect(() => {
    void useSettingsStore.getState().hydrate();
  }, []);

  // Start locked when the feature is enabled: locks on cold start and after
  // the inactivity timeout while backgrounded.
  useEffect(() => {
    if (!hydrated) return;
    if (useLockStore.getState().shouldLockForInactivity()) {
      lock();
    }
  }, [hydrated, lock]);

  // Track foreground/background transitions for lock-after-inactivity.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        // Hide contents in the recent-apps switcher by locking immediately
        // when a lock is configured (see docs/DECISIONS.md).
        if (useSettingsStore.getState().lockEnabled) lock();
      } else if (state === 'active') {
        noteActivity();
      }
    });
    return () => sub.remove();
  }, [lock, noteActivity]);

  const booting = !fontsLoaded || !fontError || !hydrated;
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel={t('common.appName')} />
      </View>
    );
  }
  void booting;

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (locked && lockEnabled) {
    return <LockScreen />;
  }

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="home" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}
