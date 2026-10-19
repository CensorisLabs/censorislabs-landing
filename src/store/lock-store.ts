/**
 * Lock store: whether the app is currently locked, and unlock actions.
 *
 * Lock-after-inactivity: the root layout feeds app state changes
 * (background/foreground) into `lockSoon`/`noteActivity`; a timer locks the
 * app when the configured number of minutes passes. We do not need
 * background permissions for this because we only check elapsed time when
 * the app comes back to the foreground.
 */
import { create } from 'zustand';

import { authenticateBiometric, verifyPin } from '../features/settings/lock-service';
import { useSettingsStore } from './settings-store';

interface LockState {
  locked: boolean;
  pinTries: number;
  /** Last known foreground activity timestamp (ms). */
  lastActiveAt: number;

  lock(): void;
  noteActivity(): void;
  /** Returns true when the lock timeout has elapsed and we should lock. */
  shouldLockForInactivity(): boolean;
  unlockWithPin(pin: string): Promise<boolean>;
  unlockWithBiometric(): Promise<boolean>;
}

export const useLockStore = create<LockState>((set, get) => ({
  locked: false,
  pinTries: 0,
  lastActiveAt: Date.now(),

  lock() {
    set({ locked: true, pinTries: 0 });
  },

  noteActivity() {
    set({ lastActiveAt: Date.now() });
  },

  shouldLockForInactivity() {
    const settings = useSettingsStore.getState();
    if (!settings.lockEnabled) return false;
    const elapsedMs = Date.now() - get().lastActiveAt;
    return elapsedMs >= settings.lockAfterMinutes * 60_000;
  },

  async unlockWithPin(pin) {
    const ok = await verifyPin(pin);
    if (ok) {
      set({ locked: false, pinTries: 0, lastActiveAt: Date.now() });
    } else {
      set({ pinTries: get().pinTries + 1 });
    }
    return ok;
  },

  async unlockWithBiometric() {
    const settings = useSettingsStore.getState();
    if (settings.lockMethod !== 'biometric') return false;
    const ok = await authenticateBiometric();
    if (ok) set({ locked: false, pinTries: 0, lastActiveAt: Date.now() });
    return ok;
  },
}));
