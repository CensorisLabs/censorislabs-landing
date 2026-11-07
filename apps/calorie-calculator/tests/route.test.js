import test from 'node:test'
import assert from 'node:assert/strict'
import { ROUTE_MIN_SPAN_M, routePath, simplifyRoute } from '../src/gps.js'

// ~1 degree of latitude is 110.54 km; 0.0001 deg is about 11 m.
const step = 0.0001
const line = count => Array.from({ length: count }, (_, index) => ({ lat: 12.9716 + index * step, lon: 77.5946 }))

test('a route needs at least two distinct fixes to draw', () => {
  assert.equal(routePath([]), null)
  assert.equal(routePath([{ lat: 1, lon: 1 }]), null)
  assert.equal(routePath([{ lat: 1, lon: 1 }, { lat: 1, lon: 1 }]), null)
  assert.equal(routePath([{ lat: 1, lon: 1 }, { lat: NaN, lon: 1 }]), null)
  assert.equal(routePath(null), null)
})

test('two real fixes produce one polyline with start and end inside the box', () => {
  const drawn = routePath(line(2), { width: 320, height: 180 })
  assert.ok(drawn)
  assert.match(drawn.points, /^\d+(\.\d+)?,\d+(\.\d+)? \d+(\.\d+)?,\d+(\.\d+)?$/)
  for (const point of [drawn.start, drawn.end]) {
    assert.ok(point.x >= 0 && point.x <= 320, `x ${point.x} inside width`)
    assert.ok(point.y >= 0 && point.y <= 180, `y ${point.y} inside height`)
  }
  assert.ok(drawn.distanceM > 9 && drawn.distanceM < 15, `two 11 m steps: ${drawn.distanceM}`)
})

test('every projected point stays inside the viewBox for a winding route', () => {
  const points = line(6).map((point, index) => ({ lat: point.lat, lon: point.lon + (index % 2) * step }))
  const drawn = routePath(points, { width: 300, height: 200, padding: 8 })
  const coords = drawn.points.split(' ').map(pair => pair.split(',').map(Number))
  assert.equal(coords.length, drawn.count)
  for (const [x, y] of coords) {
    assert.ok(x >= 8 && x <= 292, `x ${x} respects padding`)
    assert.ok(y >= 8 && y <= 192, `y ${y} respects padding`)
  }
})

test('simplifyRoute keeps the ends and drops points closer than the tolerance', () => {
  const dense = line(50).flatMap(point => [point, { ...point }])
  const kept = simplifyRoute(dense, 5)
  assert.equal(kept[0].lat, dense[0].lat)
  assert.equal(kept[kept.length - 1].lat, dense[dense.length - 1].lat)
  assert.ok(kept.length < dense.length, 'duplicates are gone')
  assert.ok(kept.length > 1, 'the route is still a route')
})

test('a tiny walk is not magnified into a scribble', () => {
  // Two fixes 6 m apart must not fill a 320 px box: the zoom is capped.
  const drawn = routePath([{ lat: 12.9716, lon: 77.5946 }, { lat: 12.9716 + 0.00005, lon: 77.5946 }], { width: 320, height: 180, padding: 12 })
  const px = Math.abs(drawn.start.y - drawn.end.y)
  assert.ok(px > 0, 'something is drawn')
  assert.ok(px <= (180 - 24) * (6 / ROUTE_MIN_SPAN_M) + 4, `6 m drew ${px}px, capped by the minimum span`)
})

test('latitude and longitude are projected with the same scale, so the shape is not stretched', () => {
  // A square-ish walk (equal metres north and east) must draw roughly square.
  const latStep = 0.0001
  const lonStep = latStep / Math.cos(12.9716 * Math.PI / 180)
  const points = [
    { lat: 12.9716, lon: 77.5946 },
    { lat: 12.9716 + latStep, lon: 77.5946 },
    { lat: 12.9716 + latStep, lon: 77.5946 + lonStep },
  ]
  const drawn = routePath(points, { width: 320, height: 320, padding: 0 })
  const vertical = Math.abs(drawn.start.y - drawn.end.y)
  const horizontal = Math.abs(drawn.start.x - drawn.end.x)
  assert.ok(Math.abs(vertical - horizontal) < 2, `square-ish: ${vertical}px vs ${horizontal}px`)
})
