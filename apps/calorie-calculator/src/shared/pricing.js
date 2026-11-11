export const PRO_PLANS = [
  { id: 'monthly', name: 'Pro Monthly', price: '₹69 / month', note: 'Monthly access' },
  { id: 'yearly', name: 'Pro Yearly', price: '₹299 / year', note: 'Annual access' },
  { id: 'early_bird_lifetime', name: 'Early-bird lifetime', price: '₹499 once', note: 'First 1,000 users' },
  { id: 'lifetime', name: 'Standard lifetime', price: '₹999 once', note: 'One-time access' },
]

export const DEFAULT_PLAN_ID = 'early_bird_lifetime'
export const LICENSE_PRODUCT = 'censorislabs-suite'

export function discountedPrice(price, percent) {
  const match = String(price).match(/₹([\d,]+)/)
  if (!match || !Number.isFinite(percent) || percent <= 0) return price
  const amount = Math.round(Number(match[1].replaceAll(',', '')) * (100 - percent) / 100)
  return String(price).replace(match[0], `₹${amount.toLocaleString('en-IN')}`)
}
