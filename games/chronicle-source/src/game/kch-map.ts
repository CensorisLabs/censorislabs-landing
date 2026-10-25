export type KchSpawn = { pos: [number, number, number]; rotation: [number, number] }
export type KchMapData = {
  mapName: string
  spawnPlaces: { firstTeam: KchSpawn[]; secondTeam: KchSpawn[] }
  chunks: Record<string, Array<[number, number, number]>>
  brightness?: number
  skyboxColor?: string
  fogColor?: string
  fogNear?: number
  fogFar?: number
}

function normalizeKchFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeKchFields)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key.endsWith('___DATA') ? key.slice(0, -'___DATA'.length) : key, normalizeKchFields(child)]))
}

function normalizeKchChunks(value: unknown): KchMapData['chunks'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const chunks: KchMapData['chunks'] = {}
  for (const [key, cells] of Object.entries(value)) {
    if (!Array.isArray(cells)) continue
    // Most exports store sparse [start, texture, length] runs. Tomesha uses a
    // dense 16³ texture array where zero is empty, so compress occupied cells
    // before feeding both formats through the same renderer.
    if (cells.length === 4096 && cells.every(cell => Number.isFinite(cell) && Number.isInteger(cell))) {
      const runs: Array<[number, number, number]> = []
      for (let index = 0; index < cells.length;) {
        const texture = cells[index]
        if (typeof texture !== 'number' || texture <= 0) { index += 1; continue }
        let end = index + 1
        while (end < cells.length && cells[end] === texture) end += 1
        runs.push([index, texture, end - index])
        index = end
      }
      chunks[key] = runs
      continue
    }
    chunks[key] = cells as KchMapData['chunks'][string]
  }
  return chunks
}

/** KCH community exports use both standard keys and suffixed ___DATA keys. */
export function normalizeKchMapData(value: unknown): KchMapData | null {
  const raw = normalizeKchFields(value) as Partial<KchMapData> | null
  if (!raw || typeof raw !== 'object' || !raw.chunks || typeof raw.chunks !== 'object' || !Object.keys(raw.chunks).length) return null
  const normalizeSpawns = (list: unknown): KchSpawn[] => Array.isArray(list) ? list.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const spawn = item as Partial<KchSpawn>
    if (!Array.isArray(spawn.pos) || spawn.pos.length !== 3 || !spawn.pos.every(Number.isFinite)) return []
    const rotation = Array.isArray(spawn.rotation) && spawn.rotation.length === 2 && spawn.rotation.every(Number.isFinite) ? spawn.rotation : [0, 0]
    return [{ pos: [spawn.pos[0]!, spawn.pos[1]!, spawn.pos[2]!], rotation: [rotation[0]!, rotation[1]!] }]
  }) : []
  const places = raw.spawnPlaces as Partial<KchMapData['spawnPlaces']> | undefined
  return {
    mapName: typeof raw.mapName === 'string' ? raw.mapName : '',
    spawnPlaces: { firstTeam: normalizeSpawns(places?.firstTeam), secondTeam: normalizeSpawns(places?.secondTeam) },
    chunks: normalizeKchChunks(raw.chunks),
    ...(typeof raw.brightness === 'number' ? { brightness: raw.brightness } : {}),
    ...(typeof raw.skyboxColor === 'string' ? { skyboxColor: raw.skyboxColor } : {}),
    ...(typeof raw.fogColor === 'string' ? { fogColor: raw.fogColor } : {}),
    ...(typeof raw.fogNear === 'number' ? { fogNear: raw.fogNear } : {}),
    ...(typeof raw.fogFar === 'number' ? { fogFar: raw.fogFar } : {}),
  }
}
