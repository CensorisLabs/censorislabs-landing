export type WeaponId = 'glock' | 'deagle' | 'mp5' | 'ak47' | 'm4a4' | 'awp' | 'knife'
export type MatchType = 'ffa' | 'tdm' | 'royale'
export type MapId = 'aurelian-forum' | 'sun-archive' | 'fjordgate'
export type BotDifficulty = 'recruit' | 'regular' | 'veteran' | 'elite'
export type Rarity = 'Consumer' | 'Industrial' | 'Mil-Spec' | 'Restricted' | 'Classified' | 'Covert' | 'Legendary'

export type WeaponDef = {
  id: WeaponId
  name: string
  short: string
  damage: number
  headshot: number
  fireRate: number
  magazine: number
  reload: number
  range: number
  spread: number
  recoil: number
  movement: number
  automatic: boolean
  color: string
}

export const WEAPON_ORDER: WeaponId[] = ['glock', 'deagle', 'mp5', 'ak47', 'm4a4', 'awp', 'knife']

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  glock: { id: 'glock', name: 'Cinder-9', short: 'C9', damage: 22, headshot: 2.4, fireRate: 8.5, magazine: 20, reload: 1.55, range: 42, spread: 0.018, recoil: 0.08, movement: 1, automatic: true, color: '#a7b2bd' },
  deagle: { id: 'deagle', name: 'Stonehand', short: 'STONE', damage: 54, headshot: 2.7, fireRate: 2.8, magazine: 7, reload: 1.8, range: 62, spread: 0.014, recoil: 0.2, movement: 0.94, automatic: false, color: '#d5a84a' },
  mp5: { id: 'mp5', name: 'Rivet-5', short: 'R5', damage: 19, headshot: 2.1, fireRate: 12.5, magazine: 30, reload: 1.7, range: 38, spread: 0.025, recoil: 0.055, movement: 1.02, automatic: true, color: '#8d9aa8' },
  ak47: { id: 'ak47', name: 'Morrow-7', short: 'M7', damage: 35, headshot: 2.4, fireRate: 9.2, magazine: 30, reload: 2.15, range: 72, spread: 0.022, recoil: 0.14, movement: 0.9, automatic: true, color: '#b67546' },
  m4a4: { id: 'm4a4', name: 'Sentinel-11', short: 'S11', damage: 30, headshot: 2.35, fireRate: 11.5, magazine: 30, reload: 1.95, range: 70, spread: 0.017, recoil: 0.095, movement: 0.94, automatic: true, color: '#7e9a9e' },
  awp: { id: 'awp', name: 'Longwatch', short: 'LW', damage: 115, headshot: 2.2, fireRate: 0.9, magazine: 5, reload: 2.8, range: 120, spread: 0.004, recoil: 0.3, movement: 0.72, automatic: false, color: '#719dc7' },
  knife: { id: 'knife', name: 'Field Shard', short: 'SHARD', damage: 85, headshot: 1, fireRate: 2.2, magazine: 1, reload: 0, range: 3.2, spread: 0.04, recoil: 0.02, movement: 1.12, automatic: false, color: '#e9edf2' },
}

export type SkinItem = { id: string; weapon: WeaponId; name: string; rarity: Rarity; color: string; pattern: string }

