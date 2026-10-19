const TOKEN_KEY = 'censorislabs-suite-license-token'
const LEGACY_TOKEN_KEY = 'arthasetu-license-token'
const DATABASE_NAME = 'censorislabs-license-vault'
const KEY_STORE = 'keys'
const ENCRYPTION_KEY_ID = 'license-token-aes-gcm-v1'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0))
}

function openKeyDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Secure local storage is unavailable.'))
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(KEY_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not open secure local storage.'))
  })
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not read the license key.'))
  })
}

async function getEncryptionKey() {
  const database = await openKeyDatabase()
  const existing = await requestResult<CryptoKey | undefined>(database.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get(ENCRYPTION_KEY_ID))
  if (existing) return existing

  const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  return new Promise<CryptoKey>((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, 'readwrite')
    const store = transaction.objectStore(KEY_STORE)
    let selected: CryptoKey | undefined
    const request = store.get(ENCRYPTION_KEY_ID)
    request.onsuccess = () => {
      selected = request.result || candidate
      if (!request.result) store.put(candidate, ENCRYPTION_KEY_ID)
    }
    transaction.oncomplete = () => selected ? resolve(selected) : reject(new Error('Could not save the license encryption key.'))
    transaction.onerror = () => reject(transaction.error || new Error('Could not save the license encryption key.'))
    transaction.onabort = () => reject(transaction.error || new Error('Could not save the license encryption key.'))
  })
}

async function encryptToken(token: string) {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(token))
  return `enc1.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(ciphertext))}`
}

async function decryptToken(value: string) {
  if (!value.startsWith('enc1.')) return value // migrate an older signed token on the next successful load
  const [, ivPart, ciphertextPart, extra] = value.split('.')
  if (!ivPart || !ciphertextPart || extra) throw new Error('Stored license data is invalid.')
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeBase64Url(ivPart) }, await getEncryptionKey(), decodeBase64Url(ciphertextPart))
  return decoder.decode(plaintext)
}

export async function loadLicenseToken() {
  const encryptedOrLegacy = localStorage.getItem(TOKEN_KEY)
  if (encryptedOrLegacy) {
    try { return await decryptToken(encryptedOrLegacy) } catch { return null }
  }
  return localStorage.getItem(LEGACY_TOKEN_KEY)
}

export async function storeLicenseToken(token: string) {
  localStorage.setItem(TOKEN_KEY, await encryptToken(token))
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export function clearLicenseToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}
