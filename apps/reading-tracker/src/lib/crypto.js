// Passphrase-protected backups. Key: PBKDF2-HMAC-SHA256 → AES-256-GCM (Web Crypto).
// The same file format carries an unencrypted backup when the user explicitly chooses that.
export const BACKUP_FORMAT = 'censorislabs-reading-tracker-backup'
export const PBKDF2_ITERATIONS = 600000
const MIN_ITERATIONS = 10000
const MAX_ITERATIONS = 5000000
export const MIN_PASSPHRASE = 8

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

async function deriveKey(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const aadFor = (envelope) => encoder.encode(JSON.stringify({ format: envelope.format, version: envelope.version }))

export function plainBackup(data) {
  return { format: BACKUP_FORMAT, version: 1, encrypted: false, exportedAt: new Date().toISOString(), data }
}

export async function encryptBackup(data, passphrase, iterations = PBKDF2_ITERATIONS) {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE) throw new Error(`Use a passphrase of at least ${MIN_PASSPHRASE} characters.`)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const header = {
    format: BACKUP_FORMAT,
    version: 1,
    encrypted: true,
    kdf: 'PBKDF2-SHA256',
    iterations,
    cipher: 'AES-256-GCM',
    salt: toBase64(salt),
    iv: toBase64(iv),
    exportedAt: new Date().toISOString(),
  }
  const key = await deriveKey(passphrase, salt, iterations)
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadFor(header) }, key, encoder.encode(JSON.stringify(data)))
  return { ...header, data: toBase64(new Uint8Array(sealed)) }
}

export async function decryptBackup(envelope, passphrase) {
  const { iterations, salt, iv, data } = envelope
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS || typeof salt !== 'string' || typeof iv !== 'string' || typeof data !== 'string') {
    throw new Error('This backup file is damaged or uses an unsupported format.')
  }
  try {
    const key = await deriveKey(String(passphrase || ''), fromBase64(salt), iterations)
    const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv), additionalData: aadFor(envelope) }, key, fromBase64(data))
    return JSON.parse(decoder.decode(opened))
  } catch {
    throw new Error('That passphrase did not unlock the backup, or the file is damaged.')
  }
}

/** Parses a backup file's text. Throws a readable error if it is not a Reading Tracker backup. */
export function readBackupText(text) {
  let envelope
  try { envelope = JSON.parse(text) } catch { throw new Error('This file is not valid JSON, so it cannot be a Reading Tracker backup.') }
  if (!envelope || typeof envelope !== 'object' || envelope.format !== BACKUP_FORMAT) throw new Error('This file is not a Reading Tracker backup.')
  if (envelope.version !== 1) throw new Error('This backup was made by a newer version of the app and cannot be read here.')
  if (envelope.encrypted === false && (typeof envelope.data !== 'object' || envelope.data === null)) throw new Error('This backup file has no data in it.')
  return envelope
}
