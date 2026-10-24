import { ARMORY_GUNS, defaultInventory, KNIFE_SKINS, OPERATOR_SKINS, operatorSkinForLevel, type SkinItem, type WeaponId } from '../game/fps'

export type Locale = 'en' | 'zh-CN'
export type Quality = 'low' | 'medium' | 'high'
export type ScoreEntry = { name: string; score: number; seconds: number; at: number }
export type PlayerStats = { kills: number; headshots: number; deaths: number; matches: number; wins: number; shots: number; hits: number }
export type SaveData = {
  version: 1
  locale: Locale | ''
  musicVolume: number
  sfxVolume: number
  muted: boolean
  sensitivity: number
  fov: number
  invertY: boolean
  quality: Quality
  reducedMotion: boolean
  tutorialDone: boolean
  playerName: string
  leaderboard: ScoreEntry[]
  xp: number
  level: number
  operatorSkinId: string
  primaryGunId: string
  handgunGunId: string
  knifeSkinId: string
  unlockedKnifeSkinIds: string[]
  dailyChallenge: { date: string; id: number; progress: number; claimed: boolean }
  weaponKills: Partial<Record<WeaponId, number>>
  credits: number
  inventory: SkinItem[]
  equipped: Partial<Record<WeaponId, string>>
  stats: PlayerStats
}

export const SAVE_KEY = 'chroniclefrontier.save'
export const LEADERBOARD_SIZE = 10
export function xpForLevel(level: number): number { return 500 + (Math.max(1, level) - 1) * 175 }
export function defaultSave(): SaveData {
  const inventory = defaultInventory()
  return { version: 1, locale: '', musicVolume: 0.7, sfxVolume: 0.8, muted: false, sensitivity: 1, fov: 92, invertY: false, quality: 'high', reducedMotion: false, tutorialDone: false, playerName: 'RAVEN', leaderboard: [], xp: 0, level: 1, operatorSkinId: OPERATOR_SKINS[0]!.id, primaryGunId: ARMORY_GUNS[0]!.id, handgunGunId: ARMORY_GUNS.find(g => g.slot === 'handgun')!.id, knifeSkinId: KNIFE_SKINS[0]!.id, unlockedKnifeSkinIds: KNIFE_SKINS.filter(s => s.level <= 1).map(s => s.id), dailyChallenge: { date: new Date().toISOString().slice(0, 10), id: Math.floor(Date.now() / 86400000) % 30, progress: 0, claimed: false }, weaponKills: {}, credits: 420, inventory, equipped: { glock: inventory[0]?.id, deagle: inventory[0]?.id }, stats: { kills: 0, headshots: 0, deaths: 0, matches: 0, wins: 0, shots: 0, hits: 0 } }
}
const clamp01 = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback
function validInventory(value: unknown, fallback: SkinItem[]): SkinItem[] { return Array.isArray(value) ? value.filter(item => !!item && typeof item === 'object' && typeof (item as SkinItem).id === 'string' && typeof (item as SkinItem).weapon === 'string' && typeof (item as SkinItem).name === 'string').slice(0, 2000) as SkinItem[] : fallback }
function validStats(value: unknown, fallback: PlayerStats): PlayerStats { const v = value && typeof value === 'object' ? value as Record<string, unknown> : {}; const n = (key: keyof PlayerStats) => typeof v[key] === 'number' && Number.isFinite(v[key]) ? Math.max(0, Math.floor(v[key] as number)) : fallback[key]; return { kills: n('kills'), headshots: n('headshots'), deaths: n('deaths'), matches: n('matches'), wins: n('wins'), shots: n('shots'), hits: n('hits') } }

