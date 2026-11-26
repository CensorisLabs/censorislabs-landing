import { send, readJson, clientKey, allow } from '../server/http.mjs'
import { getCollection, mongoConfigured } from '../server/mongo.mjs'
import { createReviewStore, validateReview } from '../server/reviewsStore.mjs'

/** GET returns published reviews; POST queues one for moderation. */
const submissions = new Map()
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {})

  if (!mongoConfigured()) {
    return send(res, 503, {
      error: 'Reviews are not connected yet. They will open once the review database is configured.',
      code: 'unconfigured',
    })
  }

  let store
  try {
    store = createReviewStore(await getCollection())
  } catch {
    return send(res, 502, { error: 'Review storage is unavailable right now.', code: 'unavailable' })
  }

  if (req.method === 'GET') {
    try {
      return send(res, 200, { reviews: await store.listApproved() })
    } catch {
      return send(res, 502, { error: 'Could not read reviews right now.', code: 'unavailable' })
    }
  }

  if (req.method === 'POST') {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') return send(res, 400, { error: 'Send a JSON body.' })

    // Honeypot: a filled hidden field is accepted silently and never stored.
    if (typeof body.website === 'string' && body.website.trim()) {
      return send(res, 202, { ok: true, status: 'pending' })
    }

    const checked = validateReview(body)
    if (checked.error) return send(res, 400, { error: checked.error })

    if (!allow(submissions, clientKey(req), MAX_PER_WINDOW, WINDOW_MS)) {
      return send(res, 429, { error: 'Too many reviews from this connection. Try again later.' })
    }

    try {
      const id = await store.create(checked.value)
      return send(res, 202, { ok: true, id, status: 'pending' })
    } catch {
      return send(res, 502, { error: 'Could not save that review right now.', code: 'unavailable' })
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS')
  return send(res, 405, { error: 'Method not allowed.' })
}
