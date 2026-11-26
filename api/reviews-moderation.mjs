import { timingSafeEqual } from 'node:crypto'

import { send, readJson } from '../server/http.mjs'
import { getCollection, mongoConfigured } from '../server/mongo.mjs'
import { createReviewStore } from '../server/reviewsStore.mjs'

/**
 * Owner-only moderation. The shared secret arrives as a bearer token, is
 * compared in constant time, and is never stored on the server.
 */
function authorised(req) {
  const expected = process.env.REVIEWS_ADMIN_TOKEN
  if (!expected) return false
  const header = req.headers.authorization || ''
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : String(req.headers['x-admin-token'] || '')
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {})

  if (!process.env.REVIEWS_ADMIN_TOKEN) {
    return send(res, 503, {
      error: 'Moderation is not configured. Set REVIEWS_ADMIN_TOKEN in the hosting environment.',
      code: 'unconfigured',
    })
  }
  if (!mongoConfigured()) {
    return send(res, 503, { error: 'Reviews are not connected yet.', code: 'unconfigured' })
  }

  res.setHeader('cache-control', 'no-store')
  if (!authorised(req)) return send(res, 401, { error: 'That moderation token was rejected.' })

  let store
  try {
    store = createReviewStore(await getCollection())
  } catch {
    return send(res, 502, { error: 'Review storage is unavailable right now.', code: 'unavailable' })
  }

  if (req.method === 'GET') {
    try {
      const [pending, approved] = await Promise.all([store.listPending(), store.listApproved()])
      return send(res, 200, { pending, approved })
    } catch {
      return send(res, 502, { error: 'Could not read the review queue.', code: 'unavailable' })
    }
  }

  if (req.method === 'POST') {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') return send(res, 400, { error: 'Send a JSON body.' })
    const id = typeof body.id === 'string' ? body.id : ''
    const action = typeof body.action === 'string' ? body.action : ''
    if (!id) return send(res, 400, { error: 'Which review?' })

    try {
      const result = await store.moderate(id, action)
      if (!result.ok) {
        const status = result.reason === 'missing' ? 404 : 400
        return send(res, status, { error: result.reason || 'That action failed.' })
      }
      return send(res, 200, { ok: true })
    } catch {
      return send(res, 502, { error: 'Could not update that review right now.', code: 'unavailable' })
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS')
  return send(res, 405, { error: 'Method not allowed.' })
}
