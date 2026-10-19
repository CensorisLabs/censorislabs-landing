import { useState, type ReactNode } from 'react'
import { useLicense, type PlanId, type ProFeature } from './useLicense.tsx'
import { PRO_PLANS } from '../../../../shared/pricing.js'
import { CheckoutModal } from './CheckoutModal.tsx'

const featureNames: Record<ProFeature, string> = {
  sms_parser: 'Smart bank & UPI SMS parser',
  advanced_investments: 'Investments and XIRR analytics',
  loan_planner: 'Loan & EMI payoff planner',
  tax_optimizer: 'Old vs new regime tax optimizer',
  fire_forecast: 'Inflation-adjusted FIRE forecast',
  encrypted_vault: 'Encrypted vault and security',
  custom_rules: 'Custom categorization rules',
  reports: 'PDF and Excel reports',
  mandate_tracker: 'Subscription and bill reminders',
  account_limit: 'More than two accounts',
}

const plans: readonly { id: PlanId; name: string; price: string; note: string }[] = PRO_PLANS

export function ProGate({ feature, children, onCheckout }: { feature: ProFeature; children: ReactNode; onCheckout: (plan: PlanId) => void }) {
  const { isPro } = useLicense()
  const [open, setOpen] = useState(false)
  if (isPro) return <>{children}</>
  return <>
    <button className="pro-locked" onClick={() => setOpen(true)} aria-label={`View ArthaSetu Pro plans for ${featureNames[feature]}`}>
      <span className="pro-lock-badge">PRO</span>
      <span className="pro-lock-copy"><b>{featureNames[feature]}</b><small>Included with ArthaSetu Pro</small></span>
      <span className="pro-lock-link">View plans →</span>
    </button>
    {open && <Paywall feature={feature} onClose={() => setOpen(false)} onCheckout={onCheckout} />}
  </>
}

export function Paywall({ feature, onClose, onCheckout }: { feature?: ProFeature; onClose: () => void; onCheckout: (plan: PlanId) => void }) {
  const { activateKey, licenseReady } = useLicense()
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('early_bird_lifetime')
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)
  const [paymentActivated, setPaymentActivated] = useState(false)
  const [key, setKey] = useState('')
  const [message, setMessage] = useState('')

  async function redeem() {
    const ok = await activateKey(key)
    setMessage(ok ? 'License activated on this device.' : licenseReady ? 'That signed license could not be verified.' : 'License activation is not configured in this build.')
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="paywall modal" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <button className="modal-close" onClick={onClose} aria-label="Close plans">×</button>
      <div className="eyebrow">CENSORISLABS PRO</div>
      <h2 id="paywall-title">A clearer view of your whole money life.</h2>
      <p className="subtitle">{feature ? `Unlock ${featureNames[feature].toLowerCase()} and the full private toolkit.` : 'Unlock the full private toolkit.'}</p>
      <div className="early-bird"><b>Private by design · verified UPI payments</b><span>Prices below are the exact amounts sent to the payment provider.</span></div>
      <div className="plan-grid">{plans.map(plan => <button key={plan.id} className={`plan${selectedPlan === plan.id ? ' selected' : ''}`} onClick={() => { setSelectedPlan(plan.id); setMessage('') }} aria-pressed={selectedPlan === plan.id}>
        <b>{plan.name}</b><strong>{plan.price}</strong><small>{plan.note}</small>
      </button>)}</div>
      <button className="add-button paywall-continue" onClick={() => { setMessage(''); setPaymentActivated(false); setCheckoutPlan(selectedPlan) }}>Continue with {plans.find(plan => plan.id === selectedPlan)?.price || ''}</button>
      {message && <p className="checkout-message" role="status">{message}</p>}
      <div className="paywall-divider"><span>Have a signed license?</span></div>
      <div className="redeem"><input value={key} onChange={event => setKey(event.target.value)} placeholder="Paste license token" aria-label="License token" /><button className="secondary" onClick={redeem} disabled={!licenseReady || !key.trim()}>Activate</button></div>
      {message && message.startsWith('License') && <small className="security-help" role="status">{message}</small>}
      <small className="security-help">The payment provider confirms each UPI payment before issuing a signed license. The same CensorisLabs suite license works across apps.</small>
    </section>
    {checkoutPlan && <CheckoutModal planId={checkoutPlan} onClose={() => { setCheckoutPlan(null); if (paymentActivated) onClose() }} onActivated={() => { setPaymentActivated(true); onCheckout(checkoutPlan) }} />}
  </div>
}
