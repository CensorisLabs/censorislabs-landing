// GPS for walk/run sessions: distance that ignores standing-still jitter,
// a "are they moving?" state, and quality labels that do not overstate what a
// phone can do. Everything here is pure so it can be tested without a device.

export const GPS_LIMITS = {
  // Fixes vaguer than this are useless for distance: a 200 m accuracy reading
  // can be 200 m out, so adding it would invent movement.
  maxAccuracyM: 80,
  goodAccuracyM: 15,
  // Displacement below accuracy × this factor (and below minMoveM) is noise.
  jitterFactor: 0.5,
  minMoveM: 2.5,
  // Faster than this between fixes means a GPS jump, not a person.
  maxSpeedMps: 12,
  // Hysteresis: start moving above moveSpeedMps, stop below stillSpeedMps.
  moveSpeedMps: 0.8,
  stillSpeedMps: 0.45,
  stillSamples: 3,
  stillMs: 3000,
  lostAfterMs: 10000,
  // Smoothing window for positions. Long enough to average out standing-still
  // wander, short enough that a real move still clears the noise floor quickly.
  windowMs: 12000,
  maxWindow: 8,
  // GPS chips report Doppler speed, which is far steadier than differencing
  // positions. Below this the phone is parked, whatever the coordinates do.
  stationarySpeedMps: 0.35,
}

const rad = value => value * Math.PI / 180

