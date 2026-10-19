import { createHmac, createPrivateKey, randomBytes, sign, timingSafeEqual } from 'node:crypto'

export const PLANS = {
  monthly: { amountPaise: 6900, status: 'PRO_MONTHLY', days: 31, name: 'Pro Monthly' },
  yearly: { amountPaise: 29900, status: 'PRO_YEARLY', days: 366, name: 'Pro Yearly' },
  early_bird_lifetime: { amountPaise: 49900, status: 'PRO_LIFETIME', days: 0, name: 'Early-bird Lifetime' },
  lifetime: { amountPaise: 99900, status: 'PRO_LIFETIME', days: 0, name: 'Lifetime' },
}

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_ALLOWED_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

export function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export function readJson(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)) } catch { return Promise.resolve({}) }
  }
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk; if (body.length > 16_384) reject(new Error('Request is too large.')) })
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}) } catch { reject(new Error('Invalid JSON.')) } })
    req.on('error', reject)
  })
}

export function paymentConfigReady() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.CHECKOUT_TOKEN_SECRET && process.env.LICENSE_PRIVATE_JWK)
}

export async function razorpay(path, method = 'GET', body) {
  const authorization = Buffer.from(process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET).toString('base64')
  const response = await fetch('https://api.razorpay.com/v1/' + path, {
    method,
    headers: { Authorization: 'Basic ' + authorization, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error?.description || 'The payment provider could not complete this request.')
  return result
}

export function createCheckoutToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', process.env.CHECKOUT_TOKEN_SECRET).update(encoded).digest('base64url')
  return encoded + '.' + signature
}

export function verifyCheckoutToken(token) {
  const [encoded, signature, extra] = String(token || '').split('.')
  if (!encoded || !signature || extra) return null
  const expected = createHmac('sha256', process.env.CHECKOUT_TOKEN_SECRET).update(encoded).digest()
  let supplied
  try { supplied = Buffer.from(signature, 'base64url') } catch { return null }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (!PLANS[payload.planId] || typeof payload.paymentLinkId !== 'string' || !Number.isFinite(payload.amountPaise) || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null
    return payload
  } catch { return null }
}

export function issueLicense(planId) {
  const plan = PLANS[planId]
  if (!plan) throw new Error('Unknown Pro plan.')
  const issuedAt = Date.now()
  const payload = { product: 'censorislabs-suite', status: plan.status, issuedAt }
  if (plan.days) payload.expiresAt = issuedAt + plan.days * 24 * 60 * 60 * 1000
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const privateJwk = JSON.parse(process.env.LICENSE_PRIVATE_JWK || '{}')
  const key = createPrivateKey({ key: privateJwk, format: 'jwk' })
  const signature = sign('sha256', Buffer.from(encoded), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return 'CENSORISLABS.' + encoded + '.' + signature
}

export function newCheckoutReference() { return randomBytes(18).toString('hex') }
