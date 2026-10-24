import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'

const VIOLET = '#a855f7'
const PETAL = '#ffb3c8'

/**
 * Depth layer over the hero room: slow drifting motes, two hairline orbits and
 * a gentle pointer/scroll parallax. The pink diamonds themselves are drawn in
 * the SVG and CSS so they stay crisp; this layer only adds air and movement
 * behind them, which keeps the illustration readable on every screen.
 */

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/** Deterministic PRNG so the mote cloud is identical on every render. */
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state += 0x6d2b79f5
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** Decorative only, so it listens on the window: everything above stays clickable. */
function usePointerRef() {
  const pointer = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return pointer
}

interface SceneProps {
  reduced: boolean
  pointer: MutableRefObject<{ x: number; y: number }>
}

function Scene({ reduced, pointer }: SceneProps) {
  const world = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const motes = useRef<THREE.Points>(null)
  const scroll = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      scroll.current = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: VIOLET,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
      }),
    [],
  )

  const { geometry: dustGeometry, speeds } = useMemo(() => {
    const count = 160
    const random = seededRandom(20261024)
    const positions = new Float32Array(count * 3)
    const drift = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() - 0.5) * 13
      positions[index * 3 + 1] = (random() - 0.5) * 8
      positions[index * 3 + 2] = (random() - 0.5) * 6 - 2
      drift[index] = 0.06 + random() * 0.16
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geometry, speeds: drift }
  }, [])

  const dustMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: PETAL,
        size: 0.028,
        transparent: true,
        opacity: 0.55,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useEffect(
    () => () => {
      ringMaterial.dispose()
      dustGeometry.dispose()
      dustMaterial.dispose()
    },
    [ringMaterial, dustGeometry, dustMaterial],
  )

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime
    const pointerX = reduced ? 0 : pointer.current.x
    const pointerY = reduced ? 0 : pointer.current.y

    if (world.current) {
      world.current.rotation.y = THREE.MathUtils.damp(world.current.rotation.y, pointerX * 0.12, 2, delta)
      world.current.rotation.x = THREE.MathUtils.damp(world.current.rotation.x, pointerY * 0.07, 2, delta)
      world.current.position.y = THREE.MathUtils.damp(world.current.position.y, scroll.current * 0.8, 2, delta)
    }

    if (motes.current && !reduced) {
      const position = motes.current.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let index = 0; index < speeds.length; index += 1) {
        const y = position.getY(index) + delta * speeds[index]
        position.setY(index, y > 4.2 ? -4.2 : y)
      }
      position.needsUpdate = true
    }

    if (ring.current && !reduced) {
      ring.current.rotation.z = time * 0.06
      ring.current.rotation.x = 1.34 + Math.sin(time * 0.24) * 0.05
    }
  })

  return (
    <>
      <ambientLight intensity={0.7} />
      <group ref={world}>
        <points ref={motes} geometry={dustGeometry} material={dustMaterial} />
        <mesh ref={ring} rotation={[1.32, 0, 0]} position={[0.3, 0.2, -1.6]} material={ringMaterial}>
          <torusGeometry args={[2.6, 0.004, 3, 150]} />
        </mesh>
        <mesh rotation={[1.5, 0.34, 0]} position={[-0.5, -0.3, -2.1]} material={ringMaterial}>
          <torusGeometry args={[3.3, 0.003, 3, 160]} />
        </mesh>
      </group>
    </>
  )
}

export default function HeroScene() {
  const reduced = usePrefersReducedMotion()
  const pointer = usePointerRef()
  const [webgl] = useState(() => (typeof window === 'undefined' ? false : supportsWebGL()))

  if (!webgl) return null

  return (
    <Canvas
      frameloop={reduced ? 'demand' : 'always'}
      dpr={[1, 1.7]}
      camera={{ position: [0, 0, 7.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor('#0c0812', 0)}
    >
      <Scene reduced={reduced} pointer={pointer} />
    </Canvas>
  )
}
