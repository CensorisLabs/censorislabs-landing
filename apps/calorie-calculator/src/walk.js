// Live walk/run session: elapsed time, GPS distance, stride-aware steps and a
// speed-based calorie estimate. The active session is mirrored into
// localStorage so closing the app mid-walk does not lose the timer.

import { metForSpeed } from './steps.js'

const KEY = 'cc-active-walk-v1'

export const WALK_PACES = [
  { id: 'gentle', label: 'Gentle stroll', hint: 'Easy pace · 3 km/h', speed: 3, met: metForSpeed(3) },
  { id: 'steady', label: 'Steady walk', hint: 'Normal pace · 4.5 km/h', speed: 4.5, met: metForSpeed(4.5) },
  { id: 'brisk', label: 'Brisk walk', hint: 'Fast pace · 5.5 km/h', speed: 5.5, met: metForSpeed(5.5) },
]
export const RUN_PACES = [
  { id: 'jog', label: 'Easy jog', hint: 'Light run · 7.5 km/h', speed: 7.5, met: metForSpeed(7.5) },
  { id: 'run', label: 'Steady run', hint: 'Comfortable run · 9.5 km/h', speed: 9.5, met: metForSpeed(9.5) },
  { id: 'tempo', label: 'Fast run', hint: 'Hard effort · 12 km/h', speed: 12, met: metForSpeed(12) },
]
export const PACES_FOR = mode => (mode === 'run' ? RUN_PACES : WALK_PACES)

export const COMPANIONS = ['Alone', 'Friends', 'Family', 'Partner', 'Pet', 'Group / club']
export const FEELINGS = ['Easy', 'Moderate', 'Hard']
export const PLACES = ['Neighbourhood', 'Park', 'Trail', 'Treadmill', 'Gym', 'Beach']
export const WEATHERS = ['Sunny', 'Cloudy', 'Windy', 'Rain', 'Hot', 'Cold']

export function emptyWalk() {
  return {
    id: `walk-${Date.now()}`,
    startedAt: Date.now(),
    endedAt: 0,
    pauseStartedAt: 0,
    pausedMs: 0,
    distanceM: 0,
    accuracyOk: true,
    points: 0,
    mode: 'walk',
    pace: 'steady',
    gps: false,
    startPhoto: '',
    endPhoto: '',
    checkin: null,
  }
}

export function loadWalk(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw)
    if (!value || !value.startedAt || value.endedAt) return null
    return value
  } catch {
    return null
  }
}

export function saveWalk(walk, storage = globalThis.localStorage) {
  try {
    if (!walk) storage?.removeItem(KEY)
    else storage?.setItem(KEY, JSON.stringify(walk))
  } catch {
    /* storage full or unavailable */
  }
}

export function clearWalk(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export const isPaused = walk => Boolean(walk && walk.pauseStartedAt)

export function elapsedMs(walk, now = Date.now()) {
  if (!walk) return 0
  // While paused the clock is frozen at the moment of pausing; accumulated
  // pauses are already in pausedMs, so they are not added again.
  const until = walk.endedAt || walk.pauseStartedAt || now
  return Math.max(0, until - walk.startedAt - (Number(walk.pausedMs) || 0))
}

export function formatDuration(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = value => String(value).padStart(2, '0')
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export function haversineM(a, b) {
  if (!a || !b) return 0
  const rad = value => value * Math.PI / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function paceFromSpeed(speedKmh) {
  const kmh = Number(speedKmh)
  if (!(kmh > 0.5)) return '—'
  return formatPaceSeconds(Math.round(60 / kmh * 60))
}

// Seconds per kilometre rounded once, so 5.99 km/h shows 10:01 instead of 9:60.
function formatPaceSeconds(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

export function paceLabel(minutes, distanceKm) {
  if (!(minutes > 0) || !(distanceKm > 0.01)) return '—'
  return formatPaceSeconds(minutes / distanceKm * 60)
}

export function walkSummary(walk, weightKg, strideM = 0.76) {
  const ms = elapsedMs(walk)
  const minutes = ms / 60000
  const mode = walk?.mode === 'run' ? 'run' : 'walk'
  const paces = PACES_FOR(mode)
  const pace = paces.find(item => item.id === walk?.pace) || paces[1]
  const gpsKm = (Number(walk?.distanceM) || 0) / 1000
  // 30 m of accepted GPS movement is enough to trust it over the pace estimate.
  const useGps = Boolean(walk?.gps) && gpsKm > 0.03
  const distanceKm = useGps ? gpsKm : minutes / 60 * pace.speed
  const stride = Number(strideM) > 0 ? Number(strideM) : 0.76
  const steps = Math.round(distanceKm * 1000 / stride)
  // GPS speed is measured directly (Doppler), so it is steadier than dividing
  // distance by a clock that may include pauses.
  const gpsSpeed = Number(walk?.gpsSpeedKmh) || 0
  const liveSpeed = useGps && gpsSpeed > 0.5
  const speed = liveSpeed ? gpsSpeed : minutes > 0 ? distanceKm / (minutes / 60) : pace.speed
  const met = metForSpeed(speed)
  const calories = Math.round(minutes * Math.max(0.5, met - 1) * 3.5 * Math.max(0, Number(weightKg) || 0) / 200)
  return {
    ms,
    minutes: Math.round(minutes * 10) / 10,
    distanceKm: Math.round(distanceKm * 100) / 100,
    steps,
    calories,
    speed: Math.round(speed * 10) / 10,
    met: Math.round(met * 10) / 10,
    paceLabel: pace.label,
    pacePerKm: liveSpeed ? paceFromSpeed(gpsSpeed) : paceLabel(minutes, distanceKm),
    mode,
    modeLabel: mode === 'run' ? 'Run' : 'Walk',
    source: useGps ? 'GPS' : 'Pace estimate',
    gpsAccuracy: Number(walk?.gpsAccuracy) || 0,
  }
}

export function addPosition(walk, position) {
  if (!walk || !position?.coords) return walk
  const { latitude: lat, longitude: lon, accuracy } = position.coords
  const next = { ...walk }
  if (Number(accuracy) > 100) return next
  const point = { lat, lon, at: Date.now(), accuracy: Number(accuracy) || 0 }
  if (next.lastPos) {
    const metres = haversineM(next.lastPos, point)
    // Ignore GPS jitter: moves under 3 m are noise, jumps over 400 m are errors.
    if (metres > 3 && metres < 400) next.distanceM = (Number(next.distanceM) || 0) + metres
  }
  next.lastPos = point
  next.points = (Number(next.points) || 0) + 1
  next.gps = true
  return next
}
