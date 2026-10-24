import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import type { Renderer } from '../engine/renderer'
import { SaveStore, xpForLevel } from '../engine/save'
import { OPERATOR_SKINS, SKINS, WEAPONS, WEAPON_ORDER, operatorSkinForLevel, skinFor, type BotDifficulty, type MapId, type MatchType, type WeaponId } from './fps'

export type Mode = 'attract' | 'playing' | 'paused' | 'ended'
export type GameSnapshot = { phase: 'playing' | 'won' | 'lost'; matchType: MatchType; mapId: MapId; timeLeft: number; elapsed: number; score: number; kills: number; deaths: number; headshots: number; shots: number; hits: number; accuracy: number; health: number; armor: number; ammo: number; magazine: number; weapon: WeaponId; weaponName: string; aimed: boolean; reload: number; level: number; xp: number; nextXp: number; credits: number; blueScore: number; redScore: number; aliveBots: number; stormRadius: number; playerX: number; playerZ: number; yaw: number; scoreboard: { name: string; kills: number; deaths: number; ping: number; you?: boolean; team?: 'blue' | 'red' }[] }
export type GameHooks = { popup(text: string, screen: { x: number; y: number }, kind: 'score' | 'hurt'): void; hitmarker(headshot: boolean): void; hurt(): void; killfeed(text: string, headshot: boolean): void; banner(text: string): void; end(run: GameSnapshot): void }
type Bot = { id: number; root: THREE.Group; hitMeshes: THREE.Object3D[]; health: number; nextShot: number; respawnAt: number; spawn: THREE.Vector3; phase: number; kills: number; deaths: number; alive: boolean; team: 'blue' | 'red'; stormTime: number }

type MutableRun = GameSnapshot & { phase: 'playing' | 'won' | 'lost' }