export function haversineM(a, b) {
  if (!a || !b) return 0
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function gpsQuality(accuracyM) {
  const accuracy = Number(accuracyM)
  if (!Number.isFinite(accuracy) || accuracy <= 0) return { level: 'waiting', label: 'Waiting for GPS', detail: 'No position yet.' }
  if (accuracy <= GPS_LIMITS.goodAccuracyM) return { level: 'excellent', label: `GPS ±${Math.round(accuracy)} m`, detail: 'Strong fix — distance is accurate to a few metres.' }
  if (accuracy <= 35) return { level: 'good', label: `GPS ±${Math.round(accuracy)} m`, detail: 'Good fix. Distance is close but can drift slightly.' }
  if (accuracy <= GPS_LIMITS.maxAccuracyM) return { level: 'fair', label: `GPS ±${Math.round(accuracy)} m`, detail: 'Weak fix. Distance may be short until the signal improves.' }
  return { level: 'poor', label: 'No usable fix', detail: 'Move into the open; a fix this vague would invent distance.' }
}

export function gpsErrorMessage(error) {
  const code = error && Number(error.code)
  if (code === 1) return 'Location permission was denied. Allow it in the browser, or the walk uses a pace estimate.'
  if (code === 2) return 'Location is switched off on this device.'
  if (code === 3) return 'GPS is still searching. Move into the open and keep this screen on.'
  return 'GPS is unavailable right now. The walk continues with a pace estimate.'
}

export function createGpsFilter(options = {}) {
  const cfg = { ...GPS_LIMITS, ...options }
  let points = []
  let anchor = null
  let anchorAt = 0
  let distance = 0
  let speed = 0
  let moving = false
  let slowSamples = 0
  let lastMoveAt = 0
  let lastFix = null
  let lastAt = 0
  let accuracy = 0
  let bestAccuracy = Infinity
  let accepted = 0
  let rejected = 0

  const smoothed = () => {
    if (!points.length) return null
    let lat = 0
    let lon = 0
    let weightSum = 0
    for (const point of points) {
      // Trust tight fixes far more than vague ones.
      const weight = 1 / Math.max(1, point.accuracy) ** 2
      lat += point.lat * weight
      lon += point.lon * weight
      weightSum += weight
    }
    return { lat: lat / weightSum, lon: lon / weightSum }
  }

  function state(now = Date.now()) {
    const quality = gpsQuality(accuracy)
    const lost = Boolean(lastAt) && now - lastAt > cfg.lostAfterMs
    return {
      distanceM: distance,
      speedMps: speed,
      speedKmh: Math.round(speed * 3.6 * 10) / 10,
      moving,
      accuracy,
      quality,
      accepted,
      rejected,
      lost,
      lastAt,
      bestAccuracy: Number.isFinite(bestAccuracy) ? Math.round(bestAccuracy) : 0,
    }
  }

  function push(coords, now = Date.now()) {
    const lat = Number(coords?.latitude)
    const lon = Number(coords?.longitude)
    const value = Number(coords?.accuracy)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      rejected += 1
      return { ...state(now), acceptedPoint: false, reason: 'invalid' }
    }
    accuracy = Number.isFinite(value) && value > 0 ? Math.min(value, 9999) : 999
    lastAt = now
    if (accuracy > cfg.maxAccuracyM) {
      rejected += 1
      return { ...state(now), acceptedPoint: false, reason: 'weak' }
    }

    const point = { lat, lon, accuracy, at: now }
    const previous = lastFix
    if (previous && now > previous.at) {
      const jump = haversineM(previous, point)
      const dt = Math.max(0.2, (now - previous.at) / 1000)
      if (jump / dt > cfg.maxSpeedMps && jump > Math.max(15, accuracy * 2)) {
        // A signal bounce, not a person. Keep the old anchor untouched.
        rejected += 1
        bestAccuracy = Math.min(bestAccuracy, accuracy)
        return { ...state(now), acceptedPoint: false, reason: 'jump' }
      }
    }

    const reportedSpeed = Number(coords?.speed)
    const hasSpeed = Number.isFinite(reportedSpeed) && reportedSpeed >= 0

    lastFix = point
    accepted += 1
    bestAccuracy = Math.min(bestAccuracy, accuracy)
    points.push(point)
    points = points.filter(item => now - item.at <= cfg.windowMs)
    if (points.length > cfg.maxWindow) points.shift()

    const next = smoothed()
    if (!anchor) {
      // Start from the raw first fix: seeding from the smoothed average would
      // hide the first few metres of every session.
      anchor = { lat: point.lat, lon: point.lon }
      anchorAt = now
      return { ...state(now), acceptedPoint: true, reason: 'first' }
    }

    // The chip says the phone is not moving: hold the anchor here so the next
    // real steps are measured from this spot and the drift in between is lost.
    if (hasSpeed && reportedSpeed < cfg.stationarySpeedMps) {
      anchor = next
      anchorAt = now
      speed = reportedSpeed
      slowSamples += 1
      if (slowSamples >= cfg.stillSamples) moving = false
      return { ...state(now), acceptedPoint: true, reason: 'stationary' }
    }

    const moved = haversineM(anchor, next)
    const floor = Math.max(cfg.minMoveM, accuracy * cfg.jitterFactor)
    // Speed is measured from the anchor, which is the last point distance was
    // counted from, so it covers exactly the metres just added.
    const seconds = Math.max(0.6, (now - (anchorAt || previous?.at || now - 1000)) / 1000)
    if (moved >= floor) {
      distance += moved
      anchor = next
      anchorAt = now
      lastMoveAt = now
      slowSamples = 0
      moving = true
      const instant = hasSpeed && reportedSpeed > 0.2 ? reportedSpeed : moved / seconds
      speed = speed > 0 ? speed * 0.6 + instant * 0.4 : instant
    } else {
      // Below the noise floor: keep the anchor where it is so this movement is
      // still counted once it clears the floor. Moving the anchor here would
      // quietly drop part of every slow step and shrink the total.
      const instant = hasSpeed && reportedSpeed > 0.2 ? reportedSpeed : moved / seconds
      speed = speed > 0 ? speed * 0.7 + instant * 0.3 : instant
      if (!hasSpeed && speed < cfg.stillSpeedMps) {
        slowSamples += 1
        if (slowSamples >= cfg.stillSamples && now - lastMoveAt > cfg.stillMs) moving = false
      }
    }
    return { ...state(now), acceptedPoint: true, reason: moved >= floor ? 'moved' : 'noise' }
  }

  // Called when the session ends: the smoothed position always trails the last
  // fix by roughly half a window, so add that final leg instead of ending a
  // walk a few metres short.
  function settle() {
    if (lastFix && anchor) {
      const tail = haversineM(anchor, lastFix)
      if (tail > cfg.minMoveM && tail < 250) {
        distance += tail
        anchor = lastFix
        anchorAt = lastAt
      }
    }
    return distance
  }

  function reset() {
    points = []
    anchor = null
    anchorAt = 0
    distance = 0
    speed = 0
    moving = false
    slowSamples = 0
    lastMoveAt = 0
    lastFix = null
    lastAt = 0
    accuracy = 0
    bestAccuracy = Infinity
    accepted = 0
    rejected = 0
  }

  return { push, settle, reset, state: () => state(), config: cfg }
}

