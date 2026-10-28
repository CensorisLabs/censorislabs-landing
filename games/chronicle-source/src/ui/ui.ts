import type { Audio } from '../engine/audio'
import type { I18n } from '../engine/i18n'
import type { Input } from '../engine/input'
import { ACHIEVEMENTS, insertScore, type Locale, type Quality, type SaveData, type SaveStore } from '../engine/save'
import { KCH_GAME_TEXTURES } from '../engine/assets'
import { ARMORY_GUNS, HISTORIC_MAPS, KNIFE_SKINS, OPERATOR_SKINS, RARITY_COLORS, SKINS, WEAPONS, operatorSkinForLevel, type BotDifficulty, type MapId, type MatchSettings, type MatchType, type WeaponId } from '../game/fps'
import { KCH_MAP_PREVIEWS } from '../game/kch-map-previews'
import type { Game, GameSnapshot } from '../game/game'
import { DEFAULT_CUSTOM_MAP, decodeCustomMap, encodeCustomMap, MAX_CUSTOM_MAP_JSON_BYTES, readCustomMap, storeCustomMap, validateCustomMap, type CustomMap, type MapSurface } from '../game/custom-map'

export type Screen = 'boot' | 'title' | 'armory' | 'map-editor' | 'hud' | 'buy-menu' | 'pause' | 'settings' | 'leaderboard' | 'results'
export type UiActions = { play(mode: MatchType, map: MapId, difficulty: BotDifficulty, settings?: MatchSettings): void | Promise<void>; pause(): void; resume(): void; restart(): void; quit(): void; openBuy(): void; buy(item: 'rifle' | 'armor' | 'grenade'): string; settings(patch: Partial<SaveData>): void }

