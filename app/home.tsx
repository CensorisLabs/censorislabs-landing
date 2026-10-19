/**
 * Home screen (Phase 1 placeholder).
 * Phase 2 replaces the body with the monthly ledger dashboard; the shell
 * (welcome + settings entry) stays.
 */
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useSettingsStore } from '../src/store/settings-store';
import { Body, Heading, Rule, Screen } from '../src/ui/components';
import { resolveTypeStyle } from '../src/ui/fonts';
import { useLang } from '../src/ui/components';
import { useTheme } from '../src/ui/theme-context';

export default function Home() {
  const { t } = useTranslation();
  const theme = useTheme();
  const lang = useLang();
  const language = useSettingsStore((s) => s.language);

  return (
    <Screen>
      <View style={{ flex: 1, padding: theme.spacing(6) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={resolveTypeStyle('wordmark', language)} accessibilityRole="header" accessibilityLabel={t('common.appName')}>
            {t('common.appName')}
          </Text>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            style={{ minHeight: theme.touchTargetMin, minWidth: theme.touchTargetMin, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ ...resolveTypeStyle('body', lang), color: theme.colors.primary }}>{t('settings.title')}</Text>
          </Pressable>
        </View>
        <Rule />
        <Heading text={t('home.welcomeBack')} level={2} />
        <Body text={t('home.comingSoonBody')} muted />
      </View>
    </Screen>
  );
}
