import * as THREE from 'three'
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import type { Renderer } from '../engine/renderer'
import { ACHIEVEMENTS, SaveStore, xpForLevel } from '../engine/save'
import { DAILY_CONTRACTS, GUN_GAME_ORDER, HISTORIC_MAPS, KNIFE_SKINS, OPERATOR_SKINS, SKINS, WEAPONS, armoryGun, operatorSkinForLevel, skinFor, type BotDifficulty, type MapId, type MatchSettings, type MatchType, type OperatorSkin, type WeaponId } from './fps'
import { validateCustomMap, type CustomMap } from './custom-map'
import { kchSkinTextureIndex } from './kch-skins'
import type { KchMapData, KchSpawn } from './kch-map'

export type Mode = 'attract' | 'playing' | 'paused' | 'ended'
export type GameSnapshot = { phase: 'playing' | 'won' | 'lost'; xpEarned: number; matchType: MatchType; crosshairBloom: number; grenades: number; spectating: boolean; mapId: MapId; mapName: string; objective: string; respawnIn: number; timeLeft: number; elapsed: number; score: number; kills: number; deaths: number; headshots: number; shots: number; hits: number; accuracy: number; health: number; armor: number; ammo: number; magazine: number; weapon: WeaponId; weaponName: string; aimed: boolean; reload: number; level: number; xp: number; nextXp: number; credits: number; blueScore: number; redScore: number; round: number; roundPhase: 'buy' | 'live' | 'planted' | 'post'; spawnProtection: number; aliveBots: number; stormRadius: number; playerX: number; playerZ: number; yaw: number; scoreboard: { name: string; kills: number; deaths: number; you?: boolean; team?: 'blue' | 'red' }[] }
export type GameHooks = { popup(text: string, screen: { x: number; y: number }, kind: 'score' | 'hurt'): void; hitmarker(headshot: boolean): void; hurt(): void; killfeed(text: string, headshot: boolean): void; banner(text: string): void; end(run: GameSnapshot): void }
/**
 * KCH block ids that are collision-only: the map author uses them to seal the
 * playable volume. Drawing them covers every arena in invisible walls.
 */
const KCH_INVISIBLE_BLOCKS = new Set<number>([27])

type BotAnimation = { mixer: THREE.AnimationMixer; idle: THREE.AnimationAction; move: THREE.AnimationAction; active: THREE.AnimationAction }
type Bot = { id: number; name: string; style: number; root: THREE.Group; hitMeshes: THREE.Object3D[]; teamMarker: THREE.Mesh; health: number; nextShot: number; respawnAt: number; spawn: THREE.Vector3; phase: number; visualPhase: number; walking: boolean; kills: number; deaths: number; alive: boolean; team: 'blue' | 'red'; stormTime: number; spawnProtectedUntil: number; animation?: BotAnimation; /** Materials tinted by the crosshair highlight, 0 = none. */ highlightMaterials: THREE.MeshStandardMaterial[]; highlight: number }
/**
 * The KCH operator is a single skinned mesh, so its "skin" is painted per bone
 * group instead of by UV island: torso and shoulders take the operator's cloth,
 * forearms and gloves the trim, legs the cloth darkened, boots a fixed leather.
 * Community texture packs are 64x64 skins authored for other rigs and scramble
 * on these UVs, which is why the operators looked mis-textured.
 */
