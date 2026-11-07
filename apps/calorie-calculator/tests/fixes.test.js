import test from 'node:test'
import assert from 'node:assert/strict'
import { dayActivity, createProfile } from '../src/core.js'
import { paceFromSpeed, paceLabel } from '../src/walk.js'

const profile = { ...createProfile('Test'), weightKg: 70, stepGoal: 8000 }
const date = '2026-11-07'

test('a device reporting zero steps does not hide hand-logged steps', () => {
  const state = {
    activities: [{ id: 'a', date, steps: 4200, stepsOnly: true, minutes: 0, met: 1, calories: 0 }],
    healthImports: [{ date, steps: 0 }],
  }
  const activity = dayActivity(state, date, profile)
  assert.equal(activity.deviceSteps, 0)
  assert.equal(activity.manualSteps, 4200)
  // Before the fix, steps came back 0 here while stepTotal was 4200, so the
  // dashboard and every weekly average disagreed with the movement log.
  assert.equal(activity.steps, 4200)
})

test('a real device total still wins over hand-logged steps', () => {
  const state = {
    activities: [{ id: 'a', date, steps: 4200, stepsOnly: true, minutes: 0, met: 1, calories: 0 }],
    healthImports: [{ date, steps: 9100 }],
  }
  const activity = dayActivity(state, date, profile)
  assert.equal(activity.steps, 9100)
  assert.equal(activity.manualSteps, 4200)
})

test('pace rounding carries a full minute instead of printing 9:60', () => {
  // 6.005 km/h is 9 minutes 59.17 seconds per km, which rounds to 10:00 —
  // the old code printed 9:00 because it rounded the seconds to 60 and reset.
  assert.equal(paceFromSpeed(6.005), '10:00 /km')
  assert.equal(paceFromSpeed(5.99), '10:01 /km')
  assert.equal(paceFromSpeed(12), '5:00 /km')
  assert.equal(paceFromSpeed(0), '—')
  assert.equal(paceLabel(29.5, 3), '9:50 /km')
})

test('pace labels refuse impossible input', () => {
  assert.equal(paceLabel(0, 3), '—')
  assert.equal(paceLabel(30, 0), '—')
})