export const SKINS: SkinItem[] = [
  { id: 'glock-sand', weapon: 'glock', name: 'Sandline', rarity: 'Consumer', color: '#b8a98d', pattern: 'micro-grid' },
  { id: 'deagle-cobalt', weapon: 'deagle', name: 'Cobalt Circuit', rarity: 'Industrial', color: '#2e86c1', pattern: 'circuit' },
  { id: 'mp5-oxide', weapon: 'mp5', name: 'Oxide', rarity: 'Mil-Spec', color: '#d2703b', pattern: 'oxide' },
  { id: 'ak47-jungle', weapon: 'ak47', name: 'Jungle Mesh', rarity: 'Restricted', color: '#3d9a65', pattern: 'mesh' },
  { id: 'm4a4-neon', weapon: 'm4a4', name: 'Neon Grid', rarity: 'Classified', color: '#12d6c5', pattern: 'grid' },
  { id: 'awp-night', weapon: 'awp', name: 'Night Watch', rarity: 'Covert', color: '#bc4cff', pattern: 'stars' },
  { id: 'knife-gold', weapon: 'knife', name: 'Auric Edge', rarity: 'Legendary', color: '#f5c85a', pattern: 'gold' },
  { id: 'glock-ember', weapon: 'glock', name: 'Kiln Glow', rarity: 'Mil-Spec', color: '#db6246', pattern: 'ember' },
  { id: 'glock-river', weapon: 'glock', name: 'River Glass', rarity: 'Restricted', color: '#4cb6b3', pattern: 'river' },
  { id: 'deagle-mosaic', weapon: 'deagle', name: 'Mosaic Gold', rarity: 'Classified', color: '#c09b4d', pattern: 'mosaic' },
  { id: 'deagle-basalt', weapon: 'deagle', name: 'Basalt Crown', rarity: 'Covert', color: '#5a6573', pattern: 'basalt' },
  { id: 'mp5-frost', weapon: 'mp5', name: 'Frost Reed', rarity: 'Industrial', color: '#82cdd6', pattern: 'reed' },
  { id: 'mp5-moss', weapon: 'mp5', name: 'Mossbound', rarity: 'Restricted', color: '#678b4c', pattern: 'moss' },
  { id: 'ak47-saffron', weapon: 'ak47', name: 'Saffron Route', rarity: 'Classified', color: '#e5a841', pattern: 'saffron' },
  { id: 'ak47-obsidian', weapon: 'ak47', name: 'Obsidian Grain', rarity: 'Covert', color: '#323846', pattern: 'grain' },
  { id: 'm4a4-lantern', weapon: 'm4a4', name: 'Lantern Bloom', rarity: 'Mil-Spec', color: '#d37d54', pattern: 'lantern' },
  { id: 'm4a4-glacier', weapon: 'm4a4', name: 'Glacier Run', rarity: 'Restricted', color: '#84b9d6', pattern: 'glacier' },
  { id: 'awp-sunstone', weapon: 'awp', name: 'Sunstone', rarity: 'Classified', color: '#e8a65a', pattern: 'sunstone' },
  { id: 'awp-nightfall', weapon: 'awp', name: 'Nightfall Script', rarity: 'Covert', color: '#7260b8', pattern: 'nightfall' },
  { id: 'knife-jade', weapon: 'knife', name: 'Jade Oath', rarity: 'Legendary', color: '#51b99c', pattern: 'jade' },
  { id: 'knife-ivory', weapon: 'knife', name: 'Ivory Vow', rarity: 'Covert', color: '#e9ddbe', pattern: 'ivory' },
]

export type OperatorSkin = { id: string; name: string; level: number; cloth: string; trim: string; accent: string; model: number }

