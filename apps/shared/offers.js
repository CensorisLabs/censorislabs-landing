export const USE_OFFER_MILESTONES = [
  { uses: 15, percent: 10, coupon: 'FREQUENT10' },
  { uses: 30, percent: 15, coupon: 'FREQUENT15' },
]

export const FIRST_USERS_OFFER = { limit: 1000, percent: 30, coupon: 'FIRST1000' }

export function getUseOffer(count) {
  return [...USE_OFFER_MILESTONES].reverse().find((offer) => count >= offer.uses) || null
}

export function getSaleOffer() {
  const eventId = String(import.meta.env?.VITE_SALE_EVENT_ID || '').trim()
  if (eventId) return { percent: 10, eventId }
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const hourMs = 60 * 60 * 1000
  const week = Math.floor(Date.now() / weekMs)
  const seed = [...`CensorisLabs-${week}`].reduce((value, character) => ((value * 33) ^ character.charCodeAt(0)) >>> 0, 5381)
  const startHour = seed % 160
  const withinWeek = Date.now() - week * weekMs
  const active = withinWeek >= startHour * hourMs && withinWeek < (startHour + 8) * hourMs
  return active ? { percent: 10, eventId: `W${week}-${String(startHour).padStart(3, '0')}` } : null
}