export class Ui {
  screen: Screen = 'boot'
  private readonly root: HTMLElement
  private panel = 'queue'
  private finishQuery = ''
  private finishLimit = 48
  private selectedMode: MatchType = 'tdm'
  private selectedMap: MapId = 'pool'
  private hudChatMatch = ''
  private customMap: CustomMap = readCustomMap()
  private mapBrush: 'block' | 'player-spawn' | 'bot-spawn' | 'site-a' | 'site-b' = 'block'
  private brush = { width: 4, depth: 4, height: 2, color: '#7d7467', surface: 'concrete' as MapSurface }
  private difficulty: BotDifficulty = 'regular'
  private royalePlayers: 30 | 50 | 60 | 100 = 60
  private teamSize: 1 | 4 | 5 = 5
  private lastRun?: GameSnapshot
  private scoreSaved = false
  private hudCache = new Map<string, string>()
  private scoreboardCache = ''
  private loginReward = 0
  constructor(private readonly i18n: I18n, private readonly save: SaveStore, private readonly audio: Audio, private readonly input: Input, private readonly actions: UiActions) {
    this.root = document.getElementById('ui')!
    this.root.innerHTML = this.template()
    this.root.querySelector('.scope-overlay')?.insertAdjacentHTML('beforeend', '<img class="scope-reticle" src="assets/kch-library/crosshairs/scope.png" alt="">')
    this.root.querySelector<HTMLElement>('[data-screen="hud"]')?.insertAdjacentHTML('beforeend', `
      <div class="hud-control-hints" aria-label="Movement controls"><span><kbd>SHIFT</kbd> SPRINT</span><span><kbd>CTRL + SHIFT</kbd> SLIDE</span><span><kbd>E</kbd> DASH</span><span><kbd>TAB</kbd> SCOREBOARD</span></div>
      <section class="hud-chat" aria-label="Match chat"><div class="hud-chat-log" data-slot="hud-chat-log" role="log" aria-live="polite"></div><form class="hud-chat-compose"><input name="hudChat" maxlength="120" autocomplete="off" aria-label="Match chat message" placeholder="MESSAGE..."><button type="submit">ENTER</button></form></section>`)
    this.claimDailyLogin()
    this.root.insertAdjacentHTML('beforeend', '<section class="screen screen-map-editor" data-screen="map-editor" aria-hidden="true"><div class="map-editor-content"></div></section>')

    const sharedMap = new URL(location.href).searchParams.get('map')
    const importedMap = sharedMap ? decodeCustomMap(sharedMap) : null
    if (importedMap) { this.customMap = importedMap; storeCustomMap(importedMap) }
    this.root.addEventListener('click', event => this.onClick(event))
    this.root.addEventListener('input', event => this.onInput(event))
    this.root.addEventListener('change', event => { if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement && event.target.name === 'customMapFile') this.onInput(event) })
    this.root.addEventListener('submit', event => {
      const form = event.target
      if (!(form instanceof HTMLFormElement) || !form.matches('.hud-chat-compose')) return
      event.preventDefault()
      const input = form.querySelector<HTMLInputElement>('input[name="hudChat"]')
      const message = input?.value.trim().slice(0, 120)
      if (message) this.appendHudChat('YOU', message, 'player')
      if (input) input.value = ''
    })
    window.addEventListener('keydown', event => this.onKey(event))
    i18n.onChange(() => this.translate())
    this.translate(); this.refreshSettings()
  }
  setGame(_game: Game): void {}
  show(screen: Screen): void { this.screen = screen; this.root.dataset.activeScreen = screen; for (const el of this.root.querySelectorAll<HTMLElement>('[data-screen]')) { const active = el.dataset.screen === screen; el.classList.toggle('is-active', active); el.setAttribute('aria-hidden', String(!active)) } if (screen === 'title') this.renderPanel(this.panel); if (screen === 'armory') this.renderArmory(); if (screen === 'map-editor') this.renderMapEditor(); if (screen === 'leaderboard') this.renderLeaderboard(); requestAnimationFrame(() => this.root.querySelector<HTMLElement>(`[data-screen="${screen}"] [data-nav]`)?.focus({ preventScroll: true })) }
  setBootProgress(progress: number): void { const bar = this.root.querySelector<HTMLElement>('.boot-bar i'); if (bar) bar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, progress))})` }
  private appendHudChat(name: string, message: string, tone: 'system' | 'team' | 'player'): void {
    const log = this.root.querySelector<HTMLElement>('[data-slot="hud-chat-log"]')
    if (!log) return
    const entry = document.createElement('p')
    entry.className = `hud-chat-line is-${tone}`
    const speaker = document.createElement('b')
    speaker.textContent = name
    const text = document.createElement('span')
    text.textContent = message
    entry.append(speaker, text)
    log.append(entry)
    while (log.childElementCount > 6) log.firstElementChild?.remove()
    log.scrollTop = log.scrollHeight
  }
  refreshSettings(): void { const d = this.save.data; const set = (name: string, value: string) => { const el = this.root.querySelector<HTMLInputElement>(`[name="${name}"]`); if (el) el.value = value }; set('musicVolume', String(d.musicVolume)); set('sfxVolume', String(d.sfxVolume)); set('sensitivity', String(d.sensitivity)); set('fov', String(d.fov)); set('crosshairColor', d.crosshairColor); set('crosshairGap', String(d.crosshairGap)); set('crosshairThickness', String(d.crosshairThickness)); this.root.querySelectorAll<HTMLButtonElement>('.toggle').forEach(button => { const key = button.dataset.setting as keyof SaveData; button.setAttribute('aria-pressed', String(d[key] === true)) }); this.root.querySelectorAll<HTMLButtonElement>('[data-setting="quality"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === d.quality))); this.root.querySelectorAll<HTMLButtonElement>('[data-setting="locale"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === this.i18n.locale))) }
  updateHud(snapshot: GameSnapshot): void {
    const mapName = snapshot.mapName || HISTORIC_MAPS.find(map => map.id === snapshot.mapId)?.name.toUpperCase() || 'AURELIAN FORUM'
    const wholeSeconds = Math.ceil(snapshot.timeLeft)
    const minutes = Math.floor(wholeSeconds / 60).toString().padStart(2, '0')
    const seconds = (wholeSeconds % 60).toString().padStart(2, '0')
    const alive = snapshot.aliveBots + (snapshot.phase === 'playing' ? 1 : 0)
    const mode = ({ royale: 'FRONTIER ROYALE', tdm: 'TEAM DEATHMATCH', training: 'AIM RANGE', gungame: 'GUN GAME', ffa: 'FREE FOR ALL', domination: 'DOMINATION', hardpoint: 'HARDPOINT', ctf: 'CAPTURE THE STANDARD', search: 'SEARCH & DEFUSE' } satisfies Record<MatchType, string>)[snapshot.matchType]
    const chatMatch = `${snapshot.mapId}:${snapshot.matchType}`
    if (chatMatch !== this.hudChatMatch) {
      this.hudChatMatch = chatMatch
      this.root.querySelector<HTMLElement>('[data-slot="hud-chat-log"]')?.replaceChildren()
      this.appendHudChat('SYSTEM', `${mapName} // ${mode}`, 'system')
      this.appendHudChat('BOT SQUAD', 'joined the local arena', 'team')
    }
    this.setText('hud-score', String(snapshot.score).padStart(4, '0'))
    this.setText('hud-kills', String(snapshot.kills))
    this.setText('hud-deaths', String(snapshot.deaths))
    this.setText('hud-clock', snapshot.matchType === 'training' ? '∞' : `${minutes}:${seconds}`)
    this.setText('hud-clock-label', snapshot.matchType === 'search' ? ({ buy: 'BUY PHASE', live: 'ROUND TIME', planted: 'CHARGE FUSE', post: 'ROUND END' } satisfies Record<GameSnapshot['roundPhase'], string>)[snapshot.roundPhase] : 'ROUND TIME')
    const spawnShield = this.root.querySelector<HTMLElement>('[data-slot="hud-spawn-shield"]')
    if (spawnShield) { spawnShield.textContent = snapshot.spawnProtection > 0 ? `SPAWN SHIELD // ${snapshot.spawnProtection.toFixed(1)}S` : ''; spawnShield.classList.toggle('is-visible', snapshot.spawnProtection > 0) }
    this.setText('hud-weapon', snapshot.weaponName)
    const primaryGun = ARMORY_GUNS.find(gun => gun.id === this.save.data.primaryGunId) ?? ARMORY_GUNS[0]!
    const handgun = ARMORY_GUNS.find(gun => gun.id === this.save.data.handgunGunId) ?? ARMORY_GUNS.find(gun => gun.slot === 'handgun')!
    const knife = KNIFE_SKINS.find(item => item.id === this.save.data.knifeSkinId)
    this.setText('hud-primary', primaryGun.name)
    this.setText('hud-handgun', handgun.name)
    this.setText('hud-knife', knife?.name ?? 'Bayonet')
    const activeSlot = snapshot.weapon === primaryGun.base ? 'primary' : snapshot.weapon === handgun.base ? 'handgun' : snapshot.weapon === 'knife' ? 'knife' : 'primary'
    this.root.querySelectorAll<HTMLElement>('[data-weapon-slot]').forEach(slot => slot.classList.toggle('is-active', slot.dataset.weaponSlot === activeSlot))
    this.setText('hud-ammo', snapshot.reload > 0 ? '—' : String(snapshot.ammo))
    this.setText('hud-magazine', String(snapshot.magazine))
    this.setText('hud-reload', snapshot.reload > 0 ? 'RELOADING // ' : '')
    this.setText('lobby-credits', `${snapshot.credits} CR`)
    this.setText('hud-mode', mode)
    this.setText('hud-map', mapName)
    this.setText('hud-objective', snapshot.respawnIn > 0 ? `RESPAWN IN ${Math.ceil(snapshot.respawnIn)}S` : snapshot.objective)
    this.root.querySelector('.match-mode')?.classList.toggle('is-respawning', snapshot.respawnIn > 0)
    this.setText('hud-team-blue', String(snapshot.blueScore).padStart(2, '0'))
    this.setText('hud-team-red', String(snapshot.redScore).padStart(2, '0'))
    this.setText('hud-royale-alive', String(alive).padStart(2, '0'))
    this.setText('hud-storm', snapshot.matchType === 'royale' ? `${Math.ceil(snapshot.stormRadius)}M` : 'LOCAL BOTS')
    this.setText('hud-grenades', String(snapshot.grenades))
    const health = this.root.querySelector<HTMLElement>('.health-fill')
    if (health) { health.style.width = `${snapshot.health}%`; health.parentElement?.setAttribute('aria-valuenow', String(Math.round(snapshot.health))) }
    const armor = this.root.querySelector<HTMLElement>('.armor-fill')
    if (armor) { armor.style.width = `${snapshot.armor}%`; armor.parentElement?.setAttribute('aria-valuenow', String(Math.round(snapshot.armor))) }
    const marker = this.root.querySelector<HTMLElement>('.radar-player')
    if (marker) { marker.style.left = `${Math.max(3, Math.min(97, (snapshot.playerX + 30) / 60 * 100))}%`; marker.style.top = `${Math.max(3, Math.min(97, (snapshot.playerZ + 30) / 60 * 100))}%`; marker.style.setProperty('--bearing', `${snapshot.yaw * 180 / Math.PI}deg`) }
    const radar = this.root.querySelector<HTMLElement>('.radar')
    radar?.classList.toggle('is-royale', snapshot.matchType === 'royale')
    if (radar) radar.style.setProperty('--safe-size', `${Math.max(18, Math.min(88, snapshot.stormRadius / 30 * 88))}%`)
    const hud = this.root.querySelector<HTMLElement>('.screen-hud')
    hud?.classList.toggle('is-tdm', snapshot.matchType === 'tdm')
    hud?.classList.toggle('is-royale', snapshot.matchType === 'royale')
    hud?.classList.toggle('is-search', snapshot.matchType === 'search')
    hud?.classList.toggle('is-spawn-protected', snapshot.spawnProtection > 0)
    hud?.classList.toggle('is-low-health', snapshot.health <= 25)
    this.root.querySelector('.match-clock')?.classList.toggle('is-critical', snapshot.timeLeft <= 30)
    this.setText('hud-kills-bottom', String(snapshot.kills))
    this.setText('hud-deaths-bottom', String(snapshot.deaths))
    const crosshair = this.root.querySelector<HTMLElement>('.crosshair')
    const scoped = snapshot.aimed && snapshot.weapon === 'awp'
    if (crosshair) { crosshair.style.setProperty('--crosshair-color', this.save.data.crosshairColor); crosshair.style.setProperty('--crosshair-gap', `${this.save.data.crosshairGap + snapshot.crosshairBloom}px`); crosshair.style.setProperty('--crosshair-thickness', `${this.save.data.crosshairThickness}px`); crosshair.classList.toggle('is-aiming', snapshot.aimed); crosshair.classList.toggle('is-scoped', scoped) }
    const board = this.root.querySelector<HTMLElement>('.scoreboard-list')
    const boardHtml = snapshot.scoreboard.map(row => `<li class="${row.you ? 'is-you' : row.team === 'blue' ? 'is-ally' : 'is-rival'}"><span><b>${this.escape(row.name)}</b><small>${row.you ? 'YOU' : row.team === 'blue' ? 'SQUAD' : 'BOT'}</small></span><strong>${row.kills}</strong><strong>${row.deaths}</strong><em>${row.you ? 'LOCAL' : 'CPU'}</em></li>`).join('')
    if (board && boardHtml !== this.scoreboardCache) { board.innerHTML = boardHtml; this.scoreboardCache = boardHtml }
    this.root.querySelector('.buy-open')?.classList.toggle('is-visible', snapshot.matchType === 'search')
    hud?.classList.toggle('is-spectating', snapshot.spectating)
    const spectatorStatus = this.root.querySelector<HTMLElement>('.spectator-status')
    if (spectatorStatus) spectatorStatus.textContent = snapshot.spectating ? 'SPECTATING // PRESS X TO CYCLE' : ''
    const scoreboard = this.root.querySelector<HTMLElement>('.scoreboard')
    if (scoreboard) scoreboard.classList.toggle('is-visible', this.input.held('scoreboard'))
    this.root.querySelector('.scope-overlay')?.classList.toggle('is-visible', scoped)
  }
  popup(text: string, at: { x: number; y: number }, kind: 'score' | 'hurt'): void { const el = document.createElement('div'); el.className = `popup popup-${kind}`; el.textContent = text; el.style.left = `${at.x}px`; el.style.top = `${at.y}px`; this.root.querySelector('.popups')?.append(el); el.addEventListener('animationend', () => el.remove()) }
  hurt(): void { const el = this.root.querySelector('.hurt-vignette'); el?.classList.remove('flash'); void (el as HTMLElement | undefined)?.offsetWidth; el?.classList.add('flash') }
  hitmarker(headshot: boolean): void { const el = this.root.querySelector('.hitmarker'); el?.classList.remove('show', 'headshot'); void (el as HTMLElement | undefined)?.offsetWidth; el?.classList.add('show'); if (headshot) el?.classList.add('headshot') }
  killfeed(text: string, headshot: boolean): void { const el = document.createElement('div'); el.className = `feed-item ${headshot ? 'headshot' : ''}`; const icon = document.createElement('img'); icon.src = KCH_GAME_TEXTURES.killIcon; icon.alt = ''; icon.width = 16; icon.height = 16; const label = document.createElement('span'); label.textContent = text; el.append(icon, label); this.root.querySelector('.killfeed')?.prepend(el); window.setTimeout(() => el.remove(), 4500) }
  banner(text: string): void { const el = this.root.querySelector<HTMLElement>('.banner'); if (!el) return; el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show') }
  showResults(run: GameSnapshot): void {
    this.lastRun = run; this.scoreSaved = false; this.show('results')
    const title = this.root.querySelector('.results-title'); if (title) title.textContent = run.phase === 'won' ? 'MATCH VICTORY' : 'MATCH COMPLETE'
    this.setText('result-kills', String(run.kills)); this.setText('result-headshots', String(run.headshots)); this.setText('result-accuracy', `${Math.round(run.accuracy * 100)}%`); this.setText('result-xp', `+${run.xpEarned} XP`); this.setText('result-score', String(run.score))
    this.setText('result-level', run.level >= 50 ? `LEVEL ${run.level} // MAX` : `LEVEL ${run.level} → ${run.level + 1}`)
    this.setText('result-xp-progress', run.level >= 50 ? 'MAX LEVEL' : `${run.xp} / ${run.nextXp} XP`)
    const resultXp = this.root.querySelector<HTMLElement>('[data-slot="result-xp-fill"]'); if (resultXp) resultXp.style.width = `${run.level >= 50 ? 100 : Math.min(100, run.xp / run.nextXp * 100)}%`
    const mvp = run.scoreboard[0]?.you ? this.save.data.playerName : run.scoreboard[0]?.name ?? this.save.data.playerName; const mvpEl = this.root.querySelector<HTMLElement>('[data-slot="result-mvp"]'); if (mvpEl) mvpEl.textContent = mvp
    const unowned = SKINS.filter(item => item.weapon !== 'knife' && !this.save.data.inventory.some(owned => owned.id === item.id))
    const unownedKnives = KNIFE_SKINS.filter(item => !this.save.data.unlockedKnifeSkinIds.includes(item.id)).map(item => ({ id: item.id, weapon: 'knife' as const, name: item.name, color: item.color, pattern: 'etched-voxel', rarity: 'Classified' as const }))
    const pool = [...unowned, ...unownedKnives]; const skin = pool.length ? pool[Math.floor(Math.random() * pool.length)]! : SKINS[Math.floor(Math.random() * SKINS.length)]!
    if (pool.includes(skin)) { if (skin.weapon === 'knife') this.save.update({ unlockedKnifeSkinIds: [...this.save.data.unlockedKnifeSkinIds, skin.id] }); this.save.update({ inventory: [...this.save.data.inventory, skin] }) }
    const drop = this.root.querySelector<HTMLElement>('.drop-card'); if (drop) { drop.style.setProperty('--rarity', RARITY_COLORS[skin.rarity]); drop.innerHTML = `<span class="drop-rarity">${skin.rarity}</span><b>${skin.name}</b><small>${WEAPONS[skin.weapon].name} · ${skin.pattern}</small>`; drop.dataset.skinId = skin.id }
  }
  frame(_seconds: number): void {}
  hint(_hint: unknown): void {}
  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-panel], [data-mode], [data-armory-gun], [data-buy-item], [data-brush], [data-cell-x], .toggle, .seg button, .equip, .operator-choice, .knife-choice')
    if (!target) return
    this.audio.unlock()
    if (target.dataset.brush) { this.mapBrush = target.dataset.brush as typeof this.mapBrush; this.renderMapEditor(); return }
    if (target.hasAttribute('data-cell-x')) { this.placeMapCell(Number(target.dataset.cellX), Number(target.dataset.cellZ)); return }
    if (target.dataset.action?.startsWith('map-')) { void this.handleMapAction(target.dataset.action); return }
    if (target.dataset.mode) { this.selectedMode = target.dataset.mode as MatchType; this.renderPanel('queue'); return }
    if (target.dataset.armoryGun) { const gun = ARMORY_GUNS.find(item => item.id === target.dataset.armoryGun); if (!gun) return; this.actions.settings(gun.slot === 'primary' ? { primaryGunId: gun.id } : { handgunGunId: gun.id }); this.renderPanel('loadout'); return }
    if (target.dataset.buyItem) { const result = this.actions.buy(target.dataset.buyItem as 'rifle' | 'armor' | 'grenade'); const status = this.root.querySelector<HTMLElement>('[data-slot="buy-feedback"]'); if (status) status.textContent = result; if (result.startsWith('BOUGHT')) { this.banner(result); this.actions.resume() }; return }
    const panel = target.dataset.panel
    if (panel) { this.panel = panel; for (const nav of this.root.querySelectorAll<HTMLElement>('.lobby-nav [data-panel]')) nav.classList.toggle('active', nav.dataset.panel === panel); this.renderPanel(panel); return }
    if (target.classList.contains('toggle')) { const key = target.dataset.setting as keyof SaveData; this.actions.settings({ [key]: !this.save.data[key] } as Partial<SaveData>); return }
    if (target.matches('.seg button')) { const key = target.parentElement?.dataset.setting; if (key === 'quality') this.actions.settings({ quality: target.dataset.value as Quality }); if (key === 'locale') this.actions.settings({ locale: target.dataset.value as Locale }); return }
    if (target.classList.contains('equip')) { const weapon = target.dataset.weapon as WeaponId; const skin = target.dataset.skin; this.actions.settings({ equipped: { ...this.save.data.equipped, [weapon]: skin } }); this.renderPanel('loadout'); return }
    if (target.classList.contains('knife-choice')) { const id = target.dataset.knife; if (!id || !this.save.data.unlockedKnifeSkinIds.includes(id)) return; this.actions.settings({ knifeSkinId: id }); if (this.screen === 'armory') this.renderArmory(); else this.renderPanel('loadout'); return }
    if (target.classList.contains('operator-choice')) { const skin = OPERATOR_SKINS.find(item => item.id === target.dataset.operatorSkin); if (!skin || skin.level > this.save.data.level) return; this.actions.settings({ operatorSkinId: skin.id }); this.renderPanel('profile'); return }
    if (target.dataset.action === 'more-finishes') { this.finishLimit += 60; this.renderPanel('loadout'); return }
    switch (target.dataset.action) {
      case 'play': this.show('armory'); break
      case 'armory': this.show('armory'); break
      case 'map-editor': this.show('map-editor'); break
      case 'deploy': void this.actions.play(this.selectedMode, this.selectedMap, this.difficulty, { royalePlayers: this.royalePlayers, teamSize: this.teamSize }); break
      case 'quick-play': void this.actions.play(this.selectedMode, this.selectedMap, this.difficulty, { royalePlayers: this.royalePlayers, teamSize: this.teamSize }); break
      case 'armory-back': this.show('title'); break
      case 'resume': this.actions.resume(); break
      case 'restart': this.actions.restart(); break
      case 'quit': this.actions.quit(); break
      case 'settings': this.show('settings'); break
      case 'leaderboard': this.show('leaderboard'); this.renderLeaderboard(); break
      case 'back': this.show('title'); break
      case 'open-case': this.openCase(); break
      case 'save-score': this.saveScore(); break
      case 'pause': this.actions.pause(); break
      case 'buy-close': this.actions.resume(); break
      case 'open-buy': this.actions.openBuy(); break
    }
  }
  private syncMapBrush(): void {
    const value = (name: string) => this.root.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)
    this.customMap.name = value('customMapName')?.value.trim().slice(0, 32) || this.customMap.name
    this.brush.width = Math.max(1, Math.min(10, Number(value('brushWidth')?.value) || 4))
    this.brush.depth = Math.max(1, Math.min(10, Number(value('brushDepth')?.value) || 4))
    this.brush.height = Math.max(1, Math.min(8, Number(value('brushHeight')?.value) || 2))
    const color = value('brushColor')?.value ?? this.brush.color
    this.brush.color = /^#[0-9a-f]{6}$/i.test(color) ? color : '#7d7467'
    const surface = value('brushSurface')?.value
    this.brush.surface = surface === 'metal' || surface === 'wood' || surface === 'gravel' ? surface : 'concrete'
  }
  private placeMapCell(column: number, row: number): void {
    if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || column > 12 || row < 0 || row > 12) return
    this.syncMapBrush()
    const x = -24 + column * 4; const z = -24 + row * 4
    if (this.mapBrush === 'block') {
      const existing = this.customMap.blocks.findIndex(block => block.x === x && block.z === z)
      if (existing >= 0) this.customMap.blocks.splice(existing, 1)
      else if (this.customMap.blocks.length < 96) this.customMap.blocks.push({ ...this.brush, x, z })
      else { this.setMapStatus('This map reached the 96-block limit.'); return }
    } else {
      const kind = this.mapBrush === 'site-a' || this.mapBrush === 'site-b' ? 'site' : this.mapBrush
      const label = this.mapBrush === 'site-b' ? 'B' : 'A'
      const existing = this.customMap.markers.findIndex(marker => marker.kind === kind && (kind !== 'site' || marker.label === label) && marker.x === x && marker.z === z)
      if (existing >= 0) this.customMap.markers.splice(existing, 1)
      else if (kind === 'player-spawn') {
        this.customMap.markers = this.customMap.markers.filter(marker => marker.kind !== kind)
        this.customMap.markers.push({ kind, x, z })
      } else if (kind === 'site') {
        this.customMap.markers = this.customMap.markers.filter(marker => marker.kind !== 'site' || marker.label !== label)
        this.customMap.markers.push({ kind, x, z, label })
      } else if (this.customMap.markers.length < 24) this.customMap.markers.push({ kind, x, z })
    }
    this.customMap = validateCustomMap(this.customMap) ?? this.customMap
    storeCustomMap(this.customMap); this.renderMapEditor()
  }
  private setMapStatus(message: string): void { const status = this.root.querySelector<HTMLElement>('[data-slot="map-editor-status"]'); if (status) status.textContent = message }
  private async handleMapAction(action: string): Promise<void> {
    this.syncMapBrush()
    this.customMap = validateCustomMap(this.customMap) ?? this.customMap
    if (action === 'map-editor') { this.show('map-editor'); return }
    if (action === 'map-save') { storeCustomMap(this.customMap); this.setMapStatus('Saved on this device.'); return }
    if (action === 'map-reset') { this.customMap = structuredClone(DEFAULT_CUSTOM_MAP); storeCustomMap(this.customMap); this.mapBrush = 'block'; this.renderMapEditor(); return }
    if (action === 'map-clear') { this.customMap.blocks = []; storeCustomMap(this.customMap); this.renderMapEditor(); return }
    if (action === 'map-export') {
      const blob = new Blob([JSON.stringify(this.customMap, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = `${this.customMap.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'custom-field'}.json`; link.click(); URL.revokeObjectURL(url); this.setMapStatus('Map JSON exported.'); return
    }
    if (action === 'map-copy-link') {
      const link = new URL(location.href); link.searchParams.set('map', encodeCustomMap(this.customMap))
      try { await navigator.clipboard.writeText(link.toString()); this.setMapStatus('Share link copied. The map is encoded in the URL.'); }
      catch { this.setMapStatus('Clipboard is unavailable. Export the JSON file instead.'); }
      return
    }
    if (action === 'map-import-code') {
      const code = this.root.querySelector<HTMLTextAreaElement>('[name="mapCode"]')?.value.trim() ?? ''
      const decoded = decodeCustomMap(code)
      if (!decoded) { this.setMapStatus('That map code is invalid.'); return }
      this.customMap = decoded; storeCustomMap(decoded); this.renderMapEditor(); this.setMapStatus('Map code loaded.'); return
    }
    if (action === 'map-back') { this.show('title'); return }
    if (action === 'map-deploy') {
      storeCustomMap(this.customMap)
      void this.actions.play(this.selectedMode, this.selectedMap, this.difficulty, { royalePlayers: this.royalePlayers, teamSize: this.teamSize, customMap: this.customMap })
    }
  }
  private openCase(): void {
    if (this.save.data.credits < 100) { this.banner('NEED 100 CREDITS TO OPEN A CASE'); return }
    const unowned = SKINS.filter(item => item.weapon !== 'knife' && !this.save.data.inventory.some(owned => owned.id === item.id))
    const unownedKnives = KNIFE_SKINS.filter(item => !this.save.data.unlockedKnifeSkinIds.includes(item.id)).map(item => ({ id: item.id, weapon: 'knife' as const, name: item.name, color: item.color, pattern: 'etched-voxel', rarity: 'Classified' as const }))
    const pool = [...unowned, ...unownedKnives]; const skin = pool.length ? pool[Math.floor(Math.random() * pool.length)]! : SKINS[Math.floor(Math.random() * SKINS.length)]!
    this.save.update({ credits: this.save.data.credits - 100, inventory: [...this.save.data.inventory, skin], unlockedKnifeSkinIds: skin.weapon === 'knife' ? [...this.save.data.unlockedKnifeSkinIds, skin.id] : this.save.data.unlockedKnifeSkinIds })
    this.audio.play('case'); this.renderPanel('cases'); this.banner(`DROP // ${skin.rarity.toUpperCase()} ${skin.name}`)
  }
  private saveScore(): void { if (!this.lastRun || this.scoreSaved) return; const name = this.root.querySelector<HTMLInputElement>('.results-name')?.value.trim().slice(0, 16) || this.save.data.playerName; const entry = { name, score: this.lastRun.score, seconds: Math.round(this.lastRun.elapsed), at: Date.now() }; const { board } = insertScore(this.save.data.leaderboard, entry); this.save.update({ leaderboard: board, playerName: name }); this.scoreSaved = true; this.banner('SCORE SAVED TO LOCAL LEADERBOARD') }
  private async onInput(event: Event): Promise<void> {
    const el = event.target as HTMLInputElement | HTMLSelectElement
    if (el instanceof HTMLInputElement && 'finishSearch' in el.dataset) {
      this.finishQuery = el.value.trim().toLowerCase(); this.finishLimit = 48; this.renderPanel('loadout')
      const field = this.root.querySelector<HTMLInputElement>('[data-finish-search]')
      if (field) { field.focus(); field.setSelectionRange(field.value.length, field.value.length) }
      return
    }
    if (el instanceof HTMLInputElement && el.name === 'customMapFile') {
      const file = el.files?.[0]
      if (!file) return
      if (file.size > MAX_CUSTOM_MAP_JSON_BYTES) { this.setMapStatus('Map JSON must be 48 KB or smaller.'); return }
      try {
        const imported = validateCustomMap(JSON.parse(await file.text()))
        if (!imported) { this.setMapStatus('That JSON is not a supported map.'); return }
        this.customMap = imported; storeCustomMap(imported); this.renderMapEditor(); this.setMapStatus('JSON map loaded.')
      } catch { this.setMapStatus('Could not read that JSON map.'); }
      return
    }
    if (el.name === 'customMapName') { this.customMap.name = el.value.trim().slice(0, 32) || 'Custom Field'; storeCustomMap(this.customMap); return }
    if (['brushWidth', 'brushDepth', 'brushHeight', 'brushColor', 'brushSurface'].includes(el.name)) { this.syncMapBrush(); return }
    if (el instanceof HTMLSelectElement && el.name === 'primaryGun') { this.actions.settings({ primaryGunId: el.value }); this.renderArmory(); return }
    if (el instanceof HTMLSelectElement && el.name === 'handgunGun') { this.actions.settings({ handgunGunId: el.value }); this.renderArmory(); return }
    if (el instanceof HTMLSelectElement && el.name === 'map') { this.selectedMap = el.value as MapId; this.renderPanel('queue'); return }
    if (el instanceof HTMLSelectElement && el.name === 'mode') { this.selectedMode = el.value as MatchType; this.renderPanel(this.panel); return }
    if (el instanceof HTMLSelectElement && el.name === 'difficulty') { this.difficulty = el.value as BotDifficulty; return }
    if (el instanceof HTMLSelectElement && el.name === 'royalePlayers') { this.royalePlayers = Number(el.value) as 30 | 50 | 60 | 100; const card = this.root.querySelector<HTMLElement>('[data-mode="royale"] span'); if (card) card.textContent = `${this.royalePlayers} COMBATANTS`; return }
    if (el instanceof HTMLSelectElement && el.name === 'teamSize') { this.teamSize = Number(el.value) as 1 | 4 | 5; this.renderPanel('queue'); return }
    if (el.type === 'range') this.actions.settings({ [el.name]: Number(el.value) } as Partial<SaveData>)
    if (el.type === 'color' && el.name === 'crosshairColor') this.actions.settings({ crosshairColor: el.value })
  }
  private onKey(event: KeyboardEvent): void {
    const target = event.target instanceof HTMLElement ? event.target : null
    const typing = !!target?.closest('input, textarea, select, [contenteditable="true"]')
    if (event.code === 'Enter' && this.screen === 'hud' && !typing) {
      event.preventDefault()
      this.root.querySelector<HTMLInputElement>('.hud-chat-compose input')?.focus()
      return
    }
    if (event.code === 'Escape' && this.screen === 'buy-menu') { event.preventDefault(); this.actions.resume(); return }
    if (event.code === 'KeyB' && this.screen === 'hud' && !event.repeat && !typing) { event.preventDefault(); this.actions.openBuy(); return }
    if (event.code === 'Escape' && (this.screen === 'settings' || this.screen === 'leaderboard')) { event.preventDefault(); this.show('title') }
  }
  private claimDailyLogin(): void { const today = new Date().toISOString().slice(0, 10); const previous = new Date(Date.now() - 86400000).toISOString().slice(0, 10); const login = this.save.data.dailyLogin; if (login.date === today) { this.loginReward = login.reward; return } const streak = login.date === previous ? login.streak + 1 : 1; this.loginReward = 100 + Math.min(6, streak - 1) * 50; this.save.update({ dailyLogin: { date: today, streak, reward: this.loginReward }, credits: this.save.data.credits + this.loginReward }) }
  private renderLeaderboard(): void { const list = this.root.querySelector<HTMLElement>('.board'); if (!list) return; const board = this.save.data.leaderboard; list.innerHTML = board.length ? board.map((e, i) => `<li><b>${i + 1}</b><span>${this.escape(e.name)}</span><em>${e.score}</em></li>`).join('') : '<li class="empty">No local scores yet. Win a match to be first.</li>' }
  private renderPanel(panel: string): void {
    const panelEl = this.root.querySelector<HTMLElement>('.lobby-panel')
    if (!panelEl) return
    this.root.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button => button.classList.toggle('active', button.dataset.panel === panel))
    if (panel === 'queue' || panel === 'servers') {
      panelEl.innerHTML = `<div class="local-room"><span class="region-bars">▮▮▮</span><b>LOCAL ARENA</b><small>BOT ROOMS READY</small></div><div class="quick-actions"><button class="quick-create" data-action="armory">CREATE</button><button class="quick-join" data-action="quick-play">JOIN</button></div><details class="queue-settings"><summary>MODE SELECTION</summary><label>MODE<select name="mode">${[['ffa','Free for all'],['tdm','Team deathmatch'],['domination','Domination'],['hardpoint','Hardpoint'],['ctf','Capture the standard'],['search','Search & defuse'],['royale','Frontier royale'],['training','Aim range'],['gungame','Gun game']].map(([id,name]) => `<option value="${id}" ${this.selectedMode === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label><div class="queue-settings-row"><label>MAP<select name="map">${HISTORIC_MAPS.map(map => `<option value="${map.id}" ${this.selectedMap === map.id ? 'selected' : ''}>${map.name}</option>`).join('')}</select></label><label>SKILL<select name="difficulty"><option value="recruit" ${this.difficulty === 'recruit' ? 'selected' : ''}>Recruit</option><option value="regular" ${this.difficulty === 'regular' ? 'selected' : ''}>Regular</option><option value="veteran" ${this.difficulty === 'veteran' ? 'selected' : ''}>Veteran</option><option value="elite" ${this.difficulty === 'elite' ? 'selected' : ''}>Elite</option></select></label>${['tdm','domination','hardpoint','ctf','search'].includes(this.selectedMode) ? `<label>TEAM<select name="teamSize"><option value="1" ${this.teamSize === 1 ? 'selected' : ''}>1 v 1</option><option value="4" ${this.teamSize === 4 ? 'selected' : ''}>4 v 4</option><option value="5" ${this.teamSize === 5 ? 'selected' : ''}>5 v 5</option></select></label>` : ''}${this.selectedMode === 'royale' ? `<label>PLAYERS<select name="royalePlayers"><option value="30" ${this.royalePlayers === 30 ? 'selected' : ''}>30</option><option value="50" ${this.royalePlayers === 50 ? 'selected' : ''}>50</option><option value="60" ${this.royalePlayers === 60 ? 'selected' : ''}>60</option><option value="100" ${this.royalePlayers === 100 ? 'selected' : ''}>100</option></select></label>` : ''}</div></details><button class="cta menu-play" data-action="quick-play">PLAY <span>▶</span></button><div class="lobby-hint"><kbd>WASD</kbd> MOVE <kbd>LMB</kbd> FIRE <kbd>SPACE</kbd> JUMP</div>`
      const selectedMap = HISTORIC_MAPS.find(map => map.id === this.selectedMap)
      const previewFile = KCH_MAP_PREVIEWS[this.selectedMap]
      if (selectedMap && previewFile) {
        const preview = document.createElement('div')
        preview.className = 'queue-map-preview'
        const image = document.createElement('img')
        image.src = `assets/kch-library/map-imgs/${encodeURIComponent(previewFile)}`
        image.alt = `${selectedMap.name} map preview`
        image.loading = 'lazy'
        const caption = document.createElement('div')
        const kicker = document.createElement('small')
        kicker.textContent = 'KCH COMMUNITY MAP'
        const title = document.createElement('strong')
        title.textContent = selectedMap.name
        caption.append(kicker, title)
        preview.append(image, caption)
        panelEl.querySelector('.quick-actions')?.before(preview)
      }
    } else if (panel === 'loadout') {
      const primary = ARMORY_GUNS.find(gun => gun.id === this.save.data.primaryGunId) ?? ARMORY_GUNS[0]!
      const handgun = ARMORY_GUNS.find(gun => gun.id === this.save.data.handgunGunId) ?? ARMORY_GUNS.find(gun => gun.slot === 'handgun')!
      const owned = new Set(this.save.data.inventory.map(item => item.id))
      const finishMatches = SKINS.filter(skin => skin.weapon !== 'knife' && (this.finishQuery === '' || `${skin.name} ${skin.rarity} ${skin.pattern}`.toLowerCase().includes(this.finishQuery)))
      panelEl.innerHTML = `<div class="loadout-heading"><div><div class="panel-kicker">FIELD ARMORY // MODEL PREVIEW</div><h2>Your loadout</h2><p>Every preview uses its actual 3D model. Choose a blueprint, inspect finish colors, and set your knife.</p></div><button class="cta loadout-open-armory" data-action="armory">EDIT KIT <span>→</span></button></div><div class="loadout-layout"><aside class="loadout-showcase"><div class="showcase-tag"><i></i> OPERATOR KIT // LIVE PREVIEW</div><div class="showcase-slot" style="--gun:${primary.color}"><span>PRIMARY</span><img src="assets/weapon-previews/${primary.base}.webp" alt="3D preview of ${this.escape(primary.name)}" loading="lazy"><b>${this.escape(primary.name)}</b><small>${WEAPONS[primary.base].name} · ${WEAPONS[primary.base].magazine} ROUNDS</small></div><div class="showcase-slot compact" style="--gun:${handgun.color}"><span>HANDGUN</span><img src="assets/weapon-previews/${handgun.base}.webp" alt="3D preview of ${this.escape(handgun.name)}" loading="lazy"><b>${this.escape(handgun.name)}</b></div><div class="showcase-slot compact knife-showcase" style="--gun:${KNIFE_SKINS.find(item => item.id === this.save.data.knifeSkinId)?.color ?? '#f5c85a'}"><span>MELEE</span><img src="assets/weapon-previews/knife.webp" alt="3D voxel knife preview" loading="lazy"><b>${this.escape(KNIFE_SKINS.find(item => item.id === this.save.data.knifeSkinId)?.name ?? 'Field Shard')}</b></div><small class="showcase-footnote">KCH 3D models fitted to the operator grip.</small></aside><div class="loadout-library"><section class="loadout-section"><div class="loadout-section-heading"><div><span class="panel-kicker">76 ORIGINAL BLUEPRINTS</span><h3>Choose your firearm</h3></div><small>Tap a card to equip its slot.</small></div><div class="blueprint-grid">${ARMORY_GUNS.map(gun => { const selected = gun.id === (gun.slot === 'primary' ? primary.id : handgun.id); return `<button type="button" class="blueprint-choice ${selected ? 'is-selected' : ''}" data-armory-gun="${gun.id}" aria-pressed="${selected}" style="--gun:${gun.color}" title="Equip ${this.escape(gun.name)}"><img src="assets/weapon-previews/${gun.base}.webp" alt="" loading="lazy"><span>${gun.slot === 'primary' ? 'PRIMARY' : 'HANDGUN'}</span><b>${this.escape(gun.name)}</b></button>` }).join('')}</div></section><section class="loadout-section"><div class="loadout-section-heading"><div><span class="panel-kicker">${SKINS.length - 3} FIREARM COLORS</span><h3>Finishes</h3></div><small>Owned finishes are clickable.</small></div><div class="finish-tools"><input class="finish-search" type="search" data-finish-search placeholder="Search every finish..." value="${this.escape(this.finishQuery)}" aria-label="Search finishes"><small>${finishMatches.length} MATCHES</small></div><div class="finish-grid skin-grid">${finishMatches.slice(0, this.finishLimit).map(skin => { const unlocked = owned.has(skin.id); const equipped = this.save.data.equipped[skin.weapon] === skin.id; return `<button type="button" class="finish-choice skin-card equip ${unlocked ? 'is-owned' : 'is-locked'} ${equipped ? 'is-equipped' : ''}" data-weapon="${skin.weapon}" data-skin="${skin.id}" style="--finish:${skin.color};--rarity:${RARITY_COLORS[skin.rarity]}" title="${this.escape(skin.name)} · ${WEAPONS[skin.weapon].name} · ${skin.rarity}${unlocked ? '' : ' · LOCKED'}" aria-label="${this.escape(skin.name)}" ${unlocked ? '' : 'disabled'}><span class="skin-preview"><i class="skin-pattern" data-pattern="${this.escape(skin.pattern.split('#')[0] ?? 'plain')}"></i></span><b>${this.escape(skin.name)}</b><small>${WEAPONS[skin.weapon].short}</small></button>` }).join('')}</div>${finishMatches.length > this.finishLimit ? `<button type="button" class="finish-more" data-action="more-finishes">SHOW ${Math.min(60, finishMatches.length - this.finishLimit)} MORE · ${finishMatches.length - this.finishLimit} LEFT</button>` : ''}</div></section><section class="loadout-section"><div class="loadout-section-heading"><div><span class="panel-kicker">${KNIFE_SKINS.length} MELEE FINISHES</span><h3>Knife collection</h3></div><small>Unlocked designs can be selected.</small></div><div class="knife-finish-grid">${KNIFE_SKINS.map(knife => { const unlocked = this.save.data.unlockedKnifeSkinIds.includes(knife.id); return `<button type="button" class="knife-choice ${this.save.data.knifeSkinId === knife.id ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}" data-knife="${knife.id}" style="--knife:${knife.color}" title="${this.escape(knife.name)}" ${unlocked ? '' : 'disabled'}><i></i><span>${unlocked ? this.escape(knife.name) : 'LEVEL ' + knife.level}</span></button>` }).join('')}</div></section></div></div>`
    } else if (panel === 'inventory') {
      panelEl.innerHTML = `<div class="panel-kicker">INVENTORY / ${this.save.data.inventory.length} OF ${SKINS.length + KNIFE_SKINS.length - 3} FINISHES</div><h2>Collected finishes</h2><div class="inventory-list">${this.save.data.inventory.map(item => `<div class="inventory-item" style="--rarity:${RARITY_COLORS[item.rarity]}"><span class="rarity-dot"></span><b>${item.name}</b><small>${item.rarity} · ${WEAPONS[item.weapon].name}</small></div>`).join('')}</div>`
    } else if (panel === 'cases') {
      panelEl.innerHTML = `<div class="panel-kicker">DROP TERMINAL / LOCAL ECONOMY</div><h2>Case openings</h2><p>Open a case for a random weapon finish. No account, network, or purchase is required.</p><div class="case-visual"><span>CF</span><small>FRONTIER CACHE</small></div><div class="case-action"><b>${this.save.data.credits} CR</b><button class="cta" data-action="open-case">OPEN CACHE · 100 CR</button></div>`
    } else {
      if (panel === 'achievements' || panel === 'quests') { const unlocked = new Set(this.save.data.achievements); panelEl.innerHTML = `<div class="panel-kicker">MEDALS // ${unlocked.size} OF ${ACHIEVEMENTS.length}</div><h2>Field record</h2><p>Milestones are saved on this device.</p><div class="achievement-grid">${ACHIEVEMENTS.map(item => `<article class="achievement ${unlocked.has(item.id) ? 'is-earned' : ''}"><b>${unlocked.has(item.id) ? '★' : '◇'} ${item.name}</b><small>${item.detail}</small><em>${unlocked.has(item.id) ? 'UNLOCKED' : 'IN PROGRESS'}</em></article>`).join('')}</div>`; return }
      const s = this.save.data.stats
      const progress = Math.min(100, this.save.data.xp / this.save.data.level / 6)
      const operator = OPERATOR_SKINS.find(skin => skin.id === this.save.data.operatorSkinId) ?? operatorSkinForLevel(this.save.data.level)
      const nextSkin = OPERATOR_SKINS.find(skin => skin.level > this.save.data.level)
      panelEl.innerHTML = `<div class="panel-kicker">PROFILE / ${this.save.data.playerName}</div><h2>Chronicle keeper</h2><div class="profile-level"><div><b>LEVEL ${this.save.data.level}</b><span>${this.save.data.xp} / ${this.save.data.level >= 50 ? 'MAX' : 'NEXT'} XP</span></div><i style="width:${progress}%"></i></div><div class="operator-reward"><div class="operator-swatch" data-model="${operator.model}" style="--cloth:${operator.cloth};--trim:${operator.trim};--accent:${operator.accent}"><i></i><b></b><em></em></div><div><small>ACTIVE OPERATOR SKIN</small><strong>${operator.name}</strong><span>${nextSkin ? `Next unlock · level ${nextSkin.level} · ${nextSkin.name}` : 'All operator skins unlocked'}</span></div></div><div class="operator-track">${OPERATOR_SKINS.map(skin => { const unlocked = this.save.data.level >= skin.level; const selected = this.save.data.operatorSkinId === skin.id; return `<button class="operator-choice ${unlocked ? 'is-unlocked' : 'is-locked'} ${selected ? 'is-selected' : ''}" data-operator-skin="${skin.id}" data-model="${skin.model}" aria-label="${skin.name}, level ${skin.level}${unlocked ? selected ? ', selected' : ', unlocked' : ', locked'}" title="${skin.name} · level ${skin.level}" ${unlocked ? '' : 'disabled'}><i style="--cloth:${skin.cloth};--trim:${skin.trim}"></i><small>${skin.level}</small></button>` }).join('')}</div><div class="stat-grid"><span><b>${s.kills}</b>KILLS</span><span><b>${s.headshots}</b>HEADSHOTS</span><span><b>${s.wins}</b>WINS</span><span><b>${s.matches}</b>MATCHES</span></div>`
    }
  }
  private renderMapEditor(): void {
    const name = this.escape(this.customMap.name)
    const tiles: string[] = []
    for (let row = 0; row < 13; row += 1) for (let column = 0; column < 13; column += 1) {
      const x = -24 + column * 4; const z = -24 + row * 4
      const block = this.customMap.blocks.find(item => item.x === x && item.z === z)
      const marker = this.customMap.markers.find(item => item.x === x && item.z === z)
      const text = block ? '■' : marker?.kind === 'player-spawn' ? 'P' : marker?.kind === 'bot-spawn' ? 'B' : marker?.kind === 'site' ? marker.label ?? 'A' : ''
      const detail = block ? `${block.width}×${block.depth}×${block.height} ${block.surface}` : marker ? marker.kind === 'site' ? `SITE ${marker.label}` : marker.kind.toUpperCase() : 'empty'
      tiles.push(`<button class="map-tile ${block ? 'has-block' : ''} ${marker ? `has-${marker.kind}` : ''}" data-cell-x="${column}" data-cell-z="${row}" style="--tile-color:${block?.color ?? 'transparent'}" aria-label="Grid ${x}, ${z}: ${detail}" title="${x}, ${z} · ${detail}">${text}</button>`)
    }
    const tool = (id: typeof this.mapBrush, label: string) => `<button class="map-tool ${this.mapBrush === id ? 'is-selected' : ''}" data-brush="${id}" aria-pressed="${this.mapBrush === id}">${label}</button>`
    const root = this.root.querySelector<HTMLElement>('.map-editor-content')
    if (!root) return
    root.innerHTML = `<div class="map-editor-heading"><div><span class="panel-kicker">FIELD WORKSHOP // LOCAL EDITOR</span><h1>Build a custom arena.</h1><p>Place grid-snapped cover, spawns, and A/B sites. Up to 96 blocks, stored on this device.</p></div><label>MAP NAME<input data-nav name="customMapName" maxlength="32" value="${name}"></label></div><div class="map-editor-layout"><div class="map-editor-tools"><b>BRUSH</b><div class="map-tool-row">${tool('block', '▧ Cover')}${tool('player-spawn', 'P Player spawn')}${tool('bot-spawn', 'B Bot spawn')}${tool('site-a', 'A Site A')}${tool('site-b', 'B Site B')}</div><div class="map-brush-fields"><label>Width <input name="brushWidth" type="number" min="1" max="10" value="${this.brush.width}"></label><label>Depth <input name="brushDepth" type="number" min="1" max="10" value="${this.brush.depth}"></label><label>Height <input name="brushHeight" type="number" min="1" max="8" value="${this.brush.height}"></label><label>Color <input name="brushColor" type="color" value="${this.brush.color}"></label><label>Surface texture <select name="brushSurface"><option value="concrete" ${this.brush.surface === 'concrete' ? 'selected' : ''}>Concrete</option><option value="metal" ${this.brush.surface === 'metal' ? 'selected' : ''}>Metal</option><option value="wood" ${this.brush.surface === 'wood' ? 'selected' : ''}>Wood</option><option value="gravel" ${this.brush.surface === 'gravel' ? 'selected' : ''}>Gravel</option></select></label></div><div class="map-editor-grid" role="grid" aria-label="13 by 13 map editing grid">${tiles.join('')}</div><div class="map-legend"><span>P Player</span><span>B Bot</span><span>A/B Sites</span><span>${this.customMap.blocks.length}/96 blocks</span></div></div><aside class="map-share-panel"><b>MAP DATA</b><p>Click an occupied tile again to erase it. Imported JSON is validated and limited to the same grid.</p><button class="ghost-btn" data-action="map-save">SAVE LOCALLY</button><button class="ghost-btn" data-action="map-export">EXPORT JSON</button><label class="map-import">IMPORT JSON<input type="file" name="customMapFile" accept="application/json,.json"></label><div class="map-share-actions"><button class="ghost-btn" data-action="map-copy-link">COPY SHARE LINK</button><textarea name="mapCode" rows="4" spellcheck="false" aria-label="Paste a map code">${encodeCustomMap(this.customMap)}</textarea><button class="ghost-btn" data-action="map-import-code">LOAD MAP CODE</button></div><button class="ghost-btn" data-action="map-clear">CLEAR COVER</button><button class="ghost-btn" data-action="map-reset">RESTORE STARTER MAP</button><p class="map-editor-status" data-slot="map-editor-status" aria-live="polite">Local JSON and URL sharing; no cloud server is configured.</p><div class="map-editor-footer"><button class="ghost-btn" data-action="map-back">BACK</button><button class="cta" data-action="map-deploy">PLAY THIS MAP →</button></div></aside></div>`
  }
  private renderArmory(): void { const root = this.root.querySelector<HTMLElement>('.armory-content'); if (!root) return; const primary = ARMORY_GUNS.filter(g => g.slot === 'primary'); const sidearms = ARMORY_GUNS.filter(g => g.slot === 'handgun'); const knives = KNIFE_SKINS; const primarySelected = this.save.data.primaryGunId; const sidearmSelected = this.save.data.handgunGunId; root.innerHTML = `<div class="panel-kicker">PRE-ROUND // FIELD ARMORY</div><h2>Lock in your kit.</h2><p>Pick a primary, sidearm, and earned knife finish. The 76 original blueprints share balanced weapon archetypes. Browse ${SKINS.length - 3} firearm and ${KNIFE_SKINS.length} knife finishes with procedural voxel patterns.</p><div class="armory-columns"><label>PRIMARY <select name="primaryGun">${primary.map(g => `<option value="${g.id}" ${g.id === primarySelected ? 'selected' : ''}>${g.name} · ${g.era}</option>`).join('')}</select><span class="weapon-preview" style="--gun:${primary.find(g => g.id === primarySelected)?.color}"><img src="assets/weapon-previews/${primary.find(g => g.id === primarySelected)?.base ?? 'ak47'}.webp" alt="3D preview of selected primary"></span><small>ARCHETYPE MASTERY · ${(this.save.data.weaponKills[primary.find(g => g.id === primarySelected)?.base ?? 'ak47'] ?? 0)} ELIMS</small></label><label>HANDGUN <select name="handgunGun">${sidearms.map(g => `<option value="${g.id}" ${g.id === sidearmSelected ? 'selected' : ''}>${g.name}</option>`).join('')}</select><span class="weapon-preview sidearm" style="--gun:${sidearms.find(g => g.id === sidearmSelected)?.color}"><img src="assets/weapon-previews/${sidearms.find(g => g.id === sidearmSelected)?.base ?? 'glock'}.webp" alt="3D preview of selected handgun"></span><small>ARCHETYPE MASTERY · ${(this.save.data.weaponKills[sidearms.find(g => g.id === sidearmSelected)?.base ?? 'glock'] ?? 0)} ELIMS</small></label></div><div class="knife-picker"><b>KNIFE FINISHES</b><div>${knives.map(k => { const unlocked = this.save.data.unlockedKnifeSkinIds.includes(k.id); return `<button class="knife-choice ${this.save.data.knifeSkinId === k.id ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}" data-knife="${k.id}" style="--knife:${k.color}" ${unlocked ? '' : 'disabled'}><i></i><span>${unlocked ? k.name : `LEVEL ${k.level}`}</span></button>` }).join('')}</div></div><div class="armory-footer"><button class="ghost-btn" data-action="armory-back">BACK TO QUEUE</button><button class="cta" data-action="deploy">DEPLOY // ${this.selectedMode.toUpperCase()} <span>→</span></button></div><small class="armory-controls">1 PRIMARY · 2 HANDGUN · 3 KNIFE · MOUSE WHEEL SWITCHES SLOTS · CTRL + SHIFT SLIDE · Q PING</small>` }
  private translate(): void { for (const el of this.root.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = this.i18n.t(el.dataset.i18n!); document.title = this.i18n.t('game.title') }
  private setText(slot: string, value: string): void { const el = this.root.querySelector<HTMLElement>(`[data-slot="${slot}"]`); if (el && this.hudCache.get(slot) !== value) { el.textContent = value; this.hudCache.set(slot, value) } }
  private escape(value: string): string { return value.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c)) }
  private template(): string { return `
<section class="screen screen-boot is-active" data-screen="boot"><div class="boot-mark">CF</div><div class="boot-logo" data-i18n="game.title"></div><div class="boot-bar"><i></i></div><div class="boot-label" data-i18n="boot.loading"></div></section>
<section class="screen screen-title" data-screen="title"><div class="title-noise"></div><header class="lobby-top"><div class="brand"><span class="brand-mark">K</span><div><strong class="logo-text">KIRKA</strong><small>ALPHA</small></div></div><div class="top-status"><span class="status-dot"></span><span>ARENA // READY</span><b data-slot="lobby-credits">420 CR</b><button class="lobby-settings" data-action="settings" aria-label="Settings">⚙</button></div></header><div class="lobby-shell"><aside class="lobby-nav"><span class="nav-label">MAIN MENU</span><button data-panel="queue" class="active"><i>⌂</i><span>HUB</span></button><button data-panel="cases"><i>▦</i><span>STORE</span></button><button data-panel="servers"><i>▤</i><span>SERVERS</span></button><button data-panel="quests"><i>◇</i><span>QUESTS</span></button><button data-action="leaderboard"><i>♙</i><span>FRIENDS</span></button><button data-panel="inventory"><i>▣</i><span>INVENTORY</span></button><button data-action="map-editor"><i>⌗</i><span>MAP</span></button><div class="nav-foot"><button data-action="settings">SETTINGS</button></div><div class="nav-online"><i></i> LOCAL ARENA READY</div></aside><main class="lobby-main"><div class="lobby-hero" aria-hidden="true"></div><section class="lobby-panel"></section></main></div><footer class="lobby-footer"><span><kbd>WASD</kbd> MOVE <kbd>LMB</kbd> FIRE <kbd>RMB</kbd> AIM <kbd>R</kbd> RELOAD <kbd>1–3</kbd> GEAR</span><span>CHRONICLE FRONTIER <i></i> OFFLINE ARENA</span></footer></section>
<section class="screen screen-modal screen-armory" data-screen="armory"><div class="modal modal-wide armory-content"></div></section>
<section class="screen screen-hud" data-screen="hud"><div class="hurt-vignette"></div><div class="popups"></div><div class="scope-overlay"><div class="scope-line horizontal"></div><div class="scope-line vertical"></div><span>LONGWATCH // 4X</span></div><div class="hud-topline"><section class="radar-card" aria-label="Tactical map"><div class="radar-heading"><span>FIELD MAP</span><b data-slot="hud-storm">LOCAL BOTS</b></div><div class="radar"><div class="radar-grid"><i></i><i></i><i></i></div><div class="radar-safe"></div><div class="radar-player" aria-label="Your position"></div></div><div class="radar-footer"><strong data-slot="hud-map">AURELIAN FORUM</strong><span>GRID // 30M</span></div></section><section class="match-ribbon" aria-label="Match status"><div class="match-mode"><span class="status-dot"></span><small data-slot="hud-mode">FREE FOR ALL</small><b data-slot="hud-objective">FIRST TO 12 ELIMS</b></div><div class="match-core"><div class="team-score team-blue"><b data-slot="hud-team-blue">00</b><small>BLUE</small></div><div class="match-clock"><small data-slot="hud-clock-label">ROUND TIME</small><strong data-slot="hud-clock">02:30</strong></div><div class="team-score team-red"><b data-slot="hud-team-red">00</b><small>RED</small></div></div><div class="match-stats"><div class="match-stat ffa-stat"><b data-slot="hud-kills">0</b><small>ELIMS</small></div><div class="match-stat royale-stat"><b data-slot="hud-royale-alive">25</b><small>ALIVE</small></div><i></i><div class="match-stat"><b data-slot="hud-deaths">0</b><small>DEATHS</small></div></div></section></div><div class="spawn-shield" data-slot="hud-spawn-shield" role="status" aria-live="polite"></div><div class="killfeed" aria-live="polite" aria-label="Elimination feed"></div><div class="spectator-status" aria-live="polite"></div><button class="buy-open" data-action="open-buy">B&nbsp; BUY</button><div class="crosshair" aria-hidden="true"><i class="crosshair-up"></i><i class="crosshair-right"></i><i class="crosshair-down"></i><i class="crosshair-left"></i><b></b></div><div class="hitmarker" aria-hidden="true">×</div><div class="hud-bottom-left"><span class="hud-label">OPERATOR VITALS</span><div class="vital-row"><b>HP</b><i class="health-track" role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><em class="health-fill"></em></i></div><div class="vital-row"><b>ARMOR</b><i class="armor-track" role="progressbar" aria-label="Armor" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><em class="armor-fill"></em></i></div></div><div class="hud-bottom-right"><div class="weapon-slots"><div class="weapon-slot" data-weapon-slot="primary"><kbd>1</kbd><span><b data-slot="hud-primary">Morrow-7</b><small>PRIMARY</small></span></div><div class="weapon-slot" data-weapon-slot="handgun"><kbd>2</kbd><span><b data-slot="hud-handgun">Shark</b><small>HANDGUN</small></span></div><div class="weapon-slot" data-weapon-slot="knife"><kbd>3</kbd><span><b data-slot="hud-knife">Bayonet</b><small>MELEE</small></span></div></div><span class="weapon-class">ACTIVE LOADOUT</span><b class="hud-label" data-slot="hud-weapon">Cinder-9</b><div class="weapon-ammo"><strong data-slot="hud-ammo">20</strong><span class="ammo-divider">/</span><span data-slot="hud-magazine">20</span></div><small class="ammo-help"><span data-slot="hud-reload"></span>1–7 SELECT · R RELOAD · G FRAG <b>×<span data-slot="hud-grenades">0</span></b></small></div><div class="hud-center-bottom"><b data-slot="hud-score">0000</b><span>MATCH SCORE</span><i></i><small><b data-slot="hud-kills-bottom">0</b> ELIMS&nbsp; / &nbsp;<b data-slot="hud-deaths-bottom">0</b> DEATHS</small></div><button class="hud-pause" data-action="pause" aria-label="Pause match">Ⅱ</button><div class="scoreboard"><div class="score-head"><span>OPERATIVE</span><span>K</span><span>D</span><span>UNIT</span></div><div class="scoreboard-list"></div></div><div class="banner"></div></section>
<section class="screen screen-buy" data-screen="buy-menu"><div class="buy-panel"><div class="panel-kicker">RELIC SEARCH // BUY PHASE</div><h2>Field requisition</h2><p>Purchases use your match credits and persist only on this device.</p><div class="buy-options"><button data-buy-item="rifle"><b>WAYFINDER RIFLE</b><span>1,200 CR · Requisition the Morrow-7.</span></button><button data-buy-item="armor"><b>REINFORCED ARMOR</b><span>350 CR · Restore up to 50 armor.</span></button><button data-buy-item="grenade"><b>VOXEL FRAG</b><span>300 CR · Press G to throw.</span></button></div><small data-slot="buy-feedback" aria-live="polite">B opens this panel during the first 15 seconds of each round.</small><button class="ghost-btn" data-action="buy-close">CLOSE // ESC</button></div></section>
<section class="screen screen-modal" data-screen="pause"><div class="modal"><span class="panel-kicker">ROUND PAUSED</span><h2>Systems idle.</h2><button class="cta" data-action="resume">RESUME</button><button class="ghost-btn" data-action="restart">RESTART MATCH</button><button class="ghost-btn" data-action="settings">SETTINGS</button><button class="ghost-btn" data-action="quit">EXIT TO LOBBY</button></div></section>
<section class="screen screen-modal" data-screen="settings"><div class="modal modal-wide"><span class="panel-kicker">SYSTEM // SETTINGS</span><h2>Configuration</h2><div class="settings-grid"><label>Music <input type="range" name="musicVolume" min="0" max="1" step="0.05"></label><label>Effects <input type="range" name="sfxVolume" min="0" max="1" step="0.05"></label><label>Sensitivity <input type="range" name="sensitivity" min="0.2" max="3" step="0.1"></label><label>Field of view <input type="range" name="fov" min="70" max="110" step="1"></label><label>Crosshair color <input type="color" name="crosshairColor" value="#e9eddf"></label><label>Crosshair gap <input type="range" name="crosshairGap" min="1" max="14" step="1"></label><label>Crosshair thickness <input type="range" name="crosshairThickness" min="1" max="5" step="1"></label><button class="toggle" data-setting="muted" aria-pressed="false">Mute audio</button><button class="toggle" data-setting="invertY" aria-pressed="false">Invert Y</button><button class="toggle" data-setting="reducedMotion" aria-pressed="false">Reduce motion</button></div><div class="seg" data-setting="quality"><button data-value="low">LOW</button><button data-value="medium">MEDIUM</button><button data-value="high">HIGH</button></div><div class="seg" data-setting="locale"><button data-value="en">ENGLISH</button><button data-value="zh-CN">简体中文</button></div><button class="ghost-btn" data-action="back">BACK</button></div></section>
<section class="screen screen-modal" data-screen="leaderboard"><div class="modal"><span class="panel-kicker">LOCAL // SCOREBOARD</span><h2>Leaderboard</h2><ol class="board"></ol><button class="ghost-btn" data-action="back">BACK</button></div></section>
<section class="screen screen-modal" data-screen="results"><div class="modal results-modal"><span class="panel-kicker">POST-MATCH // DROP SECURED</span><h2 class="results-title">MATCH COMPLETE</h2><div class="drop-card"></div><div class="result-grid"><span><b data-slot="result-kills">0</b>KILLS</span><span><b data-slot="result-headshots">0</b>HEADSHOTS</span><span><b data-slot="result-accuracy">0%</b>ACCURACY</span><span><b data-slot="result-xp">+0 XP</b>REWARD</span></div><div class="results-level"><div><span>LEVEL PROGRESS</span><b data-slot="result-level">LEVEL 1 → 2</b></div><i class="xp-track"><b class="xp-fill" data-slot="result-xp-fill"></b></i><small data-slot="result-xp-progress">0 / 500 XP</small></div><div class="result-score"><span>FIELD MVP · <b data-slot="result-mvp">YOU</b> &nbsp;|&nbsp; ROUND SCORE</span><b data-slot="result-score">0</b></div><input class="results-name" data-nav value="RAVEN" maxlength="16"><button class="cta" data-action="save-score">SAVE SCORE LOCALLY</button><button class="ghost-btn" data-action="restart">PLAY AGAIN</button><button class="ghost-btn" data-action="quit">RETURN TO LOBBY</button></div></section>` }
}