export class Game {
  mode: Mode = 'attract'
  run: MutableRun
  readonly scene = new THREE.Scene()
  readonly player = { root: new THREE.Group(), teleport: (position: THREE.Vector3) => this.teleport(position) }
  readonly cores = { remaining: () => [] as THREE.Vector3[] }
  private readonly arenaRoot = new THREE.Group()
  private readonly cameraInternal = new THREE.PerspectiveCamera(72, 1, 0.05, 180)
  private readonly raycaster = new THREE.Raycaster()
  private readonly bots: Bot[] = []
  private readonly hitTargets: THREE.Object3D[] = []
  private readonly weaponView = new THREE.Group()
  private currentWeapon: WeaponId = 'glock'
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
  private lastFrame = 0
  private readonly spawn = new THREE.Vector3(0, 0, 22)
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
  private newRun(): MutableRun { const w = WEAPONS[this.currentWeapon]; return { phase: 'playing', matchType: this.matchType, mapId: this.mapId, timeLeft: this.matchType === 'royale' ? 180 : 150, elapsed: 0, score: 0, kills: 0, deaths: 0, headshots: 0, shots: 0, hits: 0, accuracy: 0, health: 100, armor: 50, ammo: w.magazine, magazine: w.magazine, weapon: this.currentWeapon, weaponName: w.name, aimed: false, reload: 0, level: this.save.data.level, xp: this.save.data.xp, nextXp: xpForLevel(this.save.data.level), credits: this.save.data.credits, blueScore: 0, redScore: 0, aliveBots: 0, stormRadius: 30, playerX: 0, playerZ: 0, yaw: 0, scoreboard: [] } }
  private buildLighting(): void { this.scene.add(new THREE.HemisphereLight('#a6d4ff', '#07111c', 1.8)); const sun = new THREE.DirectionalLight('#d4f5ff', 2.8); sun.position.set(-20, 34, 12); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); this.scene.add(sun); const cyan = new THREE.PointLight('#10d7c3', 16, 34); cyan.position.set(-18, 5, -18); this.scene.add(cyan); const magenta = new THREE.PointLight('#a949ff', 14, 28); magenta.position.set(18, 4, 12); this.scene.add(magenta) }
  private mat(color: string, emissive = false): THREE.MeshStandardMaterial { return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.18, emissive: emissive ? color : '#000000', emissiveIntensity: emissive ? 2.4 : 0 }) }
  private block(size: THREE.Vector3, position: THREE.Vector3, color: string, emissive = false, rotation = 0): THREE.Mesh { const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), this.mat(color, emissive)); mesh.position.copy(position); mesh.rotation.y = rotation; mesh.castShadow = true; mesh.receiveShadow = true; this.arenaRoot.add(mesh); return mesh }
  private buildArena(): void {
    this.arenaRoot.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()) } })
    this.arenaRoot.clear()
    const palettes: Record<MapId, { ground: string; stone: string; trim: string; fog: string; sky: string; name: string }> = {
      'aurelian-forum': { ground: '#62594e', stone: '#95856e', trim: '#c69b55', fog: '#504942', sky: '#54473f', name: 'Aurelian Forum' },
      'sun-archive': { ground: '#816a46', stone: '#c09a60', trim: '#4b9c91', fog: '#6a5a42', sky: '#766044', name: 'Sun Archive' },
      fjordgate: { ground: '#40555b', stone: '#6a7a78', trim: '#c58b5e', fog: '#394b54', sky: '#344c57', name: 'Fjordgate' },
    }
    const palette = palettes[this.mapId]
    this.scene.background = new THREE.Color(palette.sky)
    this.scene.fog = new THREE.Fog(palette.fog, 46, 115)
    this.block(new THREE.Vector3(64, 0.4, 64), new THREE.Vector3(0, -0.2, 0), palette.ground)
    const grid = new THREE.GridHelper(64, 32, palette.trim, palette.stone); grid.position.y = 0.015; this.arenaRoot.add(grid)
    for (const [x, z, sx, sz] of [[0, -31, 64, 1], [0, 31, 64, 1], [-31, 0, 1, 64], [31, 0, 1, 64]] as const) this.block(new THREE.Vector3(sx, 6, sz), new THREE.Vector3(x, 3, z), palette.stone)
    const cover = [[-12, -12, 4, 3, 2], [-7, -12, 3, 3, 2], [10, -8, 4, 3, 3], [15, -8, 3, 3, 2], [-15, 8, 3, 4, 2], [-9, 12, 5, 3, 2], [11, 12, 3, 5, 2], [3, 19, 4, 3, 2], [-20, -1, 3, 3, 3], [20, 0, 3, 3, 3], [0, 4, 3, 6, 2], [0, -4, 3, 6, 2]] as const
    for (const [x, z, sx, sz, sy] of cover) this.block(new THREE.Vector3(sx, sy, sz), new THREE.Vector3(x, sy / 2, z), palette.stone)
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
        this.block(new THREE.Vector3(38, 0.45, 2.6), new THREE.Vector3(0, 5, z), palette.trim)
      }
      this.block(new THREE.Vector3(22, 1.4, 12), new THREE.Vector3(0, 0.7, -22), palette.trim)
    } else {
      for (const z of [-17, -11, 11, 17]) {
        for (const x of [-18, -12, 12, 18]) this.block(new THREE.Vector3(1.2, 5.5, 1.2), new THREE.Vector3(x, 2.75, z), palette.stone)
        this.block(new THREE.Vector3(40, 0.45, 1.8), new THREE.Vector3(0, 5.4, z), palette.trim)
      }
    }
    for (const [x, z, r] of [[-24, 21, 3], [23, 21, 3], [-23, -21, 3], [23, -21, 3]] as const) { const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 8), this.mat(palette.trim)); pad.position.set(x, 0.08, z); this.arenaRoot.add(pad) }
    const sign = this.block(new THREE.Vector3(13, 3.2, 0.18), new THREE.Vector3(0, 4.8, -30.4), '#282720'); const rune = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.12, 0.05), this.mat(palette.trim, true)); rune.position.set(0, 0.4, -0.12); sign.add(rune)
  }
  private voxelPart(parent: THREE.Group, size: [number, number, number], pos: [number, number, number], color: string, zone: 'head' | 'body' | 'limb'): THREE.Mesh { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color)); m.position.set(...pos); m.userData = { zone, botId: parent.userData.botId }; m.castShadow = true; parent.add(m); return m }
  private buildBots(): void {
    const starts = Array.from({ length: 24 }, (_, id) => { const angle = id / 24 * Math.PI * 2; return [Math.sin(angle) * 23, Math.cos(angle) * 23] as const })
    starts.forEach(([x, z], id) => {
      const group = new THREE.Group(); group.userData.botId = id
      const skin = OPERATOR_SKINS[(id * 3) % OPERATOR_SKINS.length]!
      const head = this.voxelPart(group, [0.9, 0.9, 0.9], [0, 2.55, 0], skin.trim, 'head')
      const hitMeshes = [head, this.voxelPart(group, [1.25, 1.35, 0.7], [0, 1.45, 0], skin.cloth, 'body'), this.voxelPart(group, [0.34, 1.25, 0.34], [-0.78, 1.42, 0], skin.accent, 'limb'), this.voxelPart(group, [0.34, 1.25, 0.34], [0.78, 1.42, 0], skin.accent, 'limb'), this.voxelPart(group, [0.42, 1.2, 0.42], [-0.38, 0.35, 0], '#202b38', 'limb'), this.voxelPart(group, [0.42, 1.2, 0.42], [0.38, 0.35, 0], '#202b38', 'limb')]
      const detail = (size: [number, number, number], pos: [number, number, number], color: string) => { const part = new THREE.Mesh(new THREE.BoxGeometry(...size), this.mat(color)); part.position.set(...pos); part.castShadow = true; group.add(part) }
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
      group.position.set(x, 0, z); this.scene.add(group)
      const bot: Bot = { id, root: group, hitMeshes, health: 100, nextShot: 1 + id * 0.4, respawnAt: 0, spawn: new THREE.Vector3(x, 0, z), phase: id * 1.7, kills: 0, deaths: 0, alive: true, team: 'red', stormTime: 0 }
      this.bots.push(bot); this.hitTargets.push(...hitMeshes)
    })
  }
  private updateViewModel(): void {
    for (const part of this.viewParts) part.removeFromParent(); this.viewParts.length = 0
    const weapon = WEAPONS[this.currentWeapon]; const skin = skinFor(this.save.data.equipped[this.currentWeapon]); const primary = skin?.color ?? weapon.color; const operator = OPERATOR_SKINS.find(item => item.id === this.save.data.operatorSkinId) ?? operatorSkinForLevel(this.save.data.level)
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.72, 0.38), this.mat(operator.cloth)); sleeve.position.set(-0.27, -0.39, -0.53); sleeve.rotation.z = -0.22; this.weaponView.add(sleeve); this.viewParts.push(sleeve)
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.3), this.mat(operator.trim)); glove.position.set(-0.23, -0.68, -0.8); this.weaponView.add(glove); this.viewParts.push(glove)
    const rightSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.76, 0.4), this.mat(operator.cloth)); rightSleeve.position.set(0.5, -0.5, -0.39); rightSleeve.rotation.z = 0.18; this.weaponView.add(rightSleeve); this.viewParts.push(rightSleeve)
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(this.currentWeapon === 'knife' ? 0.12 : 0.34, this.currentWeapon === 'knife' ? 0.18 : 0.22, this.currentWeapon === 'awp' ? 1.2 : 0.85), this.mat(primary)); receiver.position.set(0.35, -0.28, -0.65); receiver.rotation.x = 0.03; receiver.castShadow = true; this.weaponView.add(receiver); this.viewParts.push(receiver)
    if (this.currentWeapon === 'knife') { const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.75), this.mat(primary, true)); blade.position.set(0.25, -0.18, -1.08); blade.rotation.x = -0.18; this.weaponView.add(blade); this.viewParts.push(blade) } else { const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, this.currentWeapon === 'awp' ? 1.9 : 1.15), this.mat('#121a22')); barrel.position.set(0.35, -0.25, -1.18); this.weaponView.add(barrel); this.viewParts.push(barrel); const sight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.34), this.mat('#8cebe0', true)); sight.position.set(0.35, -0.1, -0.72); this.weaponView.add(sight); this.viewParts.push(sight) }
  }
  start(matchType: MatchType = this.matchType, mapId: MapId = this.mapId, difficulty: BotDifficulty = this.difficulty): void {
    this.matchType = matchType
    this.difficulty = difficulty
    if (mapId !== this.mapId) { this.mapId = mapId; this.buildArena() }
    this.matchTime = 0; this.blueScore = 0; this.redScore = 0; this.botScoreTimer = 8; this.stormDamageTimer = 0
    this.currentWeapon = 'glock'; this.ammo = WEAPONS.glock.magazine; this.reloadLeft = 0; this.playerDeadUntil = 0; this.run = this.newRun(); this.teleport(this.spawn); this.yaw = Math.PI; this.pitch = -0.03; this.updateViewModel()
    const activeCount = matchType === 'ffa' ? 6 : matchType === 'tdm' ? 9 : 24
    this.bots.forEach((bot, i) => {
      bot.team = matchType === 'tdm' && i < 4 ? 'blue' : 'red'
      bot.alive = i < activeCount; bot.root.visible = bot.alive; bot.health = 100; bot.respawnAt = 0; bot.stormTime = 0; bot.kills = 0; bot.deaths = 0; bot.root.position.copy(bot.spawn); bot.nextShot = 1.1 + i * 0.16
      const teamColor = matchType === 'tdm' && bot.team === 'blue' ? '#4e9ce0' : '#cb6657'
      for (const mesh of [bot.hitMeshes[0], bot.hitMeshes[2], bot.hitMeshes[3]]) if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) mesh.material.color.set(teamColor)
    })
    this.run.aliveBots = activeCount
    this.mode = 'playing'; this.input.endFrame(); this.input.takeLook()
    const brief = matchType === 'ffa' ? 'FREE FOR ALL // FIRST TO 12' : matchType === 'tdm' ? 'TEAM DEATHMATCH // FIRST TO 16' : 'FRONTIER ROYALE // LAST ONE STANDING'
    this.hooks.banner(`${brief} // ${this.mapName()}`)
  }
  pause(): void { if (this.mode === 'playing') this.mode = 'paused' }
  resume(): void { if (this.mode !== 'paused') return; this.mode = 'playing'; this.input.endFrame(); this.input.takeLook() }
  toTitle(): void { this.mode = 'attract'; this.run = this.newRun() }
  setQuality(quality: 'low' | 'medium' | 'high'): void { this.renderer.applyQuality(quality) }
  private teleport(position: THREE.Vector3): void { this.player.root.position.copy(position); this.verticalVelocity = 0 }
  step(dt: number): void {
    if (this.mode !== 'playing') return
    this.matchTime += dt; this.run.elapsed = this.matchTime; this.run.timeLeft = Math.max(0, (this.matchType === 'royale' ? 180 : 150) - this.matchTime); this.reloadLeft = Math.max(0, this.reloadLeft - dt); this.fireCooldown = Math.max(0, this.fireCooldown - dt); this.recoil = Math.max(0, this.recoil - dt * 4); this.flash = Math.max(0, this.flash - dt)
    this.handleWeaponInput(); this.handleMovement(dt); this.handleReload(dt); this.handleFire(); this.stepBots(dt)
    if (this.matchType === 'tdm') this.stepTeamScore(dt)
    if (this.matchType === 'royale') this.stepRoyale(dt)
    if (this.playerDeadUntil && this.matchType !== 'royale' && this.matchTime >= this.playerDeadUntil) { this.run.health = 100; this.run.armor = 50; this.playerDeadUntil = 0; this.teleport(this.spawn); this.hooks.banner('RESPAWN // BACK IN THE FIGHT') }
    if (this.matchType === 'ffa' && this.run.kills >= 12) this.finish('won')
    else if (this.matchType === 'tdm' && this.blueScore >= 16) this.finish('won')
    else if (this.matchType === 'tdm' && this.redScore >= 16) this.finish('lost')
    else if (this.matchType === 'royale' && this.run.aliveBots <= 0 && !this.playerDeadUntil) this.finish('won')
    else if (this.run.timeLeft <= 0) this.finish('lost')
    this.run.ammo = this.ammo; this.run.reload = this.reloadLeft; this.run.weapon = this.currentWeapon; this.run.weaponName = WEAPONS[this.currentWeapon].name; this.run.aimed = this.input.held('ads'); this.run.accuracy = this.run.shots ? this.run.hits / this.run.shots : 0; this.run.scoreboard = this.scoreboard()
  }
  private handleWeaponInput(): void { const wheel = this.input.takeWeaponWheel(); if (wheel) this.switchWeapon((WEAPON_ORDER.indexOf(this.currentWeapon) + wheel + WEAPON_ORDER.length * 4) % WEAPON_ORDER.length); for (let i = 0; i < WEAPON_ORDER.length; i += 1) if (this.input.consume(`weapon${i + 1}` as Parameters<Input['consume']>[0])) this.switchWeapon(i); if (this.input.consume('inspect')) this.hooks.banner(`${WEAPONS[this.currentWeapon].name} // ${skinFor(this.save.data.equipped[this.currentWeapon])?.name ?? 'STANDARD ISSUE'}`) }
  private switchWeapon(index: number): void { const id = WEAPON_ORDER[index]; if (!id || id === this.currentWeapon || this.reloadLeft > 0) return; this.currentWeapon = id; this.ammo = WEAPONS[id].magazine; this.reloadLeft = 0; this.updateViewModel(); this.audio.play('ui') }
  private handleMovement(dt: number): void { if (this.playerDeadUntil) return; const weapon = WEAPONS[this.currentWeapon]; const speed = (this.input.held('sprint') ? 8.5 : 6.2) * weapon.movement * (this.input.held('ads') ? 0.72 : 1); const forward = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw)); const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw)); this.player.root.position.addScaledVector(forward, this.input.move.y * speed * dt); this.player.root.position.addScaledVector(right, this.input.move.x * speed * dt); this.player.root.position.x = THREE.MathUtils.clamp(this.player.root.position.x, -27, 27); this.player.root.position.z = THREE.MathUtils.clamp(this.player.root.position.z, -27, 27); if (this.input.consume('jump') && this.player.root.position.y <= 0.01) { this.verticalVelocity = 7.2; this.audio.play('jump') } this.verticalVelocity -= 21 * dt; this.player.root.position.y = Math.max(0, this.player.root.position.y + this.verticalVelocity * dt); if (this.player.root.position.y === 0) this.verticalVelocity = 0 }
  private handleReload(dt: number): void { if (this.reloadLeft <= 0 && this.input.consume('reload') && this.ammo < WEAPONS[this.currentWeapon].magazine) { this.reloadLeft = WEAPONS[this.currentWeapon].reload; this.audio.play('reload') } if (this.reloadLeft > 0 && this.reloadLeft <= dt) this.ammo = WEAPONS[this.currentWeapon].magazine }
  private handleFire(): void { const weapon = WEAPONS[this.currentWeapon]; if (this.reloadLeft > 0 || this.playerDeadUntil || !this.input.held('shoot') || this.fireCooldown > 0) return; if (this.ammo <= 0) { this.audio.play('empty'); this.fireCooldown = 0.18; return } this.ammo -= 1; this.run.shots += 1; this.fireCooldown = 1 / weapon.fireRate; this.recoil = weapon.recoil; this.flash = 0.04; this.audio.play('gunshot'); const spread = weapon.spread * (this.input.held('ads') ? 0.25 : 1) * (1 + this.run.shots % 4 * 0.08); this.raycaster.setFromCamera(new THREE.Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread), this.cameraInternal); const hit = this.raycaster.intersectObjects(this.hitTargets, false)[0]; if (!hit || hit.distance > weapon.range) return; const botId = hit.object.userData.botId as number; const bot = this.bots.find(item => item.id === botId); if (!bot || !bot.alive || (this.matchType === 'tdm' && bot.team === 'blue')) return; const headshot = hit.object.userData.zone === 'head'; const damage = Math.max(weapon.damage * 0.48, weapon.damage * (1 - hit.distance / weapon.range * 0.46)) * (headshot ? weapon.headshot : 1); bot.health -= damage; this.run.hits += 1; this.audio.play('hit'); this.hooks.hitmarker(headshot); this.hooks.popup(`${Math.round(damage)}${headshot ? ' HS' : ''}`, this.project(hit.point), 'score'); if (bot.health <= 0) this.killBot(bot, headshot) }
  private killBot(bot: Bot, headshot: boolean): void { if (this.matchType === 'tdm' && bot.team === 'blue') return; bot.alive = false; bot.root.visible = false; bot.deaths += 1; bot.respawnAt = this.matchType === 'royale' ? Number.POSITIVE_INFINITY : this.matchTime + 2.2; this.run.kills += 1; this.run.aliveBots = this.bots.filter(item => item.alive && item.id < (this.matchType === 'ffa' ? 6 : this.matchType === 'tdm' ? 9 : 24)).length; if (this.matchType === 'tdm') this.blueScore += 1; if (headshot) this.run.headshots += 1; this.run.score += headshot ? 150 : 100; this.addXp(headshot ? 85 : 55); this.save.update({ stats: { ...this.save.data.stats, kills: this.save.data.stats.kills + 1, headshots: this.save.data.stats.headshots + (headshot ? 1 : 0), shots: this.save.data.stats.shots + this.run.shots, hits: this.save.data.stats.hits + this.run.hits } }); this.hooks.killfeed(`YOU eliminated BOT-${String(bot.id + 1).padStart(2, '0')}`, headshot) }
  private stepBots(dt: number): void {
    const playerPos = this.player.root.position
    for (const bot of this.bots) {
      if (bot.id >= (this.matchType === 'ffa' ? 6 : this.matchType === 'tdm' ? 9 : 24)) continue
      if (!bot.alive) { if (this.matchType !== 'royale' && this.matchTime >= bot.respawnAt) { bot.alive = true; bot.health = 100; bot.root.visible = true; bot.root.position.copy(bot.spawn) } continue }
      bot.phase += dt * (0.45 + bot.id * 0.04)
      const isAlly = this.matchType === 'tdm' && bot.team === 'blue'
      const toPlayer = new THREE.Vector3(playerPos.x - bot.root.position.x, 0, playerPos.z - bot.root.position.z)
      const distance = toPlayer.length()
      if (!isAlly && distance < 25 && !this.playerDeadUntil) {
        bot.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z)
        if (this.matchTime >= bot.nextShot) {
          const reaction = { recruit: 1.35, regular: 0.95, veteran: 0.7, elite: 0.52 }[this.difficulty]
          const aim = { recruit: 0.38, regular: 0.58, veteran: 0.72, elite: 0.84 }[this.difficulty]
          bot.nextShot = this.matchTime + reaction + bot.id * 0.035
          if (Math.random() < Math.max(0.1, aim - distance * 0.012)) this.damagePlayer(7 + bot.id % 3 * 2, bot)
        }
        if (distance > 8) { bot.root.position.x += toPlayer.x / Math.max(distance, 1) * dt * 1.6; bot.root.position.z += toPlayer.z / Math.max(distance, 1) * dt * 1.6 }
      } else {
        bot.root.position.x = bot.spawn.x + Math.sin(bot.phase) * 4.2
        bot.root.position.z = bot.spawn.z + Math.cos(bot.phase * 0.8) * 3.8
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
  private stepRoyale(dt: number): void {
    const radius = Math.max(5, 30 - this.matchTime / 180 * 25)
    this.run.stormRadius = radius
    this.stormDamageTimer -= dt
    const playerOutside = Math.hypot(this.player.root.position.x, this.player.root.position.z) > radius
    if (playerOutside && this.stormDamageTimer <= 0) { this.stormDamageTimer = 0.75; this.damagePlayer(8, null) }
    for (const bot of this.bots) {
      if (bot.id >= 24 || !bot.alive) continue
      const outside = Math.hypot(bot.root.position.x, bot.root.position.z) > radius + 1
      if (!outside) { bot.stormTime = Math.max(0, bot.stormTime - dt * 2); continue }
      bot.stormTime += dt
      const distance = Math.hypot(bot.root.position.x, bot.root.position.z) || 1
      bot.root.position.x -= bot.root.position.x / distance * dt * 2.1
      bot.root.position.z -= bot.root.position.z / distance * dt * 2.1
      if (bot.stormTime > 8) { bot.alive = false; bot.root.visible = false; this.run.aliveBots -= 1; this.hooks.killfeed(`BOT-${String(bot.id + 1).padStart(2, '0')} lost to the storm`, false) }
    }
  }
  private damagePlayer(amount: number, bot: Bot | null): void { if (this.playerDeadUntil) return; const armorAbsorb = Math.min(this.run.armor, amount * 0.55); this.run.armor = Math.max(0, this.run.armor - armorAbsorb); this.run.health = Math.max(0, this.run.health - (amount - armorAbsorb)); this.audio.play('hurt'); this.hooks.hurt(); this.hooks.popup(`-${Math.round(amount - armorAbsorb)}`, this.project(this.player.root.position.clone().setY(1.4)), 'hurt'); if (this.run.health <= 0) { this.run.deaths += 1; this.playerDeadUntil = this.matchType === 'royale' ? Number.POSITIVE_INFINITY : this.matchTime + 2.2; this.save.update({ stats: { ...this.save.data.stats, deaths: this.save.data.stats.deaths + 1 } }); this.hooks.killfeed(`${bot ? `BOT-${String(bot.id + 1).padStart(2, '0')}` : 'THE STORM'} eliminated YOU`, false); this.run.health = 0; this.run.armor = 0; if (this.matchType === 'royale') this.finish('lost') } }
  private addXp(amount: number): void { let xp = this.save.data.xp + amount; let level = this.save.data.level; let leveled = false; let reward = ''
    while (level < 50 && xp >= xpForLevel(level)) {
      xp -= xpForLevel(level); level += 1; leveled = true
      const unlocked = OPERATOR_SKINS.find(skin => skin.level === level)
      if (unlocked) reward = unlocked.name
      const weaponReward = level % 5 === 0 ? SKINS.find(skin => !this.save.data.inventory.some(item => item.id === skin.id)) : undefined
      if (weaponReward) { this.save.update({ inventory: [...this.save.data.inventory, weaponReward] }); reward = reward ? `${reward} + ${weaponReward.name}` : weaponReward.name }
      this.save.update({ credits: this.save.data.credits + 150 * level })
    }
    this.save.update({ xp, level }); this.run.level = level; this.run.xp = xp; this.run.nextXp = xpForLevel(level); this.run.credits = this.save.data.credits
    if (leveled) { this.audio.play('levelup'); this.hooks.banner(`LEVEL ${level} // ${reward || '150 CREDITS CLAIMED'}`) }
  }
  private scoreboard(): GameSnapshot['scoreboard'] { return [{ name: this.save.data.playerName, kills: this.run.kills, deaths: this.run.deaths, ping: 18, you: true, team: 'blue' as const }, ...this.bots.filter(bot => bot.id < (this.matchType === 'ffa' ? 6 : this.matchType === 'tdm' ? 9 : 24)).map(bot => ({ name: `BOT-${String(bot.id + 1).padStart(2, '0')}`, kills: bot.kills, deaths: bot.deaths, ping: 22 + bot.id * 2, team: bot.team }))].sort((a, b) => b.kills - a.kills) }
  private mapName(): string { return this.mapId === 'sun-archive' ? 'SUN ARCHIVE' : this.mapId === 'fjordgate' ? 'FJORDGATE' : 'AURELIAN FORUM' }
  private finish(phase: 'won' | 'lost'): void { if (this.run.phase !== 'playing') return; this.run.phase = phase; this.mode = 'ended'; this.input.unlockPointer(); const mvpBonus = phase === 'won' ? 300 : 0; const xp = Math.max(70, this.run.kills * 55 + this.run.headshots * 30 + (phase === 'won' ? 250 : 80) + mvpBonus); this.addXp(xp); this.save.update({ stats: { ...this.save.data.stats, matches: this.save.data.stats.matches + 1, wins: this.save.data.stats.wins + (phase === 'won' ? 1 : 0), shots: this.save.data.stats.shots + this.run.shots, hits: this.save.data.stats.hits + this.run.hits } }); this.hooks.end(this.snapshot()) }
  debugFinish(): void { this.run.kills = 12; this.finish('won') }
  render(_alpha: number, frameSeconds: number): void { const look = this.mode === 'playing' ? this.input.takeLook() : { x: 0, y: 0 }; if (this.mode === 'playing') { this.yaw -= look.x; this.pitch = THREE.MathUtils.clamp(this.pitch - look.y, -1.35, 1.25) } this.cameraInternal.position.set(this.player.root.position.x, this.player.root.position.y + 1.65, this.player.root.position.z); this.cameraInternal.rotation.set(this.pitch - this.recoil * 0.16, this.yaw, 0); this.weaponView.position.z = this.recoil * 0.1; this.weaponView.rotation.x = this.recoil * 0.7; if (this.flash > 0) this.weaponView.scale.setScalar(1.04); else this.weaponView.scale.setScalar(1); this.lastFrame += frameSeconds; this.renderer.render(this.scene, this.cameraInternal) }
  snapshot(): GameSnapshot { return { ...this.run, matchType: this.matchType, mapId: this.mapId, blueScore: this.blueScore, redScore: this.redScore, aliveBots: this.bots.filter(bot => bot.alive && bot.id < (this.matchType === 'ffa' ? 6 : this.matchType === 'tdm' ? 9 : 24)).length, accuracy: this.run.shots ? this.run.hits / this.run.shots : 0, ammo: this.ammo, reload: this.reloadLeft, weapon: this.currentWeapon, weaponName: WEAPONS[this.currentWeapon].name, aimed: this.input.held('ads'), level: this.save.data.level, xp: this.save.data.xp, nextXp: xpForLevel(this.save.data.level), credits: this.save.data.credits, playerX: this.player.root.position.x, playerZ: this.player.root.position.z, yaw: this.yaw, scoreboard: this.scoreboard() } }
  project(world: THREE.Vector3): { x: number; y: number } { const v = world.clone().project(this.cameraInternal); return { x: ((v.x + 1) / 2) * this.renderer.canvas.clientWidth, y: ((1 - v.y) / 2) * this.renderer.canvas.clientHeight } }
}
