import { MongoClient } from 'mongodb'

/**
 * One cached client per function instance: serverless invocations come and go,
 * and reconnecting on every request both slows the response down and burns
 * Atlas connection slots. A failed connection is dropped so the next request
 * can retry instead of inheriting a dead promise.
 */
const cacheKey = Symbol.for('censorislabs.mongo')

export function mongoConfigured() {
  return Boolean(process.env.MONGODB_URI)
}

export async function getCollection() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    const error = new Error('MONGODB_URI is not set')
    error.code = 'unconfigured'
    throw error
  }

  let cached = globalThis[cacheKey]
  if (!cached) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    })
    cached = { client, connecting: client.connect() }
    globalThis[cacheKey] = cached
    cached.connecting.catch(() => {
      globalThis[cacheKey] = undefined
      client.close().catch(() => {})
    })
  }

  const client = await cached.connecting
  return client.db(process.env.MONGODB_DB || 'censorislabs').collection('reviews')
}
