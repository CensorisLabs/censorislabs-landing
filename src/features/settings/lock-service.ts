/**
 * App lock service.
 *
 * - PIN is never stored in plain text. We store a random salt plus
 *   SHA-256(salt + PIN) in expo-secure-store, which on Android is backed by
 *   the Keystore and on iOS by the Keychain.
 * - Biometric unlock uses expo-local-authentication (device biometrics; we
 *   never see or store biometric data).
 * - A locked-out user who forgets the PIN must wipe app data; the UI says so
 *   clearly. We deliberately do NOT build a remote reset (no server).
 */
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PIN_SALT_KEY = 'censoris.pin.salt';
const PIN_HASH_KEY = 'censoris.pin.hash';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

function normalizePin(pin: string): string {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4 to 6 digits');
  }
  return pin;
}

async function hashPin(salt: string, pin: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`,
  );
  return digest;
}

export async function hasPin(): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  return hash !== null;
}

export async function setPin(pin: string): Promise<void> {
  const normalized = normalizePin(pin);
  const salt = Crypto.getRandomBytes(16).reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
  const hash = await hashPin(salt, normalized);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt, SECURE_STORE_OPTIONS);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash, SECURE_STORE_OPTIONS);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = await SecureStore.getItemAsync(PIN_SALT_KEY);
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!salt || !storedHash) return false;
  let normalized: string;
  try {
    normalized = normalizePin(pin);
  } catch {
    return false;
  }
  const hash = await hashPin(salt, normalized);
  return hash === storedHash;
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
}

/** True when the device can do a biometric (or strong) authentication. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return false;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return (
      types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ||
      types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ||
      types.includes(LocalAuthentication.AuthenticationType.IRIS)
    );
  } catch {
    return false;
  }
}

/**
 * Prompt for biometric unlock. Returns true on success.
 * Never throws: a denial (including user cancellation) is just false, so the
 * app must not crash on permission denial.
 */
export async function authenticateBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Censoris',
      disableDeviceFallback: true, // force PIN entry via our own screen
    });
    return result.success;
  } catch {
    return false;
  }
}