export const OPERATOR_SKINS: OperatorSkin[] = [
  { id: 'wayfinder', name: 'Wayfinder', level: 1, cloth: '#317b79', trim: '#d9c487', accent: '#d6a25c', model: 0 },
  { id: 'sun-riven', name: 'Sun-Riven', level: 2, cloth: '#b9783c', trim: '#ecd29a', accent: '#7b452f', model: 1 },
  { id: 'reed-walker', name: 'Reed Walker', level: 3, cloth: '#687b48', trim: '#c5b77e', accent: '#d3a75d', model: 2 },
  { id: 'fjord-warden', name: 'Fjord Warden', level: 4, cloth: '#526e83', trim: '#d8d4c1', accent: '#ad7155', model: 3 },
  { id: 'copper-guard', name: 'Copper Guard', level: 5, cloth: '#8a4d3e', trim: '#e0b05c', accent: '#3d5554', model: 4 },
  { id: 'moss-sentinel', name: 'Moss Sentinel', level: 6, cloth: '#45684c', trim: '#a4c37b', accent: '#c79556', model: 5 },
  { id: 'blue-ceramic', name: 'Blue Ceramic', level: 7, cloth: '#496aa0', trim: '#e6d6ab', accent: '#d47a55', model: 6 },
  { id: 'ash-scribe', name: 'Ash Scribe', level: 8, cloth: '#69666c', trim: '#d9c9a9', accent: '#b2874f', model: 7 },
  { id: 'dawn-pilgrim', name: 'Dawn Pilgrim', level: 9, cloth: '#bf7958', trim: '#efe0b8', accent: '#5b7d73', model: 0 },
  { id: 'jade-caravan', name: 'Jade Caravan', level: 10, cloth: '#327e6f', trim: '#c9ae6e', accent: '#ba604b', model: 1 },
  { id: 'storm-herald', name: 'Storm Herald', level: 11, cloth: '#425568', trim: '#c7d2d2', accent: '#9b6ab7', model: 2 },
  { id: 'ember-caller', name: 'Ember Caller', level: 12, cloth: '#a34d39', trim: '#eac071', accent: '#516841', model: 3 },
  { id: 'marble-fox', name: 'Marble Fox', level: 13, cloth: '#a9a18c', trim: '#e8d9b5', accent: '#6c608c', model: 4 },
  { id: 'night-archer', name: 'Night Archer', level: 14, cloth: '#3a465e', trim: '#b8c8d2', accent: '#8ab277', model: 5 },
  { id: 'golden-crest', name: 'Golden Crest', level: 15, cloth: '#977339', trim: '#f1d894', accent: '#4c7182', model: 6 },
  { id: 'tide-keeper', name: 'Tide Keeper', level: 16, cloth: '#357b91', trim: '#c8e0dc', accent: '#bd8155', model: 7 },
  { id: 'stone-oracle', name: 'Stone Oracle', level: 17, cloth: '#777268', trim: '#d8c9a1', accent: '#8f6a9c', model: 0 },
  { id: 'crimson-lark', name: 'Crimson Lark', level: 18, cloth: '#99485a', trim: '#e3c19a', accent: '#4a7b6c', model: 1 },
  { id: 'pine-rider', name: 'Pine Rider', level: 19, cloth: '#476748', trim: '#d8c17b', accent: '#93724b', model: 2 },
  { id: 'star-forged', name: 'Star-Forged', level: 20, cloth: '#4d4777', trim: '#e5d5a5', accent: '#54a5a6', model: 3 },
  { id: 'river-clay', name: 'River Clay', level: 21, cloth: '#89684f', trim: '#dfc99e', accent: '#547b82', model: 4 },
  { id: 'reed-captain', name: 'Reed Captain', level: 22, cloth: '#466e60', trim: '#d6bf83', accent: '#ae704a', model: 5 },
  { id: 'blue-hour', name: 'Blue Hour', level: 23, cloth: '#435b7d', trim: '#d7d7c5', accent: '#c87963', model: 6 },
  { id: 'kiln-keeper', name: 'Kiln Keeper', level: 24, cloth: '#a45d43', trim: '#edca86', accent: '#4d7771', model: 7 },
  { id: 'sun-archive', name: 'Archive Keeper', level: 25, cloth: '#ae7b43', trim: '#f1dfac', accent: '#508d83', model: 0 },
  { id: 'salt-mariner', name: 'Salt Mariner', level: 26, cloth: '#537685', trim: '#d7d1ad', accent: '#b57752', model: 1 },
  { id: 'basalt-runner', name: 'Basalt Runner', level: 27, cloth: '#54575c', trim: '#d2bc86', accent: '#6e9578', model: 2 },
  { id: 'ochre-vow', name: 'Ochre Vow', level: 28, cloth: '#a77b45', trim: '#ebd3a0', accent: '#665c81', model: 3 },
  { id: 'mist-watcher', name: 'Mist Watcher', level: 29, cloth: '#687b83', trim: '#ded6c0', accent: '#af785f', model: 4 },
  { id: 'long-winter', name: 'Long Winter', level: 30, cloth: '#536f88', trim: '#d9e3e4', accent: '#8c5f70', model: 5 },
  { id: 'first-chronicle', name: 'First Chronicle', level: 40, cloth: '#5b4a79', trim: '#efd48b', accent: '#6fae97', model: 6 },
  { id: 'world-keeper', name: 'World Keeper', level: 50, cloth: '#9b6b38', trim: '#f5e6b5', accent: '#64bcb1', model: 7 },
]

export function operatorSkinForLevel(level: number): OperatorSkin {
  return [...OPERATOR_SKINS].reverse().find(skin => level >= skin.level) ?? OPERATOR_SKINS[0]!
}

export const RARITY_COLORS: Record<Rarity, string> = {
  Consumer: '#9aa5ad',
  Industrial: '#67b7e8',
  'Mil-Spec': '#4e77d9',
  Restricted: '#9c59df',
  Classified: '#e772d0',
  Covert: '#ef566a',
  Legendary: '#f5c85a',
}

export function skinFor(id: string | undefined): SkinItem | undefined {
  return SKINS.find(skin => skin.id === id)
}

export function defaultInventory(): SkinItem[] {
  return SKINS.filter(skin => skin.rarity === 'Consumer' || skin.rarity === 'Industrial').slice(0, 2)
}
