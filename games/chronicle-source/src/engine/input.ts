/** Unified keyboard, mouse, gamepad and touch input for VoxelStrike. */
export type Action = 'jump' | 'sprint' | 'crouch' | 'ping' | 'pause' | 'confirm' | 'back' | 'interact' | 'shoot' | 'ads' | 'reload' | 'scoreboard' | 'inspect' | 'weapon1' | 'weapon2' | 'weapon3' | 'weapon4' | 'weapon5' | 'weapon6' | 'weapon7'
export type InputMethod = 'keyboard' | 'gamepad' | 'touch'

const KEY_BINDINGS: Record<Action, string[]> = {
  jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], crouch: ['ControlLeft', 'ControlRight'], ping: ['KeyQ'], pause: ['Escape', 'KeyP'], confirm: ['Enter', 'NumpadEnter'], back: [], interact: ['KeyE'], shoot: [], ads: [], reload: ['KeyR'], scoreboard: ['Tab'], inspect: ['KeyT'], weapon1: ['Digit1'], weapon2: ['Digit2'], weapon3: ['Digit3'], weapon4: ['Digit4'], weapon5: ['Digit5'], weapon6: ['Digit6'], weapon7: ['Digit7'],
}
const MOVE_KEYS = { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] }
const PAD_BINDINGS: Record<Action, number[]> = { jump: [0], sprint: [4, 10], crouch: [1], ping: [5], pause: [9], confirm: [0], back: [1], interact: [3], shoot: [7], ads: [6], reload: [2], scoreboard: [4], inspect: [3], weapon1: [], weapon2: [], weapon3: [], weapon4: [], weapon5: [], weapon6: [], weapon7: [] }

export class Input {
  readonly move = { x: 0, y: 0 }
  readonly look = { x: 0, y: 0 }
  method: InputMethod = 'keyboard'
  sensitivity = 1
  invertY = false
  private keys = new Set<string>()
  private mouse = new Set<number>()
  private held_ = new Set<Action>()
  private pressed_ = new Set<Action>()
  private touchMove = { x: 0, y: 0 }
  private touchButtons = new Set<Action>()
  private padPrev = new Set<Action>()
  private wheelDelta = 0
  private listeners: Array<() => void> = []

  constructor(private readonly canvas: HTMLCanvasElement) {
    const on = <K extends keyof WindowEventMap>(target: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts)
      this.listeners.push(() => target.removeEventListener(type, fn as EventListener, opts))
    }
    on(window, 'keydown', e => {
      if (e.repeat) return
      this.keys.add(e.code)
      this.method = 'keyboard'
      for (const [action, codes] of Object.entries(KEY_BINDINGS) as [Action, string[]][]) if (codes.includes(e.code)) this.pressed_.add(action)
      if (e.code === 'Tab') e.preventDefault()
      if (!(e.target as HTMLElement | null)?.matches?.('input, textarea') && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault()
    })
    on(window, 'keyup', e => this.keys.delete(e.code))
    on(window, 'blur', () => { this.keys.clear(); this.mouse.clear() })
    on(window, 'mousedown', e => {
      if (document.pointerLockElement !== canvas) return
      this.mouse.add(e.button)
      this.method = 'keyboard'
      if (e.button === 0) this.pressed_.add('shoot')
      if (e.button === 2) this.pressed_.add('ads')
    })
    on(window, 'mouseup', e => this.mouse.delete(e.button))
    on(window, 'contextmenu', e => { if (document.pointerLockElement === canvas) e.preventDefault() })
    on(window, 'wheel', e => { if (document.pointerLockElement === canvas) { this.wheelDelta += Math.sign(e.deltaY); e.preventDefault() } }, { passive: false })
    on(window, 'mousemove', e => {
      if (document.pointerLockElement !== canvas) return
      this.look.x += e.movementX * 0.0022
      this.look.y += e.movementY * 0.0022
    })
  }

  lockPointer(): void {
    if (this.method !== 'touch' && document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.()?.catch?.(() => undefined)
  }
  unlockPointer(): void { if (document.pointerLockElement) document.exitPointerLock() }
  setTouchMove(x: number, y: number): void { this.method = 'touch'; this.touchMove.x = x; this.touchMove.y = y }
  addTouchLook(dx: number, dy: number): void { this.method = 'touch'; this.look.x += dx * 0.006; this.look.y += dy * 0.006 }
  setTouchButton(action: Action, down: boolean): void { this.method = 'touch'; if (down && !this.touchButtons.has(action)) this.pressed_.add(action); if (down) this.touchButtons.add(action); else this.touchButtons.delete(action) }

  update(): void {
    const k = (codes: string[]) => codes.some(code => this.keys.has(code))
    let x = (k(MOVE_KEYS.right) ? 1 : 0) - (k(MOVE_KEYS.left) ? 1 : 0)
    let y = (k(MOVE_KEYS.up) ? 1 : 0) - (k(MOVE_KEYS.down) ? 1 : 0)
    this.held_.clear()
    for (const [action, codes] of Object.entries(KEY_BINDINGS) as [Action, string[]][]) if (k(codes)) this.held_.add(action)
    if (this.mouse.has(0)) this.held_.add('shoot')
    if (this.mouse.has(2)) this.held_.add('ads')
    for (const action of this.touchButtons) this.held_.add(action)
    if (this.touchMove.x !== 0 || this.touchMove.y !== 0) { x = this.touchMove.x; y = this.touchMove.y }
    const pad = navigator.getGamepads?.().find(p => p && p.connected)
    if (pad) {
      const dead = (v: number) => Math.abs(v) < 0.18 ? 0 : v
      const lx = dead(pad.axes[0] ?? 0); const ly = dead(pad.axes[1] ?? 0); const rx = dead(pad.axes[2] ?? 0); const ry = dead(pad.axes[3] ?? 0)
      if (lx || ly || rx || ry || pad.buttons.some(b => b.pressed)) this.method = 'gamepad'
      if (lx || ly) { x = lx; y = -ly }
      this.look.x += rx * 0.045; this.look.y += ry * 0.045
      const now = new Set<Action>()
      for (const [action, buttons] of Object.entries(PAD_BINDINGS) as [Action, number[]][]) if (buttons.some(i => pad.buttons[i]?.pressed)) now.add(action)
      for (const action of now) { this.held_.add(action); if (!this.padPrev.has(action)) this.pressed_.add(action) }
      this.padPrev = now
    }
    const len = Math.hypot(x, y)
    this.move.x = len > 1 ? x / len : x
    this.move.y = len > 1 ? y / len : y
  }
  held(action: Action): boolean { return this.held_.has(action) }
  pressed(action: Action): boolean { return this.pressed_.has(action) }
  consume(action: Action): boolean { return this.pressed_.delete(action) }
  takeLook(): { x: number; y: number } { const out = { x: this.look.x * this.sensitivity, y: this.look.y * this.sensitivity * (this.invertY ? -1 : 1) }; this.look.x = 0; this.look.y = 0; return out }
  takeWeaponWheel(): number { const value = this.wheelDelta; this.wheelDelta = 0; return value }
  endFrame(): void { this.pressed_.clear() }
  dispose(): void { for (const off of this.listeners) off(); this.listeners = [] }
}
