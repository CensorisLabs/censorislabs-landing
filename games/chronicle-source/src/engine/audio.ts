export type Sfx = 'pickup' | 'jump' | 'land' | 'hurt' | 'ui' | 'win' | 'lose' | 'dash' | 'gunshot' | 'reload' | 'hit' | 'empty' | 'levelup' | 'case'

export class Audio {
  readonly ctx: AudioContext
  private master: GainNode
  private music: GainNode
  private sfx: GainNode
  private musicTimer = 0
  private musicOn = false
  constructor() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    this.ctx = new (Ctor ?? AudioContext)()
    this.master = this.ctx.createGain(); this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain()
    this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination)
  }
  unlock(): void { if (this.ctx.state === 'suspended') void this.ctx.resume() }
  setVolumes(music: number, sfx: number, muted = false): void { const t = this.ctx.currentTime; this.music.gain.setTargetAtTime(muted ? 0 : music * 0.55, t, 0.05); this.sfx.gain.setTargetAtTime(muted ? 0 : sfx * 0.8, t, 0.05) }
  play(name: Sfx): void {
    if (this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    const tone = (freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0, bus = this.sfx) => { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t + delay); o.frequency.exponentialRampToValueAtTime(Math.max(end, 20), t + delay + dur); g.gain.setValueAtTime(0.0001, t + delay); g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); o.connect(g).connect(bus); o.start(t + delay); o.stop(t + delay + dur + 0.04) }
    switch (name) {
      case 'gunshot': tone(160, 42, 0.11, 'sawtooth', 0.28); tone(820, 160, 0.055, 'square', 0.12, 0.005); break
      case 'reload': tone(220, 440, 0.08, 'square', 0.12); tone(650, 280, 0.18, 'triangle', 0.16, 0.14); tone(120, 80, 0.12, 'sine', 0.15, 0.34); break
      case 'hit': tone(980, 460, 0.09, 'triangle', 0.18); break
      case 'empty': tone(180, 120, 0.09, 'square', 0.12); break
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.02, 0.22, 'triangle', 0.16, i * 0.08)); break
      case 'case': [330, 440, 554, 740].forEach((f, i) => tone(f, f * 1.04, 0.13, 'sine', 0.13, i * 0.07)); break
      case 'pickup': tone(880, 1320, 0.12, 'triangle', 0.35); tone(1320, 1760, 0.16, 'sine', 0.25, 0.06); break
      case 'jump': tone(300, 620, 0.14, 'square', 0.12); break
      case 'land': tone(160, 70, 0.1, 'sine', 0.25); break
      case 'hurt': tone(220, 90, 0.28, 'sawtooth', 0.22); break
      case 'ui': tone(660, 700, 0.06, 'triangle', 0.18); break
      case 'dash': tone(500, 180, 0.18, 'sawtooth', 0.1); break
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, 0.3, 'triangle', 0.25, i * 0.11)); break
      case 'lose': [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.38, 'sine', 0.25, i * 0.16)); break
    }
  }
  startMusic(): void { if (this.musicOn) return; this.musicOn = true; const chords = [[110, 138, 165], [98, 123, 147], [87, 110, 131], [98, 131, 165]]; let bar = 0; const schedule = () => { if (!this.musicOn) return; const t = this.ctx.currentTime + 0.05; for (const f of chords[bar++ % chords.length]) { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.8); g.gain.linearRampToValueAtTime(0.0001, t + 3.5); o.connect(g).connect(this.music); o.start(t); o.stop(t + 3.8) } this.musicTimer = window.setTimeout(schedule, 3000) }; schedule() }
  stopMusic(): void { this.musicOn = false; clearTimeout(this.musicTimer) }
}
