import { DEFAULT_PLANNING, readPlanningState, type PlanningState } from './planning.ts'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
export const FINANCE_VAULT_KEY = 'arthasetu-finance-vault'
export const PIN_KEY = 'arthasetu-pin'
export type FinanceData = { transactions: unknown[]; accounts: unknown[]; mandates: unknown[]; planning?: PlanningState }

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0))

async function deriveAesKey(secret: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 120_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function derivePinHash(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 180_000, hash: 'SHA-256' }, material, 256)
  return new Uint8Array(bits)
}

export async function encryptJson(value: unknown, secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(secret, salt)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, encoder.encode(JSON.stringify(value)))
  return JSON.stringify({ version: 1, algorithm: 'AES-256-GCM', salt: toBase64(salt), iv: toBase64(iv), payload: toBase64(new Uint8Array(encrypted)) })
}

export async function decryptJson<T>(encoded: string, secret: string): Promise<T> {
  const envelope = JSON.parse(encoded) as { version: number; algorithm: string; salt: string; iv: string; payload: string }
  if (envelope.version !== 1 || envelope.algorithm !== 'AES-256-GCM') throw new Error('Unsupported encrypted vault format')
  const key = await deriveAesKey(secret, fromBase64(envelope.salt))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) as unknown as BufferSource }, key, fromBase64(envelope.payload) as unknown as BufferSource)
  return JSON.parse(decoder.decode(plain)) as T
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePinHash(pin, salt)
  return JSON.stringify({ version: 2, salt: toBase64(salt), hash: toBase64(hash) })
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_KEY)
  if (!stored) return false
  try {
    const value = JSON.parse(stored) as { version?: number; salt?: string; hash?: string }
    if (value.version === 2 && value.salt && value.hash) {
      const actual = await derivePinHash(pin, fromBase64(value.salt))
      const expected = fromBase64(value.hash)
      return actual.length === expected.length && actual.every((byte, index) => byte === expected[index])
    }
  } catch { /* Read legacy hashes below so existing PINs can be upgraded on next save. */ }
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`arthasetu-pin:${pin}`))
  return toBase64(new Uint8Array(digest)) === stored
}

function validFinanceData(value: unknown): value is FinanceData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return Array.isArray(data.transactions) && Array.isArray(data.accounts) && Array.isArray(data.mandates)
}

function normalizeFinanceData(value: unknown): FinanceData | null {
  if (!validFinanceData(value)) return null
  return { ...value, planning: readPlanningState(value.planning) }
}

/** Reads only unencrypted data synchronously; encrypted data must be unlocked asynchronously. */
export function readFinanceDataSync(): FinanceData | null {
  try {
    const stored = localStorage.getItem(FINANCE_VAULT_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as unknown
      if (parsed && typeof parsed === 'object' && 'algorithm' in parsed) return null
      const normalized = normalizeFinanceData(parsed)
      if (normalized) return normalized
    }
    const transactions = JSON.parse(localStorage.getItem('arthasetu-tx') || 'null')
    const accounts = JSON.parse(localStorage.getItem('arthasetu-accounts') || 'null')
    const mandates = JSON.parse(localStorage.getItem('arthasetu-mandates') || 'null')
    if (Array.isArray(transactions) || Array.isArray(accounts) || Array.isArray(mandates)) return {
      transactions: Array.isArray(transactions) ? transactions : [],
      accounts: Array.isArray(accounts) ? accounts : [],
      mandates: Array.isArray(mandates) ? mandates : [],
      planning: DEFAULT_PLANNING,
    }
  } catch { return null }
  return null
}

let saveQueue = Promise.resolve()
export function saveFinanceData(data: FinanceData, secret = ''): Promise<void> {
  const write = saveQueue.then(async () => {
    const normalized = { ...data, planning: readPlanningState(data.planning) }
    const serialized = secret ? await encryptJson(normalized, secret) : JSON.stringify(normalized)
    localStorage.setItem(FINANCE_VAULT_KEY, serialized)
    localStorage.removeItem('arthasetu-tx')
    localStorage.removeItem('arthasetu-accounts')
    localStorage.removeItem('arthasetu-mandates')
  })
  saveQueue = write.catch(() => undefined)
  return write
}

export async function readFinanceData(secret = ''): Promise<FinanceData | null> {
  const stored = localStorage.getItem(FINANCE_VAULT_KEY)
  if (!stored) return readFinanceDataSync()
  try {
    const parsed = JSON.parse(stored) as { algorithm?: string }
    if (parsed?.algorithm === 'AES-256-GCM') return secret ? normalizeFinanceData(await decryptJson<FinanceData>(stored, secret)) : null
    return normalizeFinanceData(parsed)
  } catch { return null }
}
