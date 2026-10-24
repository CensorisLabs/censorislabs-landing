export type KchSpawn = { pos: [number, number, number]; rotation: [number, number] }
export type KchMapData = {
  mapName: string
  spawnPlaces: { firstTeam: KchSpawn[]; secondTeam: KchSpawn[] }
  chunks: Record<string, Array<[number, number, number]>>
}