function colorizeKchOperator(mesh: THREE.SkinnedMesh, skin: OperatorSkin, seed = 0): void {
  const joints = mesh.geometry.getAttribute('skinIndex')
  const weights = mesh.geometry.getAttribute('skinWeight')
  if (!joints || !weights) return
  const geometry = mesh.geometry.clone()
  const trousers = new THREE.Color(skin.trim).multiplyScalar(0.58).getStyle()
  const boots = '#1b222b'
  const tone = ['#c9a97f', '#a87c55', '#e0c39c', '#8d5f3f'][seed % 4]!
  const boneColors = new Map<string, THREE.Color>([
    ['head', new THREE.Color(tone)], ['body2', new THREE.Color(skin.cloth)],
    ['leftArm1', new THREE.Color(skin.cloth)], ['rightArm1', new THREE.Color(skin.cloth)],
    ['leftArm2', new THREE.Color(skin.trim)], ['rightArm2', new THREE.Color(skin.trim)],
    ['leftLeg1', new THREE.Color(trousers)], ['rightLeg1', new THREE.Color(trousers)],
    ['leftLeg2', new THREE.Color(boots)], ['rightLeg2', new THREE.Color(boots)],
  ])
  const colors = new Float32Array(joints.count * 3)
  for (let vertex = 0; vertex < joints.count; vertex += 1) {
    const influence = [weights.getX(vertex), weights.getY(vertex), weights.getZ(vertex), weights.getW(vertex)]
    const index = [joints.getX(vertex), joints.getY(vertex), joints.getZ(vertex), joints.getW(vertex)]
    const dominant = index[influence.indexOf(Math.max(...influence))] ?? 0
    const boneName = mesh.skeleton.bones[dominant]?.name ?? ''
    const color = boneColors.get(boneName) ?? new THREE.Color('#bfc6ca')
    color.toArray(colors, vertex * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  if (mesh.userData.kchColoredGeometry === true) mesh.geometry.dispose()
  mesh.geometry = geometry
  mesh.userData.kchColoredGeometry = true
}

const RESPAWN_SECONDS = 8
const PLAYER_MODEL_HEIGHT = 1.84
const BOT_EYE_HEIGHT = 1.48
const SEARCH_ROUND = { buySeconds: 15, liveSeconds: 115, fuseSeconds: 45, postSeconds: RESPAWN_SECONDS, spawnShieldSeconds: 3, halfRounds: 12, winsRequired: 13 } as const
export type GameModels = { player: GLTF | null; arms: GLTF | null; ar9: GLTF | null; scar: GLTF | null; lar: GLTF | null; m60: GLTF | null; mac10: GLTF | null; revolver: GLTF | null; shark: GLTF | null; vita: GLTF | null; weatie: GLTF | null; bayonet: GLTF | null; tomahawk: GLTF | null; modelTexture: THREE.Texture | null; kchMapTexture: THREE.Texture | null; kchTexturePacks: THREE.Texture[]; kchMaps: Partial<Record<MapId, KchMapData>>; kchSkybox?: THREE.CubeTexture | null }

type MutableRun = GameSnapshot & { phase: 'playing' | 'won' | 'lost' }

export class Game {
  mode: Mode = 'attract'
  run: MutableRun
  readonly scene = new THREE.Scene()
  readonly player = { root: new THREE.Group(), teleport: (position: THREE.Vector3) => this.teleport(position) }
  readonly cores = { remaining: () => [] as THREE.Vector3[] }
  private readonly arenaRoot = new THREE.Group()
  private readonly cameraInternal = new THREE.PerspectiveCamera(92, 1, 0.05, 180)
  private baseFov = 92
  private aimBlend = 0
  private readonly raycaster = new THREE.Raycaster()
  private readonly visionRaycaster = new THREE.Raycaster()
  private readonly bots: Bot[] = []
  private readonly previousPlayerPosition = new THREE.Vector3()
  private readonly interpolatedPlayerPosition = new THREE.Vector3()
  private readonly previousBotPositions = new Map<Bot, THREE.Vector3>()
  private readonly renderBotPositions = new Map<Bot, THREE.Vector3>()
  private readonly previousBotYaw = new Map<Bot, number>()
  private readonly renderBotYaw = new Map<Bot, number>()
  private previousCameraBobY = 0
  private previousCameraLanding = 0
  private readonly hitTargets: THREE.Object3D[] = []
  private readonly obstacles: THREE.Mesh[] = []
  private readonly relics: { mesh: THREE.Mesh; at: THREE.Vector3 }[] = []
  private readonly objectiveMarkers: THREE.Group[] = []
  private readonly objectivePoints = [new THREE.Vector3(-15, 0, -12), new THREE.Vector3(0, 0, 0), new THREE.Vector3(15, 0, 12)]
  private readonly zoneOwners: Array<'blue' | 'red' | null> = [null, null, null]
  private readonly zoneProgress = [0, 0, 0]
  private activeBotCount = 6
  private royalePlayers: 30 | 50 | 60 | 100 = 60
  private teamSize: 1 | 4 | 5 = 5
  private mapScale = 1
  /** Local half-size of the active arena, used to keep the player inside it. */
  private arenaHalfExtent = 27
  private kchCellScale = 1
  private kchCenterX = 0
  private kchCenterZ = 0
  private kchPlayerYaw = 0
  private kchColumns = new Map<string, Array<{ bottom: number; top: number }>>()
  private kchSpawnTeams: { first: THREE.Vector3[]; second: THREE.Vector3[] } = { first: [], second: [] }
  private activeKchMap: KchMapData | null = null
  private objectiveClock = 1
  private objectiveRotation = 0
  private objective = 'ELIMINATE RIVALS'
  private battleSimTimer = 1.3
  private flagCarried = false
  private flagScoreClock = 0
  private round = 1
  private roundClock = 0
  private roundBreak = 0
  private chargePlanted = false
  private chargeTimer = 0
  private plantProgress = 0
  private defuseProgress = 0
  private plantSite = 0
  private readonly weaponView = new THREE.Group()
  private readonly viewModelRig = new THREE.Group()
  private currentWeapon: WeaponId = 'glock'
  private activeSlot: 0 | 1 | 2 = 0
  private slideLeft = 0
  private slideDirection = new THREE.Vector3()
  private dashDirection = new THREE.Vector3()
  private dashLeft = 0
  private dashCooldownLeft = 0
  private bobPhase = 0
  private readonly horizontalVelocity = new THREE.Vector3()
  private cameraBobY = 0
  private cameraLanding = 0
  private weaponSwayX = 0
  private weaponSwayY = 0
  /** Where the imported gun's firing grip sits inside the weapon view rig. */
  private readonly viewGripAnchor = new THREE.Vector3(0.27, -0.37, -0.6)
  private readonly viewSpringPosition = new THREE.Vector3(0.08, -0.04, -0.65)
  private readonly viewSpringVelocity = new THREE.Vector3()
  private strideTimer = 0
  private sprintPose = 0
  private matchType: MatchType = 'ffa'
  private difficulty: BotDifficulty = 'regular'
  private mapId: MapId = 'pool'
  private activeCustomMap: CustomMap | null = null
  private blueScore = 0
  private redScore = 0
  private playerSpawnProtectedUntil = 0
  private pendingSearchResult: 'won' | 'lost' | null = null
  private botScoreTimer = 9
  private stormDamageTimer = 0
  private ammo = WEAPONS.glock.magazine
  private reloadLeft = 0
  private reloadDuration = 0
  private reloadMagazine: THREE.Mesh | null = null
  private reloadHand: THREE.Object3D | null = null
  private readonly muzzleFlashGroup = new THREE.Group()
  private yaw = 0
  private pitch = 0
  private verticalVelocity = 0
  private matchTime = 0
  private fireCooldown = 0
  private recoil = 0
  private flash = 0
  private footstepTimer = 0
  private inspectTime = 0
  private grenadeCount = 0
  private grenadeProjectile: { mesh: THREE.Mesh; velocity: THREE.Vector3; fuse: number } | null = null
  private spectatorIndex = 0
  private playerDeadUntil = 0
  private playerDownedAt = 0
  private lastFrame = 0
  private readonly save: SaveStore
  private readonly viewParts: THREE.Mesh[] = []
  private readonly weaponFinishTextures = new Map<string, THREE.CanvasTexture>()
  private readonly operatorTextures = new Map<string, THREE.CanvasTexture>()
  private importedViewModel: THREE.Group | null = null
  private importedArms: THREE.Group | null = null
  private lobbyPreview: THREE.Group | null = null
  private lobbyAnimation: THREE.AnimationMixer | null = null
  private readonly models: GameModels

  constructor(private readonly renderer: Renderer, private readonly input: Input, private readonly audio: Audio, save: SaveStore, private readonly hooks: GameHooks, models: GameModels = { player: null, arms: null, ar9: null, scar: null, lar: null, m60: null, mac10: null, revolver: null, shark: null, vita: null, weatie: null, bayonet: null, tomahawk: null, modelTexture: null, kchMapTexture: null, kchTexturePacks: [], kchMaps: {} }) {
    this.save = save
    this.models = models
    this.scene.background = this.models.kchSkybox ?? new THREE.Color('#31579f')
    this.scene.fog = null
    this.cameraInternal.rotation.order = 'YXZ'
    this.cameraInternal.add(this.weaponView)
    this.weaponView.add(this.viewModelRig)
    const flash = new THREE.Group()
    const flashMaterial = (color: string) => new THREE.MeshBasicMaterial({ color })
    flash.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.075, 0.06), flashMaterial('#ffeb3b')))
    const flashStem = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.42, 0.06), flashMaterial('#ff9800'))
    flashStem.rotation.z = 0.18; flash.add(flashStem)
    const flashRay = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.06), flashMaterial('#ffeb3b'))
    flashRay.rotation.z = -0.66; flash.add(flashRay)
    this.muzzleFlashGroup.add(flash); this.muzzleFlashGroup.visible = false; this.weaponView.add(this.muzzleFlashGroup)
    this.scene.add(this.cameraInternal)
    this.scene.add(this.player.root)
    this.scene.add(this.arenaRoot)
    this.buildLighting()
    this.buildArena()
    this.buildBots()
    this.resetInterpolation()
    this.buildLobbyPreview()
    this.arenaRoot.visible = false
    this.bots.forEach(bot => { bot.root.visible = false })
    this.run = this.newRun()
    this.updateViewModel()
  }
  get camera(): THREE.PerspectiveCamera { return this.cameraInternal }
  private newRun(): MutableRun { const w = WEAPONS[this.currentWeapon]; return { phase: 'playing', matchType: this.matchType, mapId: this.mapId, mapName: this.mapName(), objective: this.objective, respawnIn: 0, timeLeft: this.matchType === 'royale' ? 360 : this.matchType === 'training' ? 0 : 240, elapsed: 0, score: 0, kills: 0, deaths: 0, headshots: 0, shots: 0, hits: 0, accuracy: 0, xpEarned: 0, health: 100, armor: 50, ammo: w.magazine, magazine: w.magazine, weapon: this.currentWeapon, weaponName: w.name, aimed: false, reload: 0, level: this.save.data.level, xp: this.save.data.xp, nextXp: xpForLevel(this.save.data.level), credits: this.save.data.credits, blueScore: 0, redScore: 0, round: 1, roundPhase: 'live', spawnProtection: 0, aliveBots: 0, stormRadius: 30, playerX: 0, playerZ: 0, yaw: 0, scoreboard: [], crosshairBloom: 3, grenades: 0, spectating: false } }
  private buildLighting(): void { this.scene.add(new THREE.HemisphereLight('#f1f8ff', '#8198b1', 1.2)); const sun = new THREE.DirectionalLight('#fff9f0', 1.4); sun.position.set(-20, 34, 12); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); this.scene.add(sun) }
  private mat(color: string, emissive = false): THREE.MeshLambertMaterial { return new THREE.MeshLambertMaterial({ color, emissive: emissive ? color : '#000000', emissiveIntensity: emissive ? 0.8 : 0 }) }
  private block(size: THREE.Vector3, position: THREE.Vector3, color: string, emissive = false, rotation = 0): THREE.Mesh { const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), this.mat(color, emissive)); mesh.position.copy(position); mesh.rotation.y = rotation; mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.colliderSize = size.clone(); mesh.userData.surfaceType = 'concrete'; this.arenaRoot.add(mesh); this.obstacles.push(mesh); return mesh }
  addVoxelBackdrop(palette: { ground: string; stone: string; trim: string }): void {
    const deco = (size: [number, number, number], position: [number, number, number], color: string) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color))
      mesh.position.set(...position); mesh.receiveShadow = false; mesh.castShadow = false
      this.arenaRoot.add(mesh)
    }
    // Low, non-colliding color decks extend the ground into a clean horizon behind the play lanes.
    deco([64, 0.36, 20], [0, -0.27, -41], palette.ground)
    deco([64, 0.36, 20], [0, -0.27, 41], palette.ground)
    deco([20, 0.36, 64], [-41, -0.18, 0], palette.ground)
    deco([20, 0.36, 64], [41, -0.18, 0], palette.ground)
    // Original voxel skyline blocks frame the arena from every side without changing collision or sightline rules.
    const towers: Array<{ x: number; z: number; h: number; side: 'front' | 'side' }> = [
      { x: -18, z: -39, h: 7, side: 'front' }, { x: 18, z: -39, h: 5, side: 'front' },
      { x: -18, z: 39, h: 5, side: 'front' }, { x: 18, z: 39, h: 8, side: 'front' },
      { x: -39, z: -16, h: 6, side: 'side' }, { x: -39, z: 16, h: 8, side: 'side' },
      { x: 39, z: -16, h: 8, side: 'side' }, { x: 39, z: 16, h: 6, side: 'side' },
    ]
    const windowColor = '#8ed8df'
    for (let i = 0; i < towers.length; i += 1) {
      const tower = towers[i]!
      const width = i % 2 ? 5 : 6
      const depth = tower.side === 'side' ? 5 : 4
      const w = tower.side === 'side' ? depth : width
      const d = tower.side === 'side' ? width : depth
      deco([w, tower.h, d], [tower.x, tower.h / 2, tower.z], palette.stone)
      deco([w + 0.5, 0.42, d + 0.5], [tower.x, 0.21, tower.z], palette.trim)
      deco([w + 0.7, 0.52, d + 0.7], [tower.x, tower.h + 0.26, tower.z], i % 2 ? palette.trim : '#f0d06e')
      for (const offset of [-1, 1]) {
        const window = tower.side === 'side' ? [0.12, 1.05, 0.82] as [number, number, number] : [0.82, 1.05, 0.12] as [number, number, number]
        const face = tower.side === 'side' ? tower.x + Math.sign(tower.x) * (d / 2 + 0.08) : tower.z + Math.sign(tower.z) * (depth / 2 + 0.08)
        const pos: [number, number, number] = tower.side === 'side' ? [face, tower.h * 0.55, tower.z + offset * 1.25] : [tower.x + offset * 1.35, tower.h * 0.55, face]
        deco(window, pos, windowColor)
      }
    }
  }
  addImportedArenaModel(source: GLTF | null, at: THREE.Vector3, targetWidth: number, yaw = 0): void {
    if (!source) return
    const model = source.scene.clone(true)
    model.rotation.y = yaw
    model.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(model)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const scale = targetWidth / Math.max(0.001, size.x, size.z)
    model.scale.setScalar(scale)
    model.position.set(at.x - center.x * scale, at.y - bounds.min.y * scale, at.z - center.z * scale)
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry = object.geometry.clone()
      object.castShadow = true; object.receiveShadow = true
      const cloneMaterial = (material: THREE.Material) => {
        const copy = material.clone()
        if ('map' in copy && copy.map instanceof THREE.Texture) copy.map = copy.map.clone()
        return copy
      }
      object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material)
    })
    this.arenaRoot.add(model)
  }
  private buildKchMap(data: KchMapData, terrain: string): void {
    const rawBlocks: Array<{ x: number; y: number; z: number; texture: number }> = []
    for (const [chunkKey, cells] of Object.entries(data.chunks ?? {})) {
      const [cx, cy, cz] = chunkKey.split(',').map(Number)
      if (![cx, cy, cz].every(Number.isFinite) || !Array.isArray(cells)) continue
      for (const entry of cells) {
        if (rawBlocks.length >= 30000) break
        if (!Array.isArray(entry) || entry.length < 2 || !entry.every(Number.isFinite)) continue
        const [start, texture, runLength = 1] = entry
        if (!Number.isInteger(start) || !Number.isInteger(texture) || !Number.isInteger(runLength) || start < 0 || start >= 4096 || runLength < 1) continue
        const end = Math.min(start + runLength, 4096)
        for (let index = start; index < end && rawBlocks.length < 30000; index += 1) {
          rawBlocks.push({ x: cx! * 16 + index % 16, y: cy! * 16 + Math.floor(index / 256), z: cz! * 16 + Math.floor(index / 16) % 16, texture: texture! })
        }
      }
    }
    if (!rawBlocks.length) { this.buildFallbackArena(terrain); return }
    const minX = Math.min(...rawBlocks.map(block => block.x)), maxX = Math.max(...rawBlocks.map(block => block.x))
    const minZ = Math.min(...rawBlocks.map(block => block.z)), maxZ = Math.max(...rawBlocks.map(block => block.z))
    const xCenter = (minX + maxX) / 2, zCenter = (minZ + maxZ) / 2
    const spawnEntries = [...(data.spawnPlaces?.firstTeam ?? []), ...(data.spawnPlaces?.secondTeam ?? [])].filter(spawn => spawn?.pos?.length === 3 && spawn.pos.every(Number.isFinite))
    const yOrigin = spawnEntries.length ? spawnEntries.reduce((sum, spawn) => sum + spawn.pos[1], 0) / spawnEntries.length : Math.min(...rawBlocks.map(block => block.y))
    const width = maxX - minX + 1, depth = maxZ - minZ + 1
    // Target a much larger footprint than the original 52-unit box while keeping
    // single voxels below the jump-and-mantle height (2.25 * mapScale) so every
    // step stays climbable.
    this.kchCellScale = Math.min(1.45, 96 / Math.max(width, depth))
    this.arenaHalfExtent = Math.max(width, depth) * this.kchCellScale * 0.5 + 6
    this.kchCenterX = xCenter; this.kchCenterZ = zCenter
    const palettes: Partial<Record<MapId, string[]>> = {
      antfarm: ['#c79a4b', '#e4c777', '#82785d', '#6f9271', '#dbb970', '#566e72', '#f0dc9b', '#a87a50'],
      schism: ['#73838e', '#b98658', '#c3b27f', '#4f6974', '#d6c6a5', '#9b654c', '#647d62', '#b7a078'],
      labs: ['#4b9697', '#b9b7aa', '#4b6575', '#d3b764', '#83939a', '#476d5a', '#e4d6b2', '#a46a54'],
      collision: ['#8a6a88', '#b48a5f', '#758c91', '#d2b76b', '#5b7184', '#c1b497', '#8a7258', '#789468'],
      dunes: ['#c6a15f', '#e3c982', '#9b7955', '#667d81', '#d2b270', '#8b9360', '#a85e48', '#e8d8af'],
      // Pool's export references atlas tiles in an empty part of the shipped atlas.
      // Keep the original block layout but restore the bright stone, pink, blue,
      // and timber palette from the Kirka reference.
      pool: ['#f3e7dc', '#b93d5b', '#df637c', '#1488bd', '#f5e9df', '#993d56', '#d7c8bc', '#14a0d8'],
      skyfel: ['#5d91b5', '#d1b777', '#6c798a', '#e1d5bf', '#508c8b', '#a86852', '#879c72', '#c5a46e'],
      dethroned: ['#70815f', '#c7a260', '#837b70', '#a95e4d', '#526f70', '#d6c9a3', '#8f9d78', '#b17d4f'],
    }
    const palette = palettes[this.mapId] ?? palettes.dunes!
    const mapBrightness = Math.max(1, Math.min(1.8, Math.sqrt(Math.max(1, data.brightness ?? 1))))
    const poolColors: Record<number, string> = { 148: '#b77a49', 149: '#a43d57', 150: '#eadbd1', 151: '#138cc7', 152: '#eee2d8', 153: '#bd8050', 154: '#d34364', 156: '#f4e7dc' }
    const grouped = new Map<string, { blocks: Array<{ x: number; y: number; z: number }>; texture?: number; poolTile?: number; color?: string }>()
    // Only the team floor blocks keep a flat tint; everything else uses the map
    // atlas so large surfaces read as material instead of bare grey polygons.
    const blockColors: Record<number, string> = { 200: '#2676d4', 201: '#cb4b50' }
    this.kchColumns.clear()
    for (const block of rawBlocks) {
      const x = (block.x - xCenter) * this.kchCellScale
      const y = (block.y - yOrigin) * this.kchCellScale
      const z = (block.z - zCenter) * this.kchCellScale
      if (KCH_INVISIBLE_BLOCKS.has(block.texture)) {
        // KCH authors seal a map's playable volume with invisible barrier
        // blocks. They carry collision through kchColumns below, but drawing
        // them turned every arena into a visible cage of thin bars.
      } else {
        const color = blockColors[block.texture]
        const hasAtlasTile = this.mapId !== 'pool' && !!this.models.kchMapTexture && block.texture >= 0 && block.texture < 128
        const poolColor = this.mapId === 'pool' ? poolColors[block.texture] ?? palette[Math.abs(block.texture) % palette.length]! : undefined
        const resolvedColor = color ?? poolColor ?? (!hasAtlasTile ? palette[Math.abs(block.texture) % palette.length]! : undefined)
        const key = this.mapId === 'pool' ? `pool:${block.texture}` : hasAtlasTile && !color ? `texture:${block.texture}` : `color:${resolvedColor}`
        const group = grouped.get(key) ?? (this.mapId === 'pool'
          ? { blocks: [], color: resolvedColor ?? '#f3e7dc', poolTile: block.texture }
          : color || !hasAtlasTile
            ? { blocks: [], color: resolvedColor ?? palette[Math.abs(block.texture) % palette.length]! }
            : { blocks: [], texture: block.texture })
        group.blocks.push({ x, y, z })
        grouped.set(key, group)
      }
      const key = `${block.x},${block.z}`
      const column = this.kchColumns.get(key) ?? []
      column.push({ bottom: (block.y - 0.5 - yOrigin) * this.kchCellScale, top: (block.y + 0.5 - yOrigin) * this.kchCellScale })
      this.kchColumns.set(key, column)
    }
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const dummy = new THREE.Object3D()
    const atlasGeometry = (texture: number): THREE.BufferGeometry => {
      const tile = geometry.clone()
      const uv = tile.getAttribute('uv')
      const column = texture % 16
      const row = Math.floor(texture / 16) % 16
      const inset = 0.5 / 256
      const u0 = column / 16 + inset, u1 = (column + 1) / 16 - inset
      const v0 = row / 16 + inset, v1 = (row + 1) / 16 - inset
      for (let index = 0; index < uv.count; index += 1) {
        const u = uv.getX(index), v = uv.getY(index)
        uv.setXY(index, u0 + u * (u1 - u0), v0 + v * (v1 - v0))
      }
      uv.needsUpdate = true
      return tile
    }
    let usesBaseGeometry = false
    for (const [key, group] of grouped) {
      if (!group.blocks.length) continue
      const color = group.color
      const meshGeometry = group.texture === undefined ? geometry : atlasGeometry(group.texture)
      if (meshGeometry === geometry) usesBaseGeometry = true
      const material = group.poolTile !== undefined
        ? (() => { const map = this.poolBlockTexture(group.poolTile!, color ?? '#f3e7dc'); return new THREE.MeshLambertMaterial({ map, emissiveMap: map, emissive: '#dcecff', emissiveIntensity: 0.28 }) })()
        : group.texture !== undefined && this.models.kchMapTexture
        ? new THREE.MeshLambertMaterial({ map: this.models.kchMapTexture, emissiveMap: this.models.kchMapTexture, emissive: '#dcecff', emissiveIntensity: 0.05 * mapBrightness, color: '#ffffff' })
        : this.mapId === 'pool'
          ? new THREE.MeshLambertMaterial({ color: color ?? '#f3e7dc', emissive: color ?? '#f3e7dc', emissiveIntensity: 0.22 })
          : this.mat(color ?? '#c8c7c2')
      const mesh = new THREE.InstancedMesh(meshGeometry, material, group.blocks.length)
      mesh.name = `KCH ${data.mapName} voxel ${key}`
      mesh.userData.surfaceType = /dune|sand|antfarm/i.test(data.mapName) ? 'gravel' : /lab|collision/i.test(data.mapName) ? 'metal' : 'concrete'
      mesh.castShadow = false; mesh.receiveShadow = true
      group.blocks.forEach((block, index) => { dummy.position.set(block.x, block.y, block.z); dummy.scale.setScalar(this.kchCellScale); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix) })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      this.arenaRoot.add(mesh)
    }
    if (!usesBaseGeometry) geometry.dispose()
    const sourceSpawnRecords = (list: KchSpawn[]) => list.filter(spawn => spawn?.pos?.length === 3 && spawn.pos.every(Number.isFinite)).map(spawn => ({
      point: new THREE.Vector3((spawn.pos[0] - xCenter) * this.kchCellScale, (spawn.pos[1] - yOrigin) * this.kchCellScale, (spawn.pos[2] - zCenter) * this.kchCellScale),
      yaw: Number.isFinite(spawn.rotation?.[1]) ? spawn.rotation[1] : 0,
    }))
    let firstRecords = sourceSpawnRecords(data.spawnPlaces?.firstTeam ?? [])
    let secondRecords = sourceSpawnRecords(data.spawnPlaces?.secondTeam ?? [])
    if (!firstRecords.length && secondRecords.length > 1) { firstRecords = secondRecords.filter((_, index) => index % 2 === 0); secondRecords = secondRecords.filter((_, index) => index % 2 === 1) }
    if (!firstRecords.length && secondRecords.length) firstRecords = secondRecords.map(record => ({ point: record.point.clone(), yaw: record.yaw }))
    if (!secondRecords.length && firstRecords.length > 1) { secondRecords = firstRecords.filter((_, index) => index % 2 === 1); firstRecords = firstRecords.filter((_, index) => index % 2 === 0) }
    if (!secondRecords.length && firstRecords.length) secondRecords = firstRecords.map(record => ({ point: record.point.clone(), yaw: record.yaw }))
    const firstSpawns = firstRecords.map(record => record.point)
    const secondSpawns = secondRecords.map(record => record.point)
    this.activeKchMap = data
    this.kchSpawnTeams = { first: firstSpawns, second: secondSpawns }
    this.kchPlayerYaw = firstRecords[this.centralSpawnIndex(firstSpawns)]?.yaw ?? 0
    const mean = (points: THREE.Vector3[], fallback: THREE.Vector3) => points.length ? points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length) : fallback
    const first = mean(this.kchSpawnTeams.first, new THREE.Vector3(-width * this.kchCellScale * 0.35, 0, 0))
    const second = mean(this.kchSpawnTeams.second, new THREE.Vector3(width * this.kchCellScale * 0.35, 0, 0))
    const center = first.clone().add(second).multiplyScalar(0.5)
    const axis = second.clone().sub(first)
    this.objectivePoints[0]!.copy(center.clone().addScaledVector(axis, -0.2))
    this.objectivePoints[1]!.copy(center)
    this.objectivePoints[2]!.copy(center.clone().addScaledVector(axis, 0.2))
    const mapSky = this.mapId === 'pool' ? '#62b7ee' : data.skyboxColor
    this.scene.background = this.models.kchSkybox ?? new THREE.Color(mapSky && /^#[0-9a-f]{6}$/i.test(mapSky) ? mapSky : this.mapId === 'labs' ? '#87c9d8' : this.mapId === 'dunes' || this.mapId === 'antfarm' ? '#83c3ec' : '#73bce9')
    this.applyDistanceFog(Math.max(width, depth) * this.kchCellScale * this.mapScale)
  }
  /**
   * Distance haze tinted to the sky. Without it, a 50 m voxel arena renders as
   * one flat wall of colour; with it, corridors and pillars gain depth.
   */
  private applyDistanceFog(span: number): void {
    const sky = this.scene.background instanceof THREE.CubeTexture ? '#8fc3e8' : (this.scene.background as THREE.Color | null)?.getStyle() ?? '#8fc3e8'
    const radius = Math.max(28, Math.min(220, span))
    this.scene.fog = new THREE.Fog(sky, radius * 0.42, radius * 1.35)
  }
  private poolBlockTexture(textureId: number, base: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 32; canvas.height = 32
    const context = canvas.getContext('2d')!
    const color = new THREE.Color(base)
    const mortar = color.clone().multiplyScalar(0.62)
    context.fillStyle = mortar.getStyle(THREE.SRGBColorSpace)
    context.fillRect(0, 0, 32, 32)
    if (textureId === 148 || textureId === 153) {
      for (let y = 2; y < 32; y += 6) {
        const shade = color.clone().multiplyScalar(0.84 + ((y + textureId) % 5) * 0.025)
        context.fillStyle = shade.getStyle(THREE.SRGBColorSpace)
        context.fillRect(1, y, 30, 4)
        context.fillStyle = mortar.getStyle(THREE.SRGBColorSpace)
        context.fillRect(1 + ((y * 3) % 14), y, 1, 4)
      }
    } else {
      for (let row = 0; row < 4; row += 1) {
        const y = row * 8 + 1
        const offset = row % 2 ? 8 : 0
        for (let x = -8 + offset; x < 32; x += 16) {
          const shade = color.clone().multiplyScalar(0.88 + ((x + row * 9 + textureId) % 7) * 0.025)
          context.fillStyle = shade.getStyle(THREE.SRGBColorSpace)
          context.fillRect(x + 1, y, 14, 6)
          context.fillStyle = color.clone().multiplyScalar(1.06).getStyle(THREE.SRGBColorSpace)
          context.fillRect(x + 2, y + 1, 12, 1)
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    return texture
  }
  private buildFallbackArena(terrain: string): void {
    this.activeKchMap = null; this.kchColumns.clear(); this.kchSpawnTeams = { first: [], second: [] }
    this.arenaHalfExtent = 34
    this.scene.background = this.models.kchSkybox ?? new THREE.Color('#77bde9')
    this.applyDistanceFog(64)
    const floor = this.block(new THREE.Vector3(64, 0.4, 64), new THREE.Vector3(0, -0.2, 0), terrain)
    floor.userData.surfaceType = 'concrete'
    for (const [x, z, sx, sz, sy] of [[-12, -12, 4, 3, 2], [-7, -12, 3, 3, 2], [10, -8, 4, 3, 3], [15, -8, 3, 3, 2], [-15, 8, 3, 4, 2], [-9, 12, 5, 3, 2], [11, 12, 3, 5, 2], [3, 19, 4, 3, 2], [-20, -1, 3, 3, 3], [20, 0, 3, 3, 3], [0, 4, 3, 6, 2], [0, -4, 3, 6, 2]] as const) this.block(new THREE.Vector3(sx, sy, sz), new THREE.Vector3(x, sy / 2, z), '#c4b384')
    this.objectivePoints[0]!.set(-15, 0, -12); this.objectivePoints[1]!.set(0, 0, 0); this.objectivePoints[2]!.set(15, 0, 12)
  }
  private buildArena(): void {
    this.relics.length = 0
    this.arenaRoot.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => { if ('map' in material && material.map && material.map !== this.models.kchMapTexture) material.map.dispose(); material.dispose() }) } })
    this.arenaRoot.clear(); this.obstacles.length = 0; this.kchColumns.clear(); this.activeKchMap = null
    const mapInfo = HISTORIC_MAPS.find(map => map.id === this.mapId)
    const terrain = mapInfo?.terrain ?? '#b7aa88'
    if (this.activeCustomMap) {
      this.buildFallbackArena(terrain)
      for (const item of this.activeCustomMap.blocks) {
        const mesh = this.block(new THREE.Vector3(item.width, item.height, item.depth), new THREE.Vector3(item.x, item.height / 2, item.z), item.color)
        const material = mesh.material as THREE.MeshLambertMaterial
        material.map = this.customSurfaceTexture(item.color, item.surface); material.color.set('#ffffff'); material.needsUpdate = true; mesh.userData.surfaceType = item.surface
      }
      const siteA = this.activeCustomMap.markers.find(marker => marker.kind === 'site' && marker.label === 'A')
      const siteB = this.activeCustomMap.markers.find(marker => marker.kind === 'site' && marker.label === 'B')
      if (siteA) this.objectivePoints[0]!.set(siteA.x, 0, siteA.z)
      if (siteB) this.objectivePoints[2]!.set(siteB.x, 0, siteB.z)
      for (const marker of this.activeCustomMap.markers) {
        if (marker.kind === 'site') continue
        const pad = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.7), new THREE.MeshBasicMaterial({ color: marker.kind === 'player-spawn' ? '#4e9ce0' : '#cb6657', transparent: true, opacity: 0.7 }))
        pad.position.set(marker.x, 0.05, marker.z); this.arenaRoot.add(pad)
      }
    } else {
      const data = this.models.kchMaps[this.mapId]
      if (data) this.buildKchMap(data, terrain)
      else this.buildFallbackArena(terrain)
    }
    this.relics.length = 0
    const relicPoints = this.activeKchMap ? [this.objectivePoints[0]!, this.objectivePoints[2]!, this.objectivePoints[1]!] : [new THREE.Vector3(-8, 0, -20), new THREE.Vector3(9, 0, 19), new THREE.Vector3(0, 0, 0)]
    for (const point of relicPoints) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), this.mat('#f0ca5f', true))
      const floor = this.activeKchMap ? this.supportHeight(point) : 0
      mesh.position.set(point.x, floor + 0.85, point.z); mesh.userData.baseY = mesh.position.y; this.arenaRoot.add(mesh); this.relics.push({ mesh, at: point.clone() })
    }
    this.objectiveMarkers.length = 0
    const points = [...this.objectivePoints, this.kchSpawnTeams.first[0]?.clone() ?? new THREE.Vector3(-24, 0, 0), this.kchSpawnTeams.second[0]?.clone() ?? new THREE.Vector3(24, 0, 0)]
    points.forEach((point, index) => {
      const marker = new THREE.Group()
      const color = index >= 3 ? (index === 3 ? '#56b9ef' : '#e56e61') : '#e9c45b'
      const radius = index >= 3 ? 2.6 : 3.8
      const ring = new THREE.Group()
      for (const [width, depth, x, z] of [[radius * 2 + 0.22, 0.22, 0, -radius], [radius * 2 + 0.22, 0.22, 0, radius], [0.22, radius * 2, -radius, 0], [0.22, radius * 2, radius, 0]] as const) {
        const segment = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, depth), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.28, transparent: true, opacity: 0.76 }))
        segment.position.set(x, 0.08, z); ring.add(segment)
      }
      marker.add(ring)
      if (index >= 3) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), this.mat('#d2cbb5')); pole.position.y = 1.65; marker.add(pole)
        const pennant = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.58, 0.08), this.mat(color, true)); pennant.position.set(index === 3 ? 0.56 : -0.56, 2.85, 0); marker.add(pennant)
      }
      const markerY = this.activeKchMap ? this.supportHeight(point) : 0
      marker.visible = false; marker.position.set(point.x, markerY, point.z); this.arenaRoot.add(marker); this.objectiveMarkers.push(marker)
    })
  }
  voxelTexture(base: string, stone: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 16; canvas.height = 16
    const context = canvas.getContext('2d')!
    const baseColor = new THREE.Color(base)
    const stoneColor = new THREE.Color(stone)
    for (let by = 0; by < 4; by += 1) for (let bx = 0; bx < 4; bx += 1) {
      const seed = (bx * 37 + by * 19 + bx * by * 7) % 11
      const color = seed === 0 ? stoneColor : baseColor.clone().multiplyScalar(seed > 7 ? 0.84 : 0.96 + seed * 0.006)
      context.fillStyle = `#${color.getHexString()}`
      context.fillRect(bx * 4, by * 4, 4, 4)
      context.fillStyle = 'rgba(12,10,14,.12)'
      context.fillRect(bx * 4, by * 4, 4, 1)
      context.fillRect(bx * 4, by * 4, 1, 4)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestMipmapNearestFilter
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.generateMipmaps = true
    return texture
  }
  private customSurfaceTexture(baseHex: string, surface: 'concrete' | 'metal' | 'wood' | 'gravel'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16
    const context = canvas.getContext('2d')!
    const base = new THREE.Color(baseHex)
    context.fillStyle = `#${base.getHexString()}`; context.fillRect(0, 0, 16, 16)
    if (surface === 'metal') {
      context.fillStyle = `#${base.clone().multiplyScalar(0.68).getHexString()}`
      for (let y = 2; y < 16; y += 5) context.fillRect(0, y, 16, 1)
      context.fillStyle = `#${base.clone().lerp(new THREE.Color('#ffffff'), 0.38).getHexString()}`
      context.fillRect(2, 1, 12, 1); context.fillRect(2, 7, 12, 1)
    } else if (surface === 'wood') {
      for (let y = 3; y < 16; y += 5) {
        context.fillStyle = `#${base.clone().multiplyScalar(0.76).getHexString()}`; context.fillRect(0, y, 16, 1)
        context.fillStyle = `#${base.clone().lerp(new THREE.Color('#d4b078'), 0.22).getHexString()}`; context.fillRect(2, y + 1, 9, 1)
      }
    } else {
      const detail = surface === 'gravel' ? base.clone().lerp(new THREE.Color('#d6c8a2'), 0.32) : base.clone().lerp(new THREE.Color('#ffffff'), 0.14)
      const shadow = base.clone().multiplyScalar(0.72)
      for (let y = 1; y < 16; y += 4) for (let x = (y % 3) + 1; x < 16; x += 5) {
        context.fillStyle = `#${((x * 7 + y * 3) % 4 === 0 ? shadow : detail).getHexString()}`
        context.fillRect(x, y, surface === 'gravel' ? 2 : 1, 1)
      }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestMipmapNearestFilter
    return texture
  }
  private voxelPart(parent: THREE.Group, size: [number, number, number], pos: [number, number, number], color: string, zone: 'head' | 'body' | 'limb'): THREE.Mesh { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color)); m.position.set(...pos); m.userData = { zone, botId: parent.userData.botId }; m.castShadow = false; parent.add(m); return m }
  /**
   * Fits an imported KCH weapon into a character's hand.
   *
   * The source weapons are authored several metres long and every one carries
   * `Lever` (grip) and `Muzzle` helpers. Scaling by the bounding box alone
   * produced seven-metre rifles, so this measures the authored muzzle axis,
   * scales the model to a human length, aims the muzzle down the holder's
   * forward (-Z) axis with the weapon upright, and then slides it so the
   * authored grip lands exactly on the hand joint.
   */
  private fitHeldWeapon(weapon: THREE.Object3D, hand: THREE.Object3D, targetLength: number): void {
    weapon.position.set(0, 0, 0); weapon.rotation.set(0, 0, 0); weapon.scale.setScalar(1)
    weapon.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(weapon)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const muzzlePoint = weapon.getObjectByName('Muzzle')?.getWorldPosition(new THREE.Vector3())
    const gripPoint = weapon.getObjectByName('Lever')?.getWorldPosition(new THREE.Vector3())
    const muzzleAxis = (muzzlePoint ?? center.clone().add(new THREE.Vector3(1, 0, 0))).sub(center)
    const grip = (gripPoint ?? center.clone().add(new THREE.Vector3(0.1, -0.045, 0))).sub(center)
    if (muzzleAxis.lengthSq() < 1e-8) muzzleAxis.set(1, 0, 0)
    muzzleAxis.normalize()
    let length = Math.max(size.x, size.y, size.z)
    let minAlong = Number.POSITIVE_INFINITY
    let maxAlong = Number.NEGATIVE_INFINITY
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const projection = new THREE.Vector3(x, y, z).sub(center).dot(muzzleAxis)
      minAlong = Math.min(minAlong, projection); maxAlong = Math.max(maxAlong, projection)
    }
    if (maxAlong - minAlong > 1e-4) length = maxAlong - minAlong
    // The hand joint inherits the operator rig's scale (about 6.9x on this GLB),
    // so divide it out or a hand-local 1 m rifle measures seven metres in world
    // space and dwarfs the bot holding it.
    const handScale = hand.getWorldScale(new THREE.Vector3())
    const inherited = (Math.abs(handScale.x) + Math.abs(handScale.y) + Math.abs(handScale.z)) / 3
    const scale = targetLength / Math.max(0.001, length) / Math.max(0.001, inherited)
    // Aim the muzzle along -Z, then roll about that axis until the weapon's own
    // up direction is vertical. Without the roll pass the guns hang sideways.
    const up = Math.abs(muzzleAxis.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
    const orientation = new THREE.Quaternion().setFromUnitVectors(muzzleAxis, new THREE.Vector3(0, 0, -1))
    const rolledUp = up.applyQuaternion(orientation)
    orientation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.atan2(rolledUp.x, rolledUp.y)))
    // Match the holder's world rotation, then undo it so the weapon keeps the
    // world-aligned orientation captured at rig build time.
    const local = hand.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation)
    weapon.quaternion.copy(local)
    weapon.scale.setScalar(scale)
    weapon.position.copy(center.clone().multiplyScalar(-scale).applyQuaternion(local))
    weapon.position.sub(grip.clone().multiplyScalar(scale).applyQuaternion(local))
    weapon.userData.heldWeapon = true
    hand.add(weapon)
  }
  private kchTexturePack(seed: number): THREE.Texture | null {
    const packs = this.models.kchTexturePacks
    if (!packs.length) return null
    return packs[Math.abs(Math.trunc(seed)) % packs.length] ?? null
  }
  /**
   * Measures a skinned operator by sampling its real skinned vertices.
   *
   * The KCH rigs author their bind geometry at a much smaller scale than the
   * skeleton, so `Box3.setFromObject` reported roughly 0.27 m for a 1.8 m
   * operator. That made the bots scale up 6.9x and stand seven metres tall.
   */
  private skinnedExtent(root: THREE.Object3D): { height: number; minY: number; centerX: number; centerZ: number } {
    root.updateMatrixWorld(true)
    const point = new THREE.Vector3()
    const vertex = new THREE.Vector3()
    let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY
    let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY, maxZ = Number.NEGATIVE_INFINITY
    root.traverse(object => {
      if (!(object instanceof THREE.SkinnedMesh)) return
      const position = object.geometry.getAttribute('position')
      if (!position) return
      const step = Math.max(1, Math.floor(position.count / 320))
      for (let index = 0; index < position.count; index += step) {
        vertex.fromBufferAttribute(position, index)
        object.applyBoneTransform(index, vertex).applyMatrix4(object.matrixWorld)
        point.copy(vertex)
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y)
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x)
        minZ = Math.min(minZ, point.z); maxZ = Math.max(maxZ, point.z)
      }
    })
    if (!Number.isFinite(minY)) return { height: 0, minY: 0, centerX: 0, centerZ: 0 }
    return { height: maxY - minY, minY, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2 }
  }
  /** Scales an operator to an exact height, then centres it with its feet on the floor. */
  private fitSkinnedModel(model: THREE.Object3D, targetHeight: number): void {
    model.scale.setScalar(1)
    model.position.set(0, 0, 0)
    const raw = this.skinnedExtent(model)
    if (raw.height <= 0.0001) return
    model.scale.setScalar(targetHeight / raw.height)
    const fitted = this.skinnedExtent(model)
    model.position.set(-fitted.centerX, -fitted.minY, -fitted.centerZ)
  }
  private buildBots(): void {
    const starts = Array.from({ length: 99 }, (_, id) => { const angle = id / 99 * Math.PI * 2; const radius = 18 + (id % 5) * 1.2; return [Math.sin(angle) * radius, Math.cos(angle) * radius] as const })
    starts.forEach(([x, z], id) => {
      const group = new THREE.Group(); group.userData.botId = id
      const proxyRoot = new THREE.Group(); proxyRoot.userData.botId = id; group.add(proxyRoot)
      // Spread the roster so neighbouring bots never share an outfit.
      const skin = OPERATOR_SKINS[(id * 11 + 5) % OPERATOR_SKINS.length]!
      const head = this.voxelPart(proxyRoot, [0.9, 0.9, 0.9], [0, 2.55, 0], skin.trim, 'head')
      const body = this.voxelPart(proxyRoot, [1.2, 1.2, 0.8], [0, 1.45, 0], skin.cloth, 'body')
      const leftArm = new THREE.Group(); leftArm.userData.botId = id; leftArm.position.set(-0.78, 2.02, 0); proxyRoot.add(leftArm)
      const rightArm = new THREE.Group(); rightArm.userData.botId = id; rightArm.position.set(0.78, 2.02, 0); proxyRoot.add(rightArm)
      const leftLeg = new THREE.Group(); leftLeg.userData.botId = id; leftLeg.position.set(-0.38, 0.95, 0); proxyRoot.add(leftLeg)
      const rightLeg = new THREE.Group(); rightLeg.userData.botId = id; rightLeg.position.set(0.38, 0.95, 0); proxyRoot.add(rightLeg)
      const leftArmMesh = this.voxelPart(leftArm, [0.34, 1.2, 0.34], [0, -0.58, 0], skin.accent, 'limb')
      const rightArmMesh = this.voxelPart(rightArm, [0.34, 1.2, 0.34], [0, -0.58, 0], skin.accent, 'limb')
      const leftLegMesh = this.voxelPart(leftLeg, [0.42, 1.2, 0.42], [0, -0.6, 0], skin.trim, 'limb')
      const rightLegMesh = this.voxelPart(rightLeg, [0.42, 1.2, 0.42], [0, -0.6, 0], skin.trim, 'limb')
      const hitMeshes = [head, body, leftArmMesh, rightArmMesh, leftLegMesh, rightLegMesh]
      const proceduralVisuals: THREE.Object3D[] = [head, body, leftArmMesh, rightArmMesh, leftLegMesh, rightLegMesh]
      group.userData.rig = { leftArm, rightArm, leftLeg, rightLeg }
      const detail = (size: [number, number, number], pos: [number, number, number], color: string) => { const part = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color)); part.position.set(...pos); part.castShadow = false; proxyRoot.add(part); proceduralVisuals.push(part) }
      // Contrasting face shield, chest rig, belt, shoulder plates and a back-mounted field pack.
      detail([0.72, 0.22, 0.1], [0, 2.63, 0.49], skin.accent)
      detail([0.78, 0.54, 0.12], [0, 1.58, 0.41], skin.trim)
      detail([0.62, 0.16, 0.08], [0, 1.55, 0.49], skin.accent)
      detail([1.08, 0.14, 0.74], [0, 1.0, 0], skin.accent)
      detail([0.58, 0.72, 0.28], [0, 1.65, -0.48], skin.trim)
      detail([0.44, 0.32, 0.1], [0, 1.2, 0.42], skin.cloth)
      // Small original block carbine gives every bot a readable armed silhouette.
      detail([0.18, 0.16, 0.72], [0.42, 1.26, 0.5], '#263c49')
      detail([0.1, 0.1, 0.52], [0.42, 1.28, 1.08], skin.accent)
      detail([0.14, 0.24, 0.18], [0.42, 1.08, 0.48], '#263c49')
      detail([0.22, 0.12, 0.26], [0.42, 1.28, 0.18], skin.trim)
      // Eight handmade voxel silhouettes keep the unlocks readable at match distance.
      switch (skin.model) {
        case 0: detail([1.08, 0.26, 1.08], [0, 3.02, 0], skin.cloth); break // wrapped hood
        case 1: detail([0.18, 0.66, 0.18], [0, 3.32, 0], skin.accent); detail([1.08, 0.16, 0.2], [0, 2.92, 0.42], skin.accent); break // crest and brow
        case 2: detail([0.52, 0.38, 0.82], [-0.82, 2.02, 0], skin.trim); detail([0.52, 0.38, 0.82], [0.82, 2.02, 0], skin.trim); break // plated shoulders
        case 3: detail([1.12, 0.24, 0.82], [0, 2.12, 0.04], skin.accent); detail([0.24, 0.7, 0.25], [-0.48, 1.92, 0.4], skin.accent); break // long scarf
        case 4: detail([0.62, 0.34, 0.14], [0, 2.48, 0.48], skin.accent); detail([0.8, 0.18, 0.98], [0, 3.0, 0], skin.cloth); break // face wrap and cap
        case 5: detail([0.56, 0.46, 0.82], [-0.82, 1.95, 0], skin.accent); detail([0.56, 0.46, 0.82], [0.82, 1.95, 0], skin.accent); break // broad mantle
        case 6: detail([1.08, 0.2, 0.24], [0, 2.98, 0.43], skin.accent); detail([0.3, 0.38, 0.24], [0.34, 2.55, 0.49], skin.cloth); break // visor and cheek plate
        default: detail([0.18, 0.5, 0.18], [-0.38, 3.18, 0], skin.accent); detail([0.18, 0.5, 0.18], [0.38, 3.18, 0], skin.accent); break // twin crest
      }
      const fabric = this.operatorFabricTexture(skin.model + id * 3)
      for (const part of proceduralVisuals) {
        if (!(part instanceof THREE.Mesh)) continue
        const applyFabric = (material: THREE.Material) => {
          const copy = material.clone()
          if ('map' in copy && part.geometry.getAttribute('uv')) { (copy as THREE.MeshLambertMaterial).map = fabric; copy.needsUpdate = true }
          return copy
        }
        part.material = Array.isArray(part.material) ? part.material.map(applyFabric) : applyFabric(part.material)
      }
      const teamMarker = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.14), this.mat('#cb6657'))
      teamMarker.position.set(0.79, 2.03, 0.18); proxyRoot.add(teamMarker)
      const operatorMaterials: THREE.MeshStandardMaterial[] = []
      let animation: BotAnimation | undefined
      if (this.models.player) {
        proceduralVisuals.forEach(part => { part.visible = false })
        const operator = cloneSkinnedScene(this.models.player.scene)
        this.fitSkinnedModel(operator, PLAYER_MODEL_HEIGHT)
        operator.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return
          if (object instanceof THREE.SkinnedMesh) colorizeKchOperator(object, skin, id)
          object.castShadow = false; object.receiveShadow = false
          const cloneMaterial = (material: THREE.Material) => {
            const copy = material.clone()
            if (copy instanceof THREE.MeshStandardMaterial) {
              copy.map = null
              copy.color.set('#ffffff')
              copy.vertexColors = object.geometry.hasAttribute('color')
              copy.roughness = Math.max(copy.roughness, 0.78)
              copy.needsUpdate = true
            }
            return copy
          }
          object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material)
        })
        // A skinned mesh keeps the bounding sphere of its bind pose, which on
        // these rigs is a fraction of the posed size. Frustum culling therefore
        // dropped bots in and out of view as they walked, which read as glitching.
        operator.traverse(object => {
          if (object instanceof THREE.SkinnedMesh) object.frustumCulled = false
          else if (object instanceof THREE.Mesh) object.frustumCulled = false
          if (!(object instanceof THREE.Mesh)) return
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of materials) if (material instanceof THREE.MeshStandardMaterial && !operatorMaterials.includes(material)) operatorMaterials.push(material)
        })
        group.add(operator)
        const heldWeaponSource = this.models.ar9 ?? this.models.lar ?? this.models.scar
        const rightHand = operator.getObjectByName('rightArm2') ?? operator.getObjectByName('rightArm1')
        if (heldWeaponSource && rightHand) {
          const heldWeapon = heldWeaponSource.scene.clone(true)
          operator.updateMatrixWorld(true)
          this.fitHeldWeapon(heldWeapon, rightHand, 1.02)
          const finishTexture = this.weaponFinishTexture(skin.accent, 'operator-rifle', skin.model)
          heldWeapon.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return
            object.castShadow = false; object.receiveShadow = false
            const applyFinish = (material: THREE.Material) => {
              const copy = material.clone()
              if (copy instanceof THREE.MeshStandardMaterial && object.geometry.getAttribute('uv')) {
                copy.map = finishTexture; copy.color.set('#ffffff'); copy.metalness = 0.28; copy.roughness = 0.56
              }
              return copy
            }
            object.material = Array.isArray(object.material) ? object.material.map(applyFinish) : applyFinish(object.material)
          })
        }
        const idleClip = this.models.player.animations.find(clip => /idle|stand/i.test(clip.name)) ?? this.models.player.animations[0]
        const moveClip = this.models.player.animations.find(clip => /walk|run|sprint|jog/i.test(clip.name)) ?? idleClip
        if (idleClip) {
          const mixer = new THREE.AnimationMixer(operator)
          const idle = mixer.clipAction(idleClip).play()
          const move = moveClip ? mixer.clipAction(moveClip) : idle
          animation = { mixer, idle, move, active: idle }
        }
      }
      // Fit the fallback rig and its hit volumes to the same 1.84 m height as
      // the player. Keep the world root unscaled so imported bones and weapons
      // do not inherit an extra visual multiplier.
      const proxyBounds = new THREE.Box3().setFromObject(proxyRoot)
      const proxySize = proxyBounds.getSize(new THREE.Vector3())
      const proxyScale = PLAYER_MODEL_HEIGHT / Math.max(0.001, proxySize.y)
      proxyRoot.scale.setScalar(proxyScale)
      proxyRoot.position.y = -proxyBounds.min.y * proxyScale
      group.position.set(x, 0, z); this.scene.add(group)
      const profiles = ['MICA', 'HOLLOW', 'TUNDRA', 'RUST', 'KITE', 'MALLOW', 'QUARRY', 'WISP', 'TALLOW', 'CROW', 'SABLE', 'BRAMBLE', 'OCHRE', 'NORTH', 'FLINT', 'REED', 'CIRRUS', 'CLOVE', 'BASALT', 'LARK', 'MERCURY', 'PIPER', 'CINDER', 'WREN']
      const bot: Bot = { id, name: profiles[id]!, style: id % 4, root: group, hitMeshes, teamMarker, health: 100, nextShot: 1 + id * 0.4, respawnAt: 0, spawn: new THREE.Vector3(x, 0, z), phase: id * 1.7, visualPhase: id * 1.7, walking: false, kills: 0, deaths: 0, alive: true, team: 'red', stormTime: 0, spawnProtectedUntil: 0, animation, highlightMaterials: operatorMaterials, highlight: 0 }
      this.bots.push(bot); this.hitTargets.push(...hitMeshes)
    })
  }
  /**
   * Crosshair highlight: rivals tint red, squadmates blue, and the tint fades
   * instead of snapping so it stays readable while strafing across a target.
   */
  private updateAimHighlight(dt: number): void {
    const looking = this.mode === 'playing' && !this.playerDeadUntil
    let target: Bot | undefined
    if (looking) {
      // Angular test against the view axis rather than a mesh raycast: bot world
      // matrices are refreshed during rendering, so raycasting their hit boxes
      // silently missed while the simulation ran ahead of the last draw.
      const eye = this.cameraInternal.position
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraInternal.quaternion)
      const rel = new THREE.Vector3()
      // Sample points up the bot's body and measure the perpendicular distance
      // from the view ray. A pure centre-point angle test missed standing bots
      // because their chest sits below eye height at close range.
      let bestAlong = Number.POSITIVE_INFINITY
      for (const bot of this.bots) {
        if (!bot.alive || bot.id >= this.activeBotCount) continue
        for (const [height, radius] of [[0.45, 0.42], [0.95, 0.44], [1.3, 0.42], [1.55, 0.34], [1.75, 0.32]] as const) {
          rel.set(bot.root.position.x, bot.root.position.y + height, bot.root.position.z).sub(eye)
          const along = rel.dot(forward)
          if (along <= 0.5 || along > 90 || along >= bestAlong) continue
          if (rel.addScaledVector(forward, -along).length() > radius) continue
          bestAlong = along
          target = bot
        }
      }
      if (target) {
        // Only the chosen bot pays for an occlusion cast.
        this.raycaster.set(eye, rel.set(target.root.position.x, target.root.position.y + 1.3, target.root.position.z).sub(eye).normalize())
        const wall = this.raycaster.intersectObjects(this.arenaRoot.children, true)[0]
        if (wall && wall.distance < this.cameraInternal.position.distanceTo(target.root.position) - 0.3) target = undefined
      }
    }
    for (const bot of this.bots) {
      if (!bot.highlightMaterials.length) continue
      const wanted = bot === target ? 1 : 0
      bot.highlight = THREE.MathUtils.damp(bot.highlight, wanted, 16, dt)
      if (bot.highlight < 0.002 && wanted === 0) continue
      const color = bot.team === 'red' ? '#ff3a2f' : '#2f8bff'
      for (const material of bot.highlightMaterials) {
        material.emissive.set(color)
        material.emissiveIntensity = bot.highlight * 0.85
      }
    }
  }
  private buildLobbyPreview(): void {
    if (!this.models.player) return
    const stage = new THREE.Group()
    stage.position.set(0, -0.3, -4.9)
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.78, 32), new THREE.MeshBasicMaterial({ color: '#172f69', transparent: true, opacity: 0.38, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; shadow.scale.set(1.5, 0.58, 1); stage.add(shadow)
    const model = cloneSkinnedScene(this.models.player.scene)
    // The KCH operator's face points down local +Z; turn it toward the lobby camera.
    model.rotation.y = Math.PI
    model.updateMatrixWorld(true)
    const skin = OPERATOR_SKINS.find(item => item.id === this.save.data.operatorSkinId) ?? operatorSkinForLevel(this.save.data.level)
    // Match the reference lobby framing instead of letting the showcase model
    // dominate the narrow game panel.
    this.fitSkinnedModel(model, 2.55)
    model.position.y += 0.045
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      if (object instanceof THREE.SkinnedMesh) colorizeKchOperator(object, skin, skin.model)
      object.userData.lobbyOperator = true
      object.castShadow = false; object.receiveShadow = false
      const colorize = (material: THREE.Material) => {
        const copy = material.clone()
        if (copy instanceof THREE.MeshStandardMaterial) {
          copy.map = null
          copy.color.set('#ffffff')
          copy.vertexColors = object.geometry.hasAttribute('color')
          copy.roughness = Math.max(copy.roughness, 0.78)
          copy.needsUpdate = true
        }
        return copy
      }
      object.material = Array.isArray(object.material) ? object.material.map(colorize) : colorize(object.material)
    })
    const headBone = model.getObjectByName('head')
    if (headBone) {
      const face = new THREE.Group()
      face.position.set(0, 0.1, 0.29)
      const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#121820' })
      for (const x of [-0.085, 0.085]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.035), eyeMaterial)
        eye.position.set(x, 0, 0); face.add(eye)
      }
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.025), eyeMaterial)
      mouth.position.set(0, -0.12, -0.008); face.add(mouth)
      headBone.add(face)
    }
    const lobbyRifle = this.models.ar9 ?? this.models.lar ?? this.models.scar
    if (lobbyRifle) {
      const rifle = lobbyRifle.scene.clone(true)
      // KCH rifle assets are modeled along local X. Keep that axis across the chest,
      // with the muzzle outward and the stock near the operator's right hand.
      rifle.rotation.y = 0.55
      rifle.updateMatrixWorld(true)
      const rifleBounds = new THREE.Box3().setFromObject(rifle)
      const rifleSize = rifleBounds.getSize(new THREE.Vector3())
      const rifleCenter = rifleBounds.getCenter(new THREE.Vector3())
      const rifleScale = 1.12 / Math.max(0.001, rifleSize.x, rifleSize.y, rifleSize.z)
      rifle.scale.setScalar(rifleScale)
      rifle.position.set(-rifleCenter.x * rifleScale, 1.04 - rifleCenter.y * rifleScale, 0.65 - rifleCenter.z * rifleScale)
      rifle.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        object.castShadow = false; object.receiveShadow = false
        object.renderOrder = 8
        const finishTexture = this.weaponFinishTexture(skin.accent, 'operator-rifle', skin.model)
        const applyTexture = (material: THREE.Material) => { const copy = material.clone(); if ('depthTest' in copy) { copy.depthTest = false; copy.depthWrite = false }; if (copy instanceof THREE.MeshStandardMaterial) { copy.color.set('#ffffff'); copy.emissive.set('#101c23'); copy.metalness = 0.22; copy.roughness = 0.62; if (object.geometry.getAttribute('uv')) copy.map = finishTexture; copy.needsUpdate = true }; return copy }
        object.material = Array.isArray(object.material) ? object.material.map(applyTexture) : applyTexture(object.material)
        object.userData.lobbyWeapon = true
      })
      model.add(rifle)
    }
    stage.add(model); this.scene.add(stage); this.lobbyPreview = stage
    const idle = this.models.player.animations.find(clip => /stand/i.test(clip.name)) ?? this.models.player.animations.find(clip => /idle/i.test(clip.name)) ?? this.models.player.animations[0]
    if (idle) { this.lobbyAnimation = new THREE.AnimationMixer(model); this.lobbyAnimation.clipAction(idle).play() }
  }
  private updateLobbyPreviewSkin(): void {
    if (!this.lobbyPreview) return
    const skin = OPERATOR_SKINS.find(item => item.id === this.save.data.operatorSkinId) ?? operatorSkinForLevel(this.save.data.level)
    const weaponTexture = this.weaponFinishTexture(skin.accent, 'operator-rifle', skin.model)
    this.lobbyPreview.traverse(object => {
      if (object instanceof THREE.Mesh && object.userData.lobbyWeapon === true) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial && object.geometry.getAttribute('uv')) {
            material.map = weaponTexture ?? this.weaponFinishTexture(skin.accent, 'operator-rifle', skin.model)
            material.color.set('#ffffff')
            material.needsUpdate = true
          }
        }
        return
      }
      if (!(object instanceof THREE.SkinnedMesh) || object.userData.lobbyOperator !== true) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.set('#ffffff')
          material.vertexColors = object.geometry.hasAttribute('color')
          material.map = null
          material.needsUpdate = true
        }
      }
    })
  }
  private operatorFabricTexture(seed: number): THREE.CanvasTexture {
    const key = String(((seed % 64) + 64) % 64)
    const cached = this.operatorTextures.get(key)
    if (cached) return cached
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    const context = canvas.getContext('2d')!
    context.imageSmoothingEnabled = false
    context.fillStyle = '#d1d1d1'; context.fillRect(0, 0, 64, 64)
    context.fillStyle = '#a8a8a8'
    for (let y = 1; y < 64; y += 4) context.fillRect(0, y, 64, 1)
    for (let x = 2; x < 64; x += 4) context.fillRect(x, 0, 1, 64)
    context.fillStyle = 'rgba(248, 248, 248, 0.46)'
    for (let y = 0; y < 64; y += 8) for (let x = ((y / 8 + seed) % 2) * 4; x < 64; x += 8) context.fillRect(x, y, 2, 2)
    context.strokeStyle = 'rgba(65, 65, 65, 0.48)'; context.lineWidth = 1
    context.strokeRect(2.5, 2.5, 59, 59)
    context.beginPath(); context.moveTo(4, 48); context.lineTo(60, 48); context.moveTo(14, 4); context.lineTo(14, 48); context.stroke()
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2, 2)
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.anisotropy = Math.min(4, this.renderer.gl.capabilities.getMaxAnisotropy())
    this.operatorTextures.set(key, texture)
    return texture
  }
  private weaponFinishTexture(colorHex: string, pattern: string, seed: number): THREE.CanvasTexture {
    const stableSeed = ((seed % 128) + 128) % 128
    const key = `${colorHex}:${pattern}:${stableSeed}`
    const cached = this.weaponFinishTextures.get(key)
    if (cached) return cached

    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const context = canvas.getContext('2d')!
    context.imageSmoothingEnabled = false
    context.scale(2, 2)
    const base = new THREE.Color(colorHex)
    const dark = base.clone().multiplyScalar(0.38)
    const mid = base.clone().multiplyScalar(0.84)
    const bright = base.clone().lerp(new THREE.Color('#f1f3e8'), 0.5)
    const accent = base.clone().lerp(new THREE.Color(['#f4d36d', '#74e1db', '#ffa06d', '#d4b7ff'][stableSeed % 4]!), 0.74)
    const paint = (color: THREE.Color) => color.getStyle(THREE.SRGBColorSpace)

    context.fillStyle = paint(base); context.fillRect(0, 0, 128, 128)
    context.fillStyle = paint(dark); context.fillRect(0, 0, 128, 7); context.fillRect(0, 121, 128, 7)
    context.fillStyle = paint(mid); context.fillRect(8, 14, 112, 100)
    context.fillStyle = paint(bright); context.fillRect(12, 18, 104, 3); context.fillRect(12, 107, 104, 3)

    context.save(); context.beginPath(); context.rect(12, 22, 104, 82); context.clip()
    context.lineWidth = 2
    if (pattern.includes('grid') || pattern.includes('circuit') || pattern.includes('rune')) {
      context.strokeStyle = paint(dark)
      for (let x = 20; x <= 112; x += 16) { context.beginPath(); context.moveTo(x, 22); context.lineTo(x, 104); context.stroke() }
      for (let y = 28; y <= 100; y += 16) { context.beginPath(); context.moveTo(12, y); context.lineTo(116, y); context.stroke() }
      context.strokeStyle = paint(accent); context.lineWidth = 3
      for (let x = 24; x < 112; x += 32) {
        const y = 30 + (Math.floor(x / 16 + stableSeed) % 4) * 16
        context.beginPath(); context.moveTo(x, y); context.lineTo(x + 10, y); context.lineTo(x + 10, y + 12); context.lineTo(x + 23, y + 12); context.stroke()
      }
    } else if (pattern.includes('mesh') || pattern.includes('braid') || pattern.includes('strata')) {
      context.strokeStyle = paint(dark)
      for (let offset = -128; offset < 256; offset += 16) {
        context.beginPath(); context.moveTo(offset, 22); context.lineTo(offset + 82, 104); context.stroke()
        context.beginPath(); context.moveTo(offset + 82, 22); context.lineTo(offset, 104); context.stroke()
      }
      context.strokeStyle = paint(accent); context.lineWidth = 3
      for (let y = 30; y < 102; y += 32) { context.beginPath(); context.moveTo(18, y); context.lineTo(110, y - 10); context.stroke() }
    } else if (pattern.includes('star') || pattern.includes('constellation')) {
      context.fillStyle = paint(accent)
      for (let i = 0; i < 16; i += 1) {
        const x = 18 + (i * 37 + stableSeed * 13) % 92, y = 26 + (i * 23 + stableSeed * 7) % 72
        context.fillRect(x, y, i % 4 === 0 ? 4 : 2, i % 4 === 0 ? 4 : 2)
        if (i % 3 === 0) { context.strokeStyle = paint(bright); context.lineWidth = 1; context.beginPath(); context.moveTo(x, y); context.lineTo(x + 12, y - 8); context.stroke() }
      }
    } else {
      context.strokeStyle = paint(dark); context.lineWidth = 6
      for (let offset = -80; offset < 180; offset += 26) { context.beginPath(); context.moveTo(offset, 22); context.lineTo(offset + 76, 104); context.stroke() }
      context.strokeStyle = paint(accent); context.lineWidth = 4
      for (let y = 32; y < 102; y += 28) { context.beginPath(); context.moveTo(18, y); context.lineTo(108, y - 12); context.stroke() }
    }
    context.restore()
    context.fillStyle = paint(accent); context.fillRect(16, 26, 3, 72); context.fillRect(109, 26, 3, 72)
    context.fillStyle = paint(dark); context.fillRect(22, 112, 24, 5); context.fillRect(82, 112, 24, 5)
    context.fillStyle = paint(bright); context.font = 'bold 8px sans-serif'; context.fillText(pattern.slice(0, 12).toUpperCase(), 20, 16)

    const plateIndex = kchSkinTextureIndex(pattern)
    const plate = plateIndex !== null ? this.models.kchTexturePacks[plateIndex] : this.kchTexturePack(seed)
    const kchImage = plate?.image as CanvasImageSource | undefined
    if (kchImage) {
      // The plates are dark concrete/wood masks. Multiply sinks them into the
      // base colour and the screen pass lifts the grain back out, so the gun
      // stays bright while the selected plate still drives its texture.
      context.save()
      context.globalCompositeOperation = 'multiply'
      context.globalAlpha = 0.42
      context.drawImage(kchImage, 0, 0, 128, 128)
      context.globalCompositeOperation = 'screen'
      context.globalAlpha = 0.3
      context.drawImage(kchImage, 0, 0, 128, 128)
      context.restore()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.anisotropy = Math.min(4, this.renderer.gl.capabilities.getMaxAnisotropy())
    if (this.weaponFinishTextures.size >= 64) {
      const oldest = this.weaponFinishTextures.entries().next().value as [string, THREE.CanvasTexture] | undefined
      if (oldest) { oldest[1].dispose(); this.weaponFinishTextures.delete(oldest[0]) }
    }
    this.weaponFinishTextures.set(key, texture)
    return texture
  }

  private addImportedViewModel(source: GLTF, yaw: number, targetLength: number, tint: string, pitch = 0, pattern = 'industrial', seed = 0): THREE.Group {
    const wrapper = new THREE.Group()
    const model = source.scene.clone(true)
    // Measure the authored model before rotating it. Rotating first makes the
    // bounding box depend on the view angle, which shifts the grip and can
    // change the apparent size between weapons.
    model.position.set(0, 0, 0)
    model.rotation.set(0, 0, 0)
    model.scale.setScalar(1)
    model.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(model)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const muzzleMarker = model.getObjectByName('Muzzle')
    const gripSource = model.getObjectByName('Lever')?.getWorldPosition(new THREE.Vector3()).clone() ?? new THREE.Vector3(0.1, -0.045, 0)
    // Derive the true muzzle axis from the authored helper and measure the model
    // along it. Guessing a shared yaw left every KCH gun tilted, so the
    // viewmodel read as a shapeless tube instead of a rifle silhouette.
    const muzzleAxis = muzzleMarker ? muzzleMarker.getWorldPosition(new THREE.Vector3()).sub(center) : new THREE.Vector3(1, 0, 0)
    if (muzzleAxis.lengthSq() < 1e-8) muzzleAxis.set(1, 0, 0)
    muzzleAxis.normalize()
    let axisLength = Math.max(size.x, size.y, size.z)
    let minAlongAxis = Number.POSITIVE_INFINITY
    let maxAlongAxis = Number.NEGATIVE_INFINITY
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const projection = new THREE.Vector3(x, y, z).sub(center).dot(muzzleAxis)
      minAlongAxis = Math.min(minAlongAxis, projection)
      maxAlongAxis = Math.max(maxAlongAxis, projection)
    }
    if (maxAlongAxis - minAlongAxis > 1e-4) axisLength = maxAlongAxis - minAlongAxis
    const scale = targetLength / Math.max(0.001, axisLength)
    const kchFinish = this.weaponFinishTexture(tint, pattern, seed)
    // Aim the muzzle down -Z, then roll about that axis until the weapon stands
    // upright, and finally add the authored pitch as a small display tilt.
    const orientation = new THREE.Quaternion().setFromUnitVectors(muzzleAxis, new THREE.Vector3(0, 0, -1))
    const localUp = Math.abs(muzzleAxis.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
    const rolledUp = localUp.applyQuaternion(orientation)
    orientation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.atan2(rolledUp.x, rolledUp.y)))
    // Cant the muzzle a little to the left so the camera sees the weapon's side
    // profile. Pointing it straight down -Z showed only the stock end and made
    // every gun read as a shapeless blob.
    orientation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.04 + pitch * 0.18, 0.32 + yaw * 0.02, 0.03)))
    model.scale.setScalar(scale)
    model.quaternion.copy(orientation)
    // A rotated center must be removed in the rotated basis too, or the
    // normalized model drifts sideways when its muzzle axis is aligned.
    model.position.copy(center.clone().multiplyScalar(-scale).applyQuaternion(orientation))
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = false; object.receiveShadow = false
      const cloneMaterial = (material: THREE.Material) => {
        const copy = material.clone()
        if (copy instanceof THREE.MeshStandardMaterial) {
          if (object.geometry.getAttribute('uv')) {
            // The KCH GLBs contain UVs but no embedded base-color maps. Use
            // the matching KCH skin atlas directly so its UV islands line up;
            // the generic procedural finish is only a fallback.
            // The KCH gun UVs land almost entirely in the empty black half of
            // the 256px skin atlases, which painted every viewmodel solid black.
            // The painted finish below is full coverage, so it carries the skin
            // colour and pattern while the atlas only modulates it.
            copy.map = kchFinish
            copy.emissive.set(tint).multiplyScalar(0.17)
            copy.emissiveMap = null
            copy.color.set('#ffffff')
            copy.vertexColors = object.geometry.hasAttribute('color')
          } else {
            copy.color.set('#526d80').lerp(new THREE.Color(tint), 0.24)
          }
          copy.metalness = 0.06
          copy.roughness = 0.52
        } else if ('color' in copy && copy.color instanceof THREE.Color) copy.color.set('#526d80')
        copy.needsUpdate = true
        return copy
      }
      object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material)
    })
    wrapper.add(model)
    const fit = this.currentWeapon === 'knife' ? [0.3, -0.42, -0.8] : this.currentWeapon === 'glock' || this.currentWeapon === 'deagle' ? [0.68, -0.56, -0.8] : this.currentWeapon === 'mp5' ? [0.82, -0.64, -0.82] : this.currentWeapon === 'awp' ? [0.94, -0.68, -0.8] : [0.94, -0.68, -0.8]
    const compactView = THREE.MathUtils.clamp(1 - this.cameraInternal.aspect / 1.15, 0, 0.65)
    if (this.currentWeapon === 'knife') {
      wrapper.position.set(fit[0]! - compactView * 0.78, fit[1]!, fit[2]!)
    } else {
      // The KCH Lever helper sits by each weapon's firing grip. Account for
      // the normalized model center so the marker lands on the same hand point
      // across the different source mesh scales.
      const gripOnModel = gripSource.clone().sub(center).multiplyScalar(scale).applyQuaternion(orientation)
      wrapper.position.copy(this.viewGripAnchor.clone().sub(gripOnModel))
    }
    // KCH firearms are each one authored mesh. A separate box used as a
    // detachable magazine floated outside the receiver and made the model
    // look like unfinished geometry; keep reload motion on the full rig.
    wrapper.userData.baseY = wrapper.position.y
    wrapper.userData.basePosition = wrapper.position.clone()
    this.viewModelRig.add(wrapper)
    this.importedViewModel = wrapper
    const muzzle = model.getObjectByName('Muzzle')
    if (muzzle) {
      this.weaponView.updateMatrixWorld(true)
      this.muzzleFlashGroup.position.copy(this.weaponView.worldToLocal(muzzle.getWorldPosition(new THREE.Vector3())))
    }
    return wrapper
  }
  private updateViewModel(): void {
    for (const part of this.viewParts) { part.removeFromParent(); part.geometry.dispose(); const materials = Array.isArray(part.material) ? part.material : [part.material]; materials.forEach(material => material.dispose()) }
    this.viewParts.length = 0
    if (this.importedViewModel) {
      this.importedViewModel.removeFromParent()
      this.importedViewModel.traverse(object => { if (object instanceof THREE.Mesh) { const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()) } })
      this.importedViewModel = null
    }
    this.importedArms = null
    this.reloadMagazine = null; this.reloadHand = null; this.muzzleFlashGroup.visible = false; this.muzzleFlashGroup.position.set(0, 0, 0)
    const weapon = WEAPONS[this.currentWeapon]
    const selectedGun = this.currentWeapon === 'knife' ? undefined : armoryGun(this.currentWeapon === this.selectedHandgunBase() ? this.save.data.handgunGunId : this.save.data.primaryGunId)
    const knifeSkin = KNIFE_SKINS.find(item => item.id === this.save.data.knifeSkinId)
    const finish = skinFor(this.save.data.equipped[this.currentWeapon])
    const primary = this.currentWeapon === 'knife' ? knifeSkin?.color ?? weapon.color : finish?.color ?? selectedGun?.color ?? weapon.color
    const motif = finish?.pattern ?? knifeSkin?.id ?? 'plain'
    const motifCode = [...motif].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7)
    const knifeModel = (this.save.data.knifeSkinId.length % 2 ? this.models.bayonet : this.models.tomahawk) ?? this.models.bayonet ?? this.models.tomahawk
    const rifleModels = this.currentWeapon === 'm4a4'
      ? [this.models.scar, this.models.lar, this.models.ar9, this.models.weatie, this.models.m60]
      : [this.models.lar, this.models.ar9, this.models.scar, this.models.weatie, this.models.m60]
    const importedSource = this.currentWeapon === 'knife' ? knifeModel
      : this.currentWeapon === 'glock' ? this.models.shark
        : this.currentWeapon === 'deagle' ? this.models.revolver
          : this.currentWeapon === 'mp5' ? this.models.mac10
            : this.currentWeapon === 'awp' ? this.models.vita
              : rifleModels[(selectedGun?.model ?? 0) % rifleModels.length]
    const importedLength = this.currentWeapon === 'knife' ? 0.74 : this.currentWeapon === 'glock' || this.currentWeapon === 'deagle' ? 0.78 : this.currentWeapon === 'mp5' ? 1.42 : this.currentWeapon === 'awp' ? 1.7 : 1.66
    // The KCH models are centred on the firing grip, so the anchor has to clear
    // the stock as well as the muzzle or the rear of the rifle ends up behind
    // the near plane and smears the whole weapon across the screen.
    this.viewGripAnchor.set(0.33, -0.4, -Math.max(0.52, importedLength * 0.36))
    const importedGun = Boolean(importedSource && this.currentWeapon !== 'knife')
    const ornament = new THREE.Color(primary).lerp(new THREE.Color('#f5deb0'), 0.48).getStyle()
    const addBox = (size: [number, number, number], pos: [number, number, number], color: string, metal = false) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color, metal))
      part.position.set(...pos); part.castShadow = true; this.viewModelRig.add(part); this.viewParts.push(part); return part
    }
    const addSkinBox = (size: [number, number, number], pos: [number, number, number]) => {
      const material = new THREE.MeshStandardMaterial({ color: '#ffffff', map: this.weaponFinishTexture(primary, motif, motifCode), metalness: 0.28, roughness: 0.48 })
      const part = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
      part.position.set(...pos); part.castShadow = true; this.viewModelRig.add(part); this.viewParts.push(part); return part
    }
    /**
     * A gloved fist that actually wraps a grip: palm, four curled fingers, a
     * thumb and a short cuff. The previous version was a bare box on the end of
     * a long cylinder, which read as two poles resting against the gun.
     */
    const addHand = (origin: THREE.Vector3, forward: THREE.Vector3, color: string): THREE.Group => {
      const hand = new THREE.Group()
      hand.position.copy(origin)
      hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), forward.clone().normalize())
      const add = (size: [number, number, number], pos: [number, number, number]) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color))
        mesh.position.set(...pos); mesh.castShadow = true
        hand.add(mesh); this.viewParts.push(mesh)
        return mesh
      }
      const palm = add([0.105, 0.09, 0.115], [0, 0, 0])
      for (let finger = 0; finger < 4; finger += 1) add([0.022, 0.07, 0.03], [-0.036 + finger * 0.024, 0.052, -0.05])
      add([0.03, 0.055, 0.07], [0.056, 0.028, -0.012])
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.3, 8, 1), this.mat(color))
      cuff.position.set(0.028, -0.115, 0.2); cuff.rotation.set(-0.62, 0, 0.12)
      cuff.castShadow = true
      hand.add(cuff); this.viewParts.push(cuff)
      this.viewModelRig.add(hand)
      void palm
      return hand
    }
    // Gloved hands are always procedural. The KCH arm rigs are authored at wildly
    // different scales per weapon and landed as detached slabs floating beside
    // the sights, so the deterministic sleeves are what the player sees.
    const triggerHand: [number, number, number] = importedGun
      ? this.viewGripAnchor.toArray() as [number, number, number]
      : [0.36, -0.53, -0.38]
    const supportHand: [number, number, number] = importedGun
      ? [triggerHand[0] - 0.22, triggerHand[1] - 0.02, triggerHand[2] - 0.34]
      : [0.36, -0.52, -0.88]
    // The viewmodel is canted left, so the support hand has to travel down the
    // barrel rather than sit straight ahead of the trigger hand.
    const gunForward = new THREE.Vector3(-Math.sin(0.32), 0, -Math.cos(0.32))
    if (importedGun) {
      const reach = Math.max(0.34, importedLength * 0.42)
      supportHand[0] = triggerHand[0] + gunForward.x * reach
      supportHand[1] = triggerHand[1] - 0.012
      supportHand[2] = triggerHand[2] + gunForward.z * reach
    }
    // Sit the fists under and outside the receiver line so they wrap the grip
    // instead of covering the weapon's body.
    this.reloadHand = addHand(new THREE.Vector3(triggerHand[0] + 0.012, triggerHand[1] - 0.055, triggerHand[2] + 0.01), gunForward, '#2b3340')
    addHand(new THREE.Vector3(supportHand[0] - 0.012, supportHand[1] - 0.055, supportHand[2]), gunForward, '#2b3340')
    this.reloadHand.userData.basePosition = this.reloadHand.position.clone()
    if (importedSource) {
      this.addImportedViewModel(importedSource, this.currentWeapon === 'knife' ? -Math.PI / 4 : Math.PI * 7 / 12, importedLength, primary, this.currentWeapon === 'knife' ? -Math.PI / 2 : 0, motif, motifCode)
    } else if (this.currentWeapon === 'knife') {
      this.muzzleFlashGroup.position.set(0, 0, 0)
      addBox([0.12, 0.15, 0.38], [0.34, -0.48, -0.57], '#202832')
      addBox([0.09, 0.12, 0.75], [0.34, -0.23, -0.98], primary, true)
      addBox([0.1, 0.035, 0.28], [0.34, -0.15, -1.02], ornament, true)
    } else {
        const pistol = this.currentWeapon === 'glock' || this.currentWeapon === 'deagle'
        const sniper = this.currentWeapon === 'awp'
        const smg = this.currentWeapon === 'mp5'
        const model = selectedGun?.model ?? 0
        const receiverLength = pistol ? 0.54 : sniper ? 1.12 : smg ? 0.76 : 0.92
        const receiverWidth = pistol ? 0.26 : 0.31 + model % 3 * 0.018
        addSkinBox([receiverWidth, pistol ? 0.17 : 0.22, receiverLength], [0.36, -0.35, -0.57])
        const portrait = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.28), new THREE.MeshStandardMaterial({ map: this.weaponFinishTexture(primary, motif, motifCode), roughness: 0.48, metalness: 0.24 }))
        portrait.rotation.y = -Math.PI / 2; portrait.position.set(0.36 - receiverWidth / 2 - 0.012, -0.35, -0.57); this.viewModelRig.add(portrait); this.viewParts.push(portrait)
        // Distinct pistol, compact SMG, long precision rifle and rifle proportions.
        const barrelLength = pistol ? 0.38 : sniper ? 1.75 : smg ? 0.92 : 1.28
        addBox([pistol ? 0.1 : 0.12, 0.1, barrelLength], [0.36, -0.31, -0.88 - barrelLength / 2], '#26313c')
        addBox([pistol ? 0.15 : 0.2, 0.12, 0.12], [0.36, -0.31, -0.88 - barrelLength], '#121a23', true)
        // The model index changes stock, handguard, magazine and optic outline across the armory.
        if (!pistol && model % 4 !== 1) addBox([0.3, 0.15, model % 2 ? 0.48 : 0.36], [0.36, -0.35, -0.12], '#514235')
        if (!pistol && model % 4 !== 0) addSkinBox([receiverWidth, 0.15, 0.4], [0.36, -0.34, -0.91])
        this.reloadMagazine = addSkinBox([pistol ? 0.14 : 0.2, pistol ? 0.25 : 0.34, 0.17], [0.36, -0.58, -0.55])
        this.reloadMagazine.userData.baseY = this.reloadMagazine.position.y
        this.reloadMagazine.userData.basePosition = this.reloadMagazine.position.clone()
        this.reloadMagazine.userData.baseRotation = this.reloadMagazine.rotation.clone()
        addBox([0.16, pistol ? 0.1 : 0.12, 0.28], [0.36, -0.53, -0.35], '#293540')
        if (sniper) {
          const scope = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.62), this.mat('#27333c'))
          scope.rotation.x = Math.PI / 2; scope.position.set(0.36, -0.17, -0.72); this.viewModelRig.add(scope); this.viewParts.push(scope)
          addBox([0.23, 0.08, 0.08], [0.36, -0.22, -0.72], '#a9d7db', true)
        } else {
          addBox([0.12, 0.11, pistol ? 0.12 : 0.3], [0.36, -0.18, -0.62], model % 3 === 1 ? '#1e2932' : '#485965')
        }
        addBox([0.045, 0.035, 0.2], [0.36, -0.13, -0.85], ornament, true)
        this.muzzleFlashGroup.position.set(0.36, -0.31, -0.88 - barrelLength - 0.05)
        for (let i = 0; i < 3; i += 1) {
          const width = 0.045 + ((motifCode >>> (i * 3)) & 3) * 0.012
          addBox([width, 0.032, 0.12 + (motifCode + i) % 3 * 0.035], [0.36 + receiverWidth / 2 + width / 2, -0.31, -0.36 - i * 0.16], ornament, i === motifCode % 3)
        }
    }
  }
  private activeWeaponName(): string { if (this.currentWeapon === 'knife') return KNIFE_SKINS.find(s => s.id === this.save.data.knifeSkinId)?.name ?? 'Field Shard'; const id = this.activeSlot === 0 ? this.save.data.primaryGunId : this.save.data.handgunGunId; return armoryGun(id).name }
  private selectedPrimaryBase(): WeaponId { return armoryGun(this.save.data.primaryGunId).base }
  private selectedHandgunBase(): WeaponId { return armoryGun(this.save.data.handgunGunId).base }
  private worldPoint(point: THREE.Vector3): THREE.Vector3 { return point.clone().multiplyScalar(this.mapScale) }
  private botSpawn(bot: Bot): THREE.Vector3 { return bot.spawn.clone().multiplyScalar(this.mapScale) }
  private centralSpawn(spawns: THREE.Vector3[]): THREE.Vector3 | undefined {
    if (!spawns.length) return undefined
    return spawns[this.centralSpawnIndex(spawns)]?.clone()
  }
  private centralSpawnIndex(spawns: THREE.Vector3[]): number {
    if (!spawns.length) return 0
    const center = spawns.reduce((sum, spawn) => sum.add(spawn), new THREE.Vector3()).multiplyScalar(1 / spawns.length)
    const roomy = spawns.map((spawn, index) => ({ spawn, index })).filter(({ spawn }) => this.hasSpawnHeadroom(spawn))
    const headroomCandidates = roomy.length ? roomy : spawns.map((spawn, index) => ({ spawn, index }))
    const safeCandidates = headroomCandidates.filter(({ spawn }) => {
      const world = spawn.clone().multiplyScalar(this.mapScale)
      world.y = this.supportHeight(world)
      return this.hasSpawnFloor(world) && !this.collisionAt(world)
    })
    const candidates = safeCandidates.length ? safeCandidates : headroomCandidates
    const rivals = spawns === this.kchSpawnTeams.first ? this.kchSpawnTeams.second : this.kchSpawnTeams.first
    const target = rivals.length ? rivals.reduce((sum, spawn) => sum.add(spawn), new THREE.Vector3()).multiplyScalar(1 / rivals.length) : center
    return candidates.reduce((best, candidate) => {
      const world = candidate.spawn.clone().multiplyScalar(this.mapScale)
      const bestWorld = best.spawn.clone().multiplyScalar(this.mapScale)
      world.y = this.supportHeight(world); bestWorld.y = this.supportHeight(bestWorld)
      const open = this.spawnAreaClearance(world) + this.spawnApproachClearance(candidate.spawn, target) * 0.08
      const bestOpen = this.spawnAreaClearance(bestWorld) + this.spawnApproachClearance(best.spawn, target) * 0.08
      const score = open - Math.sqrt(candidate.spawn.distanceToSquared(center)) * 0.2
      const bestScore = bestOpen - Math.sqrt(best.spawn.distanceToSquared(center)) * 0.2
      return score > bestScore ? candidate : best
    }).index
  }
  private clearPlayerSpawn(base: THREE.Vector3): THREE.Vector3 {
    const fallback = base.clone().multiplyScalar(this.mapScale)
    if (!this.activeKchMap || this.mapScale <= 0) return fallback
    const opponents = this.matchType === 'search' ? this.searchBase('red') : this.kchSpawnTeams.second
    const target = opponents instanceof THREE.Vector3 ? opponents : opponents.length ? opponents.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / opponents.length) : base
    let best: { position: THREE.Vector3; score: number } | undefined
    for (let radius = 0; radius <= 8; radius += 0.4) {
      const directions = radius === 0 ? 1 : 16
      for (let index = 0; index < directions; index += 1) {
        const angle = index / directions * Math.PI * 2
        const local = base.clone().add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
        const world = local.clone().multiplyScalar(this.mapScale)
        world.y = this.supportHeight(world)
        const adjustedLocal = world.clone().multiplyScalar(1 / this.mapScale)
        if (!this.hasSpawnFloor(world) || !this.hasSpawnHeadroom(adjustedLocal) || this.collisionAt(world)) continue
        const openness = this.spawnAreaClearance(world)
        const approach = this.spawnApproachClearance(adjustedLocal, target)
        const score = openness + Math.min(3, approach) * 0.08 - radius * 0.12
        if (!best || score > best.score) best = { position: world, score }
      }
    }
    return best?.position ?? fallback
  }
  private spawnAreaClearance(position: THREE.Vector3): number {
    let total = 0, minimum = 4.8
    for (let direction = 0; direction < 8; direction += 1) {
      const angle = direction / 8 * Math.PI * 2
      let clearance = 4.8
      for (let distance = 0.6; distance <= 4.8; distance += 0.6) {
        const sample = position.clone().add(new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance))
        if (this.collisionAt(sample)) { clearance = distance - 0.6; break }
      }
      total += clearance; minimum = Math.min(minimum, clearance)
    }
    return total / 8 + minimum * 0.45
  }
  private openFacingYaw(position: THREE.Vector3, target: THREE.Vector3): number {
    const direct = Math.atan2(target.x - position.x, -(target.z - position.z))
    let bestYaw = direct, bestScore = -Infinity
    for (let step = -12; step <= 12; step += 1) {
      const offset = step * Math.PI / 12
      const yaw = direct + offset
      const end = position.clone().add(new THREE.Vector3(Math.sin(yaw) * 8, 0, -Math.cos(yaw) * 8))
      const clearance = this.spawnApproachClearance(position, end)
      const score = clearance + Math.cos(offset) * 1.5
      if (score > bestScore) { bestScore = score; bestYaw = yaw }
    }
    return bestYaw
  }
  private hasSpawnHeadroom(position: THREE.Vector3): boolean {
    if (!this.activeKchMap || this.kchCellScale <= 0) return true
    const localX = position.x, localZ = position.z
    const gx = Math.round(localX / this.kchCellScale + this.kchCenterX)
    const gz = Math.round(localZ / this.kchCellScale + this.kchCenterZ)
    const reach = Math.ceil(0.38 / this.kchCellScale) + 1
    const headroom = 1.85 / Math.max(0.48, this.mapScale)
    for (let x = gx - reach; x <= gx + reach; x += 1) for (let z = gz - reach; z <= gz + reach; z += 1) {
      const centerX = (x - this.kchCenterX) * this.kchCellScale, centerZ = (z - this.kchCenterZ) * this.kchCellScale
      if (Math.abs(localX - centerX) >= this.kchCellScale / 2 + 0.38 || Math.abs(localZ - centerZ) >= this.kchCellScale / 2 + 0.38) continue
      for (const cell of this.kchColumns.get(`${x},${z}`) ?? []) if (cell.bottom > position.y + 0.12 && cell.bottom < position.y + headroom) return false
    }
    return true
  }
  private hasSpawnFloor(position: THREE.Vector3): boolean {
    if (!this.activeKchMap || this.mapScale <= 0 || this.kchCellScale <= 0) return true
    const localX = position.x / this.mapScale, localZ = position.z / this.mapScale
    const gx = Math.round(localX / this.kchCellScale + this.kchCenterX)
    const gz = Math.round(localZ / this.kchCellScale + this.kchCenterZ)
    const reach = Math.ceil(0.38 / this.kchCellScale) + 1
    for (let x = gx - reach; x <= gx + reach; x += 1) for (let z = gz - reach; z <= gz + reach; z += 1) {
      const centerX = (x - this.kchCenterX) * this.kchCellScale, centerZ = (z - this.kchCenterZ) * this.kchCellScale
      if (Math.abs(localX - centerX) >= this.kchCellScale / 2 + 0.38 || Math.abs(localZ - centerZ) >= this.kchCellScale / 2 + 0.38) continue
      for (const cell of this.kchColumns.get(`${x},${z}`) ?? []) if (Math.abs(cell.top * this.mapScale - position.y) < 0.08) return true
    }
    return false
  }
  private spawnApproachClearance(position: THREE.Vector3, target: THREE.Vector3): number {
    if (!this.activeKchMap || this.kchCellScale <= 0) return 0
    const directionX = target.x - position.x, directionZ = target.z - position.z
    const length = Math.hypot(directionX, directionZ)
    if (length < 0.001) return 0
    const stepX = directionX / length, stepZ = directionZ / length
    const radius = 0.38 / Math.max(0.48, this.mapScale)
    const bodyHeight = 1.85 / Math.max(0.48, this.mapScale)
    for (let distance = 0.25; distance <= 8; distance += 0.25) {
      const xAt = position.x + stepX * distance, zAt = position.z + stepZ * distance
      const gx = Math.round(xAt / this.kchCellScale + this.kchCenterX), gz = Math.round(zAt / this.kchCellScale + this.kchCenterZ)
      const reach = Math.ceil((radius + this.kchCellScale * 0.5) / this.kchCellScale)
      let blocked = false
      for (let x = gx - reach; x <= gx + reach && !blocked; x += 1) for (let z = gz - reach; z <= gz + reach && !blocked; z += 1) {
        const centerX = (x - this.kchCenterX) * this.kchCellScale, centerZ = (z - this.kchCenterZ) * this.kchCellScale
        if (Math.abs(xAt - centerX) >= this.kchCellScale / 2 + radius || Math.abs(zAt - centerZ) >= this.kchCellScale / 2 + radius) continue
        blocked = (this.kchColumns.get(`${x},${z}`) ?? []).some(cell => cell.top > position.y + 0.12 && cell.bottom < position.y + bodyHeight)
      }
      if (blocked) return distance - 0.25
    }
    return 8
  }
  private searchBlueSideIsSouth(): boolean { return this.round <= SEARCH_ROUND.halfRounds }
  private searchBase(team: 'blue' | 'red'): THREE.Vector3 {
    const blueIsSouth = this.searchBlueSideIsSouth()
    const teamIsSouth = team === 'blue' ? blueIsSouth : !blueIsSouth
    const markerKind = teamIsSouth ? (team === 'blue' ? 'player-spawn' : 'bot-spawn') : (team === 'blue' ? 'bot-spawn' : 'player-spawn')
    const marker = this.activeCustomMap?.markers.find(item => item.kind === markerKind)
    if (marker) return new THREE.Vector3(marker.x, 0, marker.z)
    if (this.activeKchMap) {
      const blueUsesFirst = blueIsSouth
      const useFirst = (team === 'blue') === blueUsesFirst
      const spawns = useFirst ? this.kchSpawnTeams.first : this.kchSpawnTeams.second
      const spawn = this.centralSpawn(spawns)
      if (spawn) return spawn
    }
    return new THREE.Vector3(0, 0, teamIsSouth ? -25 : 25)
  }
  private searchLineOffsets(count = this.teamSize): number[] {
    const spacing = Math.max(2, Math.ceil(3 / this.mapScale))
    return Array.from({ length: count }, (_, index) => Math.round((index - (count - 1) / 2) * spacing))
  }
  private searchPlayerSpawn(): THREE.Vector3 {
    if (this.activeKchMap) return this.searchBase('blue').multiplyScalar(this.mapScale)
    const base = this.searchBase('blue')
    const slots = this.searchLineOffsets()
    return new THREE.Vector3((base.x + slots[Math.floor((this.teamSize - 1) / 2)]!) * this.mapScale, 0, base.z * this.mapScale)
  }
  private searchBotSpawn(bot: Bot, teamIndex: number): THREE.Vector3 {
    if (this.activeKchMap) {
      const base = this.searchBase(bot.team)
      const spawns = this.searchBlueSideIsSouth() === (bot.team === 'blue') ? this.kchSpawnTeams.first : this.kchSpawnTeams.second
      if (!spawns.length) return base
      const freeSpawns = bot.team === 'blue' && spawns.length > 1 ? spawns.filter((_, index) => index !== this.centralSpawnIndex(spawns)) : spawns
      return freeSpawns[Math.abs(teamIndex) % freeSpawns.length]!.clone()
    }
    const base = this.searchBase(bot.team)
    const slots = this.searchLineOffsets(bot.team === 'blue' ? this.teamSize : this.teamSize)
    const slotIndex = bot.team === 'blue' ? teamIndex < Math.floor((this.teamSize - 1) / 2) ? teamIndex : teamIndex + 1 : teamIndex
    return new THREE.Vector3(base.x + slots[slotIndex]!, 0, base.z)
  }
  private searchTimeLeft(): number {
    if (this.roundBreak > 0) return this.roundBreak
    if (this.roundClock < SEARCH_ROUND.buySeconds) return SEARCH_ROUND.buySeconds - this.roundClock
    if (this.chargePlanted) return this.chargeTimer
    return Math.max(0, SEARCH_ROUND.liveSeconds - (this.roundClock - SEARCH_ROUND.buySeconds))
  }
  private searchRoundPhase(): GameSnapshot['roundPhase'] {
    if (this.roundBreak > 0) return 'post'
    if (this.roundClock < SEARCH_ROUND.buySeconds) return 'buy'
    return this.chargePlanted ? 'planted' : 'live'
  }
  private resetSearchRound(): void {
    this.playerDeadUntil = 0; this.run.health = 100; this.run.armor = 50; this.teleport(this.playerSpawn())
    this.yaw = this.searchBlueSideIsSouth() ? Math.PI : 0
    if (this.activeKchMap && this.kchSpawnTeams.first.length && this.kchSpawnTeams.second.length) {
      const to = this.searchBase('red')
      // Three.js cameras look down local -Z. Use the target delta directly so
      // the first-person camera faces the opposite team instead of turning away.
      this.yaw = this.openFacingYaw(this.player.root.position.clone().multiplyScalar(1 / this.mapScale), to)
    }
    this.chargePlanted = false; this.chargeTimer = 0; this.plantProgress = 0; this.defuseProgress = 0; this.plantSite = (this.round - 1) % 2
    this.playerSpawnProtectedUntil = this.matchTime + SEARCH_ROUND.buySeconds + SEARCH_ROUND.spawnShieldSeconds
    const blueCount = this.teamSize - 1
    for (const bot of this.bots.slice(0, this.activeBotCount)) {
      const teamIndex = bot.team === 'blue' ? bot.id : bot.id - blueCount
      bot.spawn.copy(this.searchBotSpawn(bot, teamIndex)); bot.alive = true; bot.health = 100; bot.root.visible = true; bot.respawnAt = 0; bot.root.position.copy(this.botSpawn(bot)); bot.spawnProtectedUntil = this.playerSpawnProtectedUntil
    }
  }
  start(matchType: MatchType = this.matchType, mapId: MapId = this.mapId, difficulty: BotDifficulty = this.difficulty, settings: MatchSettings = {}): void {
    const previousCustomMap = this.activeCustomMap
    this.activeCustomMap = settings.customMap ? validateCustomMap(settings.customMap) : null
    this.arenaRoot.visible = true
    this.matchType = matchType
    this.difficulty = difficulty
    this.royalePlayers = settings.royalePlayers === 30 || settings.royalePlayers === 50 || settings.royalePlayers === 100 ? settings.royalePlayers : 60
    this.teamSize = settings.teamSize === 1 || settings.teamSize === 4 ? settings.teamSize : 5
    const teamMode = ['tdm', 'domination', 'hardpoint', 'ctf', 'search'].includes(matchType)
    // The arena is scaled relative to the player, so these values are what make
    // a map feel roomy: 0.82 crossed a match arena in about four seconds.
    this.mapScale = matchType === 'training' ? 0.9 : teamMode ? (this.teamSize === 1 ? 0.62 : this.teamSize === 4 ? 0.85 : 1) : matchType === 'ffa' || matchType === 'gungame' ? 1 : 1.15
    this.arenaRoot.scale.setScalar(this.mapScale)
    this.activeBotCount = matchType === 'training' ? 6 : matchType === 'ffa' || matchType === 'gungame' ? 8 : matchType === 'royale' ? this.royalePlayers - 1 : teamMode ? this.teamSize * 2 - 1 : 6
    this.objective = ({ gungame: 'ELIMINATE YOUR WAY THROUGH SEVEN WEAPONS', ffa: 'FIRST TO 12 ELIMINATIONS', tdm: 'FIRST TEAM TO 16 ELIMINATIONS', royale: 'BE THE LAST OPERATOR STANDING', training: 'MOVING TARGET PRACTICE', domination: 'CAPTURE AND HOLD THREE ZONES', hardpoint: 'CONTROL THE ROTATING HARDPOINT', ctf: 'STEAL THE ENEMY STANDARD', search: 'PLANT OR DEFUSE THE RELIC CHARGE' } satisfies Record<MatchType, string>)[matchType]
    if (mapId !== this.mapId || previousCustomMap || this.activeCustomMap) { this.mapId = mapId; this.buildArena() }
    this.matchTime = 0; this.blueScore = 0; this.redScore = 0; this.botScoreTimer = 8; this.stormDamageTimer = 0; this.battleSimTimer = 1.3; this.objectiveClock = 1; this.objectiveRotation = 0; this.zoneOwners.fill(null); this.zoneProgress.fill(0); this.flagCarried = false; this.flagScoreClock = 0; this.round = 1; this.roundClock = 0; this.roundBreak = 0; this.chargePlanted = false; this.chargeTimer = 0; this.plantProgress = 0; this.defuseProgress = 0; this.plantSite = 0; this.pendingSearchResult = null; this.playerSpawnProtectedUntil = 0
    this.objectiveMarkers.forEach((marker, index) => { marker.visible = matchType === 'domination' ? index < 3 : matchType === 'hardpoint' ? index === 0 : matchType === 'ctf' ? index >= 3 : matchType === 'search' ? index === 0 || index === 2 : false })
    const relicsEnabled = matchType === 'ffa' || matchType === 'royale' || matchType === 'training'
    this.relics.forEach(({ mesh }) => { mesh.visible = relicsEnabled }); if (this.grenadeProjectile) { this.grenadeProjectile.mesh.removeFromParent(); this.grenadeProjectile.mesh.geometry.dispose(); (this.grenadeProjectile.mesh.material as THREE.Material).dispose(); this.grenadeProjectile = null } this.grenadeCount = 0; this.inspectTime = 0; this.spectatorIndex = 0; this.activeSlot = 0; this.currentWeapon = matchType === 'gungame' ? GUN_GAME_ORDER[0]! : this.selectedPrimaryBase(); this.slideLeft = 0; this.ammo = WEAPONS[this.currentWeapon].magazine; this.reloadLeft = 0; this.playerDeadUntil = 0; this.run = this.newRun(); this.teleport(this.playerSpawn()); this.yaw = Math.PI
    if (this.activeKchMap && this.kchSpawnTeams.first.length && this.kchSpawnTeams.second.length) {
      const ownSpawn = this.centralSpawn(this.kchSpawnTeams.first)
      const rivalSpawn = this.centralSpawn(this.kchSpawnTeams.second)
      if (ownSpawn && rivalSpawn) this.yaw = this.openFacingYaw(this.player.root.position.clone().multiplyScalar(1 / this.mapScale), rivalSpawn)
      else this.yaw = this.kchPlayerYaw
    }
    this.pitch = this.mapId === 'pool' ? -0.18 : 0; this.updateViewModel()
    this.updateLobbyPreviewSkin()
    if (this.lobbyPreview) this.lobbyPreview.visible = false
    const activeCount = this.activeBotCount
    this.bots.forEach((bot, i) => {
      bot.team = teamMode && i < this.teamSize - 1 ? 'blue' : 'red'
      const allyCount = teamMode ? this.teamSize - 1 : 0
      const spawnIndex = bot.team === 'blue' ? i : i - allyCount
      const spawnCount = bot.team === 'blue' ? allyCount : this.activeBotCount - allyCount
      const angle = teamMode
        ? (bot.team === 'blue' ? Math.PI : 0) + (spawnIndex / Math.max(1, spawnCount - 1) - 0.5) * 0.82
        : i / Math.max(1, this.activeBotCount) * Math.PI * 2
      const radius = 16 + (i % 3) * 1.2
      bot.spawn.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius)
      const customSpawnPoints = this.activeCustomMap?.markers.filter(marker => marker.kind === 'bot-spawn') ?? []
      if (customSpawnPoints.length) { const point = customSpawnPoints[i % customSpawnPoints.length]!; bot.spawn.set(point.x, 0, point.z) }
      else if (this.activeKchMap) {
        const available = teamMode ? (bot.team === 'blue' ? this.kchSpawnTeams.first : this.kchSpawnTeams.second) : [...this.kchSpawnTeams.first, ...this.kchSpawnTeams.second]
        if (available.length) {
          const spawnPool = teamMode && bot.team === 'blue' && available.length > 1 ? available.filter((_, index) => index !== this.centralSpawnIndex(available)) : available
          bot.spawn.copy(spawnPool[Math.abs(spawnIndex) % spawnPool.length]!)
        }
      }
      bot.alive = i < activeCount; bot.root.visible = bot.alive; bot.health = 100; bot.respawnAt = 0; bot.stormTime = 0; bot.kills = 0; bot.deaths = 0; bot.root.position.copy(this.botSpawn(bot)); bot.nextShot = 1.1 + i * 0.16
      const teamColor = teamMode && bot.team === 'blue' ? '#4e9ce0' : '#cb6657';
      (bot.teamMarker.material as THREE.MeshLambertMaterial).color.set(teamColor)
      for (const mesh of [bot.hitMeshes[0], bot.hitMeshes[2], bot.hitMeshes[3]]) if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshLambertMaterial) mesh.material.color.set(teamColor)
    })
    if (matchType === 'search') this.resetSearchRound()
    this.run.aliveBots = activeCount
    this.mode = 'playing'; this.input.endFrame(); this.input.takeLook()
    this.resetInterpolation()
    const brief = ({ gungame: 'GUN GAME // SEVEN-WEAPON LADDER', ffa: 'FREE FOR ALL', tdm: 'TEAM DEATHMATCH', royale: `${this.royalePlayers}-OPERATOR FRONTIER ROYALE`, training: 'AIM RANGE', domination: 'DOMINATION', hardpoint: 'HARDPOINT', ctf: 'CAPTURE THE STANDARD', search: 'RELIC SEARCH & DEFUSE' } satisfies Record<MatchType, string>)[matchType]
    const actionKey = matchType === 'search' || matchType === 'ctf' ? 'E INTERACT' : 'E DASH'
    this.hooks.banner(`${brief} // WASD MOVE · SHIFT SPRINT · CTRL+SHIFT SLIDE · SPACE JUMP · ${actionKey} · CLICK TO AIM`)
  }
  restart(): void {
    this.start(this.matchType, this.mapId, this.difficulty, {
      royalePlayers: this.royalePlayers,
      teamSize: this.teamSize,
      ...(this.activeCustomMap ? { customMap: this.activeCustomMap } : {}),
    })
  }
  pause(): void { if (this.mode === 'playing') this.mode = 'paused' }
  resume(): void { if (this.mode !== 'paused') return; this.mode = 'playing'; this.input.endFrame(); this.input.takeLook() }
  toTitle(): void { this.mode = 'attract'; this.scene.background = new THREE.Color('#1d4b9b'); this.scene.fog = null; this.yaw = 0; this.pitch = 0; this.teleport(new THREE.Vector3()); this.arenaRoot.visible = false; this.bots.forEach(bot => { bot.root.visible = false }); if (this.lobbyPreview) this.lobbyPreview.visible = true; this.run = this.newRun() }
  private handleGrenade(): void { if (!this.input.consume('grenade') || this.matchType !== 'search' || this.roundClock < SEARCH_ROUND.buySeconds || this.roundBreak > 0 || this.playerDeadUntil || this.grenadeCount <= 0 || this.grenadeProjectile) return; this.grenadeCount -= 1; const geometry = new THREE.IcosahedronGeometry(0.16, 0); const material = new THREE.MeshStandardMaterial({ color: '#ffffff', map: this.weaponFinishTexture('#bf6947', 'field-grenade', 4), emissive: '#3d1207', roughness: 0.78 }); const mesh = new THREE.Mesh(geometry, material); const direction = new THREE.Vector3(Math.sin(this.yaw), 0.3, -Math.cos(this.yaw)).normalize(); mesh.position.copy(this.cameraInternal.position).addScaledVector(direction, 0.7); this.scene.add(mesh); this.grenadeProjectile = { mesh, velocity: direction.multiplyScalar(14).add(new THREE.Vector3(0, 3, 0)), fuse: 1.25 }; this.audio.play('plant', mesh.position) }
  private stepGrenade(dt: number): void { const projectile = this.grenadeProjectile; if (!projectile) return; projectile.fuse -= dt; projectile.velocity.y -= 10 * dt; projectile.mesh.position.addScaledVector(projectile.velocity, dt); if (projectile.mesh.position.y < 0.18) { projectile.mesh.position.y = 0.18; projectile.velocity.y = Math.abs(projectile.velocity.y) * 0.42; projectile.velocity.x *= 0.72; projectile.velocity.z *= 0.72 } if (projectile.fuse > 0) return; const point = projectile.mesh.position.clone(); for (const bot of this.bots) { if (!bot.alive || bot.id >= this.activeBotCount || this.matchType === 'search' && this.matchTime < bot.spawnProtectedUntil) continue; const distance = bot.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)).distanceTo(point); if (distance > 7) continue; const damage = 120 * (1 - distance / 8); bot.health -= damage; this.run.hits += 1; this.hooks.popup(`${Math.round(damage)} FRAG`, this.project(bot.root.position.clone().add(new THREE.Vector3(0, 1.2, 0))), 'score'); if (bot.health <= 0) this.killBot(bot, false) } this.audio.play('plant', point); projectile.mesh.removeFromParent(); projectile.mesh.geometry.dispose(); (projectile.mesh.material as THREE.Material).dispose(); this.grenadeProjectile = null }
  setQuality(quality: 'low' | 'medium' | 'high'): void { this.renderer.applyQuality(quality) }
  setFov(fov: number): void { this.baseFov = THREE.MathUtils.clamp(fov, 70, 110); this.cameraInternal.fov = this.baseFov; this.cameraInternal.updateProjectionMatrix() }
  private playerSpawn(): THREE.Vector3 {
    if (this.matchType === 'search') {
      const spawn = this.searchPlayerSpawn()
      return this.activeKchMap ? this.clearPlayerSpawn(spawn.clone().multiplyScalar(1 / this.mapScale)) : spawn
    }
    const marker = this.activeCustomMap?.markers.find(item => item.kind === 'player-spawn')
    if (marker) return new THREE.Vector3(marker.x, 0, marker.z).multiplyScalar(this.mapScale)
    const spawn = this.activeKchMap ? this.centralSpawn(this.kchSpawnTeams.first) : undefined
    if (spawn) return this.clearPlayerSpawn(spawn)
    return new THREE.Vector3(0, 0, -26 * this.mapScale)
  }
  private resetInterpolation(): void {
    this.previousPlayerPosition.copy(this.player.root.position)
    this.interpolatedPlayerPosition.copy(this.player.root.position)
    this.previousCameraBobY = this.cameraBobY
    this.previousCameraLanding = this.cameraLanding
    for (const bot of this.bots) {
      const previous = this.previousBotPositions.get(bot) ?? new THREE.Vector3()
      previous.copy(bot.root.position)
      this.previousBotPositions.set(bot, previous)
      const renderPosition = this.renderBotPositions.get(bot) ?? new THREE.Vector3()
      renderPosition.copy(bot.root.position)
      this.renderBotPositions.set(bot, renderPosition)
      this.previousBotYaw.set(bot, bot.root.rotation.y)
      this.renderBotYaw.set(bot, bot.root.rotation.y)
    }
  }
  private captureInterpolationState(): void {
    this.previousPlayerPosition.copy(this.player.root.position)
    this.previousCameraBobY = this.cameraBobY
    this.previousCameraLanding = this.cameraLanding
    for (const bot of this.bots) {
      this.previousBotPositions.get(bot)?.copy(bot.root.position)
      this.previousBotYaw.set(bot, bot.root.rotation.y)
    }
  }
  private teleport(position: THREE.Vector3): void { this.player.root.position.copy(position); this.previousPlayerPosition.copy(position); this.interpolatedPlayerPosition.copy(position); this.verticalVelocity = 0; this.horizontalVelocity.set(0, 0, 0); this.dashLeft = 0; this.dashCooldownLeft = 0; this.cameraBobY = 0; this.previousCameraBobY = 0; this.cameraLanding = 0; this.previousCameraLanding = 0 }
  step(dt: number): void {
    if (this.mode !== 'playing') return
    this.captureInterpolationState()
    this.matchTime += dt; this.run.elapsed = this.matchTime; this.run.timeLeft = this.matchType === 'search' ? this.searchTimeLeft() : Math.max(0, (this.matchType === 'royale' ? 360 : this.matchType === 'training' ? 0 : 240) - this.matchTime); this.reloadLeft = Math.max(0, this.reloadLeft - dt); this.fireCooldown = Math.max(0, this.fireCooldown - dt); this.recoil = Math.max(0, this.recoil - dt * 4); this.flash = Math.max(0, this.flash - dt)
    this.updateAimHighlight(dt)
    this.handleWeaponInput(); if (this.playerDeadUntil === Number.POSITIVE_INFINITY && this.input.consume('spectate')) this.cycleSpectator(); if (this.input.consume('ping')) this.hooks.banner(`SQUAD PING // GRID ${Math.round(this.player.root.position.x + 30)}:${Math.round(this.player.root.position.z + 30)}`); this.handleMovement(dt); this.stepFootsteps(dt); this.stepRelics(dt); this.handleReload(dt); this.handleFire(); this.stepGrenade(dt); this.handleGrenade(); this.stepBots(dt)
    if (this.matchType === 'tdm') this.stepTeamScore(dt)
    if (this.matchType === 'royale') this.stepRoyale(dt)
    if (this.matchType === 'domination' || this.matchType === 'hardpoint') this.stepControlMode(dt)
    if (this.matchType === 'ctf') this.stepCaptureTheFlag(dt)
    if (this.matchType === 'search') this.stepSearch(dt)
    if (this.matchType === 'search') this.run.timeLeft = this.searchTimeLeft()
    if (this.playerDeadUntil && this.matchType !== 'royale' && this.matchTime >= this.playerDeadUntil) { this.run.health = 100; this.run.armor = 50; this.playerDeadUntil = 0; this.teleport(this.playerSpawn()); this.hooks.banner('RESPAWN // BACK IN THE FIGHT') }
    if (this.matchType === 'gungame' && this.run.kills >= GUN_GAME_ORDER.length) this.finish('won')
    else if (this.matchType === 'ffa' && this.run.kills >= 12) this.finish('won')
    else if ((this.matchType === 'tdm' && this.blueScore >= 16) || ((this.matchType === 'domination' || this.matchType === 'hardpoint') && this.blueScore >= 100) || (this.matchType === 'ctf' && this.blueScore >= 3)) this.finish('won')
    else if ((this.matchType === 'tdm' && this.redScore >= 16) || ((this.matchType === 'domination' || this.matchType === 'hardpoint') && this.redScore >= 100) || (this.matchType === 'ctf' && this.redScore >= 3)) this.finish('lost')
    else if (this.matchType === 'royale' && this.run.aliveBots <= 0 && !this.playerDeadUntil) this.finish('won')
    else if (this.run.timeLeft <= 0 && this.matchType !== 'training' && this.matchType !== 'search') this.finish(this.blueScore > this.redScore || (this.matchType === 'ffa' && this.run.kills > Math.max(...this.bots.map(bot => bot.kills))) ? 'won' : 'lost')
    this.run.crosshairBloom = Math.max(2, Math.min(16, 2 + Math.hypot(this.horizontalVelocity.x, this.horizontalVelocity.z) * 0.36 + this.recoil * 22 - (this.input.held('ads') ? 2 : 0))); this.run.grenades = this.grenadeCount; this.run.spectating = this.playerDeadUntil === Number.POSITIVE_INFINITY && this.matchType === 'search'; this.run.ammo = this.ammo; this.run.reload = this.reloadLeft; this.run.weapon = this.currentWeapon; this.run.weaponName = this.activeWeaponName(); this.run.aimed = this.input.held('ads'); this.run.accuracy = this.run.shots ? this.run.hits / this.run.shots : 0; this.run.scoreboard = this.scoreboard(); this.run.round = this.round; this.run.roundPhase = this.matchType === 'search' ? this.searchRoundPhase() : 'live'; this.run.spawnProtection = this.matchType === 'search' && this.roundBreak === 0 && this.roundClock >= SEARCH_ROUND.buySeconds && !this.playerDeadUntil ? Math.max(0, Math.min(SEARCH_ROUND.spawnShieldSeconds, this.playerSpawnProtectedUntil - this.matchTime)) : 0
  }
  private stepFootsteps(dt: number): void {
    this.footstepTimer = Math.max(0, this.footstepTimer - dt)
    const speed = Math.hypot(this.horizontalVelocity.x, this.horizontalVelocity.z)
    const position = this.player.root.position
    const supported = Math.abs(position.y - this.supportHeight(position)) < 0.08 && this.verticalVelocity <= 0.1
    if (!supported || speed < 2 || this.footstepTimer > 0) return
    const origin = position.clone().add(new THREE.Vector3(0, 0.22, 0))
    this.visionRaycaster.set(origin, new THREE.Vector3(0, -1, 0)); this.visionRaycaster.far = 0.7
    const surfaceObject = this.visionRaycaster.intersectObjects(this.arenaRoot.children, true)[0]?.object
    this.visionRaycaster.far = Infinity
    const surface = surfaceObject?.userData.surfaceType
    const material = surface === 'metal' || surface === 'wood' || surface === 'gravel' || surface === 'grass' ? surface : 'concrete'
    this.audio.playFootstep(material, position, Math.min(1.2, speed / 8))
    this.footstepTimer = speed > 8 ? 0.34 : 0.48
  }
  private stepRelics(dt: number): void { if (!['ffa', 'royale', 'training'].includes(this.matchType)) return; for (const relic of this.relics) { if (!relic.mesh.visible) continue; relic.mesh.rotation.y += dt * 1.5; relic.mesh.position.y = Number(relic.mesh.userData.baseY) + Math.sin(this.matchTime * 2.2 + relic.at.x) * 0.12; if (this.player.root.position.distanceTo(this.worldPoint(relic.at)) < 1.7) { relic.mesh.visible = false; this.audio.play('pickup'); this.addXp(40); this.save.update({ credits: this.save.data.credits + 35 }); this.hooks.banner(`${this.mapName()} RELIC FOUND // +40 XP · +35 CR`) } } }
  private handleWeaponInput(): void { if (this.matchType === 'gungame') { this.input.takeWeaponWheel(); for (let i = 0; i < 7; i += 1) this.input.consume(`weapon${i + 1}` as Parameters<Input['consume']>[0]); if (this.input.consume('inspect')) { this.inspectTime = 2.6; this.hooks.banner(`${WEAPONS[this.currentWeapon].name} // INSPECTING`) } return } if (this.input.consume('inspect')) { this.inspectTime = 2.6; this.audio.play('ui'); this.hooks.banner(`${WEAPONS[this.currentWeapon].name} // INSPECTING`) } const wheel = this.input.takeWeaponWheel(); if (wheel) this.switchWeapon((this.activeSlot + wheel + 6) % 3); for (let i = 0; i < 3; i += 1) if (this.input.consume(`weapon${i + 1}` as Parameters<Input['consume']>[0])) this.switchWeapon(i); if (this.input.consume('inspect')) this.hooks.banner(`${WEAPONS[this.currentWeapon].name} // ${this.currentWeapon === 'knife' ? KNIFE_SKINS.find(s => s.id === this.save.data.knifeSkinId)?.name ?? 'FIELD SHARD' : armoryGun(this.currentWeapon === this.selectedHandgunBase() ? this.save.data.handgunGunId : this.save.data.primaryGunId).name}`) }
  private switchWeapon(index: number): void { const ids = [this.selectedPrimaryBase(), this.selectedHandgunBase(), 'knife' as WeaponId]; const id = ids[index]; if (!id || (id === this.currentWeapon && this.activeSlot === index) || this.reloadLeft > 0) return; this.activeSlot = index as 0 | 1 | 2; this.currentWeapon = id; this.ammo = WEAPONS[id].magazine; this.reloadLeft = 0; this.updateViewModel(); this.audio.play('ui') }
  private collisionAt(position: THREE.Vector3): { top: number; bottom: number } | undefined {
    const radius = 0.38 * this.mapScale
    if (this.activeKchMap) {
      const localX = position.x / this.mapScale, localZ = position.z / this.mapScale
      const cellSize = this.kchCellScale
      const gx = Math.round(localX / cellSize + this.kchCenterX), gz = Math.round(localZ / cellSize + this.kchCenterZ)
      const reach = Math.ceil(0.38 / cellSize) + 1
      for (let x = gx - reach; x <= gx + reach; x += 1) for (let z = gz - reach; z <= gz + reach; z += 1) {
        const centerX = (x - this.kchCenterX) * cellSize, centerZ = (z - this.kchCenterZ) * cellSize
        if (Math.abs(localX - centerX) >= cellSize / 2 + 0.38 || Math.abs(localZ - centerZ) >= cellSize / 2 + 0.38) continue
        for (const cell of this.kchColumns.get(`${x},${z}`) ?? []) {
          const bottom = cell.bottom * this.mapScale, top = cell.top * this.mapScale
          if (position.y + 1.7 > bottom + 0.05 && position.y < top - 0.04) return { top, bottom }
        }
      }
      return undefined
    }
    for (const mesh of this.obstacles) {
      const size = mesh.userData.colliderSize as THREE.Vector3 | undefined
      if (!size) continue
      const halfX = size.x * this.mapScale / 2 + radius
      const halfZ = size.z * this.mapScale / 2 + radius
      if (Math.abs(position.x - mesh.position.x * this.mapScale) >= halfX || Math.abs(position.z - mesh.position.z * this.mapScale) >= halfZ) continue
      const bottom = (mesh.position.y - size.y / 2) * this.mapScale
      const top = (mesh.position.y + size.y / 2) * this.mapScale
      if (position.y + 1.7 > bottom + 0.05 && position.y < top - 0.04) return { top, bottom }
    }
    return undefined
  }

  private supportHeight(position: THREE.Vector3): number {
    const radius = 0.38 * this.mapScale
    if (this.activeKchMap) {
      const localX = position.x / this.mapScale, localZ = position.z / this.mapScale
      const cellSize = this.kchCellScale
      const gx = Math.round(localX / cellSize + this.kchCenterX), gz = Math.round(localZ / cellSize + this.kchCenterZ)
      const reach = Math.ceil(0.38 / cellSize) + 1
      let height = Number.NEGATIVE_INFINITY
      for (let x = gx - reach; x <= gx + reach; x += 1) for (let z = gz - reach; z <= gz + reach; z += 1) {
        const centerX = (x - this.kchCenterX) * cellSize, centerZ = (z - this.kchCenterZ) * cellSize
        if (Math.abs(localX - centerX) >= cellSize / 2 + 0.38 || Math.abs(localZ - centerZ) >= cellSize / 2 + 0.38) continue
        for (const cell of this.kchColumns.get(`${x},${z}`) ?? []) {
          const top = cell.top * this.mapScale
          if (top <= position.y + 0.16 && top > height) height = top
        }
      }
      return Number.isFinite(height) ? height : 0
    }
    let height = 0
    for (const mesh of this.obstacles) {
      const size = mesh.userData.colliderSize as THREE.Vector3 | undefined
      if (!size) continue
      if (Math.abs(position.x - mesh.position.x * this.mapScale) >= size.x * this.mapScale / 2 + radius || Math.abs(position.z - mesh.position.z * this.mapScale) >= size.z * this.mapScale / 2 + radius) continue
      const top = (mesh.position.y + size.y / 2) * this.mapScale
      if (top <= position.y + 0.16 && top > height) height = top
    }
    return height
  }

  private handleMovement(dt: number): void {
    const dashPressed = this.input.consume('dash')
    if (this.playerDeadUntil) return
    if (this.matchType === 'search' && (this.roundClock < SEARCH_ROUND.buySeconds || this.roundBreak > 0)) { this.horizontalVelocity.set(0, 0, 0); this.verticalVelocity = 0; this.slideLeft = 0; this.dashLeft = 0; this.input.consume('jump'); return }
    this.slideLeft = Math.max(0, this.slideLeft - dt)
    this.dashLeft = Math.max(0, this.dashLeft - dt)
    this.dashCooldownLeft = Math.max(0, this.dashCooldownLeft - dt)
    const weapon = WEAPONS[this.currentWeapon]
    const crouching = this.input.held('crouch') && !this.slideLeft
    const grounded = Math.abs(this.player.root.position.y - this.supportHeight(this.player.root.position)) < 0.08 && this.verticalVelocity <= 0.1
    const wantsSlide = this.input.held('crouch') && this.input.held('sprint') && grounded && this.input.move.y > 0.15 && this.slideLeft <= 0.01
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    if (wantsSlide) {
      this.slideLeft = 0.62
      this.slideDirection.copy(forward).multiplyScalar(this.input.move.y).addScaledVector(right, this.input.move.x).normalize()
      this.audio.play('dash')
    }
    const wish = forward.multiplyScalar(this.input.move.y).addScaledVector(right, this.input.move.x)
    if (wish.lengthSq() > 1) wish.normalize()
    if (dashPressed && this.dashCooldownLeft <= 0 && this.matchType !== 'search' && this.matchType !== 'ctf' && this.slideLeft <= 0) {
      this.dashDirection.copy(wish.lengthSq() > 0.0025 ? wish : forward).normalize()
      this.dashLeft = 0.18
      this.dashCooldownLeft = 0.85
      this.audio.play('dash')
    }
    const speed = (this.input.held('sprint') ? 10.8 : 8) * weapon.movement * (this.input.held('ads') ? 0.72 : 1) * (crouching ? 0.58 : 1)
    if (this.dashLeft > 0) {
      this.horizontalVelocity.copy(this.dashDirection).multiplyScalar(18)
    } else if (this.slideLeft > 0) {
      const slideSpeed = 8 + 4 * Math.min(1, this.slideLeft / 0.62)
      this.horizontalVelocity.lerp(this.slideDirection.clone().multiplyScalar(slideSpeed), 1 - Math.exp(-3.5 * dt))
    } else if (wish.lengthSq() > 0.0025) {
      const targetVelocity = wish.multiplyScalar(speed)
      const reversing = this.horizontalVelocity.x * targetVelocity.x + this.horizontalVelocity.z * targetVelocity.z < 0
      const acceleration = grounded ? (reversing ? 24 : 16.5) : 6
      this.horizontalVelocity.lerp(targetVelocity, 1 - Math.exp(-acceleration * dt))
    } else {
      // Stop cleanly on the ground, but preserve air speed for strafes and bunny hops.
      const drag = grounded ? 8.5 : 0.18
      this.horizontalVelocity.multiplyScalar(Math.exp(-drag * dt))
    }
    const move = this.horizontalVelocity.clone().multiplyScalar(dt)
    const jumpPressed = this.input.consume('jump')
    const jumpRequested = jumpPressed || this.input.held('jump')
    const wasGrounded = Math.abs(this.player.root.position.y - this.supportHeight(this.player.root.position)) < 0.08 && this.verticalVelocity <= 0.1
    const moveAxis = (axis: 'x' | 'z', amount: number): void => {
      if (!amount) return
      const candidate = this.player.root.position.clone()
      candidate[axis] += amount
      candidate.x = THREE.MathUtils.clamp(candidate.x, -this.arenaHalfExtent * this.mapScale, this.arenaHalfExtent * this.mapScale)
      candidate.z = THREE.MathUtils.clamp(candidate.z, -this.arenaHalfExtent * this.mapScale, this.arenaHalfExtent * this.mapScale)
      const hit = this.collisionAt(candidate)
      if (hit) {
        const rise = hit.top - this.player.root.position.y
        if (jumpRequested && wasGrounded && rise > 0.08 && rise <= 2.25 * this.mapScale) {
          candidate.y = hit.top
          this.player.root.position.copy(candidate)
          this.verticalVelocity = 0
          this.audio.play('jump')
        }
        this.horizontalVelocity[axis] = 0
        return
      }
      this.player.root.position[axis] = candidate[axis]
    }
    moveAxis('x', move.x)
    moveAxis('z', move.z)
    if (jumpRequested && wasGrounded && this.player.root.position.y <= this.supportHeight(this.player.root.position) + 0.03) {
      this.verticalVelocity = 7.2
      this.audio.play('jump')
    }
    this.verticalVelocity -= 21 * dt
    const nextY = this.player.root.position.y + this.verticalVelocity * dt
    const floor = this.supportHeight(this.player.root.position)
    if (this.verticalVelocity <= 0 && nextY <= floor) {
      if (this.player.root.position.y > floor + 0.03 && this.verticalVelocity < -1) this.cameraLanding = -Math.min(0.15, -this.verticalVelocity * 0.008)
      this.player.root.position.y = floor
      this.verticalVelocity = 0
    } else {
      this.player.root.position.y = Math.max(floor, nextY)
    }
    const moveSpeed = Math.hypot(this.horizontalVelocity.x, this.horizontalVelocity.z)
    this.bobPhase += dt * (5 + moveSpeed * 1.05)
    this.cameraBobY = THREE.MathUtils.damp(this.cameraBobY, grounded ? Math.sin(this.bobPhase) * Math.min(0.025, moveSpeed * 0.0027) : 0, 14, dt)
    this.cameraLanding = THREE.MathUtils.damp(this.cameraLanding, 0, 17, dt)
  }

  private handleReload(dt: number): void { if (this.reloadLeft <= 0 && this.input.consume('reload') && this.ammo < WEAPONS[this.currentWeapon].magazine) { this.reloadLeft = WEAPONS[this.currentWeapon].reload; this.reloadDuration = this.reloadLeft; this.audio.play('reload', this.player.root.position) } if (this.reloadLeft > 0 && this.reloadLeft <= dt) this.ammo = WEAPONS[this.currentWeapon].magazine }
  private handleFire(): void {
    const weapon = WEAPONS[this.currentWeapon]
    // Preserve a tap that starts and ends between fixed simulation steps. Semi-
    // automatic weapons fire once per press; automatic weapons continue while held.
    const triggerPressed = this.input.consume('shoot')
    const firing = weapon.automatic ? this.input.held('shoot') || triggerPressed : triggerPressed
    if ((this.matchType === 'search' && (this.roundClock < SEARCH_ROUND.buySeconds || this.roundBreak > 0)) || this.reloadLeft > 0 || this.playerDeadUntil || !firing || this.fireCooldown > 0) return
    if (this.ammo <= 0) { this.audio.play('empty'); this.fireCooldown = 0.18; return }
    this.ammo -= 1; this.run.shots += 1; this.fireCooldown = 1 / weapon.fireRate
    this.recoil = weapon.recoil; this.viewSpringVelocity.x += (Math.random() - 0.5) * weapon.recoil * 0.7; this.viewSpringVelocity.y -= weapon.recoil * 0.22; this.viewSpringVelocity.z += weapon.recoil * 1.8; this.flash = 1 / 60
    this.audio.play('gunshot', { x: this.player.root.position.x, y: this.player.root.position.y + 1.3, z: this.player.root.position.z })
    const spread = weapon.spread * (this.input.held('ads') ? 0.25 : 1) * (1 + this.run.shots % 4 * 0.08)
    this.raycaster.setFromCamera(new THREE.Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread), this.cameraInternal)
    const hit = this.raycaster.intersectObjects(this.hitTargets, false)[0]
    if (!hit || hit.distance > weapon.range) return
    const wall = this.raycaster.intersectObjects(this.arenaRoot.children, true)[0]
    if (wall && wall.distance + 0.02 < hit.distance) return
    const botId = hit.object.userData.botId as number
    const bot = this.bots.find(item => item.id === botId)
    if (!bot || !bot.alive || this.matchType === 'search' && this.matchTime < bot.spawnProtectedUntil || (['tdm', 'domination', 'hardpoint', 'ctf', 'search'].includes(this.matchType) && bot.team === 'blue')) return
    const zone = hit.object.userData.zone as 'head' | 'body' | 'limb'
    const headshot = zone === 'head'
    const falloff = THREE.MathUtils.clamp((hit.distance - weapon.range * 0.55) / (weapon.range * 0.45), 0, 1)
    const zoneMultiplier = headshot ? weapon.headshot : zone === 'limb' ? 0.75 : 1
    const damage = weapon.damage * (1 - falloff * 0.4) * zoneMultiplier
    bot.health -= damage
    this.run.hits += 1; this.audio.play('hit'); this.hooks.hitmarker(headshot)
    this.hooks.popup(`${Math.round(damage)}${headshot ? ' HS' : ''}`, this.project(hit.point), 'score')
    if (bot.health <= 0) this.killBot(bot, headshot)
  }
  private killBot(bot: Bot, headshot: boolean): void { if (['tdm', 'domination', 'hardpoint', 'ctf', 'search'].includes(this.matchType) && bot.team === 'blue') return; bot.alive = false; bot.root.visible = false; bot.deaths += 1; bot.respawnAt = this.matchType === 'royale' || this.matchType === 'search' ? Number.POSITIVE_INFINITY : this.matchTime + RESPAWN_SECONDS; const eliminatedWith = this.currentWeapon; this.run.kills += 1; if (this.matchType === 'gungame' && this.run.kills < GUN_GAME_ORDER.length) { this.currentWeapon = GUN_GAME_ORDER[this.run.kills]!; this.activeSlot = this.currentWeapon === 'knife' ? 2 : 0; this.ammo = WEAPONS[this.currentWeapon].magazine; this.reloadLeft = 0; this.updateViewModel(); this.hooks.banner(`WEAPON ADVANCED // ${WEAPONS[this.currentWeapon].name}`) } const weaponKills = { ...this.save.data.weaponKills, [eliminatedWith]: (this.save.data.weaponKills[eliminatedWith] ?? 0) + 1 }; this.save.update({ weaponKills }); this.advanceDaily(headshot, bot); this.run.aliveBots = this.bots.filter(item => item.alive && item.id < this.activeBotCount).length; if (this.matchType === 'tdm') this.blueScore += 1; if (headshot) this.run.headshots += 1; this.run.score += headshot ? 150 : 100; this.save.update({ credits: this.save.data.credits + (this.matchType === 'search' ? 300 : 100) }); this.run.credits = this.save.data.credits; this.addXp(headshot ? 85 : 55); this.save.update({ stats: { ...this.save.data.stats, kills: this.save.data.stats.kills + 1, headshots: this.save.data.stats.headshots + (headshot ? 1 : 0) } }); this.hooks.killfeed(`YOU eliminated ${bot.name}`, headshot); this.checkAchievements() }
  private stepBots(dt: number): void {
    if (this.matchType === 'search' && (this.roundClock < SEARCH_ROUND.buySeconds || this.roundBreak > 0)) return
    const playerPos = this.player.root.position
    for (const bot of this.bots) {
      if (bot.id >= this.activeBotCount) continue
      if (!bot.alive) { if (this.matchType !== 'royale' && this.matchType !== 'search' && this.matchTime >= bot.respawnAt) { bot.alive = true; bot.health = 100; bot.root.visible = true; bot.root.position.copy(this.botSpawn(bot)) } continue }
      bot.phase += dt * (0.45 + bot.id * 0.04)
      const isAlly = ['tdm', 'domination', 'hardpoint', 'ctf', 'search'].includes(this.matchType) && bot.team === 'blue'
      const toPlayer = new THREE.Vector3(playerPos.x - bot.root.position.x, 0, playerPos.z - bot.root.position.z)
      const distance = toPlayer.length()
      const walking = this.matchType === 'training' || distance > 8
      bot.walking = walking
      if (bot.animation) {
        const action = walking ? bot.animation.move : bot.animation.idle
        if (action !== bot.animation.active) { bot.animation.active.fadeOut(0.18); action.reset().fadeIn(0.18).play(); bot.animation.active = action }
      }
      const groundedHeight = this.supportHeight(bot.root.position)
      bot.root.position.y = groundedHeight + (walking ? Math.max(0, Math.sin(bot.phase * 16)) * 0.035 : Math.sin(bot.phase * 2) * 0.008)
      if (isAlly && this.matchType === 'tdm' && this.playerDeadUntil) { if (distance > 1.7) { bot.root.position.x += toPlayer.x / Math.max(distance, 1) * dt * 4; bot.root.position.z += toPlayer.z / Math.max(distance, 1) * dt * 4 } else if (this.matchTime - this.playerDownedAt >= RESPAWN_SECONDS) { this.playerDeadUntil = 0; this.run.health = 55; this.run.armor = 20; this.teleport(playerPos.clone().add(new THREE.Vector3(1.1, 0, 1.1))); this.hooks.banner(`${bot.name} // REVIVED YOU`) } continue }
      if (this.matchType === 'training') { bot.root.position.x = bot.spawn.x * this.mapScale + Math.sin(bot.phase * 0.6) * 1.5 * this.mapScale; bot.root.position.z = bot.spawn.z * this.mapScale + Math.cos(bot.phase * 0.7) * 1.5 * this.mapScale; continue }
      if (this.matchType === 'search' && this.matchTime < bot.spawnProtectedUntil) {
        const markerMaterial = bot.teamMarker.material as THREE.MeshLambertMaterial
        markerMaterial.transparent = true; markerMaterial.opacity = 0.55; markerMaterial.emissive.set(bot.team === 'blue' ? '#2f9de2' : '#e45647'); markerMaterial.emissiveIntensity = 0.72
        continue
      }
      const markerMaterial = bot.teamMarker.material as THREE.MeshLambertMaterial
      markerMaterial.transparent = false; markerMaterial.opacity = 1; markerMaterial.emissive.set('#000000'); markerMaterial.emissiveIntensity = 0
      if (!isAlly && distance < 54 && !this.playerDeadUntil) {
        const targetYaw = Math.atan2(toPlayer.x, toPlayer.z)
        bot.root.rotation.y = interpolateAngle(bot.root.rotation.y, targetYaw, 1 - Math.exp(-12 * dt))
        if (this.matchTime >= bot.nextShot) {
          const reaction = { recruit: 1.35, regular: 0.95, veteran: 0.7, elite: 0.52 }[this.difficulty] * (0.88 + bot.style * 0.1)
          const aim = { recruit: 0.38, regular: 0.58, veteran: 0.72, elite: 0.84 }[this.difficulty] * (0.92 + bot.style * 0.045)
          bot.nextShot = this.matchTime + reaction + bot.id * 0.035
          this.audio.play('gunshot', { x: bot.root.position.x, y: bot.root.position.y + BOT_EYE_HEIGHT - 0.08, z: bot.root.position.z })
          if (Math.random() < Math.max(0.1, aim - distance * 0.012)) { const origin = bot.root.position.clone().add(new THREE.Vector3(0, BOT_EYE_HEIGHT, 0)); const direction = playerPos.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(origin); const distanceToTarget = direction.length(); this.visionRaycaster.set(origin, direction.normalize()); this.visionRaycaster.far = distanceToTarget; const obstruction = this.visionRaycaster.intersectObjects(this.arenaRoot.children, true)[0]; this.visionRaycaster.far = Infinity; if (!obstruction) this.damagePlayer(7 + bot.id % 3 * 2, bot) }
        }
        if (distance > 8) { const flank = bot.style === 1 ? Math.sin(bot.phase) * 0.8 : 0; bot.root.position.x += (toPlayer.x / Math.max(distance, 1) + flank) * dt * (2.4 + bot.style * 0.2); bot.root.position.z += toPlayer.z / Math.max(distance, 1) * dt * (2.4 + bot.style * 0.2) }
      } else {
        bot.root.position.x = bot.spawn.x * this.mapScale + Math.sin(bot.phase) * 4.2 * this.mapScale
        bot.root.position.z = bot.spawn.z * this.mapScale + Math.cos(bot.phase * 0.8) * 3.8 * this.mapScale
      }
      if (isAlly) {
        const dx = bot.root.position.x - playerPos.x, dz = bot.root.position.z - playerPos.z
        const separation = Math.hypot(dx, dz)
        if (separation < 2.8) {
          const angle = separation > 0.001 ? Math.atan2(dz, dx) : bot.id * 2.399
          const push = Math.min(0.12, (2.8 - separation) * dt * 5)
          bot.root.position.x += Math.cos(angle) * push
          bot.root.position.z += Math.sin(angle) * push
        }
      }
      for (const child of bot.root.children) if (child instanceof THREE.Mesh && child.userData.zone === 'head') child.rotation.y = Math.sin(this.matchTime * 2 + bot.id) * 0.15
    }
  }
  private stepTeamScore(dt: number): void {
    this.botScoreTimer -= dt
    if (this.botScoreTimer > 0) return
    this.botScoreTimer = 7.5 + Math.random() * 4
    const blueScores = Math.random() > 0.5
    const team = this.bots.filter(bot => bot.alive && bot.team === (blueScores ? 'blue' : 'red'))
    const bot = team[Math.floor(Math.random() * team.length)]
    if (!bot) return
    bot.kills += 1
    if (blueScores) { this.blueScore += 1; this.hooks.killfeed(`BLUE SQUAD +1 // BOT-${String(bot.id + 1).padStart(2, '0')}`, false) }
    else { this.redScore += 1; this.hooks.killfeed(`RED SQUAD +1 // BOT-${String(bot.id + 1).padStart(2, '0')}`, false) }
  }
  private stepControlMode(dt: number): void {
    const hardpoint = this.matchType === 'hardpoint'
    if (hardpoint) {
      const nextRotation = Math.floor(this.matchTime / 22) % this.objectivePoints.length
      if (nextRotation !== this.objectiveRotation) { this.objectiveRotation = nextRotation; this.objectiveMarkers.slice(0, 3).forEach((marker, i) => { marker.visible = i === nextRotation }); this.hooks.banner(`HARDPOINT ROTATED // ${String.fromCharCode(65 + nextRotation)}`) }
    }
    const indices = hardpoint ? [this.objectiveRotation] : [0, 1, 2]
    let playerOnPoint = false
    for (const i of indices) {
      const point = this.worldPoint(this.objectivePoints[i]!)
      const playerNear = this.player.root.position.distanceTo(point) < (hardpoint ? 5.5 : 4.6)
      const redNear = this.bots.some(bot => bot.id < this.activeBotCount && bot.alive && bot.team === 'red' && bot.root.position.distanceTo(point) < 5.5)
      const blueNear = playerNear || this.bots.some(bot => bot.id < this.activeBotCount && bot.alive && bot.team === 'blue' && bot.root.position.distanceTo(point) < 5.5)
      if (playerNear) playerOnPoint = true
      if (blueNear !== redNear) this.zoneProgress[i] = THREE.MathUtils.clamp(this.zoneProgress[i]! + dt * (blueNear ? 1 : -1), -3, 3)
      if (this.zoneProgress[i]! >= 3 && this.zoneOwners[i] !== 'blue') { this.zoneOwners[i] = 'blue'; this.hooks.banner(`ZONE ${String.fromCharCode(65 + i)} SECURED // BLUE`); this.audio.play('pickup'); this.objectiveMarkers[i]?.children[0]?.children.forEach(child => { if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) child.material.color.set('#56b9ef') }) }
      else if (this.zoneProgress[i]! <= -3 && this.zoneOwners[i] !== 'red') { this.zoneOwners[i] = 'red'; this.hooks.banner(`ZONE ${String.fromCharCode(65 + i)} LOST // RED`); this.objectiveMarkers[i]?.children[0]?.children.forEach(child => { if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) child.material.color.set('#e56e61') }) }
    }
    this.objectiveClock -= dt
    if (this.objectiveClock <= 0) {
      this.objectiveClock = 1
      if (hardpoint) { const controlled = this.zoneOwners[this.objectiveRotation]; if (controlled === 'blue' || (controlled === null && playerOnPoint && !this.bots.some(bot => bot.id < this.activeBotCount && bot.alive && bot.team === 'red' && bot.root.position.distanceTo(this.worldPoint(this.objectivePoints[this.objectiveRotation]!)) < 5.5))) this.blueScore += 1; else if (controlled === 'red') this.redScore += 1 }
      else { this.blueScore += this.zoneOwners.filter(owner => owner === 'blue').length; this.redScore += this.zoneOwners.filter(owner => owner === 'red').length }
    }
    this.objective = hardpoint ? `HARDPOINT ${String.fromCharCode(65 + this.objectiveRotation)} · ${playerOnPoint ? 'CONTESTING' : 'ROTATES IN ' + Math.ceil(22 - this.matchTime % 22) + 'S'}` : `ZONES A/B/C · BLUE ${this.zoneOwners.filter(owner => owner === 'blue').length} · RED ${this.zoneOwners.filter(owner => owner === 'red').length}`
  }
  private stepCaptureTheFlag(dt: number): void {
    const blueBase = new THREE.Vector3(-24 * this.mapScale, 0, 0)
    const redBase = new THREE.Vector3(24 * this.mapScale, 0, 0)
    if (this.input.consume('interact') && !this.flagCarried && this.player.root.position.distanceTo(redBase) < 4.2) { this.flagCarried = true; this.hooks.banner('ENEMY STANDARD TAKEN // RETURN TO BLUE BASE'); this.audio.play('pickup') }
    if (this.flagCarried && this.player.root.position.distanceTo(blueBase) < 4.2) { this.flagCarried = false; this.blueScore += 1; this.run.score += 250; this.addXp(100); this.hooks.banner(`STANDARD CAPTURED // ${this.blueScore} / 3`); this.audio.play('pickup') }
    this.flagScoreClock += dt
    if (this.flagScoreClock >= 38 && this.redScore < 3) { this.flagScoreClock = 0; this.redScore += 1; this.hooks.killfeed('RED SQUAD CAPTURED THE BLUE STANDARD', false) }
    this.objective = this.flagCarried ? 'CARRY THE STANDARD TO YOUR BASE' : `STEAL RED'S STANDARD · ${this.blueScore}/3 CAPS`
  }
  private searchAttackerTeam(): 'blue' | 'red' { return this.round <= SEARCH_ROUND.halfRounds ? 'red' : 'blue' }
  private stepSearch(dt: number): void {
    if (this.roundBreak > 0) {
      this.roundBreak = Math.max(0, this.roundBreak - dt)
      this.objective = this.pendingSearchResult ? `MATCH POINT · FINAL DEPLOY ${Math.ceil(this.roundBreak)}S` : `ROUND ${this.round} · NEXT DEPLOY ${Math.ceil(this.roundBreak)}S`
      if (this.roundBreak === 0) {
        if (this.pendingSearchResult) { const result = this.pendingSearchResult; this.pendingSearchResult = null; this.finish(result); return }
        this.round += 1; this.roundClock = 0
        if (this.round === SEARCH_ROUND.halfRounds + 1) this.hooks.banner('HALFTIME // ATTACK AND DEFENSE SIDES SWAPPED')
        this.resetSearchRound()
      }
      return
    }
    this.roundClock += dt
    if (this.roundClock < SEARCH_ROUND.buySeconds) { this.objective = `ROUND ${this.round} · BUY PHASE · ${Math.ceil(SEARCH_ROUND.buySeconds - this.roundClock)}S`; return }
    const attackerTeam = this.searchAttackerTeam()
    const defenderTeam = attackerTeam === 'blue' ? 'red' : 'blue'
    const site = this.worldPoint(this.objectivePoints[this.plantSite === 0 ? 0 : 2]!)
    const siteName = this.plantSite === 0 ? 'A' : 'B'
    const blueAttacking = attackerTeam === 'blue'

    if (!this.chargePlanted) {
      const redAttackerCanPlant = attackerTeam === 'red' && this.roundClock - SEARCH_ROUND.buySeconds >= 24 && this.bots.some(bot => bot.id < this.activeBotCount && bot.alive && bot.team === 'red')
      const playerCanPlant = blueAttacking && !this.playerDeadUntil && this.player.root.position.distanceTo(site) < 3.5 && this.input.held('interact')
      if (redAttackerCanPlant || playerCanPlant) {
        this.plantProgress += dt
        this.objective = `SITE ${siteName} · PLANTING · ${Math.max(0, 3 - this.plantProgress).toFixed(1)}S`
        if (this.plantProgress >= 3) {
          this.chargePlanted = true; this.chargeTimer = SEARCH_ROUND.fuseSeconds; this.plantProgress = 0; this.defuseProgress = 0
          this.hooks.banner(`RELIC CHARGE ARMED // SITE ${siteName}`); this.audio.play('plant', site)
        }
      } else this.plantProgress = 0
    }

    if (this.chargePlanted) {
      this.chargeTimer = Math.max(0, this.chargeTimer - dt)
      if (defenderTeam === 'blue') {
        if (!this.playerDeadUntil && this.player.root.position.distanceTo(site) < 3.5 && this.input.held('interact')) this.defuseProgress += dt
        else this.defuseProgress = 0
      } else {
        const defender = this.bots.filter(bot => bot.id < this.activeBotCount && bot.alive && bot.team === 'red').sort((a, b) => a.root.position.distanceToSquared(site) - b.root.position.distanceToSquared(site))[0]
        if (defender) {
          const delta = site.clone().sub(defender.root.position).setY(0); const distance = delta.length()
          if (distance > 3.5) { defender.root.position.addScaledVector(delta.normalize(), Math.min(distance - 3.5, dt * 3.2)); this.defuseProgress = 0 }
          else this.defuseProgress += dt
        } else this.defuseProgress = 0
      }
      if (this.defuseProgress >= 3) { this.chargePlanted = false; this.defuseProgress = 0; this.audio.play('defuse', site); this.roundWin(defenderTeam, 'CHARGE DEFUSED') }
      else if (this.chargeTimer <= 0) { this.chargePlanted = false; this.roundWin(attackerTeam, 'CHARGE DETONATED') }
      else this.objective = `SITE ${siteName} · CHARGE ${Math.ceil(this.chargeTimer)}S · ${defenderTeam === 'blue' ? 'HOLD E TO DEFUSE' : 'DEFENDER APPROACHING'}`
    }

    const redAlive = this.bots.slice(0, this.activeBotCount).some(bot => bot.alive && bot.team === 'red')
    const blueAlive = !this.playerDeadUntil || this.bots.slice(0, this.activeBotCount).some(bot => bot.alive && bot.team === 'blue')
    if (redAlive !== blueAlive) this.roundWin(blueAlive ? 'blue' : 'red', `${blueAlive ? 'BLUE' : 'RED'} SQUAD ELIMINATED OPPOSITION`)
    else if (this.roundClock - SEARCH_ROUND.buySeconds >= SEARCH_ROUND.liveSeconds && !this.chargePlanted && this.roundBreak === 0) this.roundWin(defenderTeam, 'TIME EXPIRED · SITE SECURE')
  }
  private roundWin(team: 'blue' | 'red', reason: string): void {
    if (this.roundBreak > 0 || this.pendingSearchResult) return
    if (team === 'blue') { this.blueScore += 1; this.save.update({ credits: this.save.data.credits + 400 }); this.run.credits = this.save.data.credits } else this.redScore += 1
    this.roundBreak = SEARCH_ROUND.postSeconds
    if (this.blueScore >= SEARCH_ROUND.winsRequired) this.pendingSearchResult = 'won'
    else if (this.redScore >= SEARCH_ROUND.winsRequired) this.pendingSearchResult = 'lost'
    this.hooks.banner(`${reason} // ${team.toUpperCase()} ${this.blueScore} : ${this.redScore} RED`)
    this.hooks.killfeed(`${team.toUpperCase()} TEAM WON ROUND ${this.round}`, false)
  }
  private stepRoyale(dt: number): void {
    const radius = Math.max(5, 30 - this.matchTime / 360 * 25)
    this.run.stormRadius = radius
    this.stormDamageTimer -= dt
    const playerOutside = Math.hypot(this.player.root.position.x, this.player.root.position.z) > radius
    if (playerOutside && this.stormDamageTimer <= 0) { this.stormDamageTimer = 0.75; this.damagePlayer(8, null) }
    for (const bot of this.bots) {
      if (bot.id >= this.activeBotCount || !bot.alive) continue
      const outside = Math.hypot(bot.root.position.x, bot.root.position.z) > radius + 1
      if (!outside) { bot.stormTime = Math.max(0, bot.stormTime - dt * 2); continue }
      bot.stormTime += dt
      const distance = Math.hypot(bot.root.position.x, bot.root.position.z) || 1
      bot.root.position.x -= bot.root.position.x / distance * dt * 2.1
      bot.root.position.z -= bot.root.position.z / distance * dt * 2.1
      if (bot.stormTime > 8) { bot.alive = false; bot.root.visible = false; this.run.aliveBots -= 1; this.hooks.killfeed(`BOT-${String(bot.id + 1).padStart(2, '0')} lost to the storm`, false) }
    }
    this.battleSimTimer -= dt
    if (this.battleSimTimer <= 0 && this.run.aliveBots > 1) {
      this.battleSimTimer = 1.6 + Math.random() * 0.8
      const alive = this.bots.slice(0, this.activeBotCount).filter(bot => bot.alive)
      if (alive.length > 1) { const attacker = alive[Math.floor(Math.random() * alive.length)]!; const targets = alive.filter(bot => bot !== attacker && bot.root.position.distanceTo(attacker.root.position) < 28); const victim = targets[Math.floor(Math.random() * targets.length)]; if (victim) { victim.alive = false; victim.root.visible = false; victim.deaths += 1; this.run.aliveBots -= 1; this.hooks.killfeed(`${attacker.name} eliminated ${victim.name}`, false) } }
    }
    this.objective = `${this.run.aliveBots + (this.playerDeadUntil ? 0 : 1)} OPERATORS REMAIN · STORM ${Math.ceil(radius)}M`
  }
  private damagePlayer(amount: number, bot: Bot | null): void {
    if (this.playerDeadUntil || this.matchType === 'search' && this.matchTime < this.playerSpawnProtectedUntil) return
    const armorRatio = 0.5
    const armorBonus = 0.5
    let healthDamage = amount
    if (this.run.armor > 0) {
      const proposedHealthDamage = amount * (1 - armorRatio)
      const armorCost = (amount - proposedHealthDamage) * armorBonus
      if (armorCost > this.run.armor) {
        healthDamage = amount - this.run.armor / armorBonus
        this.run.armor = 0
      } else {
        healthDamage = proposedHealthDamage
        this.run.armor = Math.max(0, this.run.armor - armorCost)
      }
    }
    this.run.health = Math.max(0, this.run.health - healthDamage)
    this.audio.play('hurt'); this.hooks.hurt()
    this.hooks.popup(`-${Math.round(healthDamage)}`, this.project(this.player.root.position.clone().setY(1.4)), 'hurt')
    if (this.run.health <= 0) {
      this.run.deaths += 1; this.playerDownedAt = this.matchTime; this.playerDeadUntil = this.matchType === 'royale' || this.matchType === 'search' ? Number.POSITIVE_INFINITY : this.matchTime + RESPAWN_SECONDS
      this.save.update({ stats: { ...this.save.data.stats, deaths: this.save.data.stats.deaths + 1 } })
      this.hooks.killfeed(`${bot ? bot.name : 'THE STORM'} eliminated YOU`, false); this.run.health = 0; this.run.armor = 0
      if (this.matchType === 'royale') this.finish('lost')
    }
  }
  private advanceDaily(headshot: boolean, killedBot: Bot): void { const d = this.save.data.dailyChallenge; const contract = DAILY_CONTRACTS[d.id] ?? DAILY_CONTRACTS[0]!; const kind = contract.kind; const distance = this.player.root.position.distanceTo(killedBot.root.position); const qualifies = kind === 'elim' || kind === 'headshot' && headshot || kind === 'knife' && this.currentWeapon === 'knife' || kind === 'ads' && this.input.held('ads') || kind === 'sniper' && this.currentWeapon === 'awp' || kind === 'sidearm' && (this.currentWeapon === 'glock' || this.currentWeapon === 'deagle') || kind === 'slide' && this.slideLeft > 0 || kind === 'moving' && Math.hypot(this.input.move.x, this.input.move.y) > 0.2 || kind === 'longshot' && distance > 18 || kind === 'airborne' && this.player.root.position.y > 0.2; if (!qualifies || d.claimed) return; const progress = d.progress + 1; const goal = contract.goal; const claimed = progress >= goal; this.save.update({ dailyChallenge: { ...d, progress, claimed } }); if (claimed) { this.addXp(250); this.save.update({ credits: this.save.data.credits + 200 }); this.hooks.banner('DAILY CONTRACT // +250 XP · +200 CR') } }
  private addXp(amount: number): void { let xp = this.save.data.xp + amount; let level = this.save.data.level; let leveled = false; let reward = ''
    while (level < 50 && xp >= xpForLevel(level)) {
      xp -= xpForLevel(level); level += 1; leveled = true
      const unlocked = OPERATOR_SKINS.find(skin => skin.level === level)
      if (unlocked) reward = unlocked.name
      const knifeRewards = KNIFE_SKINS.filter(skin => skin.level === level && !this.save.data.unlockedKnifeSkinIds.includes(skin.id))
      if (knifeRewards.length) { const knifeItems = knifeRewards.map(skin => ({ id: skin.id, weapon: 'knife' as const, name: skin.name, rarity: 'Classified' as const, color: skin.color, pattern: 'etched-voxel' })); this.save.update({ unlockedKnifeSkinIds: [...this.save.data.unlockedKnifeSkinIds, ...knifeRewards.map(skin => skin.id)], inventory: [...this.save.data.inventory, ...knifeItems] }); reward = reward ? `${reward} + ${knifeRewards.map(skin => skin.name).join(', ')}` : knifeRewards.map(skin => skin.name).join(', ') }
      const weaponReward = SKINS.find(skin => skin.weapon !== 'knife' && !this.save.data.inventory.some(item => item.id === skin.id))
      if (weaponReward) { this.save.update({ inventory: [...this.save.data.inventory, weaponReward] }); reward = reward ? `${reward} + ${weaponReward.name}` : weaponReward.name }
      this.save.update({ credits: this.save.data.credits + 150 * level })
    }
    this.save.update({ xp, level }); this.run.level = level; this.run.xp = xp; this.run.nextXp = xpForLevel(level); this.run.credits = this.save.data.credits
    if (leveled) { this.audio.play('levelup'); this.hooks.banner(`LEVEL ${level} // ${reward || '150 CREDITS CLAIMED'}`) }
  }
  private scoreboard(): GameSnapshot['scoreboard'] { return [{ name: this.save.data.playerName, kills: this.run.kills, deaths: this.run.deaths, you: true, team: 'blue' as const }, ...this.bots.filter(bot => bot.id < this.activeBotCount).map(bot => ({ name: bot.name, kills: bot.kills, deaths: bot.deaths, team: bot.team }))].sort((a, b) => b.kills - a.kills) }
  private unlockAchievement(id: string): void { if (this.save.data.achievements.includes(id)) return; const item = ACHIEVEMENTS.find(achievement => achievement.id === id); if (!item) return; this.save.update({ achievements: [...this.save.data.achievements, id] }); this.hooks.banner(`MEDAL EARNED // ${item.name}`) }
  private checkAchievements(): void { const stats = this.save.data.stats; if (stats.kills >= 1) this.unlockAchievement('first-blood'); if (stats.kills >= 50) this.unlockAchievement('field-veteran'); if (stats.headshots >= 25) this.unlockAchievement('deadeye'); if (stats.wins >= 1) this.unlockAchievement('champion') }
  private cycleSpectator(): void { const targets = this.bots.filter(bot => bot.alive && bot.id < this.activeBotCount); if (targets.length) { this.spectatorIndex = (this.spectatorIndex + 1) % targets.length; this.hooks.banner(`SPECTATING // ${targets[this.spectatorIndex]!.name}`) } }
  canOpenBuyMenu(): boolean { return this.mode === 'playing' && this.matchType === 'search' && this.roundClock < SEARCH_ROUND.buySeconds && this.roundBreak === 0 && !this.pendingSearchResult && !this.playerDeadUntil }
  buy(item: 'rifle' | 'armor' | 'grenade'): string { if (this.mode !== 'paused' || this.matchType !== 'search' || this.roundClock >= SEARCH_ROUND.buySeconds || this.roundBreak > 0 || this.pendingSearchResult) return 'BUY PHASE CLOSED'; const prices = { rifle: 1200, armor: 350, grenade: 300 }; const price = prices[item]; if (this.save.data.credits < price) return `NOT ENOUGH CREDITS // ${price} CR REQUIRED`; if (item === 'armor' && this.run.armor >= 100) return 'ARMOR ALREADY FULL'; if (item === 'grenade' && this.grenadeCount >= 2) return 'GRENADE LIMIT REACHED'; this.save.update({ credits: this.save.data.credits - price }); this.run.credits = this.save.data.credits; if (item === 'rifle') { this.currentWeapon = 'ak47'; this.activeSlot = 0; this.ammo = WEAPONS.ak47.magazine; this.reloadLeft = 0; this.updateViewModel() } else if (item === 'armor') this.run.armor = Math.min(100, this.run.armor + 50); else this.grenadeCount += 1; return `BOUGHT ${item.toUpperCase()} // -${price} CR` }
  private mapName(): string { return (this.activeCustomMap?.name || HISTORIC_MAPS.find(map => map.id === this.mapId)?.name || 'Aurelian Forum').toUpperCase() }
  private finish(phase: 'won' | 'lost'): void { if (this.run.phase !== 'playing') return; this.run.phase = phase; this.mode = 'ended'; this.input.unlockPointer(); const mvpBonus = phase === 'won' ? 300 : 0; const xp = Math.max(70, this.run.kills * 55 + this.run.headshots * 30 + (phase === 'won' ? 250 : 80) + mvpBonus); this.run.xpEarned = xp; this.addXp(xp); this.save.update({ stats: { ...this.save.data.stats, matches: this.save.data.stats.matches + 1, wins: this.save.data.stats.wins + (phase === 'won' ? 1 : 0), shots: this.save.data.stats.shots + this.run.shots, hits: this.save.data.stats.hits + this.run.hits } }); if (phase === 'won') this.unlockAchievement('champion'); if (this.matchType === 'gungame' && phase === 'won') this.unlockAchievement('arms-master'); this.hooks.end(this.snapshot()) }
  debugFinish(): void { this.run.kills = 12; this.finish('won') }
  render(alpha: number, frameSeconds: number): void {
    const dt = Math.min(frameSeconds, 0.05)
    const interpolation = THREE.MathUtils.clamp(alpha, 0, 1)
    this.interpolatedPlayerPosition.lerpVectors(this.previousPlayerPosition, this.player.root.position, interpolation)
    const cameraBobY = THREE.MathUtils.lerp(this.previousCameraBobY, this.cameraBobY, interpolation)
    const cameraLanding = THREE.MathUtils.lerp(this.previousCameraLanding, this.cameraLanding, interpolation)
    this.inspectTime = Math.max(0, this.inspectTime - dt)
    const look = this.mode === 'playing' ? this.input.takeLook() : { x: 0, y: 0 }
    if (this.mode === 'playing') { this.yaw -= look.x; this.pitch = THREE.MathUtils.clamp(this.pitch - look.y, -1.35, 1.25) }
    const moveSpeed = Math.hypot(this.horizontalVelocity.x, this.horizontalVelocity.z)
    const moving = this.mode === 'playing' && moveSpeed > 0.5
    const crouching = this.mode === 'playing' && this.input.held('crouch')
    const sliding = this.slideLeft > 0
    const grounded = Math.abs(this.verticalVelocity) < 0.08
    if (moving && grounded) this.strideTimer += dt * (crouching ? 2.8 + moveSpeed * 0.7 : 3.5 + moveSpeed * 0.85)
    const bobX = moving && grounded ? Math.cos(this.strideTimer * 0.5) * 0.012 : 0
    const bobY = moving && grounded ? Math.sin(this.strideTimer) * 0.015 : 0
    const running = moving && this.input.held('sprint') && moveSpeed > 1
    this.sprintPose = THREE.MathUtils.damp(this.sprintPose, running ? 1 : 0, 9, dt)
    this.weaponSwayX = THREE.MathUtils.damp(this.weaponSwayX, THREE.MathUtils.clamp(-look.x * 0.32, -0.12, 0.12), 14, dt)
    this.weaponSwayY = THREE.MathUtils.damp(this.weaponSwayY, THREE.MathUtils.clamp(-look.y * 0.25, -0.1, 0.1), 14, dt)
    const reloadProgress = this.reloadLeft > 0 && this.reloadDuration > 0 ? THREE.MathUtils.clamp(1 - this.reloadLeft / this.reloadDuration, 0, 1) : 0
    const magOut = THREE.MathUtils.smoothstep(reloadProgress, 0.12, 0.28) * (1 - THREE.MathUtils.smoothstep(reloadProgress, 0.63, 0.82))
    if (this.reloadMagazine) {
      const base = this.reloadMagazine.userData.basePosition as THREE.Vector3 | undefined
      if (base) this.reloadMagazine.position.copy(base).add(new THREE.Vector3(magOut * 0.035, -magOut * 0.34, magOut * 0.055))
      else this.reloadMagazine.position.y = Number(this.reloadMagazine.userData.baseY) - magOut * 0.46
      const baseRotation = this.reloadMagazine.userData.baseRotation as THREE.Euler | undefined
      if (baseRotation) this.reloadMagazine.rotation.set(baseRotation.x + magOut * 0.16, baseRotation.y, baseRotation.z + magOut * 0.08)
    }
    const inspectSpin = this.inspectTime > 0 ? (1 - this.inspectTime / 2.6) * Math.PI * 2 : 0
    if (this.importedViewModel) {
      const base = this.importedViewModel.userData.basePosition as THREE.Vector3
      const reloadLift = Math.sin(Math.PI * reloadProgress) * 0.1
      this.importedViewModel.position.copy(base).add(new THREE.Vector3(0, -magOut * 0.1 - reloadLift, 0))
      this.importedViewModel.rotation.set(magOut * 0.14 + reloadLift * 0.7, inspectSpin, 0)
    }
    const handReach = THREE.MathUtils.smoothstep(reloadProgress, 0.14, 0.3) * (1 - THREE.MathUtils.smoothstep(reloadProgress, 0.66, 0.84))
    if (this.importedArms) {
      const base = this.importedArms.userData.basePosition as THREE.Vector3
      this.importedArms.position.copy(base).add(new THREE.Vector3(handReach * 0.035, handReach * 0.04, handReach * 0.08))
      this.importedArms.rotation.x = handReach * 0.045
    }
    if (this.reloadHand) {
      const grip = this.reloadHand.userData.basePosition as THREE.Vector3
      let target = grip.clone().add(new THREE.Vector3(-0.08, -0.12, -0.1))
      if (this.reloadMagazine) {
        this.weaponView.updateMatrixWorld(true)
        const magazineWorld = this.reloadMagazine.getWorldPosition(new THREE.Vector3())
        target = this.viewModelRig.worldToLocal(magazineWorld).add(new THREE.Vector3(0, 0.04, 0.02))
      }
      this.reloadHand.position.lerpVectors(grip, target, handReach)
    }
    this.muzzleFlashGroup.visible = this.flash > 0
    const spectatorTargets = this.playerDeadUntil === Number.POSITIVE_INFINITY && this.matchType === 'search' ? this.bots.filter(bot => bot.alive && bot.id < this.activeBotCount) : []
    const spectator = spectatorTargets.length ? spectatorTargets[this.spectatorIndex % spectatorTargets.length] : null
    const aiming = this.mode === 'playing' && !spectator && !this.playerDeadUntil && this.input.held('ads')
    this.aimBlend = THREE.MathUtils.damp(this.aimBlend, aiming ? 1 : 0, aiming ? 15 : 11, dt)
    const sniperScoped = this.currentWeapon === 'awp'
    const aimedFov = sniperScoped ? THREE.MathUtils.clamp(this.baseFov * 0.54, 38, 56) : THREE.MathUtils.clamp(this.baseFov * 0.82, 58, 86)
    const animatedFov = THREE.MathUtils.lerp(this.baseFov, aimedFov, this.aimBlend)
    if (Math.abs(this.cameraInternal.fov - animatedFov) > 0.04) { this.cameraInternal.fov = animatedFov; this.cameraInternal.updateProjectionMatrix() }
    this.weaponView.visible = this.mode !== 'attract' && !spectator && !(sniperScoped && this.aimBlend > 0.94)
    if (spectator) {
      const previous = this.previousBotPositions.get(spectator) ?? spectator.root.position
      if (previous.distanceToSquared(spectator.root.position) > 16) previous.copy(spectator.root.position)
      this.cameraInternal.position.set(THREE.MathUtils.lerp(previous.x, spectator.root.position.x, interpolation), THREE.MathUtils.lerp(previous.y, spectator.root.position.y, interpolation) + 1.65, THREE.MathUtils.lerp(previous.z, spectator.root.position.z, interpolation))
      this.cameraInternal.rotation.set(0, interpolateAngle(this.previousBotYaw.get(spectator) ?? spectator.root.rotation.y, spectator.root.rotation.y, interpolation), 0)
    } else {
      this.cameraInternal.position.set(this.interpolatedPlayerPosition.x, this.interpolatedPlayerPosition.y + 1.65 + cameraBobY + cameraLanding, this.interpolatedPlayerPosition.z)
      this.cameraInternal.rotation.set(this.pitch + this.recoil * 0.16, this.yaw, 0)
    }
    this.audio.updateListener(this.cameraInternal.position, this.yaw, this.pitch)
    const viewFit = THREE.MathUtils.clamp(this.cameraInternal.aspect / 1.15, 0.52, 1)
    const target = new THREE.Vector3(
      THREE.MathUtils.lerp(0.08, -0.045, this.aimBlend) + bobX * (1 - this.aimBlend * 0.8) + this.weaponSwayX * (1 - this.aimBlend * 0.72) + this.horizontalVelocity.x * 0.004 - (1 - viewFit) * 0.12,
      THREE.MathUtils.lerp(-0.04, 0.018, this.aimBlend) + bobY * (1 - this.aimBlend * 0.8) + this.cameraBobY * 0.4 - this.sprintPose * 0.2 - (crouching ? 0.09 : 0) - (sliding ? 0.12 : 0) - (1 - viewFit) * 0.1,
      -0.65 + this.recoil * 0.1 + this.sprintPose * 0.1 + this.aimBlend * 0.035 - (this.dashLeft > 0 ? 0.08 : 0),
    )
    // Exact critically damped spring integration stays stable across frame rates;
    // explicit Euler made the weapon kick overshoot on slower frames.
    const springFrequency = 16
    const displacement = this.viewSpringPosition.clone().sub(target)
    const springStep = this.viewSpringVelocity.clone().addScaledVector(displacement, springFrequency).multiplyScalar(dt)
    const decay = Math.exp(-springFrequency * dt)
    this.viewSpringPosition.copy(target).add(displacement.add(springStep).multiplyScalar(decay))
    this.viewSpringVelocity.sub(springStep.multiplyScalar(springFrequency)).multiplyScalar(decay)
    this.weaponView.position.copy(this.viewSpringPosition)
    this.weaponView.rotation.set(-this.sprintPose * 0.38 + this.recoil * 0.7 + this.weaponSwayY + Math.sin(Math.PI * reloadProgress) * 0.13 - (this.dashLeft > 0 ? 0.1 : 0), -this.weaponSwayX * 0.65, -this.horizontalVelocity.x * 0.012 - Math.sin(Math.PI * reloadProgress) * 0.08)
    this.weaponView.scale.setScalar((0.94 + this.aimBlend * 0.04) * viewFit)
    if (this.lobbyPreview && this.mode === 'attract') { this.lobbyPreview.rotation.y = Math.sin(this.lastFrame * 0.32) * 0.13; this.lobbyAnimation?.update(dt) }
    this.lastFrame += dt
    // Blend moving bots between fixed simulation ticks while drawing, then restore the exact
    // simulation transforms before the next input, collision, and hit-detection update.
    for (const bot of this.bots) {
      const previous = this.previousBotPositions.get(bot)
      const restore = this.renderBotPositions.get(bot)
      if (!previous || !restore) continue
      restore.copy(bot.root.position)
      const currentYaw = bot.root.rotation.y
      if (previous.distanceToSquared(restore) > 16) { previous.copy(restore); this.previousBotYaw.set(bot, currentYaw) } // respawns are teleports
      bot.root.position.lerpVectors(previous, restore, interpolation)
      this.renderBotYaw.set(bot, currentYaw)
      bot.root.rotation.y = interpolateAngle(this.previousBotYaw.get(bot) ?? currentYaw, currentYaw, interpolation)
      if (bot.alive && bot.root.visible) {
        bot.visualPhase += dt * (0.45 + bot.id * 0.04)
        // Update skinned meshes at render cadence so their run cycle remains
        // fluid on high-refresh displays instead of stepping at simulation Hz.
        if (bot.animation && this.mode === 'playing') bot.animation.mixer.update(dt)
        const rig = bot.root.userData.rig as { leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group } | undefined
        if (rig) {
          const stride = bot.walking ? Math.sin(bot.visualPhase * 8) * 0.52 : Math.sin(bot.visualPhase * 2) * 0.025
          rig.leftArm.rotation.x = stride * 0.65; rig.rightArm.rotation.x = -stride * 0.65 - 0.08
          rig.leftLeg.rotation.x = -stride; rig.rightLeg.rotation.x = stride
        }
      }
    }
    try {
      this.renderer.render(this.scene, this.cameraInternal)
    } finally {
      for (const bot of this.bots) {
        const restore = this.renderBotPositions.get(bot)
        if (restore) bot.root.position.copy(restore)
        const restoreYaw = this.renderBotYaw.get(bot)
        if (restoreYaw !== undefined) bot.root.rotation.y = restoreYaw
      }
    }
  }
  snapshot(): GameSnapshot { return { ...this.run, matchType: this.matchType, mapId: this.mapId, crosshairBloom: this.run.crosshairBloom, grenades: this.grenadeCount, spectating: this.playerDeadUntil === Number.POSITIVE_INFINITY && this.matchType === 'search', blueScore: this.blueScore, redScore: this.redScore, round: this.round, roundPhase: this.matchType === 'search' ? this.searchRoundPhase() : 'live', spawnProtection: this.matchType === 'search' && this.roundBreak === 0 && this.roundClock >= SEARCH_ROUND.buySeconds && !this.playerDeadUntil ? Math.max(0, Math.min(SEARCH_ROUND.spawnShieldSeconds, this.playerSpawnProtectedUntil - this.matchTime)) : 0, respawnIn: Number.isFinite(this.playerDeadUntil) ? Math.max(0, this.playerDeadUntil - this.matchTime) : 0, aliveBots: this.bots.filter(bot => bot.alive && bot.id < this.activeBotCount).length, accuracy: this.run.shots ? this.run.hits / this.run.shots : 0, ammo: this.ammo, magazine: WEAPONS[this.currentWeapon].magazine, reload: this.reloadLeft, weapon: this.currentWeapon, weaponName: this.activeWeaponName(), aimed: this.input.held('ads'), level: this.save.data.level, xp: this.save.data.xp, nextXp: xpForLevel(this.save.data.level), credits: this.save.data.credits, playerX: this.player.root.position.x, playerZ: this.player.root.position.z, yaw: this.yaw, objective: this.objective, scoreboard: this.scoreboard() } }
  project(world: THREE.Vector3): { x: number; y: number } { const v = world.clone().project(this.cameraInternal); return { x: ((v.x + 1) / 2) * this.renderer.canvas.clientWidth, y: ((1 - v.y) / 2) * this.renderer.canvas.clientHeight } }
}

function interpolateAngle(from: number, to: number, alpha: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + delta * alpha
}
