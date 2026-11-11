import { PRO_PLANS, DEFAULT_PLAN_ID, discountedPrice } from './pricing.js'
import { activateLicense, getLicenseStatus } from './license.js'
import { getUseOffer, getSaleOffer } from './offers.js'

let activePlan = DEFAULT_PLAN_ID

export function showPaywall(feature = 'Pro features', onActivated = () => {}) {
  activePlan = DEFAULT_PLAN_ID
  document.querySelector('.paywall-backdrop')?.remove()
  const backdrop = document.createElement('div')
  backdrop.className = 'paywall-backdrop'
  const appId = document.querySelector('.app-shell')?.dataset.appId || 'arthasetu'
  const usage = Number(localStorage.getItem(`censorislabs-usage-${appId}`)) || 0
  const useOffer = getUseOffer(usage)
  const sale = getSaleOffer()
  const discount = Math.max(useOffer?.percent || 0, sale?.percent || 0)
  const offerMessage = useOffer ? `<b>${useOffer.percent}% use offer · ${useOffer.coupon}</b><small>Earned after ${useOffer.uses} uses. Checkout must validate the code before changing a price.</small>` : '<b>Use this app to unlock a 10% or 15% offer.</b><small>15 uses unlocks 10%; 30 uses unlocks 15%. Eligibility is checked at checkout.</small>'
  const saleMessage = sale ? `<div class="early-bird"><b>Limited sale · 10% off · ${escapeHtml(sale.eventId)}</b><small>Sale price is subject to confirmation by checkout.</small></div>` : ''
  backdrop.innerHTML = `<section class="paywall" role="dialog" aria-modal="true" aria-labelledby="pro-title"><button class="paywall-close" aria-label="Close">×</button><p class="eyebrow">CENSORISLABS PRO</p><h2 id="pro-title">Make more room for ${escapeHtml(feature.toLowerCase())}.</h2><p class="muted-copy">One Pro format across the CensorisLabs app suite.</p><div class="early-bird"><b>First 1,000 users · 30% off across the suite</b><small>Checkout must verify the account number and apply the offer. It is not active until payment is connected.</small></div><div class="early-bird">${offerMessage}</div>${saleMessage}<div class="plan-grid">${PRO_PLANS.map(plan => `<button class="plan-option${plan.id === DEFAULT_PLAN_ID ? ' active' : ''}" data-plan="${plan.id}" aria-pressed="${plan.id === DEFAULT_PLAN_ID}"><b>${plan.name}</b>${discount ? `<strong>${discountedPrice(plan.price, discount)} <del>${plan.price}</del></strong><small>${discount}% offer shown · payment confirmation required</small>` : `<strong>${plan.price}</strong><small>${plan.note}</small>`}</button>`).join('')}</div><p class="paywall-hint" role="status">Checkout is not connected in this build. No payment is taken and Pro access is not activated.</p><button class="btn paywall-continue">Continue with ${discount ? discountedPrice(PRO_PLANS.find(plan => plan.id === activePlan).price, discount) : PRO_PLANS.find(plan => plan.id === activePlan).price}</button><div class="paywall-divider"><span>Have a signed license?</span></div><div class="redeem"><input class="license-token" aria-label="Signed license token" placeholder="Paste license token"><button class="btn btn--outline activate-license">Activate</button></div><p class="license-status muted-copy" role="status" aria-live="polite"></p><small class="muted-copy">License verification is local. Payment processing and signing keys stay outside the apps.</small></section>`
  document.body.append(backdrop)
  const close = () => backdrop.remove()
  backdrop.addEventListener('click', event => { if (event.target === backdrop || event.target.closest('.paywall-close')) close() })
  const continueButton = backdrop.querySelector('.paywall-continue')
  backdrop.querySelectorAll('.plan-option').forEach(option => option.addEventListener('click', () => {
    backdrop.querySelector('.plan-option.active')?.classList.remove('active')
    option.classList.add('active')
    activePlan = option.dataset.plan
    backdrop.querySelectorAll('.plan-option').forEach(item => item.setAttribute('aria-pressed', String(item === option)))
    const planPrice = PRO_PLANS.find(plan => plan.id === activePlan)?.price
    continueButton.textContent = `Continue with ${discount && planPrice ? discountedPrice(planPrice, discount) : planPrice}`
  }))
  continueButton.addEventListener('click', () => { backdrop.querySelector('.paywall-hint').textContent = 'Checkout is unavailable until a payment provider is connected. No payment is taken and Pro access is not activated.' })
  backdrop.querySelector('.activate-license').addEventListener('click', async () => {
    const input = backdrop.querySelector('.license-token')
    const status = backdrop.querySelector('.license-status')
    status.textContent = 'Checking signed license…'
    const result = await activateLicense(input.value)
    status.textContent = result ? 'Pro license activated on this device.' : import.meta.env?.VITE_LICENSE_PUBLIC_KEY ? 'This signed license could not be verified.' : 'License activation is not configured in this build.'
    if (result) { onActivated(result); close() }
  })
  void getLicenseStatus().then(status => {
    if (status !== 'FREE') backdrop.querySelector('.license-status').textContent = `Pro is active on this device (${status.replaceAll('_', ' ').toLowerCase()}).`
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('censorislabs:show-paywall', (event) => showPaywall(event.detail?.feature || 'suite offers'))
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}
