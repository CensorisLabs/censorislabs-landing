import type { OperatorSkin, Rarity, SkinItem, WeaponId } from './fps'
import { KCH_TEXTURE_PACKS } from './kch-texture-packs'

/**
 * Every atlas in `assets/models/kch/textures/packs` is a Krunker-style skin
 * plate: a 256px sheet of dark, mostly black islands that the original models
 * sample through their own UVs. Recolouring the plate is what produced the
 * skinned guns in the reference screenshots, so each plate becomes one
 * selectable finish and the plate index travels with the skin as `kch#<n>`.
 */
const SKIN_NAMES = [
  'Iced Emerald', 'Static Bloom', 'Ashfall', 'Nightshade', 'Copper Rush', 'Vaporlock',
  'Deep Static', 'Harbor Graphene', 'Twilight Plate', 'Signal Bleed', 'Wraithline', 'Signal Frost',
  'Quarry Signal', 'Ember Grid', 'Sable Circuit', 'Dune Static', 'Halcyon Plate', 'Cobalt Burn',
  'Rust Choir', 'Pale Cipher', 'Void Lattice', 'Mint Static', 'Graphite Hymn', 'Pulse Grid',
  'Frostline', 'Solar Drift',
]

const SKIN_COLORS = [
  '#5ce1e6', '#f8f4e3', '#d95d39', '#6c4bd1', '#e8a33d', '#2fa8d6',
  '#8a63d2', '#93e06b', '#c94f7c', '#38b6a5', '#d7d7e8', '#3f6bd8',
  '#c46be0', '#ff9f45', '#4fd2c2', '#e2554f', '#7f96d8', '#b6e05c',
  '#e069a1', '#59c3f0', '#a2f0c4', '#8d8dd6', '#e8c15a', '#4bb3a0',
  '#f0f2ff', '#d6a06b',
]

const RARITY_LADDER: Rarity[] = ['Consumer', 'Industrial', 'Mil-Spec', 'Restricted', 'Classified', 'Covert', 'Legendary']
const WEAPON_LADDER: WeaponId[] = ['ak47', 'm4a4', 'awp', 'mp5', 'glock', 'deagle']

export const KCH_WEAPON_SKINS: SkinItem[] = KCH_TEXTURE_PACKS.map((_pack, index) => ({
  id: `kch-finish-${index + 1}`,
  weapon: WEAPON_LADDER[index % WEAPON_LADDER.length]!,
  name: SKIN_NAMES[index] ?? `KCH Plate ${index + 1}`,
  rarity: RARITY_LADDER[index % RARITY_LADDER.length]!,
  color: SKIN_COLORS[index]!,
  // The texture index is part of the pattern string so the renderer always
  // paints the plate the player selected, not the plate its seed lands on.
  pattern: `kch#${index}`,
}))

/** Two line-drawn plates ship in the folder; both are colour-only garments. */
export const KCH_OPERATOR_SKINS: OperatorSkin[] = [
  { id: 'kch-standard', name: 'KCH Vanguard', level: 1, cloth: '#4f7f8c', trim: '#e6dcc4', accent: '#cf6f4a', model: 2 },
  { id: 'kch-monochrome', name: 'KCH Monochrome', level: 1, cloth: '#5a6068', trim: '#e4e7ec', accent: '#2b3038', model: 6 },
]

export const KCH_SKIN_PACK_COUNT = KCH_TEXTURE_PACKS.length

/** Parses the `kch#<index>` marker back into a texture index, or null. */
export function kchSkinTextureIndex(pattern: string): number | null {
  const match = /^kch#(\d+)$/.exec(pattern)
  if (!match) return null
  const index = Number(match[1])
  return Number.isInteger(index) && index >= 0 && index < KCH_TEXTURE_PACKS.length ? index : null
}
