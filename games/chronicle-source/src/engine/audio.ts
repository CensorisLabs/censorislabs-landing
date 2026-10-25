export type Sfx = 'pickup' | 'jump' | 'land' | 'hurt' | 'ui' | 'win' | 'lose' | 'dash' | 'gunshot' | 'reload' | 'hit' | 'empty' | 'levelup' | 'case' | 'plant' | 'defuse'
export type AudioPoint = Readonly<{ x: number; y: number; z: number }>

export class Audio {
  readonly ctx: AudioContext
  private master: GainNode
  private music: GainNode
  private sfx: GainNode
  private musicTimer = 0
  private musicOn = false
  private readonly stepNoise: AudioBuffer
  private readonly kchSamples = new Map<string, AudioBuffer>()
  constructor() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    this.ctx = new (Ctor ?? AudioContext)()
    this.master = this.ctx.createGain(); this.music = this.ctx.createGain(); this.sfx = this.ctx.createGain()
    this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination)
    this.stepNoise = this.ctx.createBuffer(1, Math.max(1, Math.floor(this.ctx.sampleRate * 0.2)), this.ctx.sampleRate)
    const channel = this.stepNoise.getChannelData(0)
    for (let i = 0; i < channel.length; i += 1) channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length)
  }
  unlock(): void { if (this.ctx.state === 'suspended') void this.ctx.resume() }
  async loadKchSamples(): Promise<void> {
    const samples: Record<string, string> = {
      gunshot: 'assets/kch-library/sounds/media%20pack-1/__use__.5421e46b.mp3',
      hit: 'assets/kch-library/sounds/media%20pack-1/__hit__.200043fa.mp3',
      hurt: 'assets/kch-library/sounds/media%20pack-2/__wound1__.531f0649.mp3',
      dash: 'assets/kch-library/sounds/media%20pack-2/__whoosh__.634f7dda.mp3',
      stepEarth: 'assets/kch-library/sounds/media%20pack-1/__Earth__.37abd171.mp3',
      stepGrass: 'assets/kch-library/sounds/media%20pack-1/__Grass__.9d721edd.mp3',
      stepMud: 'assets/kch-library/sounds/media%20pack-1/__Mud__.44d00950.mp3',
      stepSand: 'assets/kch-library/sounds/media%20pack-1/__Sand__.10a59d13.mp3',
      stepStone: 'assets/kch-library/sounds/media%20pack-1/__Stone__.a9cedce8.mp3',
    }
    await Promise.all(Object.entries(samples).map(async ([key, url]) => {
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`KCH sound request failed (${response.status})`)
        this.kchSamples.set(key, await this.ctx.decodeAudioData(await response.arrayBuffer()))
      } catch (error) {
        console.warn(`Optional KCH sound unavailable: ${url}`, error)
      }
    }))
  }
  setVolumes(music: number, sfx: number, muted = false): void { const t = this.ctx.currentTime; this.music.gain.setTargetAtTime(muted ? 0 : music * 0.55, t, 0.05); this.sfx.gain.setTargetAtTime(muted ? 0 : sfx * 0.8, t, 0.05) }
  updateListener(position: AudioPoint, yaw: number, pitch = 0): void {
    const listener = this.ctx.listener
    const forward = { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) }
    if (listener.positionX) {
      const now = this.ctx.currentTime
      listener.positionX.setTargetAtTime(position.x, now, 0.025); listener.positionY.setTargetAtTime(position.y, now, 0.025); listener.positionZ.setTargetAtTime(position.z, now, 0.025)
      listener.forwardX.setTargetAtTime(forward.x, now, 0.025); listener.forwardY.setTargetAtTime(forward.y, now, 0.025); listener.forwardZ.setTargetAtTime(forward.z, now, 0.025)
      listener.upX.setTargetAtTime(0, now, 0.025); listener.upY.setTargetAtTime(1, now, 0.025); listener.upZ.setTargetAtTime(0, now, 0.025)
    } else {
      listener.setPosition(position.x, position.y, position.z)
      listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0)
    }
  }
  private outputAt(position?: AudioPoint): AudioNode {
    if (!position) return this.sfx
    const panner = this.ctx.createPanner()
    panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2.2; panner.maxDistance = 75; panner.rolloffFactor = 1.05
    if (panner.positionX) { panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z }
    else panner.setPosition(position.x, position.y, position.z)
    panner.connect(this.sfx)
    window.setTimeout(() => panner.disconnect(), 1800)
    return panner
  }
  private playKchSample(key: string, position?: AudioPoint, volume = 1): boolean {
    const buffer = this.kchSamples.get(key)
    if (!buffer || this.ctx.state !== 'running') return false
    const source = this.ctx.createBufferSource()
    const gain = this.ctx.createGain()
    source.buffer = buffer
    gain.gain.value = volume
    source.connect(gain).connect(this.outputAt(position))
    source.onended = () => { source.disconnect(); gain.disconnect() }
    source.start()
    return true
  }
  play(name: Sfx, position?: AudioPoint): void {
    if (this.ctx.state !== 'running') return
    if (this.playKchSample(name, position, name === 'gunshot' ? 0.58 : 0.78)) return
    const t = this.ctx.currentTime
    const output = this.outputAt(position)
    const tone = (freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0, bus: AudioNode = output) => { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t + delay); o.frequency.exponentialRampToValueAtTime(Math.max(end, 20), t + delay + dur); g.gain.setValueAtTime(0.0001, t + delay); g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); o.connect(g).connect(bus); o.start(t + delay); o.stop(t + delay + dur + 0.04) }
    switch (name) {
      case 'gunshot': tone(160, 42, 0.11, 'sawtooth', 0.28); tone(820, 160, 0.055, 'square', 0.12, 0.005); break
      case 'reload': tone(220, 440, 0.08, 'square', 0.12); tone(650, 280, 0.18, 'triangle', 0.16, 0.14); tone(120, 80, 0.12, 'sine', 0.15, 0.34); break
      case 'hit': tone(980, 460, 0.09, 'triangle', 0.18); break
      case 'empty': tone(180, 120, 0.09, 'square', 0.12); break
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.02, 0.22, 'triangle', 0.16, i * 0.08)); break
      case 'case': [330, 440, 554, 740].forEach((f, i) => tone(f, f * 1.04, 0.13, 'sine', 0.13, i * 0.07)); break
      case 'plant': tone(340, 510, 0.18, 'square', 0.16); tone(510, 680, 0.2, 'triangle', 0.18, 0.2); tone(680, 720, 0.24, 'sine', 0.2, 0.43); break
      case 'defuse': tone(740, 560, 0.15, 'triangle', 0.16); tone(560, 420, 0.2, 'sine', 0.18, 0.18); break
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
  playFootstep(surface: 'concrete' | 'metal' | 'wood' | 'gravel' | 'grass', position: AudioPoint, strength = 1): void {
    if (this.ctx.state !== 'running') return
    const kchStep = surface === 'wood' ? 'stepEarth' : surface === 'grass' ? 'stepGrass' : surface === 'gravel' ? 'stepSand' : 'stepStone'
    if (this.playKchSample(kchStep, position, Math.max(0.35, Math.min(1.25, strength)))) return
    const profiles = {
      concrete: { frequency: 520, q: 0.65, gain: 0.16 }, metal: { frequency: 2850, q: 1.1, gain: 0.13 },
      wood: { frequency: 950, q: 0.8, gain: 0.16 }, gravel: { frequency: 1750, q: 0.55, gain: 0.19 }, grass: { frequency: 380, q: 0.45, gain: 0.1 },
    } as const
    const profile = profiles[surface]
    const source = this.ctx.createBufferSource(); source.buffer = this.stepNoise
    const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = profile.frequency; filter.Q.value = profile.q
    const gain = this.ctx.createGain(); const t = this.ctx.currentTime; const peak = profile.gain * Math.max(0.35, Math.min(1.25, strength))
    gain.gain.setValueAtTime(0.0001, t); gain.gain.linearRampToValueAtTime(peak, t + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    source.connect(filter).connect(gain).connect(this.outputAt(position)); source.start(t); source.stop(t + 0.18)
  }
  startMusic(): void { if (this.musicOn) return; this.musicOn = true; const chords = [[110, 138, 165], [98, 123, 147], [87, 110, 131], [98, 131, 165]]; let bar = 0; const schedule = () => { if (!this.musicOn) return; const t = this.ctx.currentTime + 0.05; for (const f of chords[bar++ % chords.length]) { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.8); g.gain.linearRampToValueAtTime(0.0001, t + 3.5); o.connect(g).connect(this.music); o.start(t); o.stop(t + 3.8) } this.musicTimer = window.setTimeout(schedule, 3000) }; schedule() }
  stopMusic(): void { this.musicOn = false; clearTimeout(this.musicTimer) }
}
