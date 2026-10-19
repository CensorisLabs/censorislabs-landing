/**
 * First-run onboarding wizard.
 * Steps: welcome -> language -> opening balances -> city tier -> lock -> done.
 * All values persist to SQLite through the settings/accounts repositories.
 * The user can skip the lock step; everything else is quick to change later.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { createAccount } from '../src/data/accounts-repo';
import { parseAmountToPaise } from '../src/domain/money';
import { clearPin, isBiometricAvailable, setPin } from '../src/features/settings/lock-service';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type Language } from '../src/i18n';
import { useSettingsStore } from '../src/store/settings-store';
import { Body, Button, Heading, Screen, TextField } from '../src/ui/components';
import { resolveTypeStyle } from '../src/ui/fonts';
import { useLang } from '../src/ui/components';
import { useTheme } from '../src/ui/theme-context';

type Step = 'welcome' | 'language' | 'balances' | 'cityTier' | 'lock' | 'pin' | 'done';

const STEP_ORDER: Step[] = ['welcome', 'language', 'balances', 'cityTier', 'lock', 'done'];

export default function Onboarding() {
  const { t } = useTranslation();
  const theme = useTheme();
  const lang = useLang();
  const settings = useSettingsStore();

  const [step, setStep] = useState<Step>('welcome');
  const [cashInput, setCashInput] = useState('');
  const [bankInput, setBankInput] = useState('');
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinStage, setPinStage] = useState<'create' | 'confirm'>('create');
  const [pinError, setPinError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function goNext() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  }

  function goBack() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  }

  async function finish(withLock: 'none' | 'pin' | 'biometric') {
    setSaving(true);
    try {
      // Opening balances become the two default accounts.
      const cash = parseAmountToPaise(cashInput) ?? 0;
      const bank = parseAmountToPaise(bankInput) ?? 0;
      await createAccount({ name: t('onboarding.cashBalance'), type: 'cash', openingBalancePaise: cash, sortOrder: 0 });
      await createAccount({ name: t('onboarding.bankBalance'), type: 'bank', openingBalancePaise: bank, sortOrder: 1 });

      if (withLock === 'pin') {
        await setPin(pinDraft);
        await settings.setLock('pin', 1);
      } else if (withLock === 'biometric') {
        await clearPin();
        await settings.setLock('biometric', 1);
      }

      await settings.setOnboarded(true);
      router.replace('/home');
    } finally {
      setSaving(false);
    }
  }

  function submitPinStage() {
    if (pinDraft.length < 4) {
      setPinError(t('onboarding.pinTooShort'));
      return;
    }
    if (pinStage === 'create') {
      setPinStage('confirm');
      setPinError(null);
      return;
    }
    if (pinDraft !== pinConfirm) {
      setPinStage('create');
      setPinDraft('');
      setPinConfirm('');
      setPinError(t('onboarding.pinMismatch'));
      return;
    }
    void finish('pin');
  }

  const tierOptions: Array<{ id: 'metro' | 'tier2' | 'tier3'; label: string }> = [
    { id: 'metro', label: t('onboarding.metro') },
    { id: 'tier2', label: t('onboarding.tier2') },
    { id: 'tier3', label: t('onboarding.tier3') },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(6), flexGrow: 1 }}>
        <Heading text={t('common.appName')} level={1} />
        <Body text={t('common.tagline')} muted style={{ marginBottom: theme.spacing(6) }} />

        {step === 'welcome' ? (
          <>
            <Heading text={t('onboarding.welcomeTitle')} />
            <Body text={t('onboarding.welcomeBody')} />
          </>
        ) : null}

        {step === 'language' ? (
          <>
            <Heading text={t('onboarding.languageTitle')} />
            {SUPPORTED_LANGUAGES.map((code: Language) => (
              <Pressable
                key={code}
                onPress={() => void settings.setLanguage(code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: settings.language === code }}
                accessibilityLabel={LANGUAGE_NAMES[code]}
                style={{
                  minHeight: theme.touchTargetMin,
                  justifyContent: 'center',
                  paddingHorizontal: theme.spacing(3),
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                  backgroundColor: settings.language === code ? theme.colors.surface : 'transparent',
                }}
              >
                <Text style={{ ...resolveTypeStyle('body', code === 'en' ? lang : code), color: theme.colors.text }}>
                  {LANGUAGE_NAMES[code]}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {step === 'balances' ? (
          <>
            <Heading text={t('onboarding.balancesTitle')} />
            <Body text={t('onboarding.balancesBody')} muted style={{ marginBottom: theme.spacing(4) }} />
            <TextField
              label={t('onboarding.cashBalance')}
              value={cashInput}
              onChangeText={setCashInput}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <TextField
              label={t('onboarding.bankBalance')}
              value={bankInput}
              onChangeText={setBankInput}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </>
        ) : null}

        {step === 'cityTier' ? (
          <>
            <Heading text={t('onboarding.cityTierTitle')} />
            <Body text={t('onboarding.cityTierBody')} muted style={{ marginBottom: theme.spacing(4) }} />
            {tierOptions.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => void settings.setCityTier(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: settings.cityTier === opt.id }}
                style={{
                  minHeight: theme.touchTargetMin,
                  justifyContent: 'center',
                  paddingHorizontal: theme.spacing(3),
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                  backgroundColor: settings.cityTier === opt.id ? theme.colors.surface : 'transparent',
                }}
              >
                <Text style={{ ...resolveTypeStyle('body', lang), color: theme.colors.text }}>{opt.label}</Text>
              </Pressable>
            ))}
            <Body text={t('onboarding.cityTierNote')} muted style={{ marginTop: theme.spacing(3) }} />
          </>
        ) : null}

        {step === 'lock' ? (
          <>
            <Heading text={t('onboarding.lockTitle')} />
            <Body text={t('onboarding.lockBody')} muted style={{ marginBottom: theme.spacing(4) }} />
            <Button
              label={t('onboarding.usePin')}
              onPress={() => {
                setPinStage('create');
                setPinDraft('');
                setPinConfirm('');
                setPinError(null);
                setStep('pin');
              }}
            />
            <View style={{ height: theme.spacing(3) }} />
            <Button
              label={t('onboarding.useBiometric')}
              variant="secondary"
              onPress={async () => {
                const available = await isBiometricAvailable();
                if (available) {
                  await finish('biometric');
                } else {
                  setStep('pin');
                }
              }}
            />
            <View style={{ height: theme.spacing(3) }} />
            <Button label={t('onboarding.skipLock')} variant="ghost" onPress={() => void finish('none')} />
          </>
        ) : null}

        {step === 'pin' ? (
          <>
            <Heading text={pinStage === 'create' ? t('onboarding.createPin') : t('onboarding.confirmPin')} />
            <TextField
              label={pinStage === 'create' ? t('onboarding.createPin') : t('onboarding.confirmPin')}
              value={pinStage === 'create' ? pinDraft : pinConfirm}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '').slice(0, 6);
                if (pinStage === 'create') setPinDraft(digits);
                else setPinConfirm(digits);
                setPinError(null);
              }}
              keyboardType="number-pad"
              secureTextEntry
            />
            {pinError ? (
              <Text accessibilityLiveRegion="polite" style={{ ...resolveTypeStyle('body', lang), color: theme.colors.danger }}>
                {pinError}
              </Text>
            ) : null}
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <Heading text={t('onboarding.allDoneTitle')} />
            <Body text={t('onboarding.allDoneBody')} />
          </>
        ) : null}

        <View style={{ flex: 1 }} />

        {/* Navigation footer */}
        <View style={{ marginTop: theme.spacing(6), gap: theme.spacing(3) }}>
          {step === 'welcome' ? <Button label={t('common.continue')} onPress={goNext} /> : null}
          {step === 'language' ? (
            <>
              <Button label={t('common.continue')} onPress={goNext} />
              <Button label={t('common.back')} variant="ghost" onPress={goBack} />
            </>
          ) : null}
          {step === 'balances' ? (
            <>
              <Button label={t('common.continue')} onPress={goNext} />
              <Button label={t('common.back')} variant="ghost" onPress={goBack} />
            </>
          ) : null}
          {step === 'cityTier' ? (
            <>
              <Button label={t('common.continue')} onPress={goNext} />
              <Button label={t('common.back')} variant="ghost" onPress={goBack} />
            </>
          ) : null}
          {step === 'pin' ? (
            <>
              <Button label={t('common.continue')} onPress={submitPinStage} disabled={saving} />
              <Button label={t('common.back')} variant="ghost" onPress={() => setStep('lock')} />
            </>
          ) : null}
          {step === 'done' ? <Button label={t('common.done')} onPress={() => void finish('none')} disabled={saving} /> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
