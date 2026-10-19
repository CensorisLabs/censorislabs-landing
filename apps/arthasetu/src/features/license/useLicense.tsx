import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearLicenseToken, loadLicenseToken, storeLicenseToken } from './licenseStorage.ts'

export type LicenseStatus = 'FREE' | 'PRO_MONTHLY' | 'PRO_YEARLY' | 'PRO_LIFETIME'
export type ProFeature = 'sms_parser' | 'advanced_investments' | 'loan_planner' | 'tax_optimizer' | 'fire_forecast' | 'encrypted_vault' | 'custom_rules' | 'reports' | 'mandate_tracker' | 'account_limit'
export type PlanId = 'monthly' | 'yearly' | 'early_bird_lifetime' | 'lifetime'

type LicenseContextValue = { status: LicenseStatus; isPro: boolean; licenseReady: boolean; activateKey: (key: string) => Promise<boolean>; clearLicense: () => void }
const LicenseContext = createContext<LicenseContextValue | null>(null)
const encoder = new TextEncoder()
const licenseEnv = (import.meta as ImportMeta & { env?: { VITE_LICENSE_PUBLIC_KEY?: string } }).env
const publicJwkText = licenseEnv?.VITE_LICENSE_PUBLIC_KEY

type SignedLicense = { product: 'censorislabs-suite' | 'arthasetu'; status: Exclude<LicenseStatus, 'FREE'>; issuedAt: number; expiresAt?: number }

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0))
}

/** Offline tokens are verified with a public key. The issuer's private signing key must stay outside the app. */
export async function validateLicenseToken(token: string): Promise<LicenseStatus | null> {
  if (!publicJwkText) return null
  try {
    const [payloadPart, signaturePart, extra] = token.trim().replace(/^(CENSORISLABS|ARTHASETU)\./i, '').split('.')
    if (!payloadPart || !signaturePart || extra) return null
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart))) as SignedLicense
    if (!['censorislabs-suite', 'arthasetu'].includes(payload.product) || !['PRO_MONTHLY', 'PRO_YEARLY', 'PRO_LIFETIME'].includes(payload.status) || !Number.isFinite(payload.issuedAt)) return null
    if (payload.expiresAt !== undefined && (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now())) return null
    const publicKey = await crypto.subtle.importKey('jwk', JSON.parse(publicJwkText) as JsonWebKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, fromBase64Url(signaturePart) as BufferSource, encoder.encode(payloadPart))
    return valid ? payload.status : null
  } catch {
    return null
  }
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus>('FREE')
  const [ready, setReady] = useState(false)
  const licenseReady = Boolean(publicJwkText)

  useEffect(() => {
    let current = true
    void loadLicenseToken().then(async token => {
      if (!token) {
        if (current) setReady(true)
        return
      }
      const next = await validateLicenseToken(token)
      if (!current) return
      if (next) {
        setStatus(next)
        try { await storeLicenseToken(token) } catch { /* Keep the verified license active for this session. */ }
      } else {
        clearLicenseToken()
      }
      setReady(true)
    }).catch(() => { if (current) setReady(true) })
    return () => { current = false }
  }, [])

  const value = useMemo<LicenseContextValue>(() => ({
    status: ready ? status : 'FREE',
    isPro: ready && status !== 'FREE',
    licenseReady,
    activateKey: async key => {
      const next = await validateLicenseToken(key)
      if (!next) return false
      try { await storeLicenseToken(key.trim()) } catch { return false }
      setStatus(next)
      setReady(true)
      return true
    },
    clearLicense: () => { clearLicenseToken(); setStatus('FREE'); setReady(true) },
  }), [status, ready, licenseReady])

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>
}

export function useLicense() {
  const context = useContext(LicenseContext)
  if (!context) throw new Error('useLicense must be used inside LicenseProvider')
  return context
}
