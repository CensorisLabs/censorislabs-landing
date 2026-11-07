import test from 'node:test'
import assert from 'node:assert/strict'
import { STEP_SYNC_MIN_MINUTES, stepSyncDue } from '../src/core.js'

const now = Date.parse('2026-11-07T12:00:00.000Z')

test('a first run with no recorded sync is due immediately', () => {
  assert.equal(stepSyncDue('', now), true)
  assert.equal(stepSyncDue(undefined, now), true)
  assert.equal(stepSyncDue('not a date', now), true)
})

test('a sync inside the window is not repeated', () => {
  assert.equal(stepSyncDue(new Date(now - 60_000).toISOString(), now), false)
  assert.equal(stepSyncDue(new Date(now - (STEP_SYNC_MIN_MINUTES * 60_000 - 1000)).toISOString(), now), false)
})

test('a sync older than the window or exactly at it is due', () => {
  assert.equal(stepSyncDue(new Date(now - STEP_SYNC_MIN_MINUTES * 60_000).toISOString(), now), true)
  assert.equal(stepSyncDue(new Date(now - 60 * 60_000).toISOString(), now), true)
})

test('a custom window is respected and a clock change never blocks syncing', () => {
  assert.equal(stepSyncDue(new Date(now - 90_000).toISOString(), now, 1), true)
  assert.equal(stepSyncDue(new Date(now - 30_000).toISOString(), now, 1), false)
  // The phone clock moved backwards after the last sync.
  assert.equal(stepSyncDue(new Date(now + 60_000).toISOString(), now), true)
})

test('nonsense windows fall back to the default instead of syncing every second', () => {
  assert.equal(stepSyncDue(new Date(now - 30_000).toISOString(), now, 0), false)
  assert.equal(stepSyncDue(new Date(now - 30_000).toISOString(), now, 'soon'), false)
})
