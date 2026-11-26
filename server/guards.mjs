/** Cheap pre-moderation checks that keep the queue readable. */

export const MIN_FILL_MS = 2500

export function normaliseBody(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A form filled in faster than a human can type is most likely a script. The
 * value is optional so a reader with scripts disabled is never punished.
 */
export function submittedTooFast(payload) {
  const elapsed = Number(payload?.elapsed)
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_FILL_MS
}

export function isDuplicate(value, existing) {
  const body = normaliseBody(value.body)
  const name = String(value.name || '').toLowerCase()
  return existing.some(
    (review) => normaliseBody(review.body) === body && String(review.name || '').toLowerCase() === name,
  )
}
