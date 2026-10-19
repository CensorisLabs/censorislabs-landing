import { LICENSE_PRODUCT } from './pricing.js'

const storageKey = 'censorislabs-suite-license-token'
const encoder = new TextEncoder()

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0))
}

export async function validateLicenseToken(token) {
  const publicKeyText = import.meta.env?.VITE_LICENSE_PUBLIC_KEY
  if (!publicKeyText) return null
  try {
    const parts = token.trim().replace(/^CENSORISLABS\./i, '').split('.')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])))
    if (payload.product !== LICENSE_PRODUCT || !['PRO_MONTHLY', 'PRO_YEARLY', 'PRO_LIFETIME'].includes(payload.status) || !Number.isFinite(payload.issuedAt)) return null
    if (payload.expiresAt !== undefined && (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now())) return null
    const publicKey = await crypto.subtle.importKey('jwk', JSON.parse(publicKeyText), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, fromBase64Url(parts[1]), encoder.encode(parts[0]))
    return valid ? payload.status : null
  } catch {
    return null
  }
}

export async function getLicenseStatus() {
  try {
    const token = localStorage.getItem(storageKey)
    if (!token) return 'FREE'
    const status = await validateLicenseToken(token)
    if (!status) localStorage.removeItem(storageKey)
    return status || 'FREE'
  } catch {
    return 'FREE'
  }
}

export async function activateLicense(token) {
  const status = await validateLicenseToken(token)
  if (!status) return null
  localStorage.setItem(storageKey, token.trim())
  window.dispatchEvent(new CustomEvent('censorislabs:license-updated', { detail: { status } }))
  return status
}

export async function clearLicense() {
  localStorage.removeItem(storageKey)
  window.dispatchEvent(new CustomEvent('censorislabs:license-updated', { detail: { status: 'FREE' } }))
}
