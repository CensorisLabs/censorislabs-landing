import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

export const CC0_GAME_MODELS = {
  assaultRifle: { url: 'assets/models/cc0/quaternius/assault-rifle.glb', sha256: '119c638bd65ef97e7843f230cfca17abd526af9c579a98a87d6df3e6f299c7a5' },
  blaster: { url: 'assets/models/cc0/kenney-blaster/blaster-c.glb', sha256: '1c4c53f201597b2845c3d71717e0c465af1c21d8f8c30c0e1b4358dc33133d35', textures: [{ url: 'assets/models/cc0/kenney-blaster/Textures/colormap.png', sha256: '4d0867c3c3c8c539106f91fbc0987d0e1b7d2811362d1daed593169c7d3b0fdc' }] },
  operator: { url: 'assets/models/cc0/kenney-operator/character-i.glb', sha256: '2b566d3b6261faa3e151b352396d823a285834f039ff6476db248ec6da902fe8', textures: [{ url: 'assets/models/cc0/kenney-operator/Textures/texture-i.png', sha256: '2c721b0a8837836ab0bf0eb0de12ca14e5d518ccba7420b8c673ed4600dc6b63' }] },
  mp5: { url: 'assets/models/cc0/opengameart/mp5.glb', sha256: '42ea467a63c66d5467b77c40c4b1722977e3ca0e5d4d36570c1d295eaf66ef03' },
  sword: { url: 'assets/models/cc0/texnist/sword2.glb', sha256: '6bf40949aa60239f6313fe067f0a3c2963271a881bb3310b92df92d014bf447b' },
} as const

/**
 * Cached asset loading with one progress stream for the boot screen.
 *
 * The starter builds its world procedurally, so nothing is required here at boot. When adding
 * models or textures, put the files in `public/assets/` and preload them in `main.ts` with
 * `assets.gltf('assets/hero.glb')` before `game.start()` so the loading bar covers them.
 */
export class Assets {
  private readonly manager = new THREE.LoadingManager()
  private readonly gltfLoader = new GLTFLoader(this.manager)
  private readonly textureLoader = new THREE.TextureLoader(this.manager)
  private readonly cache = new Map<string, Promise<unknown>>()
  private listeners = new Set<(progress: number) => void>()

  constructor() {
    this.manager.onProgress = (_url, loaded, total) => {
      const progress = total > 0 ? loaded / total : 1
      for (const fn of this.listeners) fn(progress)
    }
  }

  onProgress(fn: (progress: number) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  gltf(url: string): Promise<GLTF> {
    return this.memo(url, () => this.gltfLoader.loadAsync(url))
  }

  /** Verify shipped model bytes before parsing; a mismatch rejects so gameplay can use its procedural fallback. */
  gltfVerified(url: string, expectedSha256: string, dependencies: readonly { url: string; sha256: string }[] = []): Promise<GLTF> {
    return this.memo(`${url}#sha256=${expectedSha256}`, async () => {
      await Promise.all(dependencies.map(asset => this.verifyBytes(asset.url, asset.sha256)))
      const { absoluteUrl, bytes } = await this.verifyBytes(url, expectedSha256)
      return this.gltfLoader.parseAsync(bytes, new URL('./', absoluteUrl).href)
    })
  }

  private async verifyBytes(url: string, expectedSha256: string): Promise<{ absoluteUrl: URL; bytes: ArrayBuffer }> {
    if (!globalThis.crypto?.subtle) throw new Error('SHA-256 verification is unavailable in this browser')
    const absoluteUrl = new URL(url, document.baseURI)
    const response = await fetch(absoluteUrl, { cache: 'force-cache' })
    if (!response.ok) throw new Error(`Asset request failed (${response.status}): ${url}`)
    const bytes = await response.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    if (actual !== expectedSha256.toLowerCase()) throw new Error(`SHA-256 mismatch for ${url}`)
    return { absoluteUrl, bytes }
  }

  /** Color textures are tagged sRGB; pass `color: false` for normal/roughness maps. */
  texture(url: string, { color = true, repeat }: { color?: boolean; repeat?: number } = {}): Promise<THREE.Texture> {
    return this.memo(`${url}#${color}#${repeat ?? 1}`, async () => {
      const tex = await this.textureLoader.loadAsync(url)
      if (color) tex.colorSpace = THREE.SRGBColorSpace
      if (repeat) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(repeat, repeat)
      }
      return tex
    })
  }

  private memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    let pending = this.cache.get(key) as Promise<T> | undefined
    if (!pending) {
      pending = load()
      this.cache.set(key, pending)
      pending.catch(() => this.cache.delete(key))
    }
    return pending
  }
}
