import { issueLicense, paymentConfigReady, razorpay, readJson, sendJson, setCors, verifyCheckoutToken } from '../server/payments.js'

function paymentIds(paymentLink) {
  const linkedPayments = Array.isArray(paymentLink.payments) ? paymentLink.payments : []
  const ids = linkedPayments.map(payment => payment?.payment_id || payment?.id).filter(value => typeof value === 'string')
  if (typeof paymentLink.payment_id === 'string') ids.push(paymentLink.payment_id)
  return [...new Set(ids)]
}

function references(payment) {
  const data = payment?.acquirer_data || {}
  const upi = payment?.upi || {}
  return [data.rrn, data.upi_transaction_id, upi.rrn, upi.upi_transaction_id]
    .filter(value => value !== null && value !== undefined)
    .map(value => String(value).replace(/\s/g, ''))
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST to verify a UPI reference.' })
  if (!paymentConfigReady()) return sendJson(res, 503, { error: 'Payment verification is not configured on the service yet.' })

  try {
    const input = await readJson(req)
    const utr = String(input.utr || '').trim()
    if (!/^\d{12}$/.test(utr)) return sendJson(res, 400, { error: 'Enter the 12-digit UPI reference number shown by your bank.' })
    const checkout = verifyCheckoutToken(input.checkoutToken)
    if (!checkout) return sendJson(res, 410, { error: 'This checkout expired or could not be verified. Start a new payment.' })

    const paymentLink = await razorpay('payment_links/' + encodeURIComponent(checkout.paymentLinkId))
    if (paymentLink.status !== 'paid' || Number(paymentLink.amount_paid) !== checkout.amountPaise) {
      return sendJson(res, 202, { status: 'pending', message: 'The payment is not confirmed yet. Wait a moment and try again.' })
    }
    const ids = paymentIds(paymentLink)
    if (ids.length === 0) return sendJson(res, 202, { status: 'pending', message: 'The payment provider is still attaching the payment reference. Try again shortly.' })

    for (const id of ids) {
      const payment = await razorpay('payments/' + encodeURIComponent(id))
      const validPayment = payment.status === 'captured'
        && payment.captured === true
        && payment.method === 'upi'
        && payment.currency === 'INR'
        && Number(payment.amount) === checkout.amountPaise
        && Number(payment.amount_refunded || 0) === 0
      if (!validPayment) continue
      if (!references(payment).includes(utr)) continue
      const licenseToken = issueLicense(checkout.planId)
      return sendJson(res, 200, { status: 'paid', licenseToken })
    }
    return sendJson(res, 422, { status: 'not_matched', error: 'That reference does not match a captured UPI payment for this checkout. Check the digits or payment status.' })
  } catch {
    return sendJson(res, 502, { error: 'Could not verify the payment right now. Try again in a moment.' })
  }
}
