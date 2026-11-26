/** Small response/request helpers shared by the review functions. */

export function send(res, status, payload, extraHeaders = {}) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader(
    'cache-control',
    status === 200 ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' : 'no-store',
  )
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value)
  res.end(JSON.stringify(payload))
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}

export function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return (raw ? raw.split(',')[0] : req.socket?.remoteAddress || 'unknown').trim()
}

/**
 * Best-effort per-instance throttle. Moderation is the real spam gate; this
 * only keeps one connection from filling the queue.
 */
export function allow(map, key, limit, windowMs) {
  const now = Date.now()
  const entry = map.get(key)
  if (!entry || now - entry.start > windowMs) {
    map.set(key, { start: now, count: 1 })
    return true
  }
  entry.count += 1
  if (map.size > 5000) {
    for (const [staleKey, stale] of map) if (now - stale.start > windowMs) map.delete(staleKey)
  }
  return entry.count <= limit
}
