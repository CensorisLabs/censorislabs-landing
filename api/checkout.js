import { PLANS, createCheckoutToken, newCheckoutReference, paymentConfigReady, razorpay, readJson, sendJson, setCors } from '../server/payments.js'

const EXPIRES_IN_SECONDS = 10 * 60

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST to create a checkout.' })
  if (!paymentConfigReady()) return sendJson(res, 503, { error: 'UPI checkout is not configured on the service yet.' })

  try {
    const input = await readJson(req)
    const planId = String(input.planId || '')
    const email = String(input.email || '').trim().toLowerCase()
    const plan = PLANS[planId]
    if (!plan || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: 'Choose a plan and enter a valid email address.' })

    const createdAt = Date.now()
    const expiresAt = createdAt + EXPIRES_IN_SECONDS * 1000
    const verificationExpiresAt = createdAt + 24 * 60 * 60 * 1000
    const reference = newCheckoutReference()
    const paymentLink = await razorpay('payment_links', 'POST', {
      upi_link: true,
      amount: plan.amountPaise,
      currency: 'INR',
      accept_partial: false,
      reference_id: reference,
      description: 'ArthaSetu Pro ' + plan.name,
      customer: { email },
      expire_by: Math.floor(expiresAt / 1000),
      notify: { email: true, sms: false },
      reminder_enable: false,
      notes: { app: 'arthasetu', plan_id: planId, checkout_ref: reference },
    })
    if (!paymentLink.id || !paymentLink.short_url) throw new Error('The payment provider did not return a UPI checkout link.')

    const checkoutToken = createCheckoutToken({
      paymentLinkId: paymentLink.id,
      planId,
      amountPaise: plan.amountPaise,
      reference,
      email,
      createdAt,
      expiresAt: verificationExpiresAt,
    })
    return sendJson(res, 200, {
      checkoutToken,
      paymentUrl: paymentLink.short_url,
      expiresAt,
      amountPaise: plan.amountPaise,
      planName: plan.name,
    })
  } catch (error) {
    return sendJson(res, 502, { error: error instanceof Error ? error.message : 'Could not start UPI checkout.' })
  }
}
