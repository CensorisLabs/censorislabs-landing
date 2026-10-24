import './styles/main.css'
import './styles/hud.css'
import { Audio } from './engine/audio'
import { I18n, resolveLocale } from './engine/i18n'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SaveStore } from './engine/save'
import type { BotDifficulty, MapId, MatchType } from './game/fps'
import { Ui } from './ui/ui'

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const save = new SaveStore()
  const i18n = new I18n(resolveLocale(save.data.locale, navigator.languages))
  const input = new Input(canvas)
  const audio = new Audio()
  let game: import('./game/game').Game | undefined
  let lockLostAt = 0
  const applySettings = () => { input.sensitivity = save.data.sensitivity; input.invertY = save.data.invertY; audio.setVolumes(save.data.musicVolume, save.data.sfxVolume, save.data.muted); if (game) game.setQuality(save.data.quality) }
  const ui = new Ui(i18n, save, audio, input, {
    play: (mode: MatchType, map: MapId, difficulty: BotDifficulty) => { if (!game) return; audio.unlock(); audio.startMusic(); game.start(mode, map, difficulty); ui.show('hud'); input.lockPointer() },
    resume: () => { game?.resume(); ui.show('hud'); input.lockPointer() },
    restart: () => { if (!game) return; audio.unlock(); game.start(); ui.show('hud'); input.lockPointer() },
    quit: () => { game?.toTitle(); input.unlockPointer(); ui.show('title') },
    settings: patch => { save.update(patch); applySettings(); ui.refreshSettings(); if (patch.locale) i18n.set(patch.locale) },
  })
  ui.show('boot'); applySettings()
  let loaded = 0
  const track = <T,>(promise: Promise<T>) => promise.then(value => { loaded += 1; ui.setBootProgress(0.1 + loaded * 0.28); return value })
  ui.setBootProgress(0.08)
  const [{ Game }, { Renderer }] = await Promise.all([track(import('./game/game')), track(import('./engine/renderer')), track(document.fonts.ready)])
  const renderer = new Renderer(canvas, save.data.quality)
  game = new Game(renderer, input, audio, save, { popup: (text, at, kind) => ui.popup(text, at, kind), hitmarker: headshot => ui.hitmarker(headshot), hurt: () => ui.hurt(), killfeed: (text, headshot) => ui.killfeed(text, headshot), banner: text => ui.banner(text), end: run => window.setTimeout(() => ui.showResults(run), 500) })
  ui.setGame(game); ui.setBootProgress(1)
  const loop = new GameLoop({
    step: dt => { if (input.consume('pause') && performance.now() - lockLostAt > 300) { if (game?.mode === 'playing') { game.pause(); input.unlockPointer(); ui.show('pause') } else if (game?.mode === 'paused') { game.resume(); ui.show('hud'); input.lockPointer() } } game?.step(dt) },
    render: (alpha, frameSeconds) => { input.update(); ui.frame(frameSeconds); if (game) { loop.paused = game.mode === 'paused' || game.mode === 'attract' || game.mode === 'ended'; game.render(alpha, frameSeconds); if (game.mode === 'playing' || game.mode === 'ended') ui.updateHud(game.snapshot()) } },
  })
  loop.start()
  window.addEventListener('keydown', event => { if (event.code === 'Escape' && game?.mode === 'playing') { event.preventDefault(); game.pause(); input.unlockPointer(); ui.show('pause') } })
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && game?.mode === 'playing') { lockLostAt = performance.now(); input.consume('pause'); game.pause(); ui.show('pause') } })
  document.addEventListener('visibilitychange', () => { if (document.hidden && game?.mode === 'playing') { game.pause(); input.unlockPointer(); ui.show('pause') } })
  canvas.addEventListener('click', () => { if (game?.mode === 'playing') input.lockPointer() })
  window.setTimeout(() => ui.show('title'), 260)
  ;(window as unknown as { __game: unknown }).__game = { game, ui, input, save }
}
boot().catch(error => { console.error(error); const el = document.getElementById('ui'); if (el) el.innerHTML = `<div class="fatal">Failed to start: ${String((error as Error)?.message ?? error).replace(/[<>&]/g, '')}</div>` })
