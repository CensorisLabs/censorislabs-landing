import test from 'node:test'
import assert from 'node:assert/strict'
import { exerciseCalories, movementForDay } from '../src/lib/movement.js'

const profile = {
  weightKg: 70,
  heightCm: 170,
  sex: 'female',
  activity: 1.375,
  stepGoal: 8000,
  stepCadence: 100,
}

const walk = {
  name: 'Walking, brisk',
  group: 'Walking',
  minutes: 30,
  kcal: exerciseCalories(4.3, 30, profile.weightKg),
}

test('a logged walk and the activity baseline do not credit overlapping steps twice', () => {
  const movement = movementForDay({ steps: 8000, exercise: [walk] }, profile)
  assert.equal(movement.walkSteps, 3000)
  assert.equal(movement.baselineSteps, 6000)
  assert.equal(movement.creditSteps, 0)
  assert.equal(movement.stepCreditKcal, 0)
  assert.equal(movement.exerciseCreditKcal, 121)
  assert.equal(movement.creditKcal, 121)
})

test('steps beyond both the walk and the activity baseline still earn credit', () => {
  const movement = movementForDay({ steps: 12000, exercise: [walk] }, profile)
  assert.equal(movement.creditSteps, 3000)
  assert.ok(movement.stepCreditKcal > 0)
  assert.equal(movement.creditKcal, movement.stepCreditKcal + movement.exerciseCreditKcal)
})

test('the step-credit switch leaves exercise credit untouched', () => {
  const movement = movementForDay({ steps: 12000, exercise: [walk] }, { ...profile, creditStepCalories: false })
  assert.equal(movement.stepCreditKcal, 0)
  assert.equal(movement.creditKcal, movement.exerciseCreditKcal)
})

test('non-step exercise does not remove ordinary walking steps', () => {
  const strength = { name: 'Weight training', group: 'Strength', minutes: 30, kcal: exerciseCalories(5, 30, profile.weightKg) }
  const movement = movementForDay({ steps: 12000, exercise: [strength] }, profile)
  assert.equal(movement.walkSteps, 0)
  assert.equal(movement.creditSteps, 6000)
  assert.ok(movement.stepCreditKcal > 0)
})