/**
 * Lock screen shown whenever the app is locked.
 * - Biometric method: prompts automatically, offers a PIN fallback button.
 * - PIN method: a large 4-digit keypad, one-handed friendly.
 * - After several wrong PINs we slow down (simple attempt throttle).
 * - The forgot-PIN hint tells the truth: data is local; wiping app data is
 *   the only reset path (no server exists to ask).
 */
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLockStore } from '../../store/lock-store';
import { useSettingsStore } from '../../store/settings-store';
import { isBiometricAvailable } from './lock-service';
import { Body, Button, Heading, Screen } from '../../ui/components';
import { resolveTypeStyle } from '../../ui/fonts';
import { useTheme } from '../../ui/theme-context';
import { useLang } from '../../ui/components';

const MAX_PIN_LENGTH = 4;

export function LockScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const lang = useLang();
  const lockMethod = useSettingsStore((s) => s.lockMethod);
  const pinTries = useLockStore((s) => s.pinTries);
  const unlockWithPin = useLockStore((s) => s.unlockWithPin);
  const unlockWithBiometric = useLockStore((s) => s.unlockWithBiometric);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [biometricReady, setBiometricReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (lockMethod === 'biometric') {
      isBiometricAvailable().then((available) => {
        if (!cancelled && available) {
          setBiometricReady(true);
          void unlockWithBiometric();
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [lockMethod, unlockWithBiometric]);

  // Small delay after 3 wrong tries so brute force is impractical on-device.
  const throttled = pinTries >= 3;

  async function submitCandidate(candidate: string) {
    const ok = await unlockWithPin(candidate);
    if (!ok) {
      setError(t('lock.wrongPin'));
      setPin('');
    }
  }

  function pressDigit(d: string) {
    if (throttled) return;
    setError(null);
    const next = (pin + d).slice(0, MAX_PIN_LENGTH);
    setPin(next);
    if (next.length === MAX_PIN_LENGTH) {
      void submitCandidate(next);
    }
  }

  function pressBack() {
    setPin((p) => p.slice(0, -1));
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(6) }}>
        <Heading text={t('lock.enterPin')} level={1} />
        {lockMethod === 'biometric' && biometricReady ? (
          <Body text={t('lock.biometricPrompt')} muted style={{ marginBottom: theme.spacing(4) }} />
        ) : null}

        {/* PIN dots */}
        <View
          accessibilityLabel={t('lock.enterPin')}
          accessibilityRole="none"
          style={{ flexDirection: 'row', gap: theme.spacing(3), marginVertical: theme.spacing(5) }}
        >
          {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: i < pin.length ? theme.colors.primary : 'transparent',
              }}
            />
          ))}
        </View>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={{ ...resolveTypeStyle('body', lang), color: theme.colors.danger, marginBottom: theme.spacing(3) }}>
            {error}
          </Text>
        ) : null}
        {throttled ? (
          <Body text={t('lock.wrongPin')} muted style={{ marginBottom: theme.spacing(3) }} />
        ) : null}

        {/* Keypad: 48dp+ targets, bottom-anchored for one-handed use */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: theme.spacing(4) }}>
          {digits.map((d, i) => (
            <Pressable
              key={i}
              disabled={d === '' || throttled}
              onPress={() => (d === '⌫' ? pressBack() : pressDigit(d))}
              accessibilityRole="button"
              accessibilityLabel={d === '⌫' ? 'backspace' : d}
              style={{
                width: '33.33%',
                minHeight: theme.touchTargetMin,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: theme.spacing(3),
              }}
            >
              <Text style={{ ...resolveTypeStyle('h2', lang), color: theme.colors.text }}>{d}</Text>
            </Pressable>
          ))}
        </View>

        {lockMethod === 'biometric' && biometricReady ? (
          <Button label={t('lock.biometricPrompt')} variant="secondary" onPress={() => void unlockWithBiometric()} />
        ) : null}
        <Body text={t('lock.forgotPinHint')} muted style={{ marginTop: theme.spacing(4) }} />
      </View>
    </Screen>
  );
}
