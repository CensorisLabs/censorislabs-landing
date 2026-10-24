import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import type { Renderer } from '../engine/renderer'
import { SaveStore, xpForLevel } from '../engine/save'
import { DAILY_CONTRACTS, HISTORIC_MAPS, KNIFE_SKINS, OPERATOR_SKINS, SKINS, WEAPONS, armoryGun, operatorSkinForLevel, skinFor, type BotDifficulty, type MapId, type MatchSettings, type MatchType, type WeaponId } from './fps'

export type Mode = 'attract' | 'playing' | 'paused' | 'ended'
export type GameSnapshot = { phase: 'playing' | 'won' | 'lost'; matchType: MatchType; mapId: MapId; objective: string; timeLeft: number; elapsed: number; score: number; kills: number; deaths: number; headshots: number; shots: number; hits: number; accuracy: number; health: number; armor: number; ammo: number; magazine: number; weapon: WeaponId; weaponName: string; aimed: boolean; reload: number; level: number; xp: number; nextXp: number; credits: number; blueScore: number; redScore: number; aliveBots: number; stormRadius: number; playerX: number; playerZ: number; yaw: number; scoreboard: { name: string; kills: number; deaths: number; ping: number; you?: boolean; team?: 'blue' | 'red' }[] }
export type GameHooks = { popup(text: string, screen: { x: number; y: number }, kind: 'score' | 'hurt'): void; hitmarker(headshot: boolean): void; hurt(): void; killfeed(text: string, headshot: boolean): void; banner(text: string): void; end(run: GameSnapshot): void }
type Bot = { id: number; name: string; style: number; root: THREE.Group; hitMeshes: THREE.Object3D[]; health: number; nextShot: number; respawnAt: number; spawn: THREE.Vector3; phase: number; kills: number; deaths: number; alive: boolean; team: 'blue' | 'red'; stormTime: number }

type MutableRun = GameSnapshot & { phase: 'playing' | 'won' | 'lost' }

export class Game {
  mode: Mode = 'attract'
  run: MutableRun
  readonly scene = new THREE.Scene()
  readonly player = { root: new THREE.Group(), teleport: (position: THREE.Vector3) => this.teleport(position) }
  readonly cores = { remaining: () => [] as THREE.Vector3[] }
  private readonly arenaRoot = new THREE.Group()
  private readonly cameraInternal = new THREE.PerspectiveCamera(92, 1, 0.05, 180)
  private readonly raycaster = new THREE.Raycaster()
  private readonly visionRaycaster = new THREE.Raycaster()
  private readonly bots: Bot[] = []
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
  private plantSite = 0
  private readonly weaponView = new THREE.Group()
  private currentWeapon: WeaponId = 'glock'
  private activeSlot: 0 | 1 | 2 = 0
  private slideLeft = 0
  private slideDirection = new THREE.Vector3()
  private bobPhase = 0
  private readonly horizontalVelocity = new THREE.Vector3()
  private cameraBobY = 0
  private cameraLanding = 0
  private weaponSwayX = 0
  private weaponSwayY = 0
  private sprintPose = 0
  private matchType: MatchType = 'ffa'
  private difficulty: BotDifficulty = 'regular'
  private mapId: MapId = 'aurelian-forum'
  private blueScore = 0
  private redScore = 0
  private botScoreTimer = 9
  private stormDamageTimer = 0
  private ammo = WEAPONS.glock.magazine
  private reloadLeft = 0
  private yaw = 0
  private pitch = 0
  private verticalVelocity = 0
  private matchTime = 0
  private fireCooldown = 0
  private recoil = 0
  private flash = 0
  private playerDeadUntil = 0
  private playerDownedAt = 0
  private lastFrame = 0
  private readonly save: SaveStore
  private readonly viewParts: THREE.Mesh[] = []

