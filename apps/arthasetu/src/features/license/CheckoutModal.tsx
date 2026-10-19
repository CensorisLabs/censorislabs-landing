import { useEffect, useState, type FormEvent } from 'react'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { QRCodeSVG } from 'qrcode.react'
import { PRO_PLANS } from '../../../../shared/pricing.js'
import { createUpiCheckout, verifyUpiReference, type UpiCheckout } from './checkout.ts'
import { useLicense, type PlanId } from './useLicense.tsx'

const plans: readonly { id: PlanId; name: string; price: string; note: string }[] = PRO_PLANS
const rupees = (paise: number) => `₹${Math.floor(paise / 100).toLocaleString('en-IN')}${paise % 100 ? `.${String(paise % 100).padStart(2, '0')}` : ''}`

export function CheckoutModal({ planId, onClose, onActivated }: { planId: PlanId; onClose: () => void; onActivated: () => void }) {
  const { activateKey, licenseReady } = useLicense()
  const selected = plans.find(plan => plan.id === planId) || plans[0]
  const [email, setEmail] = useState('')
  const [session, setSession] = useState<UpiCheckout | null>(null)
  const [utr, setUtr] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [licenseToken, setLicenseToken] = useState('')

  useEffect(() => {
    if (!session) return
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [session])

  async function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!licenseReady) { setMessage('Checkout is disabled because this app build has no public license verification key.'); return }
    setBusy(true); setMessage('')
    try {
      const checkout = await createUpiCheckout(planId, email.trim())
      setSession(checkout)
      setMessage('Your one-time UPI checkout is ready. It expires in 10 minutes.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start checkout.')
    } finally { setBusy(false) }
  }

  async function openUpi() {
    if (!session || secondsLeft <= 0) return
    try {
      if (Capacitor.isNativePlatform()) await Browser.open({ url: session.paymentUrl })
      else window.open(session.paymentUrl, '_blank', 'noopener,noreferrer')
    } catch {
      window.location.assign(session.paymentUrl)
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || !/^\d{12}$/.test(utr)) return
    setBusy(true); setMessage('Checking the captured payment with the payment provider…')
    try {
      const result = await verifyUpiReference(session.checkoutToken, utr)
      if (result.status !== 'paid' || !result.licenseToken) {
        setMessage(result.message || 'Payment is not confirmed yet. Wait briefly and try again.')
        return
      }
      const activated = licenseReady && await activateKey(result.licenseToken)
      if (activated) {
        setSuccess(true)
        setMessage('Payment verified and Pro activated on this device.')
        onActivated()
      } else {
        setMessage(licenseReady ? 'Payment is verified, but this device could not validate or securely save the license. Copy the token below and retry after checking this build’s license configuration.' : 'Payment is verified, but this build has no public license verification key. Copy the token below and activate it in a correctly configured build.')
        setLicenseToken(result.licenseToken)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not verify this UPI reference.')
    } finally { setBusy(false) }
  }

  const timeLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`

  return <div className="modal-backdrop checkout-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="modal checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close UPI checkout">×</button>
      {success ? <div className="checkout-success"><div className="success-check" aria-hidden="true">✓</div><div className="eyebrow">PAYMENT CONFIRMED</div><h2 id="checkout-title">You’re on Pro.</h2><p>Razorpay confirmed the captured UPI payment and ArthaSetu activated your signed license on this device.</p><button className="add-button" onClick={onClose}>Continue to ArthaSetu</button></div> : <>
        <div className="eyebrow">SECURE UPI CHECKOUT</div>
        <h2 id="checkout-title">{selected.name}</h2>
        <p className="checkout-price">{selected.price.split(' ')[0]} <span>· Payment is verified before Pro unlocks</span></p>
        {!session ? <form className="checkout-start" onSubmit={begin}>
          <p className="subtitle">Enter an email for the payment receipt, then use any supported UPI app. Monthly and yearly plans are one-time payments with manual renewal.</p>
          <label>Receipt email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <button className="add-button" disabled={busy}>{busy ? 'Creating secure checkout…' : 'Create UPI checkout'}</button>
        </form> : <>
          <div className="checkout-instructions"><span className="checkout-clock">{secondsLeft > 0 ? `Expires in ${timeLabel}` : 'Payment request expired'}</span><p>{secondsLeft > 0 ? 'Scan this one-time QR on another device or open the UPI payment page on this device.' : 'If you paid before the request expired, enter your UTR below to verify it.'} The exact amount is {rupees(session.amountPaise)}.</p></div>
          <div className="checkout-payment-layout">
            <div className="checkout-qr"><QRCodeSVG value={session.paymentUrl} size={224} level="M" marginSize={3} aria-label="One-time UPI checkout QR code" /><small>Scan with Google Pay, PhonePe, Paytm, BHIM, or another UPI app.</small></div>
            <div className="checkout-steps"><b>Pay with UPI</b><p>On Android, open the secure UPI link to continue to an installed payment app. On desktop, scan the QR with your phone.</p><button type="button" className="add-button" onClick={openUpi} disabled={secondsLeft <= 0}>Pay via UPI apps</button><button type="button" className="text-button" onClick={() => void navigator.clipboard?.writeText(session.paymentUrl)}>Copy secure payment link</button><small>ArthaSetu never sees or stores your UPI PIN.</small></div>
          </div>
          <form className="utr-form" onSubmit={verify}>
            <label>12-digit UPI reference / UTR<input inputMode="numeric" autoComplete="off" maxLength={12} pattern="[0-9]{12}" value={utr} onChange={event => setUtr(event.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="e.g. 123456789012" /></label>
            <button className="secondary" disabled={busy || utr.length !== 12}>{busy ? 'Verifying…' : 'Verify & unlock Pro'}</button>
          </form>
          {secondsLeft === 0 && <button className="text-button" onClick={() => { setSession(null); setUtr(''); setMessage('Create a new checkout to continue.') }}>Create a new payment QR</button>}
          {licenseToken && <div className="license-token-copy"><label>Verified license token<input readOnly value={licenseToken} /></label><button type="button" className="secondary" onClick={() => void navigator.clipboard?.writeText(licenseToken)}>Copy token</button></div>}
        </>}
        {message && <p className="checkout-message" role="status" aria-live="polite">{message}</p>}
        <small className="security-help">The app sends your UTR to ArthaSetu’s server, which checks the matching captured UPI payment, amount, and payment reference before issuing a signed Pro license.</small>
      </>}
    </section>
  </div>
}