// Route drawing for the walk map. The app never talks to a tile server, so the
// route is drawn as a trace: real shape, no network, no API key, no location
// leaving the device. Points closer than the tolerance are dropped so an hour
// of fixes does not become thousands of SVG nodes.
export function simplifyRoute(points, toleranceM = 4) {
  const list = Array.isArray(points) ? points.filter(point => Number.isFinite(point?.lat) && Number.isFinite(point?.lon)) : []
  if (list.length < 2) return list.map(point => ({ lat: point.lat, lon: point.lon }))
  const tolerance = Math.max(0, Number(toleranceM) || 0)
  const kept = [{ lat: list[0].lat, lon: list[0].lon }]
  for (const point of list.slice(1, -1)) {
    const last = kept[kept.length - 1]
    if (haversineM(last, point) >= tolerance) kept.push({ lat: point.lat, lon: point.lon })
  }
  const tail = list[list.length - 1]
  if (haversineM(kept[kept.length - 1], tail) > 0.5) kept.push({ lat: tail.lat, lon: tail.lon })
  return kept
}

export const ROUTE_MIN_SPAN_M = 40
export function routePath(points, options = {}) {
  const width = Number(options.width) || 320
  const height = Number(options.height) || 180
  const padding = Math.max(0, Number(options.padding ?? 12))
  const list = simplifyRoute(points, options.toleranceM ?? 4)
  if (list.length < 2) return null
  const distanceM = list.slice(1).reduce((sum, point, index) => sum + haversineM(list[index], point), 0)
  if (distanceM < 1) return null
  const midLat = list.reduce((sum, point) => sum + point.lat, 0) / list.length
  const kx = Math.cos(rad(midLat))
  // Local flat projection in metres; the error over a walk is negligible.
  const flat = list.map(point => ({
    x: (point.lon - list[0].lon) * 111320 * kx,
    y: -(point.lat - list[0].lat) * 110540,
  }))
  const xs = flat.map(item => item.x)
  const ys = flat.map(item => item.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const spanX = maxX - minX, spanY = maxY - minY
  const innerW = Math.max(1, width - padding * 2)
  const innerH = Math.max(1, height - padding * 2)
  // A short walk is not blown up to fill the box: jitter would look like a huge
  // scribble. Cap the zoom at the size that fits ROUTE_MIN_SPAN_M.
  const maxScale = Math.min(innerW, innerH) / ROUTE_MIN_SPAN_M
  const fit = Math.min(innerW / Math.max(spanX, 1), innerH / Math.max(spanY, 1))
  const scale = Math.max(0.0001, Math.min(fit, maxScale))
  const offsetX = padding + (innerW - spanX * scale) / 2
  const offsetY = padding + (innerH - spanY * scale) / 2
  const project = item => ({
    x: Math.round((offsetX + (item.x - minX) * scale) * 10) / 10,
    y: Math.round((offsetY + (item.y - minY) * scale) * 10) / 10,
  })
  const drawn = flat.map(project)
  const start = drawn[0]
  const end = drawn[drawn.length - 1]
  return {
    points: drawn.map(item => `${item.x},${item.y}`).join(' '),
    start,
    end,
    distanceM,
    count: list.length,
    width,
    height,
  }
}