  constructor(private readonly renderer: Renderer, private readonly input: Input, private readonly audio: Audio, save: SaveStore, private readonly hooks: GameHooks) {
    this.save = save
    this.scene.background = new THREE.Color('#07111c')
    this.scene.fog = new THREE.Fog('#07111c', 44, 115)
    this.cameraInternal.rotation.order = 'YXZ'
    this.cameraInternal.add(this.weaponView)
    this.scene.add(this.cameraInternal)
    this.scene.add(this.player.root)
    this.scene.add(this.arenaRoot)
    this.buildLighting()
    this.buildArena()
    this.buildBots()
    this.run = this.newRun()
    this.updateViewModel()
  }
  get camera(): THREE.PerspectiveCamera { return this.cameraInternal }
  private newRun(): MutableRun { const w = WEAPONS[this.currentWeapon]; return { phase: 'playing', matchType: this.matchType, mapId: this.mapId, objective: this.objective, timeLeft: this.matchType === 'royale' ? 360 : this.matchType === 'training' ? 0 : 240, elapsed: 0, score: 0, kills: 0, deaths: 0, headshots: 0, shots: 0, hits: 0, accuracy: 0, health: 100, armor: 50, ammo: w.magazine, magazine: w.magazine, weapon: this.currentWeapon, weaponName: w.name, aimed: false, reload: 0, level: this.save.data.level, xp: this.save.data.xp, nextXp: xpForLevel(this.save.data.level), credits: this.save.data.credits, blueScore: 0, redScore: 0, aliveBots: 0, stormRadius: 30, playerX: 0, playerZ: 0, yaw: 0, scoreboard: [] } }
  private buildLighting(): void { this.scene.add(new THREE.HemisphereLight('#a6d4ff', '#07111c', 1.8)); const sun = new THREE.DirectionalLight('#d4f5ff', 2.8); sun.position.set(-20, 34, 12); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); this.scene.add(sun); const cyan = new THREE.PointLight('#10d7c3', 16, 34); cyan.position.set(-18, 5, -18); this.scene.add(cyan); const magenta = new THREE.PointLight('#a949ff', 14, 28); magenta.position.set(18, 4, 12); this.scene.add(magenta) }
  private mat(color: string, emissive = false): THREE.MeshStandardMaterial { return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.18, emissive: emissive ? color : '#000000', emissiveIntensity: emissive ? 2.4 : 0 }) }
  private block(size: THREE.Vector3, position: THREE.Vector3, color: string, emissive = false, rotation = 0): THREE.Mesh { const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), this.mat(color, emissive)); mesh.position.copy(position); mesh.rotation.y = rotation; mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.colliderSize = size.clone(); this.arenaRoot.add(mesh); this.obstacles.push(mesh); return mesh }
  private buildArena(): void {
    this.relics.length = 0
    this.arenaRoot.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()) } })
    this.arenaRoot.clear()
    this.obstacles.length = 0
    const palettes: Record<MapId, { ground: string; stone: string; trim: string; fog: string; sky: string; name: string }> = {
      'aurelian-forum': { ground: '#4f8652', stone: '#d3c496', trim: '#d85d48', fog: '#a9d3e5', sky: '#78bce9', name: 'Aurelian Forum' },
      'sun-archive': { ground: '#c49a50', stone: '#ecd18a', trim: '#2d9a91', fog: '#edc783', sky: '#7ec5ed', name: 'Sun Archive' },
      fjordgate: { ground: '#537f83', stone: '#b5d3d4', trim: '#d57d51', fog: '#abd8e6', sky: '#75bbeb', name: 'Fjordgate' },
      'stonewind-pass': { ground: '#668b56', stone: '#b1bd8a', trim: '#e6c56e', fog: '#b8d6d1', sky: '#78c1eb', name: 'Stonewind Pass' },
      'cedar-citadel': { ground: '#558354', stone: '#c0bc8c', trim: '#bc6544', fog: '#a8d2c2', sky: '#80c6ed', name: 'Cedar Citadel' },
      'marble-coast': { ground: '#59969a', stone: '#dfd9be', trim: '#337fb1', fog: '#b7d9e4', sky: '#76bbec', name: 'Marble Coast' },
      'ember-market': { ground: '#b57e48', stone: '#e2b76b', trim: '#df6946', fog: '#e3bd87', sky: '#83c5ef', name: 'Ember Market' }
    }
    const palette = palettes[this.mapId]
    this.scene.background = new THREE.Color(palette.sky)
    this.scene.fog = new THREE.Fog(palette.fog, 100, 210)
    const floor = this.block(new THREE.Vector3(64, 0.4, 64), new THREE.Vector3(0, -0.2, 0), '#ffffff')
    const groundVariation = new THREE.Color(palette.ground).lerp(new THREE.Color(palette.stone), 0.14).getStyle()
    const groundTexture = this.voxelTexture(palette.ground, groundVariation)
    groundTexture.repeat.set(16, 16)
    const floorMaterial = floor.material as THREE.MeshStandardMaterial
    floorMaterial.map = groundTexture
    floorMaterial.needsUpdate = true
    // Keep the floor clear and the lane silhouettes easy to read.
    // Low broken perimeter walls leave the horizon open and create multiple arena entrances.
    for (let lane = -24; lane <= 24; lane += 8) {
      if (Math.abs(lane) < 5) continue
      this.block(new THREE.Vector3(7, 4, 1.2), new THREE.Vector3(lane, 2, -30.4), palette.stone)
      this.block(new THREE.Vector3(7, 4, 1.2), new THREE.Vector3(lane, 2, 30.4), palette.stone)
      this.block(new THREE.Vector3(1.2, 4, 7), new THREE.Vector3(-30.4, 2, lane), palette.stone)
      this.block(new THREE.Vector3(1.2, 4, 7), new THREE.Vector3(30.4, 2, lane), palette.stone)
    }
    const cover = [[-12, -12, 4, 3, 2], [-7, -12, 3, 3, 2], [10, -8, 4, 3, 3], [15, -8, 3, 3, 2], [-15, 8, 3, 4, 2], [-9, 12, 5, 3, 2], [11, 12, 3, 5, 2], [3, 19, 4, 3, 2], [-20, -1, 3, 3, 3], [20, 0, 3, 3, 3], [0, 4, 3, 6, 2], [0, -4, 3, 6, 2]] as const
    for (const [x, z, sx, sz, sy] of cover) this.block(new THREE.Vector3(sx, sy, sz), new THREE.Vector3(x, sy / 2, z), palette.stone)
    if (this.mapId === 'stonewind-pass') { for (let i = 0; i < 7; i += 1) { const x = -24 + i * 8; this.block(new THREE.Vector3(4, 3 + i % 3, 5), new THREE.Vector3(x, 1.5 + i % 3 / 2, -14 + i % 2 * 26), palette.stone) } this.block(new THREE.Vector3(2, 8, 32), new THREE.Vector3(-20, 4, 0), palette.trim) }
    else if (this.mapId === 'cedar-citadel') { for (const x of [-18, -12, 12, 18]) { this.block(new THREE.Vector3(3, 8, 3), new THREE.Vector3(x, 4, -17), palette.trim); this.block(new THREE.Vector3(3, 8, 3), new THREE.Vector3(x, 4, 17), palette.trim) } this.block(new THREE.Vector3(34, 2, 4), new THREE.Vector3(0, 1, 0), palette.stone) }
    else if (this.mapId === 'marble-coast') { for (const x of [-18, -9, 9, 18]) { this.block(new THREE.Vector3(2.4, 6, 2.4), new THREE.Vector3(x, 3, 0), palette.stone); this.block(new THREE.Vector3(12, 1.2, 6), new THREE.Vector3(x / 2, 0.6, x), palette.trim) } }
    else if (this.mapId === 'ember-market') { for (const z of [-18, -9, 9, 18]) for (const x of [-18, 0, 18]) this.block(new THREE.Vector3(6, 2.6, 4), new THREE.Vector3(x, 1.3, z), x === 0 ? palette.trim : palette.stone) }
    for (const [x, z] of [[-21, -20], [21, -20], [-21, 20], [21, 20]] as const) {
      for (let step = 0; step < 4; step += 1) this.block(new THREE.Vector3(1.35 + step * 0.22, 0.7, 1.35 + step * 0.22), new THREE.Vector3(x, step * 0.72 + 0.35, z), step % 2 ? palette.stone : palette.trim)
      this.block(new THREE.Vector3(3.6, 0.35, 3.6), new THREE.Vector3(x, 3.05, z), palette.trim)
    }
    if (this.mapId === 'sun-archive') {
      for (let tier = 0; tier < 5; tier += 1) this.block(new THREE.Vector3(16 - tier * 2, 1.4, 14 - tier * 2), new THREE.Vector3(0, tier * 1.4 + 0.7, -18), tier % 2 ? palette.stone : palette.trim)
      for (const x of [-14, -10, 10, 14]) this.block(new THREE.Vector3(2, 4, 2), new THREE.Vector3(x, 2, 18), palette.stone)
    } else if (this.mapId === 'fjordgate') {
      for (const z of [-18, -12, 12, 18]) {
        this.block(new THREE.Vector3(2.2, 5, 2.2), new THREE.Vector3(-18, 2.5, z), palette.stone)
        this.block(new THREE.Vector3(2.2, 5, 2.2), new THREE.Vector3(18, 2.5, z), palette.stone)

      }
      this.block(new THREE.Vector3(22, 1.4, 12), new THREE.Vector3(0, 0.7, -22), palette.trim)
    } else {
      for (const z of [-17, -11, 11, 17]) {
        for (const x of [-18, -12, 12, 18]) this.block(new THREE.Vector3(1.2, 5.5, 1.2), new THREE.Vector3(x, 2.75, z), palette.stone)

      }
    }
    // Little landmark props add color and readable cover at the outer lanes of each historical map.
    const propTone = this.mapId === 'fjordgate' || this.mapId === 'marble-coast' ? '#8d6748' : '#766044'
    for (const [x, z] of [[-24, -12], [24, -12], [-24, 12], [24, 12]] as const) {
      this.block(new THREE.Vector3(1.8, 1.2, 1.8), new THREE.Vector3(x, 0.6, z), propTone)
      this.block(new THREE.Vector3(1.92, 0.16, 0.16), new THREE.Vector3(x, 0.62, z + 0.94), palette.trim)
      this.block(new THREE.Vector3(0.16, 0.16, 1.92), new THREE.Vector3(x + 0.94, 0.62, z), palette.trim)
    }
    for (const [x, z, r] of [[-24, 21, 3], [23, 21, 3], [-23, -21, 3], [23, -21, 3]] as const) { const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 8), this.mat(palette.trim)); pad.position.set(x, 0.08, z); this.arenaRoot.add(pad) }
    const sign = this.block(new THREE.Vector3(13, 3.2, 0.18), new THREE.Vector3(0, 4.8, -30.4), '#282720'); const rune = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.12, 0.05), this.mat(palette.trim, true)); rune.position.set(0, 0.4, -0.12); sign.add(rune)
    for (const [x, z] of [[-8, -20], [9, 19], [0, 0]] as const) { const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: palette.trim, emissive: palette.trim, emissiveIntensity: 0.75, roughness: 0.3 })); mesh.position.set(x, 0.85, z); mesh.userData.baseY = 0.85; this.arenaRoot.add(mesh); this.relics.push({ mesh, at: new THREE.Vector3(x, 0, z) }) }
    this.objectiveMarkers.length = 0
    const points = [...this.objectivePoints, new THREE.Vector3(-24, 0, 0), new THREE.Vector3(24, 0, 0)]
    points.forEach((point, index) => { const marker = new THREE.Group(); const color = index >= 3 ? (index === 3 ? '#56b9ef' : '#e56e61') : '#e9c45b'; const ring = new THREE.Mesh(new THREE.CylinderGeometry(index >= 3 ? 2.6 : 3.8, index >= 3 ? 2.6 : 3.8, 0.12, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, transparent: true, opacity: 0.72 })); ring.position.y = 0.08; marker.add(ring); if (index >= 3) { const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), this.mat('#d2cbb5')); pole.position.set(0, 1.65, 0); marker.add(pole); const pennant = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.58, 0.08), this.mat(color, true)); pennant.position.set(index === 3 ? 0.56 : -0.56, 2.85, 0); marker.add(pennant) } marker.visible = false; marker.position.set(point.x, 0, point.z); this.arenaRoot.add(marker); this.objectiveMarkers.push(marker) })
  }
  private voxelTexture(base: string, stone: string): THREE.CanvasTexture {
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
  private voxelPart(parent: THREE.Group, size: [number, number, number], pos: [number, number, number], color: string, zone: 'head' | 'body' | 'limb'): THREE.Mesh { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color)); m.position.set(...pos); m.userData = { zone, botId: parent.userData.botId }; m.castShadow = false; parent.add(m); return m }
  private buildBots(): void {
    const starts = Array.from({ length: 99 }, (_, id) => { const angle = id / 99 * Math.PI * 2; const radius = 18 + (id % 5) * 1.2; return [Math.sin(angle) * radius, Math.cos(angle) * radius] as const })
    starts.forEach(([x, z], id) => {
      const group = new THREE.Group(); group.userData.botId = id
      const skin = OPERATOR_SKINS[(id * 3) % OPERATOR_SKINS.length]!
      const head = this.voxelPart(group, [0.9, 0.9, 0.9], [0, 2.55, 0], skin.trim, 'head')
      const hitMeshes = [head, this.voxelPart(group, [1.25, 1.35, 0.7], [0, 1.45, 0], skin.cloth, 'body'), this.voxelPart(group, [0.34, 1.25, 0.34], [-0.78, 1.42, 0], skin.accent, 'limb'), this.voxelPart(group, [0.34, 1.25, 0.34], [0.78, 1.42, 0], skin.accent, 'limb'), this.voxelPart(group, [0.42, 1.2, 0.42], [-0.38, 0.35, 0], skin.trim, 'limb'), this.voxelPart(group, [0.42, 1.2, 0.42], [0.38, 0.35, 0], skin.trim, 'limb')]
      const detail = (size: [number, number, number], pos: [number, number, number], color: string) => { const part = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color)); part.position.set(...pos); part.castShadow = false; group.add(part) }
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
      group.scale.setScalar(0.66); group.position.set(x, 0, z); this.scene.add(group)
      const profiles = ['MICA', 'HOLLOW', 'TUNDRA', 'RUST', 'KITE', 'MALLOW', 'QUARRY', 'WISP', 'TALLOW', 'CROW', 'SABLE', 'BRAMBLE', 'OCHRE', 'NORTH', 'FLINT', 'REED', 'CIRRUS', 'CLOVE', 'BASALT', 'LARK', 'MERCURY', 'PIPER', 'CINDER', 'WREN']
      const bot: Bot = { id, name: profiles[id]!, style: id % 4, root: group, hitMeshes, health: 100, nextShot: 1 + id * 0.4, respawnAt: 0, spawn: new THREE.Vector3(x, 0, z), phase: id * 1.7, kills: 0, deaths: 0, alive: true, team: 'red', stormTime: 0 }
      this.bots.push(bot); this.hitTargets.push(...hitMeshes)
    })
  }
  private updateViewModel(): void {
    for (const part of this.viewParts) part.removeFromParent()
    this.viewParts.length = 0
    const weapon = WEAPONS[this.currentWeapon]
    const selectedGun = this.currentWeapon === 'knife' ? undefined : armoryGun(this.currentWeapon === this.selectedHandgunBase() ? this.save.data.handgunGunId : this.save.data.primaryGunId)
    const knifeSkin = KNIFE_SKINS.find(item => item.id === this.save.data.knifeSkinId)
    const finish = skinFor(this.save.data.equipped[this.currentWeapon])
    const primary = this.currentWeapon === 'knife' ? knifeSkin?.color ?? weapon.color : finish?.color ?? selectedGun?.color ?? weapon.color
    const motif = finish?.pattern ?? knifeSkin?.id ?? 'plain'
    const motifCode = [...motif].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7)
    const ornament = new THREE.Color(primary).lerp(new THREE.Color('#f5deb0'), 0.48).getStyle()
    const operator = OPERATOR_SKINS.find(item => item.id === this.save.data.operatorSkinId) ?? operatorSkinForLevel(this.save.data.level)
    const addBox = (size: [number, number, number], pos: [number, number, number], color: string, metal = false) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color, metal))
      part.position.set(...pos); part.castShadow = true; this.weaponView.add(part); this.viewParts.push(part); return part
    }
    // Short sleeves and fitted gloves frame the weapon without hiding its silhouette.
    const leftSleeve = addBox([0.23, 0.5, 0.22], [-0.28, -0.46, -0.34], operator.cloth); leftSleeve.rotation.z = -0.18
    addBox([0.2, 0.15, 0.2], [-0.24, -0.69, -0.61], operator.trim)
    const rightSleeve = addBox([0.24, 0.52, 0.24], [0.48, -0.51, -0.32], operator.cloth); rightSleeve.rotation.z = 0.16
    addBox([0.22, 0.16, 0.24], [0.42, -0.47, -0.69], operator.trim)
    if (this.currentWeapon === 'knife') {
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
      addBox([receiverWidth, pistol ? 0.17 : 0.22, receiverLength], [0.36, -0.35, -0.57], primary)
      // Distinct pistol, compact SMG, long precision rifle and rifle proportions.
      const barrelLength = pistol ? 0.38 : sniper ? 1.75 : smg ? 0.92 : 1.28
      addBox([pistol ? 0.1 : 0.12, 0.1, barrelLength], [0.36, -0.31, -0.88 - barrelLength / 2], '#26313c')
      addBox([pistol ? 0.15 : 0.2, 0.12, 0.12], [0.36, -0.31, -0.88 - barrelLength], '#121a23', true)
      // The model index changes stock, handguard, magazine and optic outline across the armory.
      if (!pistol && model % 4 !== 1) addBox([0.3, 0.15, model % 2 ? 0.48 : 0.36], [0.36, -0.35, -0.12], '#514235')
      if (!pistol && model % 4 !== 0) addBox([receiverWidth, 0.15, 0.4], [0.36, -0.34, -0.91], selectedGun?.color ?? primary)
      if (model % 2 === 0 || !pistol) addBox([pistol ? 0.14 : 0.2, pistol ? 0.25 : 0.34, 0.17], [0.36, -0.58, -0.55], selectedGun?.color ?? primary)
      addBox([0.16, pistol ? 0.1 : 0.12, 0.28], [0.36, -0.53, -0.35], '#293540')
      if (sniper) {
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.62, 8), this.mat('#27333c'))
        scope.rotation.x = Math.PI / 2; scope.position.set(0.36, -0.17, -0.72); this.weaponView.add(scope); this.viewParts.push(scope)
        addBox([0.23, 0.08, 0.08], [0.36, -0.22, -0.72], '#a9d7db', true)
      } else {
        addBox([0.12, 0.11, pistol ? 0.12 : 0.3], [0.36, -0.18, -0.62], model % 3 === 1 ? '#1e2932' : '#485965')
      }
      addBox([0.045, 0.035, 0.2], [0.36, -0.13, -0.85], ornament, true)
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
  private botSpawn(bot: Bot): THREE.Vector3 { return new THREE.Vector3(bot.spawn.x * this.mapScale, 0, bot.spawn.z * this.mapScale) }
  start(matchType: MatchType = this.matchType, mapId: MapId = this.mapId, difficulty: BotDifficulty = this.difficulty, settings: MatchSettings = {}): void {
    this.matchType = matchType
    this.difficulty = difficulty
    this.royalePlayers = settings.royalePlayers === 30 || settings.royalePlayers === 50 || settings.royalePlayers === 100 ? settings.royalePlayers : 60
    this.teamSize = settings.teamSize === 1 || settings.teamSize === 4 ? settings.teamSize : 5
    const teamMode = ['tdm', 'domination', 'hardpoint', 'ctf', 'search'].includes(matchType)
    this.mapScale = matchType === 'training' ? 0.72 : teamMode ? (this.teamSize === 1 ? 0.48 : this.teamSize === 4 ? 0.68 : 0.82) : matchType === 'ffa' ? 0.82 : 1
    this.arenaRoot.scale.setScalar(this.mapScale)
    this.activeBotCount = matchType === 'training' ? 6 : matchType === 'ffa' ? 8 : matchType === 'royale' ? this.royalePlayers - 1 : teamMode ? this.teamSize * 2 - 1 : 6
    this.objective = ({ ffa: 'FIRST TO 12 ELIMINATIONS', tdm: 'FIRST TEAM TO 16 ELIMINATIONS', royale: 'BE THE LAST OPERATOR STANDING', training: 'MOVING TARGET PRACTICE', domination: 'CAPTURE AND HOLD THREE ZONES', hardpoint: 'CONTROL THE ROTATING HARDPOINT', ctf: 'STEAL THE ENEMY STANDARD', search: 'PLANT OR DEFUSE THE RELIC CHARGE' } satisfies Record<MatchType, string>)[matchType]
    if (mapId !== this.mapId) { this.mapId = mapId; this.buildArena() }
    this.matchTime = 0; this.blueScore = 0; this.redScore = 0; this.botScoreTimer = 8; this.stormDamageTimer = 0; this.battleSimTimer = 1.3; this.objectiveClock = 1; this.objectiveRotation = 0; this.zoneOwners.fill(null); this.zoneProgress.fill(0); this.flagCarried = false; this.flagScoreClock = 0; this.round = 1; this.roundClock = 0; this.roundBreak = 0; this.chargePlanted = false; this.chargeTimer = 0; this.plantProgress = 0; this.plantSite = 0
    this.objectiveMarkers.forEach((marker, index) => { marker.visible = matchType === 'domination' ? index < 3 : matchType === 'hardpoint' ? index === 0 : matchType === 'ctf' ? index >= 3 : matchType === 'search' ? index === 0 || index === 2 : false })
    this.relics.forEach(({ mesh }) => { mesh.visible = true }); this.activeSlot = 0; this.currentWeapon = this.selectedPrimaryBase(); this.slideLeft = 0; this.ammo = WEAPONS[this.currentWeapon].magazine; this.reloadLeft = 0; this.playerDeadUntil = 0; this.run = this.newRun(); this.teleport(this.playerSpawn()); this.yaw = Math.PI; this.pitch = 0; this.updateViewModel()
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
      bot.alive = i < activeCount; bot.root.visible = bot.alive; bot.health = 100; bot.respawnAt = 0; bot.stormTime = 0; bot.kills = 0; bot.deaths = 0; bot.root.position.set(bot.spawn.x * this.mapScale, 0, bot.spawn.z * this.mapScale); bot.nextShot = 1.1 + i * 0.16
      const teamColor = teamMode && bot.team === 'blue' ? '#4e9ce0' : '#cb6657'
      for (const mesh of [bot.hitMeshes[0], bot.hitMeshes[2], bot.hitMeshes[3]]) if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) mesh.material.color.set(teamColor)
    })
    this.run.aliveBots = activeCount
    this.mode = 'playing'; this.input.endFrame(); this.input.takeLook()
    const brief = ({ ffa: 'FREE FOR ALL', tdm: 'TEAM DEATHMATCH', royale: `${this.royalePlayers}-OPERATOR FRONTIER ROYALE`, training: 'AIM RANGE', domination: 'DOMINATION', hardpoint: 'HARDPOINT', ctf: 'CAPTURE THE STANDARD', search: 'RELIC SEARCH & DEFUSE' } satisfies Record<MatchType, string>)[matchType]
    this.hooks.banner(`${brief} // WASD MOVE · SHIFT SPRINT · CTRL+SHIFT SLIDE · SPACE JUMP · CLICK TO AIM`)
  }
  pause(): void { if (this.mode === 'playing') this.mode = 'paused' }
  resume(): void { if (this.mode !== 'paused') return; this.mode = 'playing'; this.input.endFrame(); this.input.takeLook() }
  toTitle(): void { this.mode = 'attract'; this.run = this.newRun() }
  setQuality(quality: 'low' | 'medium' | 'high'): void { this.renderer.applyQuality(quality) }
  setFov(fov: number): void { this.cameraInternal.fov = THREE.MathUtils.clamp(fov, 70, 110); this.cameraInternal.updateProjectionMatrix() }
  private playerSpawn(): THREE.Vector3 { return new THREE.Vector3(0, 0, -26 * this.mapScale) }
  private teleport(position: THREE.Vector3): void { this.player.root.position.copy(position); this.verticalVelocity = 0; this.horizontalVelocity.set(0, 0, 0); this.cameraLanding = 0 }
  step(dt: number): void {
    if (this.mode !== 'playing') return
    this.matchTime += dt; this.run.elapsed = this.matchTime; this.run.timeLeft = Math.max(0, (this.matchType === 'royale' ? 360 : this.matchType === 'training' ? 0 : 240) - this.matchTime); this.reloadLeft = Math.max(0, this.reloadLeft - dt); this.fireCooldown = Math.max(0, this.fireCooldown - dt); this.recoil = Math.max(0, this.recoil - dt * 4); this.flash = Math.max(0, this.flash - dt)
    this.handleWeaponInput(); if (this.input.consume('ping')) this.hooks.banner(`SQUAD PING // GRID ${Math.round(this.player.root.position.x + 30)}:${Math.round(this.player.root.position.z + 30)}`); this.handleMovement(dt); this.stepRelics(dt); this.handleReload(dt); this.handleFire(); this.stepBots(dt)
    if (this.matchType === 'tdm') this.stepTeamScore(dt)
    if (this.matchType === 'royale') this.stepRoyale(dt)
    if (this.matchType === 'domination' || this.matchType === 'hardpoint') this.stepControlMode(dt)
    if (this.matchType === 'ctf') this.stepCaptureTheFlag(dt)
    if (this.matchType === 'search') this.stepSearch(dt)
    if (this.playerDeadUntil && this.matchType !== 'royale' && this.matchTime >= this.playerDeadUntil) { this.run.health = 100; this.run.armor = 50; this.playerDeadUntil = 0; this.teleport(this.playerSpawn()); this.hooks.banner('RESPAWN // BACK IN THE FIGHT') }
    if (this.matchType === 'ffa' && this.run.kills >= 12) this.finish('won')
    else if ((this.matchType === 'tdm' && this.blueScore >= 16) || ((this.matchType === 'domination' || this.matchType === 'hardpoint') && this.blueScore >= 100) || (this.matchType === 'ctf' && this.blueScore >= 3)) this.finish('won')
    else if ((this.matchType === 'tdm' && this.redScore >= 16) || ((this.matchType === 'domination' || this.matchType === 'hardpoint') && this.redScore >= 100) || (this.matchType === 'ctf' && this.redScore >= 3)) this.finish('lost')
    else if (this.matchType === 'royale' && this.run.aliveBots <= 0 && !this.playerDeadUntil) this.finish('won')
    else if (this.run.timeLeft <= 0 && this.matchType !== 'training') this.finish(this.blueScore > this.redScore || (this.matchType === 'ffa' && this.run.kills > Math.max(...this.bots.map(bot => bot.kills))) ? 'won' : 'lost')
    this.run.ammo = this.ammo; this.run.reload = this.reloadLeft; this.run.weapon = this.currentWeapon; this.run.weaponName = this.activeWeaponName(); this.run.aimed = this.input.held('ads'); this.run.accuracy = this.run.shots ? this.run.hits / this.run.shots : 0; this.run.scoreboard = this.scoreboard()
  }
  private stepRelics(dt: number): void { for (const relic of this.relics) { if (!relic.mesh.visible) continue; relic.mesh.rotation.y += dt * 1.5; relic.mesh.position.y = Number(relic.mesh.userData.baseY) + Math.sin(this.matchTime * 2.2 + relic.at.x) * 0.12; if (this.player.root.position.distanceTo(this.worldPoint(relic.at)) < 1.7) { relic.mesh.visible = false; this.audio.play('pickup'); this.addXp(40); this.save.update({ credits: this.save.data.credits + 35 }); this.hooks.banner(`${this.mapName()} RELIC FOUND // +40 XP · +35 CR`) } } }
  private handleWeaponInput(): void { const wheel = this.input.takeWeaponWheel(); if (wheel) this.switchWeapon((this.activeSlot + wheel + 6) % 3); for (let i = 0; i < 3; i += 1) if (this.input.consume(`weapon${i + 1}` as Parameters<Input['consume']>[0])) this.switchWeapon(i); if (this.input.consume('inspect')) this.hooks.banner(`${WEAPONS[this.currentWeapon].name} // ${this.currentWeapon === 'knife' ? KNIFE_SKINS.find(s => s.id === this.save.data.knifeSkinId)?.name ?? 'FIELD SHARD' : armoryGun(this.currentWeapon === this.selectedHandgunBase() ? this.save.data.handgunGunId : this.save.data.primaryGunId).name}`) }
  private switchWeapon(index: number): void { const ids = [this.selectedPrimaryBase(), this.selectedHandgunBase(), 'knife' as WeaponId]; const id = ids[index]; if (!id || (id === this.currentWeapon && this.activeSlot === index) || this.reloadLeft > 0) return; this.activeSlot = index as 0 | 1 | 2; this.currentWeapon = id; this.ammo = WEAPONS[id].magazine; this.reloadLeft = 0; this.updateViewModel(); this.audio.play('ui') }
  private collisionAt(position: THREE.Vector3): { top: number; bottom: number } | undefined {
    const radius = 0.38 * this.mapScale
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
    if (this.playerDeadUntil) return
    this.slideLeft = Math.max(0, this.slideLeft - dt)
    const weapon = WEAPONS[this.currentWeapon]
    const crouching = this.input.held('crouch') && !this.slideLeft
    const grounded = this.player.root.position.y <= 0.03
    const wantsSlide = this.input.held('crouch') && this.input.held('sprint') && grounded && this.input.move.y > 0.15 && this.slideLeft <= 0.01
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw))
    if (wantsSlide) {
      this.slideLeft = 0.62
      this.slideDirection.copy(forward).multiplyScalar(this.input.move.y).addScaledVector(right, this.input.move.x).normalize()
      this.audio.play('dash')
    }
    const wish = forward.multiplyScalar(this.input.move.y).addScaledVector(right, this.input.move.x)
    if (wish.lengthSq() > 1) wish.normalize()
    const speed = (this.input.held('sprint') ? 10.8 : 8) * weapon.movement * (this.input.held('ads') ? 0.72 : 1) * (crouching ? 0.58 : 1)
    if (this.slideLeft > 0) {
      const slideSpeed = 8 + 4 * Math.min(1, this.slideLeft / 0.62)
      this.horizontalVelocity.lerp(this.slideDirection.clone().multiplyScalar(slideSpeed), 1 - Math.exp(-3.5 * dt))
    } else {
      const targetVelocity = wish.multiplyScalar(speed)
      const acceleration = grounded ? (this.input.move.x || this.input.move.y ? 30 : 18) : 9
      this.horizontalVelocity.lerp(targetVelocity, 1 - Math.exp(-acceleration * dt))
    }
    const move = this.horizontalVelocity.clone().multiplyScalar(dt)
    const jumpPressed = this.input.consume('jump')
    const wasGrounded = this.player.root.position.y <= 0.03
    const moveAxis = (axis: 'x' | 'z', amount: number): void => {
      if (!amount) return
      const candidate = this.player.root.position.clone()
      candidate[axis] += amount
      candidate.x = THREE.MathUtils.clamp(candidate.x, -27 * this.mapScale, 27 * this.mapScale)
      candidate.z = THREE.MathUtils.clamp(candidate.z, -27 * this.mapScale, 27 * this.mapScale)
      const hit = this.collisionAt(candidate)
      if (hit) {
        const rise = hit.top - this.player.root.position.y
        if (jumpPressed && wasGrounded && rise > 0.08 && rise <= 2.25 * this.mapScale) {
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
    if (jumpPressed && wasGrounded && this.player.root.position.y <= 0.03) {
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
    this.cameraBobY = THREE.MathUtils.damp(this.cameraBobY, grounded ? Math.sin(this.bobPhase) * Math.min(0.045, moveSpeed * 0.005) : 0, 12, dt)
    this.cameraLanding = THREE.MathUtils.damp(this.cameraLanding, 0, 17, dt)
  }

  private handleReload(dt: number): void { if (this.reloadLeft <= 0 && this.input.consume('reload') && this.ammo < WEAPONS[this.currentWeapon].magazine) { this.reloadLeft = WEAPONS[this.currentWeapon].reload; this.audio.play('reload') } if (this.reloadLeft > 0 && this.reloadLeft <= dt) this.ammo = WEAPONS[this.currentWeapon].magazine }
  private handleFire(): void { const weapon = WEAPONS[this.currentWeapon]; if ((this.matchType === 'search' && this.roundClock < 8) || this.reloadLeft > 0 || this.playerDeadUntil || !this.input.held('shoot') || this.fireCooldown > 0) return; if (this.ammo <= 0) { this.audio.play('empty'); this.fireCooldown = 0.18; return } this.ammo -= 1; this.run.shots += 1; this.fireCooldown = 1 / weapon.fireRate; this.recoil = weapon.recoil; this.flash = 0.04; this.audio.play('gunshot'); const spread = weapon.spread * (this.input.held('ads') ? 0.25 : 1) * (1 + this.run.shots % 4 * 0.08); this.raycaster.setFromCamera(new THREE.Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread), this.cameraInternal); const hit = this.raycaster.intersectObjects(this.hitTargets, false)[0]; if (!hit || hit.distance > weapon.range) return; const wall = this.raycaster.intersectObjects(this.arenaRoot.children, true)[0]; if (wall && wall.distance + 0.02 < hit.distance) return; const botId = hit.object.userData.botId as number; const bot = this.bots.find(item => item.id === botId); if (!bot || !bot.alive || (['tdm', 'domination', 'hardpoint', 'ctf', 'search'].includes(this.matchType) && bot.team === 'blue')) return; const headshot = hit.object.userData.zone === 'head'; const damage = Math.max(weapon.damage * 0.48, weapon.damage * (1 - hit.distance / weapon.range * 0.46)) * (headshot ? weapon.headshot : 1); bot.health -= damage; this.run.hits += 1; this.audio.play('hit'); this.hooks.hitmarker(headshot); this.hooks.popup(`${Math.round(damage)}${headshot ? ' HS' : ''}`, this.project(hit.point), 'score'); if (bot.health <= 0) this.killBot(bot, headshot) }
  private killBot(bot: Bot, headshot: boolean): void { if (['tdm', 'domination', 'hardpoint', 'ctf', 'search'].includes(this.matchType) && bot.team === 'blue') return; bot.alive = false; bot.root.visible = false; bot.deaths += 1; bot.respawnAt = this.matchType === 'royale' || this.matchType === 'search' ? Number.POSITIVE_INFINITY : this.matchTime + 2.2; this.run.kills += 1; const weaponKills = { ...this.save.data.weaponKills, [this.currentWeapon]: (this.save.data.weaponKills[this.currentWeapon] ?? 0) + 1 }; this.save.update({ weaponKills }); this.advanceDaily(headshot, bot); this.run.aliveBots = this.bots.filter(item => item.alive && item.id < this.activeBotCount).length; if (this.matchType === 'tdm') this.blueScore += 1; if (headshot) this.run.headshots += 1; this.run.score += headshot ? 150 : 100; this.addXp(headshot ? 85 : 55); this.save.update({ stats: { ...this.save.data.stats, kills: this.save.data.stats.kills + 1, headshots: this.save.data.stats.headshots + (headshot ? 1 : 0), shots: this.save.data.stats.shots + this.run.shots, hits: this.save.data.stats.hits + this.run.hits } }); this.hooks.killfeed(`YOU eliminated ${bot.name}`, headshot) }
  private stepBots(dt: number): void {
    const playerPos = this.player.root.position
    for (const bot of this.bots) {
      if (bot.id >= this.activeBotCount) continue
      if (!bot.alive) { if (this.matchType !== 'royale' && this.matchType !== 'search' && this.matchTime >= bot.respawnAt) { bot.alive = true; bot.health = 100; bot.root.visible = true; bot.root.position.copy(this.botSpawn(bot)) } continue }
      bot.phase += dt * (0.45 + bot.id * 0.04)
      const isAlly = ['tdm', 'domination', 'hardpoint', 'ctf', 'search'].includes(this.matchType) && bot.team === 'blue'
      const toPlayer = new THREE.Vector3(playerPos.x - bot.root.position.x, 0, playerPos.z - bot.root.position.z)
      const distance = toPlayer.length()
      if (isAlly && this.matchType === 'tdm' && this.playerDeadUntil) { if (distance > 1.7) { bot.root.position.x += toPlayer.x / Math.max(distance, 1) * dt * 4; bot.root.position.z += toPlayer.z / Math.max(distance, 1) * dt * 4 } else if (this.matchTime - this.playerDownedAt >= 1.4) { this.playerDeadUntil = 0; this.run.health = 55; this.run.armor = 20; this.teleport(playerPos.clone().add(new THREE.Vector3(1.1, 0, 1.1))); this.hooks.banner(`${bot.name} // REVIVED YOU`) } continue }
      if (this.matchType === 'training') { bot.root.position.x = bot.spawn.x * this.mapScale + Math.sin(bot.phase * 0.6) * 1.5 * this.mapScale; bot.root.position.z = bot.spawn.z * this.mapScale + Math.cos(bot.phase * 0.7) * 1.5 * this.mapScale; continue }
      if (this.matchType === 'search' && this.roundClock < 8) continue
      if (!isAlly && distance < 54 && !this.playerDeadUntil) {
        bot.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z)
        if (this.matchTime >= bot.nextShot) {
          const reaction = { recruit: 1.35, regular: 0.95, veteran: 0.7, elite: 0.52 }[this.difficulty] * (0.88 + bot.style * 0.1)
          const aim = { recruit: 0.38, regular: 0.58, veteran: 0.72, elite: 0.84 }[this.difficulty] * (0.92 + bot.style * 0.045)
          bot.nextShot = this.matchTime + reaction + bot.id * 0.035
          if (Math.random() < Math.max(0.1, aim - distance * 0.012)) { const origin = bot.root.position.clone().setY(1.6); const direction = playerPos.clone().setY(1.4).sub(origin); const distanceToTarget = direction.length(); this.visionRaycaster.set(origin, direction.normalize()); this.visionRaycaster.far = distanceToTarget; const obstruction = this.visionRaycaster.intersectObjects(this.arenaRoot.children, true)[0]; this.visionRaycaster.far = Infinity; if (!obstruction) this.damagePlayer(7 + bot.id % 3 * 2, bot) }
        }
        if (distance > 8) { const flank = bot.style === 1 ? Math.sin(bot.phase) * 0.8 : 0; bot.root.position.x += (toPlayer.x / Math.max(distance, 1) + flank) * dt * (2.4 + bot.style * 0.2); bot.root.position.z += toPlayer.z / Math.max(distance, 1) * dt * (2.4 + bot.style * 0.2) }
      } else {
        bot.root.position.x = bot.spawn.x * this.mapScale + Math.sin(bot.phase) * 4.2 * this.mapScale
        bot.root.position.z = bot.spawn.z * this.mapScale + Math.cos(bot.phase * 0.8) * 3.8 * this.mapScale
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
      if (this.zoneProgress[i]! >= 3 && this.zoneOwners[i] !== 'blue') { this.zoneOwners[i] = 'blue'; this.hooks.banner(`ZONE ${String.fromCharCode(65 + i)} SECURED // BLUE`); this.audio.play('pickup'); this.objectiveMarkers[i]?.children.forEach(child => { if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) child.material.color.set('#56b9ef') }) }
      else if (this.zoneProgress[i]! <= -3 && this.zoneOwners[i] !== 'red') { this.zoneOwners[i] = 'red'; this.hooks.banner(`ZONE ${String.fromCharCode(65 + i)} LOST // RED`); this.objectiveMarkers[i]?.children.forEach(child => { if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) child.material.color.set('#e56e61') }) }
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
  private stepSearch(dt: number): void {
    if (this.roundBreak > 0) {
      this.roundBreak = Math.max(0, this.roundBreak - dt)
      this.objective = `ROUND ${this.round} · NEXT DEPLOY ${Math.ceil(this.roundBreak)}S`
      if (this.roundBreak === 0 && this.blueScore < 5 && this.redScore < 5) {
        this.round += 1; this.roundClock = 0; this.chargePlanted = false; this.chargeTimer = 0; this.plantProgress = 0; this.playerDeadUntil = 0; this.run.health = 100; this.run.armor = 50; this.teleport(this.playerSpawn())
        for (const bot of this.bots.slice(0, this.activeBotCount)) { bot.alive = true; bot.health = 100; bot.root.visible = true; bot.respawnAt = 0; bot.root.position.copy(this.botSpawn(bot)) }
      }
      return
    }
    this.roundClock += dt
    if (this.roundClock < 8) { this.objective = `ROUND ${this.round} · BUY PHASE · ${Math.ceil(8 - this.roundClock)}S`; return }
    const site = this.worldPoint(this.objectivePoints[this.plantSite === 0 ? 0 : 2]!)
    if (!this.chargePlanted && this.roundClock >= 24 && this.bots.some(bot => bot.id < this.activeBotCount && bot.alive && bot.team === 'red')) { this.plantProgress += dt; this.objective = `CHARGE PLANTING · ${Math.max(0, 3 - this.plantProgress).toFixed(1)}S`; if (this.plantProgress >= 3) { this.chargePlanted = true; this.chargeTimer = 28; this.plantProgress = 0; this.hooks.banner(`RELIC CHARGE ARMED // SITE ${this.plantSite ? 'B' : 'A'}`); this.audio.play('pickup') } }
    if (this.chargePlanted) {
      this.chargeTimer = Math.max(0, this.chargeTimer - dt)
      if (this.player.root.position.distanceTo(site) < 3.5 && this.input.held('interact')) this.plantProgress += dt
      else this.plantProgress = 0
      if (this.plantProgress >= 3) { this.chargePlanted = false; this.plantProgress = 0; this.roundWin('blue', 'CHARGE DEFUSED') }
      else if (this.chargeTimer <= 0) { this.chargePlanted = false; this.roundWin('red', 'CHARGE DETONATED') }
      else this.objective = `CHARGE ARMED · ${Math.ceil(this.chargeTimer)}S · HOLD E TO DEFUSE`
    }
    const redAlive = this.bots.slice(0, this.activeBotCount).some(bot => bot.alive && bot.team === 'red')
    const blueAlive = !this.playerDeadUntil || this.bots.slice(0, this.activeBotCount).some(bot => bot.alive && bot.team === 'blue')
    if (!redAlive && !this.roundBreak) this.roundWin('blue', 'ATTACKERS ELIMINATED')
    else if (!blueAlive && !this.roundBreak) this.roundWin('red', 'DEFENDERS ELIMINATED')
    else if (this.roundClock >= 68 && !this.chargePlanted && !this.roundBreak) this.roundWin('blue', 'TIME EXPIRED · SITE SECURE')
  }
  private roundWin(team: 'blue' | 'red', reason: string): void { if (this.roundBreak > 0) return; if (team === 'blue') this.blueScore += 1; else this.redScore += 1; this.roundBreak = 4; this.hooks.banner(`${reason} // ${team.toUpperCase()} ROUND ${team === 'blue' ? this.blueScore : this.redScore}`); this.hooks.killfeed(`${team.toUpperCase()} TEAM WON ROUND ${this.round}`, false); if (this.blueScore >= 5 || this.redScore >= 5) this.finish(this.blueScore > this.redScore ? 'won' : 'lost') }
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
  private damagePlayer(amount: number, bot: Bot | null): void { if (this.playerDeadUntil) return; const armorAbsorb = Math.min(this.run.armor, amount * 0.55); this.run.armor = Math.max(0, this.run.armor - armorAbsorb); this.run.health = Math.max(0, this.run.health - (amount - armorAbsorb)); this.audio.play('hurt'); this.hooks.hurt(); this.hooks.popup(`-${Math.round(amount - armorAbsorb)}`, this.project(this.player.root.position.clone().setY(1.4)), 'hurt'); if (this.run.health <= 0) { this.run.deaths += 1; this.playerDownedAt = this.matchTime; this.playerDeadUntil = this.matchType === 'royale' || this.matchType === 'search' ? Number.POSITIVE_INFINITY : this.matchTime + (this.matchType === 'tdm' ? 4.4 : 2.2); this.save.update({ stats: { ...this.save.data.stats, deaths: this.save.data.stats.deaths + 1 } }); this.hooks.killfeed(`${bot ? bot.name : 'THE STORM'} eliminated YOU`, false); this.run.health = 0; this.run.armor = 0; if (this.matchType === 'royale') this.finish('lost') } }
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
  private scoreboard(): GameSnapshot['scoreboard'] { return [{ name: this.save.data.playerName, kills: this.run.kills, deaths: this.run.deaths, ping: 18, you: true, team: 'blue' as const }, ...this.bots.filter(bot => bot.id < this.activeBotCount).map(bot => ({ name: bot.name, kills: bot.kills, deaths: bot.deaths, ping: 22 + bot.id * 2, team: bot.team }))].sort((a, b) => b.kills - a.kills) }
  private mapName(): string { return HISTORIC_MAPS.find(map => map.id === this.mapId)?.name.toUpperCase() ?? 'AURELIAN FORUM' }
  private finish(phase: 'won' | 'lost'): void { if (this.run.phase !== 'playing') return; this.run.phase = phase; this.mode = 'ended'; this.input.unlockPointer(); const mvpBonus = phase === 'won' ? 300 : 0; const xp = Math.max(70, this.run.kills * 55 + this.run.headshots * 30 + (phase === 'won' ? 250 : 80) + mvpBonus); this.addXp(xp); this.save.update({ stats: { ...this.save.data.stats, matches: this.save.data.stats.matches + 1, wins: this.save.data.stats.wins + (phase === 'won' ? 1 : 0), shots: this.save.data.stats.shots + this.run.shots, hits: this.save.data.stats.hits + this.run.hits } }); this.hooks.end(this.snapshot()) }
  debugFinish(): void { this.run.kills = 12; this.finish('won') }
  render(_alpha: number, frameSeconds: number): void { const look = this.mode === 'playing' ? this.input.takeLook() : { x: 0, y: 0 }; if (this.mode === 'playing') { this.yaw -= look.x; this.pitch = THREE.MathUtils.clamp(this.pitch - look.y, -1.35, 1.25) } const moveSpeed = Math.hypot(this.horizontalVelocity.x, this.horizontalVelocity.z); const running = this.mode === 'playing' && this.input.held('sprint') && moveSpeed > 1; this.sprintPose = THREE.MathUtils.damp(this.sprintPose, running ? 1 : 0, 9, frameSeconds); this.weaponSwayX = THREE.MathUtils.damp(this.weaponSwayX, THREE.MathUtils.clamp(-look.x * 0.32, -0.12, 0.12), 14, frameSeconds); this.weaponSwayY = THREE.MathUtils.damp(this.weaponSwayY, THREE.MathUtils.clamp(-look.y * 0.25, -0.1, 0.1), 14, frameSeconds); this.cameraInternal.position.set(this.player.root.position.x, this.player.root.position.y + 1.65 + this.cameraBobY + this.cameraLanding, this.player.root.position.z); this.cameraInternal.rotation.set(this.pitch + this.recoil * 0.16, this.yaw, 0); const viewFit = THREE.MathUtils.clamp(this.cameraInternal.aspect / 1.15, 0.52, 1); this.weaponView.position.set(0.08 + this.weaponSwayX + this.horizontalVelocity.x * 0.004 + (1 - viewFit) * 0.22, -0.04 + this.cameraBobY * 0.4 - this.sprintPose * 0.2 - (1 - viewFit) * 0.1, -0.65 + this.recoil * 0.1 + this.sprintPose * 0.1); this.weaponView.rotation.set(-this.sprintPose * 0.38 + this.recoil * 0.7 + this.weaponSwayY, -this.weaponSwayX * 0.65, -this.horizontalVelocity.x * 0.012); this.weaponView.scale.setScalar((this.flash > 0 ? 0.68 : 0.66) * viewFit); this.lastFrame += frameSeconds; this.renderer.render(this.scene, this.cameraInternal) }
  snapshot(): GameSnapshot { return { ...this.run, matchType: this.matchType, mapId: this.mapId, blueScore: this.blueScore, redScore: this.redScore, aliveBots: this.bots.filter(bot => bot.alive && bot.id < this.activeBotCount).length, accuracy: this.run.shots ? this.run.hits / this.run.shots : 0, ammo: this.ammo, reload: this.reloadLeft, weapon: this.currentWeapon, weaponName: this.activeWeaponName(), aimed: this.input.held('ads'), level: this.save.data.level, xp: this.save.data.xp, nextXp: xpForLevel(this.save.data.level), credits: this.save.data.credits, playerX: this.player.root.position.x, playerZ: this.player.root.position.z, yaw: this.yaw, objective: this.objective, scoreboard: this.scoreboard() } }
  project(world: THREE.Vector3): { x: number; y: number } { const v = world.clone().project(this.cameraInternal); return { x: ((v.x + 1) / 2) * this.renderer.canvas.clientWidth, y: ((1 - v.y) / 2) * this.renderer.canvas.clientHeight } }
}
