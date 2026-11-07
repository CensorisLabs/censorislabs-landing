import test from 'node:test'
import assert from 'node:assert/strict'
import { createGpsFilter, gpsQuality, haversineM } from '../src/gps.js'

// ~11 metres per 0.0001 degree of latitude, good enough for these checks.
const latFor = metres => metres / 111320

function walkPoints({ metres = 200, seconds = 150, noise = 0, stepMs = 2000, start = 12.9716, jitter = () => 0 } = {}) {
  const total = Math.round(seconds * 1000 / stepMs)
  const points = []
  for (let index = 0; index <= total; index += 1) {
    const progress = index / total
    const noiseLat = noise ? (jitter(index) * noise) / 111320 : 0
    points.push({
      at: 1000000 + index * stepMs,
      coords: { latitude: start + latFor(metres * progress) + noiseLat, longitude: 77.5946, accuracy: noise ? 12 : 6 },
    })
  }
  return points
}

test('a measured straight walk lands close to the real distance', () => {
  const filter = createGpsFilter()
  for (const point of walkPoints({ metres: 400, seconds: 300 })) filter.push(point.coords, point.at)
  const state = filter.state(1000000 + 300000)
  assert.ok(Math.abs(state.distanceM - 400) < 20, `expected ~400 m, got ${Math.round(state.distanceM)} m`)
  assert.equal(state.moving, true)
})

test('finishing settles the lagging tail of the track', () => {
  const filter = createGpsFilter()
  const points = walkPoints({ metres: 300, seconds: 200 })
  for (const point of points) filter.push(point.coords, point.at)
  const before = filter.state(points[points.length - 1].at).distanceM
  const after = filter.settle()
  assert.ok(after >= before, 'settling never removes distance')
  assert.ok(Math.abs(after - 300) < 8, `expected ~300 m after settling, got ${Math.round(after)} m`)
})

test('a parked phone that reports zero speed adds nothing even with a wild fix trail', () => {
  const filter = createGpsFilter()
  for (let index = 0; index < 40; index += 1) {
    filter.push({ latitude: 12.9716 + latFor(18 * Math.sin(index * 2.1)), longitude: 77.5946 + latFor(18 * Math.cos(index * 1.3)), accuracy: 12, speed: 0 }, 1000000 + index * 2000)
  }
  const state = filter.state(1000000 + 80000)
  assert.equal(Math.round(state.distanceM), 0)
  assert.equal(state.moving, false)
})

test('standing still with noisy fixes adds no distance', () => {
  const filter = createGpsFilter()
  const wobble = [0, 6, -5, 4, -6, 3, -4, 5, -3, 2, -5, 6, -2, 3, -6, 4, -3, 5, -4, 2]
  for (let index = 0; index < 40; index += 1) {
    const offset = wobble[index % wobble.length]
    filter.push({ latitude: 12.9716 + latFor(offset), longitude: 77.5946 + latFor(offset * 0.6), accuracy: 12 }, 1000000 + index * 2000)
  }
  const state = filter.state(1000000 + 80000)
  assert.ok(state.distanceM < 6, `jitter should cancel out, got ${Math.round(state.distanceM)} m`)
  assert.equal(state.moving, false)
})

test('a distance jump from a bad fix is ignored', () => {
  const filter = createGpsFilter()
  filter.push({ latitude: 12.9716, longitude: 77.5946, accuracy: 8 }, 1000000)
  filter.push({ latitude: 12.9716 + latFor(10), longitude: 77.5946, accuracy: 8 }, 1002000)
  const before = filter.state(1002000).distanceM
  filter.push({ latitude: 12.9716 + latFor(9000), longitude: 77.5946, accuracy: 8 }, 1004000)
  const after = filter.state(1004000)
  assert.ok(Math.abs(after.distanceM - before) < 1, 'the 9 km bounce must not count')
  assert.ok(after.rejected >= 1)
})

test('fixes vaguer than the usable limit are rejected instead of inventing distance', () => {
  const filter = createGpsFilter()
  const result = filter.push({ latitude: 12.9716, longitude: 77.5946, accuracy: 400 }, 1000000)
  assert.equal(result.acceptedPoint, false)
  assert.equal(result.reason, 'weak')
  assert.equal(result.distanceM, 0)
})

test('movement state flips off when the walker stops', () => {
  const filter = createGpsFilter()
  const walk = walkPoints({ metres: 120, seconds: 90 })
  for (const point of walk) filter.push(point.coords, point.at)
  assert.equal(filter.state(walk[walk.length - 1].at).moving, true)
  const last = walk[walk.length - 1]
  for (let index = 1; index <= 12; index += 1) {
    filter.push(last.coords, last.at + index * 2000)
  }
  assert.equal(filter.state(last.at + 24000).moving, false)
})

test('speed stays human and reported km/h is plausible', () => {
  const filter = createGpsFilter()
  const walk = walkPoints({ metres: 500, seconds: 360, noise: 6, jitter: n => Math.sin(n) })
  for (const point of walk) filter.push(point.coords, point.at)
  const state = filter.state(walk[walk.length - 1].at)
  const kmh = state.speedKmh
  assert.ok(kmh > 2 && kmh < 9, `expected walking speed, got ${kmh} km/h`)
})

test('quality labels never overstate a weak fix', () => {
  assert.equal(gpsQuality(6).level, 'excellent')
  assert.equal(gpsQuality(30).level, 'good')
  assert.equal(gpsQuality(70).level, 'fair')
  assert.equal(gpsQuality(200).level, 'poor')
  assert.equal(gpsQuality(0).level, 'waiting')
})

test('haversine matches a known short distance', () => {
  const metres = haversineM({ lat: 12.9716, lon: 77.5946 }, { lat: 12.9716 + latFor(100), lon: 77.5946 })
  assert.ok(Math.abs(metres - 100) < 1.5, `expected ~100 m, got ${metres}`)
})