export function parseSave(raw: string | null): SaveData {
  const base = defaultSave(); if (!raw) return base
  let data: Record<string, unknown>
  try { const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base; data = parsed as Record<string, unknown> } catch { return base }
  if (data.version !== 1) return base
  const board = Array.isArray(data.leaderboard) ? data.leaderboard : []
  const inventory = validInventory(data.inventory, base.inventory)
  const equipped = data.equipped && typeof data.equipped === 'object' ? data.equipped as Partial<Record<WeaponId, string>> : base.equipped
  const level = typeof data.level === 'number' && Number.isFinite(data.level) ? Math.max(1, Math.min(50, Math.floor(data.level))) : base.level
  const selectedOperator = OPERATOR_SKINS.find(skin => skin.id === data.operatorSkinId && skin.level <= level) ?? operatorSkinForLevel(level)
  return { ...base, locale: data.locale === 'en' || data.locale === 'zh-CN' ? data.locale : '', musicVolume: clamp01(data.musicVolume, base.musicVolume), sfxVolume: clamp01(data.sfxVolume, base.sfxVolume), muted: data.muted === true, sensitivity: typeof data.sensitivity === 'number' && data.sensitivity >= 0.2 && data.sensitivity <= 3 ? data.sensitivity : base.sensitivity, fov: typeof data.fov === 'number' && data.fov >= 70 && data.fov <= 110 ? data.fov : base.fov, invertY: data.invertY === true, quality: data.quality === 'low' || data.quality === 'medium' || data.quality === 'high' ? data.quality : base.quality, reducedMotion: data.reducedMotion === true, tutorialDone: data.tutorialDone === true, playerName: typeof data.playerName === 'string' && data.playerName.trim() ? data.playerName.trim().slice(0, 16) : base.playerName, leaderboard: board.filter((e): e is ScoreEntry => !!e && typeof e === 'object' && typeof (e as ScoreEntry).name === 'string' && Number.isFinite((e as ScoreEntry).score)).map(e => ({ name: e.name.slice(0, 16), score: Math.max(0, Math.floor(e.score)), seconds: Number.isFinite(e.seconds) ? e.seconds : 0, at: Number.isFinite(e.at) ? e.at : 0 })).slice(0, LEADERBOARD_SIZE), xp: typeof data.xp === 'number' && Number.isFinite(data.xp) ? Math.max(0, Math.floor(data.xp)) : base.xp, level, operatorSkinId: selectedOperator.id, primaryGunId: typeof data.primaryGunId === 'string' && ARMORY_GUNS.some(g => g.id === data.primaryGunId && g.slot === 'primary') ? data.primaryGunId : base.primaryGunId, handgunGunId: typeof data.handgunGunId === 'string' && ARMORY_GUNS.some(g => g.id === data.handgunGunId && g.slot === 'handgun') ? data.handgunGunId : base.handgunGunId, knifeSkinId: typeof data.knifeSkinId === 'string' && KNIFE_SKINS.some(s => s.id === data.knifeSkinId) ? data.knifeSkinId : base.knifeSkinId, unlockedKnifeSkinIds: Array.isArray(data.unlockedKnifeSkinIds) ? [...new Set(data.unlockedKnifeSkinIds.filter((id): id is string => typeof id === 'string' && KNIFE_SKINS.some(s => s.id === id)))].slice(0, KNIFE_SKINS.length) : base.unlockedKnifeSkinIds, dailyChallenge: data.dailyChallenge && typeof data.dailyChallenge === 'object' ? { date: typeof (data.dailyChallenge as SaveData['dailyChallenge']).date === 'string' ? (data.dailyChallenge as SaveData['dailyChallenge']).date : base.dailyChallenge.date, id: Math.max(0, Math.min(29, Number((data.dailyChallenge as SaveData['dailyChallenge']).id) || 0)), progress: Math.max(0, Math.floor(Number((data.dailyChallenge as SaveData['dailyChallenge']).progress) || 0)), claimed: (data.dailyChallenge as SaveData['dailyChallenge']).claimed === true } : base.dailyChallenge, weaponKills: data.weaponKills && typeof data.weaponKills === 'object' ? data.weaponKills as SaveData['weaponKills'] : {}, credits: typeof data.credits === 'number' && Number.isFinite(data.credits) ? Math.max(0, Math.floor(data.credits)) : base.credits, inventory, equipped, stats: validStats(data.stats, base.stats) }
}
export function insertScore(board: ScoreEntry[], entry: ScoreEntry): { board: ScoreEntry[]; rank: number } { const next = [...board, entry].sort((a, b) => b.score - a.score || a.seconds - b.seconds || a.at - b.at).slice(0, LEADERBOARD_SIZE); return { board: next, rank: next.indexOf(entry) } }
export class SaveStore {
  data: SaveData
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage) { let raw: string | null = null; try { raw = this.storage?.getItem(SAVE_KEY) ?? null } catch { raw = null }; this.data = parseSave(raw) }
  update(patch: Partial<SaveData>): void { this.data = { ...this.data, ...patch }; try { this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data)) } catch { /* keep in memory */ } }
}
