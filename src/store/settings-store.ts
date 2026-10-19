/**
 * Settings store (Zustand). SQLite is the source of truth; this store is a
 * hydrated cache for the UI. Every setter writes through to the DB.
 */
import { create } from 'zustand';

import {
  getAllSettings,
  setSetting,
  type CityTier,
  type LockMethod,
  type NumberFormat,
  type ThemeMode,
} from '../data/settings-repo';
import { setLanguage, type Language } from '../i18n';

interface SettingsState {
  hydrated: boolean;
  onboarded: boolean;
  language: Language;
  numberFormat: NumberFormat;
  themeMode: ThemeMode;
  cityTier: CityTier;
  lockEnabled: boolean;
  lockMethod: LockMethod | null;
  lockAfterMinutes: number;

  hydrate(): Promise<void>;
  setOnboarded(value: boolean): Promise<void>;
  setLanguage(lang: Language): Promise<void>;
  setNumberFormat(format: NumberFormat): Promise<void>;
  setThemeMode(mode: ThemeMode): Promise<void>;
  setCityTier(tier: CityTier): Promise<void>;
  setLock(method: LockMethod, afterMinutes: number): Promise<void>;
  disableLock(): Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  hydrated: false,
  onboarded: false,
  language: 'en',
  numberFormat: 'full',
  themeMode: 'system',
  cityTier: 'tier2',
  lockEnabled: false,
  lockMethod: null,
  lockAfterMinutes: 1,

  async hydrate() {
    const s = await getAllSettings();
    // Apply stored language to i18next immediately.
    await setLanguage(s.language as Language);
    set({
      hydrated: true,
      onboarded: s.onboarded,
      language: s.language as Language,
      numberFormat: s.numberFormat,
      themeMode: s.themeMode,
      cityTier: s.cityTier,
      lockEnabled: s.lockEnabled,
      lockMethod: s.lockMethod,
      lockAfterMinutes: s.lockAfterMinutes,
    });
  },

  async setOnboarded(value) {
    set({ onboarded: value });
    await setSetting('onboarded', value);
  },

  async setLanguage(lang) {
    set({ language: lang });
    await setLanguage(lang); // i18next runtime switch, no restart
    await setSetting('language', lang);
  },

  async setNumberFormat(format) {
    set({ numberFormat: format });
    await setSetting('numberFormat', format);
  },

  async setThemeMode(mode) {
    set({ themeMode: mode });
    await setSetting('themeMode', mode);
  },

  async setCityTier(tier) {
    set({ cityTier: tier });
    await setSetting('cityTier', tier);
  },

  async setLock(method, afterMinutes) {
    set({ lockEnabled: true, lockMethod: method, lockAfterMinutes: afterMinutes });
    await setSetting('lockEnabled', true);
    await setSetting('lockMethod', method);
    await setSetting('lockAfterMinutes', afterMinutes);
  },

  async disableLock() {
    set({ lockEnabled: false, lockMethod: null });
    await setSetting('lockEnabled', false);
    // keep lockMethod so re-enabling remembers the previous choice
    void get();
  },
}));
