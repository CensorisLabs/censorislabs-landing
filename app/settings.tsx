/**
 * Settings (Phase 1 scope): language, appearance, number format, app lock,
 * about. Later phases add categories, backup/export and Pro.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { clearPin, setPin } from '../src/features/settings/lock-service';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type Language } from '../src/i18n';
import { useSettingsStore } from '../src/store/settings-store';
import { Body, Button, Heading, Rule, Screen, TextField } from '../src/ui/components';
import { resolveTypeStyle } from '../src/ui/fonts';
import { useLang } from '../src/ui/components';
import { useTheme } from '../src/ui/theme-context';

function OptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const lang = useLang();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        minHeight: theme.touchTargetMin,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing(3),
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: selected ? theme.colors.surface : 'transparent',
      }}
    >
      <Text style={{ ...resolveTypeStyle('body', lang), color: selected ? theme.colors.primary : theme.colors.text }}>{label}</Text>
    </Pressable>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const lang = useLang();
  const settings = useSettingsStore();

  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinDraft, setPinDraft] = useState('');

  const themeOptions: Array<{ id: 'light' | 'dark' | 'system'; label: string }> = [
    { id: 'system', label: t('settings.themeSystem') },
    { id: 'light', label: t('settings.themeLight') },
    { id: 'dark', label: t('settings.themeDark') },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(6) }}>
        <Heading text={t('settings.title')} level={1} />

        <Heading text={t('settings.language')} />
        {SUPPORTED_LANGUAGES.map((code: Language) => (
          <OptionRow
            key={code}
            label={LANGUAGE_NAMES[code]}
            selected={settings.language === code}
            onPress={() => void settings.setLanguage(code)}
          />
        ))}

        <Rule />
        <Heading text={t('settings.theme')} />
        {themeOptions.map((opt) => (
          <OptionRow
            key={opt.id}
            label={opt.label}
            selected={settings.themeMode === opt.id}
            onPress={() => void settings.setThemeMode(opt.id)}
          />
        ))}

        <Rule />
        <Heading text={t('settings.numberFormat')} />
        <OptionRow
          label={t('settings.numberFormatFull')}
          selected={settings.numberFormat === 'full'}
          onPress={() => void settings.setNumberFormat('full')}
        />
        <OptionRow
          label={t('settings.numberFormatCompact')}
          selected={settings.numberFormat === 'compact'}
          onPress={() => void settings.setNumberFormat('compact')}
        />

        <Rule />
        <Heading text={t('settings.appLock')} />
        {settings.lockEnabled ? (
          <>
            <Body text={`${t('settings.lockAfter')}: ${settings.lockAfterMinutes} ${t('settings.lockAfterMinutes_other', { count: settings.lockAfterMinutes })}`} />
            <View style={{ height: theme.spacing(3) }} />
            <Button
              label={t('common.skip')}
              variant="danger"
              onPress={async () => {
                await clearPin();
                await settings.disableLock();
              }}
            />
          </>
        ) : showPinSetup ? (
          <>
            <TextField label={t('onboarding.createPin')} value={pinDraft} onChangeText={(v) => setPinDraft(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry />
            <Button
              label={t('common.save')}
              onPress={async () => {
                if (pinDraft.length >= 4) {
                  await setPin(pinDraft);
                  await settings.setLock('pin', 1);
                  setPinDraft('');
                  setShowPinSetup(false);
                }
              }}
            />
          </>
        ) : (
          <Button label={t('onboarding.usePin')} variant="secondary" onPress={() => setShowPinSetup(true)} />
        )}

        <Rule />
        <Heading text={t('settings.about')} />
        <Body text={t('common.notTaxAdvice')} muted />

        <View style={{ height: theme.spacing(6) }} />
        <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
