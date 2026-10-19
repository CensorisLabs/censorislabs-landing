/**
 * Entry route. Sends the user to onboarding on first run, otherwise home.
 */
import { Redirect } from 'expo-router';

import { useSettingsStore } from '../src/store/settings-store';

export default function Index() {
  const onboarded = useSettingsStore((s) => s.onboarded);
  return <Redirect href={onboarded ? '/home' : '/onboarding'} />;
}
