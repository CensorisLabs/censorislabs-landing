export type MapSurface = 'concrete' | 'metal' | 'wood' | 'gravel'
export type CustomMapBlock = { x: number; z: number; width: number; depth: number; height: number; color: string; surface: MapSurface }
export type CustomMapMarker = { kind: 'player-spawn' | 'bot-spawn' | 'site'; x: number; z: number; label?: 'A' | 'B' }
export type CustomMap = { version: 1; name: string; blocks: CustomMapBlock[]; markers: CustomMapMarker[] }

export const CUSTOM_MAP_KEY = 'chronicle-custom-map-v1'
export const MAX_CUSTOM_MAP_JSON_BYTES = 48 * 1024
export const MAX_CUSTOM_MAP_CODE_LENGTH = 64 * 1024
export const DEFAULT_CUSTOM_MAP: CustomMap = {
  version: 1,
  name: 'Foundry Test Range',
  blocks: [
    { x: -8, z: -4, width: 5, depth: 3, height: 2, color: '#7d7467', surface: 'concrete' },
    { x: 0, z: 0, width: 4, depth: 4, height: 3, color: '#687980', surface: 'metal' },
    { x: 8, z: 4, width: 5, depth: 3, height: 2, color: '#9a7655', surface: 'wood' },
    { x: 0, z: 12, width: 8, depth: 2, height: 1, color: '#c4a45b', surface: 'gravel' },
  ],
  markers: [
    { kind: 'player-spawn', x: 0, z: -24 },
    { kind: 'bot-spawn', x: 0, z: 24 },
    { kind: 'site', x: -16, z: 0, label: 'A' },
    { kind: 'site', x: 16, z: 0, label: 'B' },
  ],
}

const surfaces = new Set<MapSurface>(['concrete', 'metal', 'wood', 'gravel'])
const clamp = (value: unknown, min: number, max: number, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
const snapGrid = (value: unknown): number => Math.max(-24, Math.min(24, Math.round(clamp(value, -24, 24, 0) / 4) * 4))

/** Parse untrusted imports into a small, bounded map schema before gameplay sees them. */
export function validateCustomMap(input: unknown): CustomMap | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Partial<CustomMap>
  if (raw.version !== 1 || !Array.isArray(raw.blocks) || !Array.isArray(raw.markers) || raw.blocks.length > 96 || raw.markers.length > 24) return null
  const blocks: CustomMapBlock[] = []
  for (const item of raw.blocks) {
    if (!item || typeof item !== 'object') return null
    const block = item as Partial<CustomMapBlock>
    const color = typeof block.color === 'string' && /^#[0-9a-f]{6}$/i.test(block.color) ? block.color : '#7d7467'
    const surface = surfaces.has(block.surface as MapSurface) ? block.surface as MapSurface : 'concrete'
    blocks.push({ x: snapGrid(block.x), z: snapGrid(block.z), width: Math.round(clamp(block.width, 1, 10, 4)), depth: Math.round(clamp(block.depth, 1, 10, 4)), height: Math.round(clamp(block.height, 1, 8, 2)), color, surface })
  }
  const markers: CustomMapMarker[] = []
  for (const item of raw.markers) {
    if (!item || typeof item !== 'object') return null
    const marker = item as Partial<CustomMapMarker>
    if (marker.kind !== 'player-spawn' && marker.kind !== 'bot-spawn' && marker.kind !== 'site') return null
    const normalized: CustomMapMarker = { kind: marker.kind, x: snapGrid(marker.x), z: snapGrid(marker.z), ...(marker.kind === 'site' ? { label: marker.label === 'B' ? 'B' : 'A' } : {}) }
    const uniqueMarker = marker.kind === 'player-spawn'
      ? markers.findIndex(existing => existing.kind === 'player-spawn')
      : marker.kind === 'site'
        ? markers.findIndex(existing => existing.kind === 'site' && existing.label === normalized.label)
        : -1
    if (uniqueMarker >= 0) markers[uniqueMarker] = normalized
    else markers.push(normalized)
  }
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 32) : ''
  return { version: 1, name: name || 'Custom Field', blocks, markers }
}

export function readCustomMap(): CustomMap {
  try {
    const stored = localStorage.getItem(CUSTOM_MAP_KEY)
    if (stored && stored.length > MAX_CUSTOM_MAP_JSON_BYTES) return structuredClone(DEFAULT_CUSTOM_MAP)
    return validateCustomMap(JSON.parse(stored ?? 'null')) ?? structuredClone(DEFAULT_CUSTOM_MAP)
  }
  catch { return structuredClone(DEFAULT_CUSTOM_MAP) }
}

export function storeCustomMap(map: CustomMap): void {
  try { localStorage.setItem(CUSTOM_MAP_KEY, JSON.stringify(map)) } catch { /* map still works in memory */ }
}

export function encodeCustomMap(map: CustomMap): string {
  const bytes = new TextEncoder().encode(JSON.stringify(map))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function decodeCustomMap(code: string): CustomMap | null {
  try {
    if (code.length > MAX_CUSTOM_MAP_CODE_LENGTH) return null
    const base64 = code.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    return validateCustomMap(JSON.parse(new TextDecoder().decode(bytes)))
  } catch { return null }
}
