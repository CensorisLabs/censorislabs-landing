export type PlanId = 'monthly' | 'yearly' | 'early_bird_lifetime' | 'lifetime'
export const PRO_PLANS: readonly { id: PlanId; name: string; price: string; note: string }[]
export const DEFAULT_PLAN_ID: PlanId
export const LICENSE_PRODUCT: 'censorislabs-suite'
export function discountedPrice(price: string, percent: number): string
