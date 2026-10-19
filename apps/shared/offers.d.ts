export type UseOffer = { uses: number; percent: number; coupon: string }
export type SaleOffer = { percent: number; eventId: string }
export const USE_OFFER_MILESTONES: readonly UseOffer[]
export const FIRST_USERS_OFFER: { limit: number; percent: number; coupon: string }
export function getUseOffer(count: number): UseOffer | null
export function getSaleOffer(): SaleOffer | null
