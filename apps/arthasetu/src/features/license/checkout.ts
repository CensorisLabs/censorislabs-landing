import { Capacitor } from '@capacitor/core'
import type { PlanId } from './useLicense.tsx'

const env = (import.meta as ImportMeta & { env?: { VITE_PRO_API_BASE?: string } }).env
const productionApi = 'https://censorislabs.online/api'

export type UpiCheckout = { checkoutToken: string; paymentUrl: string; expiresAt: number; amountPaise: number; planName: string }

function apiBase() {
  if (env?.VITE_PRO_API_BASE) return env.VITE_PRO_API_BASE.replace(/\/$/, '')
  if (Capacitor.isNativePlatform() || window.location.protocol === 'file:') return productionApi
  return window.location.origin + '/api'
}

async function post<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(apiBase() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Payment service is unavailable. Please try again later.')
  return body as T
}

export function createUpiCheckout(planId: PlanId, email: string) {
  return post<UpiCheckout>('/checkout', { planId, email })
}

export function verifyUpiReference(checkoutToken: string, utr: string) {
  return post<{ status: 'paid' | 'pending'; licenseToken?: string; message?: string; error?: string }>('/verify-utr', { checkoutToken, utr })
}
