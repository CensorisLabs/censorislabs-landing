import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ObjectId } from 'mongodb'

import { createReviewStore, LIMITS, validateReview } from '../server/reviewsStore.mjs'
import reviewsHandler from '../api/reviews.mjs'
import moderationHandler from '../api/reviews-moderation.mjs'

/** A collection-shaped object: enough for the store's query surface. */
function fakeCollection() {
  const docs = []
  let counter = 0

  const matches = (doc, query) =>
    Object.entries(query || {}).every(([key, value]) => String(doc[key]) === String(value))

  const cursor = (rows) => {
    let sorted = rows
    return {
      sort(spec) {
        const [field, direction] = Object.entries(spec)[0]
        sorted = [...sorted].sort((a, b) => {
          const left = new Date(a[field]).getTime()
          const right = new Date(b[field]).getTime()
          return direction < 0 ? right - left : left - right
        })
        return this
      },
      limit(count) {
        sorted = sorted.slice(0, count)
        return this
      },
      async toArray() {
        return sorted.map((doc) => ({ ...doc }))
      },
    }
  }

  return {
    docs,
    find(query) {
      return cursor(docs.filter((doc) => matches(doc, query)))
    },
    async insertOne(doc) {
      counter += 1
      const _id = new ObjectId()
      docs.push({ ...doc, _id })
      return { insertedId: _id }
    },
    async updateOne(query, update) {
      const doc = docs.find((item) => matches(item, query))
      if (!doc) return { matchedCount: 0, modifiedCount: 0 }
      Object.assign(doc, update.$set || {})
      return { matchedCount: 1, modifiedCount: 1 }
    },
    async deleteOne(query) {
      const index = docs.findIndex((doc) => matches(doc, query))
      if (index === -1) return { deletedCount: 0 }
      docs.splice(index, 1)
      return { deletedCount: 1 }
    },
    async countDocuments(query) {
      return docs.filter((doc) => matches(doc, query)).length
    },
  }
}

const valid = { name: 'Ayesha K', app: 'ArthaSetu', rating: 5, body: 'Budgets finally make sense offline.' }

test('validates the fields a review must carry', () => {
  assert.deepEqual(validateReview(valid).value, valid)
  assert.match(validateReview({ ...valid, name: 'A' }).error, /name/i)
  assert.match(validateReview({ ...valid, rating: 0 }).error, /rating/i)
  assert.match(validateReview({ ...valid, rating: 4.5 }).error, /rating/i)
  assert.match(validateReview({ ...valid, body: 'short' }).error, /characters/i)
  assert.match(validateReview({ ...valid, body: 'x'.repeat(LIMITS.body + 1) }).error, /under/i)
  assert.equal(validateReview({ ...valid, name: '  Sam   Lee ' }).value.name, 'Sam Lee')
  assert.equal(validateReview({ ...valid, app: undefined }).value.app, 'General')
})

test('a submitted review waits for moderation before it is public', async () => {
  const collection = fakeCollection()
  const store = createReviewStore(collection)

  const id = await store.create(validateReview(valid).value)

  assert.equal(await store.listApproved().then((rows) => rows.length), 0)
  const pending = await store.listPending()
  assert.equal(pending.length, 1)
  assert.equal(pending[0].id, id)
  assert.equal(pending[0].status, undefined)
  assert.ok(pending[0].createdAt)
})

test('approving publishes, rejecting and unpublishing remove', async () => {
  const collection = fakeCollection()
  const store = createReviewStore(collection)

  const first = await store.create(validateReview(valid).value)
  const second = await store.create(validateReview({ ...valid, name: 'Ravi', rating: 3 }).value)

  assert.deepEqual(await store.moderate(first, 'approve'), { ok: true })
  assert.equal((await store.listApproved())[0].name, valid.name)
  assert.equal((await store.listPending()).length, 1)

  assert.deepEqual(await store.moderate(second, 'reject'), { ok: true })
  assert.equal((await store.listPending()).length, 0)

  assert.deepEqual(await store.moderate(first, 'delete'), { ok: true })
  assert.equal((await store.listApproved()).length, 0)
})

test('moderation refuses junk ids and unknown actions', async () => {
  const store = createReviewStore(fakeCollection())
  assert.deepEqual(await store.moderate('not-an-id', 'approve'), { ok: false, reason: 'bad-id' })
  assert.deepEqual(await store.moderate('not-an-id', 'delete'), { ok: false, reason: 'bad-id' })
  assert.deepEqual(await store.moderate(new ObjectId().toString(), 'approve'), { ok: false, reason: 'missing' })
  assert.deepEqual(await store.moderate(String(new ObjectId()), 'publish'), { ok: false, reason: 'unknown-action' })
})

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(payload) {
      this.body = payload ? JSON.parse(payload) : undefined
    },
  }
}

function mockReq({ method = 'GET', body, headers = {} } = {}) {
  return { method, body, headers, socket: { remoteAddress: '127.0.0.1' } }
}

test('the API says so plainly when no database is configured', async () => {
  const previous = process.env.MONGODB_URI
  delete process.env.MONGODB_URI

  const list = mockRes()
  await reviewsHandler(mockReq(), list)
  assert.equal(list.statusCode, 503)
  assert.equal(list.body.code, 'unconfigured')
  assert.equal(list.headers['cache-control'], 'no-store')

  const submit = mockRes()
  await reviewsHandler(mockReq({ method: 'POST', body: valid }), submit)
  assert.equal(submit.statusCode, 503)

  const moderation = mockRes()
  await moderationHandler(mockReq(), moderation)
  assert.equal(moderation.statusCode, 503)

  if (previous !== undefined) process.env.MONGODB_URI = previous
})

test('the API rejects unsupported methods before touching storage', async () => {
  const previous = process.env.MONGODB_URI
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/never'

  const res = mockRes()
  await reviewsHandler(mockReq({ method: 'DELETE' }), res)
  // Either storage is unreachable (502) or the method is refused (405); never a 200.
  assert.ok([405, 502].includes(res.statusCode), `unexpected status ${res.statusCode}`)

  if (previous === undefined) delete process.env.MONGODB_URI
  else process.env.MONGODB_URI = previous
})

test('the pending queue is capped so spam cannot grow without bound', async () => {
  const collection = fakeCollection()
  const store = createReviewStore(collection)

  for (let index = 0; index < LIMITS.pending + 3; index += 1) {
    await store.create({ ...validateReview(valid).value, name: `Person ${index}` })
  }

  assert.equal(await collection.countDocuments({ status: 'pending' }), LIMITS.pending)
  const names = collection.docs.map((doc) => doc.name)
  assert.ok(!names.includes('Person 0'))
  assert.ok(names.includes(`Person ${LIMITS.pending + 2}`))
})
