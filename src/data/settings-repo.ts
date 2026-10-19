/**
 * Settings repository. Values are stored as JSON strings in the settings
 * table so types survive round-trips. SQLite is the single source of truth;
 * the Zustand settings store hydrates from here and writes back on change.
 */
import { getDb } from './db';

export type NumberFormat = 'full' | 'compact';
export type ThemeMode = 'light' | 'dark' | 'system';
export type CityTier = 'metro' | 'tier2' | 'tier3';
export type LockMethod = 'pin' | 'biometric';

/** Typed settings keys with their default values. */
export const settingDefaults: {
  onboarded: boolean;
  language: string; // validated Language in the store layer
  numberFormat: NumberFormat;
  themeMode: ThemeMode;
  cityTier: CityTier;
  lockEnabled: boolean;
  lockMethod: LockMethod | null;
  lockAfterMinutes: number;
} = {
  onboarded: false,
  language: 'en',
  numberFormat: 'full',
  themeMode: 'system',
  cityTier: 'tier2',
  lockEnabled: false,
  lockMethod: null,
  lockAfterMinutes: 1,
};

export type SettingKey = keyof typeof settingDefaults;
export type SettingValue<K extends SettingKey> = (typeof settingDefaults)[K];

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return settingDefaults[key];
  try {
    return JSON.parse(row.value) as SettingValue<K>;
  } catch {
    return settingDefaults[key];
  }
}

export async function getAllSettings(): Promise<typeof settingDefaults> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const result: Record<string, unknown> = { ...settingDefaults };
  for (const row of rows) {
    if (!(row.key in settingDefaults)) continue;
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      // keep default for corrupt values
    }
  }
  return result as typeof settingDefaults;
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  );
}

export async function wipeAllData(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM settings');
  await db.execAsync('DELETE FROM accounts');
}
