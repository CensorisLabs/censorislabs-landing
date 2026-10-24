import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

export const KCH_GAME_MODELS = {
  player: { url: 'assets/models/kch/player.glb', sha256: '9457ddcd1e18a63cc01c392caee8800ca3e59a2a64d7c467377140295213cfec' },
  arms: { url: 'assets/models/kch/arms.glb', sha256: 'c56f9d93d7c1e34b6afb47b404d80d797922a49e86d8d76d487d91dfafd8ce33' },
  ar9: { url: 'assets/models/kch/ar9.glb', sha256: '365548aeeadb84b3c07f321e83d79f8f31ea193dd1b2e98bbd9f0334d21a142b' },
  scar: { url: 'assets/models/kch/scar.glb', sha256: 'eadc8a2908428fa962f8d68f02781f1e83de7b31c185dc8d4160bb5fecd21837' },
  lar: { url: 'assets/models/kch/lar.glb', sha256: '2cdd08c03b12f164ca19c4e9a6895a0f53f71148ae6b23925da2a3c62a02c10d' },
  m60: { url: 'assets/models/kch/m60.glb', sha256: '7274f68837e08f50ca381c68f4c2f6e9898c2550750971ee21531903743acc1e' },
  mac10: { url: 'assets/models/kch/mac10.glb', sha256: '6862af6c197fb03a224d9241d13748a4b49635c1e4c91792bef5e947149af25a' },
  revolver: { url: 'assets/models/kch/revolver.glb', sha256: 'e099d330969cb859689f6fc538e5a4539cf4331a7f75453376bdeaa618c1c186' },
  shark: { url: 'assets/models/kch/shark.glb', sha256: 'ea92c57b231bdbf9ecdc48274f69ce20196a72f86c3789da6fc47f4864d1700a' },
  vita: { url: 'assets/models/kch/vita.glb', sha256: 'e79752419d5478679048049613b1f82bb91acd7aaa2d32ce1d272c4ac6ac6d91' },
  weatie: { url: 'assets/models/kch/weatie.glb', sha256: '4eb57d45a9c76c38ce8c8f8692ca137476342428dfa9149e85265799634b46e5' },
  bayonet: { url: 'assets/models/kch/bayonet.glb', sha256: '61dd54e96c94b547ef91727faa2fad2fdff2d9e96cf82d52ddba99076cd05d96' },
  tomahawk: { url: 'assets/models/kch/tomahawk.glb', sha256: '805a7520a2a3d6b646b23b297e0657d1934b8624a9a47236e8bda8c816bb4b30' },
} as const

export const KCH_GAME_MAPS = {
  'antfarm': { url: 'assets/maps/kch/antfarm.json', sha256: 'a916dda87f331306eacf4d3951258eb9dcb6efa92fb02e8e8301cb0243458afe' },
  'schism': { url: 'assets/maps/kch/schism.json', sha256: 'd5012561f79018139f592c1f746147855b83245c2df1f2c459864d0c6e34fe87' },
  'labs': { url: 'assets/maps/kch/labs.json', sha256: '018c60a29a2934cd1e80245f8d5256cd3952caa7dc134414849095c3870ef873' },
  'collision': { url: 'assets/maps/kch/collision.json', sha256: 'cfacfc60b93a72049f93153522d6a089f72d3b32ccadde74530f128449007551' },
  'dunes': { url: 'assets/maps/kch/dunes.json', sha256: '412a6b7da16b334321f457bcc3b5d90d28a1b49a510c6204a27d775211c7df1e' },
  'skyfel': { url: 'assets/maps/kch/skyfel.json', sha256: '8e9d9790f7f6ec02bd045e64512907acd940b50d03742ec35fef418eacbceb2a' },
  'dethroned': { url: 'assets/maps/kch/dethroned.json', sha256: '3cd2d894cbd94ef5b994be2f7dc970e67fd8bf72f9ddb498149609cb17130f8e' },
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

  /** Verify and parse a small JSON asset before exposing it to gameplay. */
  jsonVerified<T>(url: string, expectedSha256: string): Promise<T> {
    return this.memo(`${url}#sha256=${expectedSha256}`, async () => {
      const { bytes } = await this.verifyBytes(url, expectedSha256)
      return JSON.parse(new TextDecoder().decode(bytes)) as T
    })
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
