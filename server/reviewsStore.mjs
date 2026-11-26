import { ObjectId } from 'mongodb'

export const LIMITS = {
  name: 40,
  body: 600,
  minBody: 10,
  app: 60,
  pending: 500,
  approved: 200,
}

/**
 * Everything a notice may contain. Nothing identifying is required or kept:
 * no IP address, no user agent, no email. A review is a name, an app label,
 * a rating, the words, and when it arrived.
 */
export function validateReview(input) {
  const name = typeof input?.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : ''
  const app = typeof input?.app === 'string' ? input.app.trim().slice(0, LIMITS.app) : ''
  const rating = Number(input?.rating)
  const body = typeof input?.body === 'string' ? input.body.trim() : ''

  if (name.length < 2) return { error: 'Add a name of at least two characters.' }
  if (name.length > LIMITS.name) return { error: `Keep the name under ${LIMITS.name} characters.` }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Choose a star rating from one to five.' }
  if (body.length < LIMITS.minBody) return { error: `Write at least ${LIMITS.minBody} characters so the note is useful.` }
  if (body.length > LIMITS.body) return { error: `Keep the comment under ${LIMITS.body} characters.` }

  return { value: { name, app: app || 'General', rating, body } }
}

export function serialiseReview(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    app: doc.app,
    rating: doc.rating,
    body: doc.body,
    createdAt: new Date(doc.createdAt).toISOString(),
  }
}

/**
 * The store is built on a Mongo collection-like object so the moderation rules
 * can be exercised without a database.
 */
export function createReviewStore(collection) {
  async function trimPending() {
    const count = await collection.countDocuments({ status: 'pending' })
    if (count <= LIMITS.pending) return
    const extra = await collection
      .find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(count - LIMITS.pending)
      .toArray()
    for (const doc of extra) await collection.deleteOne({ _id: doc._id })
  }

  async function remove(id) {
    if (!ObjectId.isValid(id)) return { ok: false, reason: 'bad-id' }
    const result = await collection.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount > 0 ? { ok: true } : { ok: false, reason: 'missing' }
  }

  return {
    async listApproved(limit = 50) {
      const docs = await collection
        .find({ status: 'approved' })
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, LIMITS.approved))
        .toArray()
      return docs.map(serialiseReview)
    },

    async listPending() {
      const docs = await collection
        .find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(LIMITS.pending)
        .toArray()
      return docs.map(serialiseReview)
    },

    async create(value) {
      const now = new Date()
      const result = await collection.insertOne({
        ...value,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      await trimPending()
      return String(result.insertedId)
    },

    async moderate(id, action) {
      if (action !== 'approve' && action !== 'reject' && action !== 'delete') {
        return { ok: false, reason: 'unknown-action' }
      }
      if (action !== 'approve') return remove(id)
      if (!ObjectId.isValid(id)) return { ok: false, reason: 'bad-id' }
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'approved', updatedAt: new Date() } },
      )
      return result.matchedCount > 0 ? { ok: true } : { ok: false, reason: 'missing' }
    },
  }
}
