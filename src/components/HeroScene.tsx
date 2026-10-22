import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'

const MAGENTA = '#ff5c8a'
const VIOLET = '#a855f7'

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * The scene is decorative, so it listens to the window instead of the canvas.
 * That keeps every link and button above it fully clickable.
 */
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

type Shard = {
  position: [number, number, number]
  rotation: [number, number, number]
  size: [number, number, number]
  speed: number
  phase: number
  tone: string
}

const SHARDS: Shard[] = [
  { position: [-3.1, 1.15, -1.2], rotation: [0.2, 0.5, -0.12], size: [1.3, 0.86, 0.06], speed: 0.42, phase: 0.4, tone: MAGENTA },
  { position: [3.0, 1.55, -1.8], rotation: [-0.16, -0.4, 0.1], size: [1.05, 0.7, 0.05], speed: 0.55, phase: 1.9, tone: VIOLET },
  { position: [2.35, -1.5, -0.6], rotation: [0.1, 0.7, 0.16], size: [0.9, 1.12, 0.06], speed: 0.36, phase: 3.1, tone: MAGENTA },
  { position: [-2.3, -1.75, -0.9], rotation: [-0.08, -0.6, -0.18], size: [0.82, 1.0, 0.05], speed: 0.62, phase: 4.4, tone: VIOLET },
  { position: [0.35, 2.0, -3.2], rotation: [0.4, 0.2, 0.3], size: [1.6, 1.0, 0.06], speed: 0.28, phase: 2.6, tone: '#ffa8c2' },
  { position: [-0.9, 0.1, -4.0], rotation: [0.15, -0.9, 0.05], size: [2.0, 1.25, 0.05], speed: 0.22, phase: 5.2, tone: VIOLET },
]

const DIAMONDS: Array<{ position: [number, number, number]; size: number; speed: number; phase: number }> = [
  { position: [-1.9, 2.05, -0.4], size: 0.17, speed: 0.6, phase: 0 },
  { position: [1.5, -0.35, 1.1], size: 0.12, speed: 0.85, phase: 1.5 },
  { position: [2.6, 0.85, -0.2], size: 0.09, speed: 0.72, phase: 3.0 },
  { position: [-2.7, -0.3, 0.6], size: 0.14, speed: 0.5, phase: 4.2 },
  { position: [0.6, 1.6, 0.8], size: 0.07, speed: 0.95, phase: 5.4 },
]

interface SceneProps {
  reduced: boolean
  pointer: MutableRefObject<{ x: number; y: number }>
}

function Scene({ reduced, pointer }: SceneProps) {
  const world = useRef<THREE.Group>(null)
  const shardRefs = useRef<Array<THREE.Group | null>>([])
  const diamondRefs = useRef<Array<THREE.Group | null>>([])
  const ring = useRef<THREE.Mesh>(null)
  const scroll = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      scroll.current = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const glassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#4a2d63',
        transparent: true,
        opacity: 0.18,
        roughness: 0.18,
        metalness: 0.55,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  const wireMaterials = useMemo(
    () =>
      SHARDS.map(
        (shard) =>
          new THREE.MeshBasicMaterial({
            color: shard.tone,
            wireframe: true,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
          }),
      ),
    [],
  )

  const diamondMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ff9dbb',
        emissive: new THREE.Color(MAGENTA),
        emissiveIntensity: 1.5,
        roughness: 0.25,
        metalness: 0.1,
        transparent: true,
        opacity: 0.92,
      }),
    [],
  )

  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: VIOLET,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    [],
  )

  const dustGeometry = useMemo(() => {
    const positions = new Float32Array(180 * 3)
    for (let index = 0; index < 180; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 12
      positions[index * 3 + 1] = (Math.random() - 0.5) * 7
      positions[index * 3 + 2] = (Math.random() - 0.5) * 6 - 2
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [])

  const dustMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#ffc2d6',
        size: 0.035,
        transparent: true,
        opacity: 0.55,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      glassMaterial.dispose()
      wireMaterials.forEach((material) => material.dispose())
      diamondMaterial.dispose()
      ringMaterial.dispose()
      dustGeometry.dispose()
      dustMaterial.dispose()
    }
  }, [glassMaterial, wireMaterials, diamondMaterial, ringMaterial, dustGeometry, dustMaterial])

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime
    const pointerX = reduced ? 0 : pointer.current.x
    const pointerY = reduced ? 0 : pointer.current.y

    if (world.current) {
      world.current.rotation.y = THREE.MathUtils.damp(world.current.rotation.y, pointerX * 0.18, 2, delta)
    world.current.rotation.x = THREE.MathUtils.damp(world.current.rotation.x, pointerY * 0.1, 2, delta)
      world.current.position.y = THREE.MathUtils.damp(world.current.position.y, scroll.current * 0.9, 2, delta)
    }

    shardRefs.current.forEach((group, index) => {
      const shard = SHARDS[index]
      if (!group) return
      group.position.y = shard.position[1] + (reduced ? 0 : Math.sin(time * shard.speed + shard.phase) * 0.16)
      group.rotation.z = shard.rotation[2] + (reduced ? 0 : Math.sin(time * shard.speed * 0.7 + shard.phase) * 0.06)
      group.rotation.y = shard.rotation[1] + (reduced ? 0 : time * 0.05 * shard.speed + pointerX * 0.12)
    })

    diamondRefs.current.forEach((group, index) => {
      const diamond = DIAMONDS[index]
      if (!group) return
      group.position.y = diamond.position[1] + (reduced ? 0 : Math.sin(time * diamond.speed + diamond.phase) * 0.22)
      group.rotation.y = reduced ? 0 : time * 0.35 * diamond.speed + diamond.phase
      group.rotation.x = reduced ? 0 : time * 0.18
    })

    if (ring.current && !reduced) {
      ring.current.rotation.z = time * 0.08
      ring.current.rotation.x = 1.32 + Math.sin(time * 0.25) * 0.08
    }
  })

  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[3.4, 2.4, 4]} intensity={26} color={MAGENTA} distance={14} />
      <pointLight position={[-4, -2, 3]} intensity={20} color={VIOLET} distance={14} />

      <group ref={world}>
        {SHARDS.map((shard, index) => (
          <group
            key={`${shard.tone}-${index}`}
            ref={(group) => {
              shardRefs.current[index] = group
            }}
            position={shard.position}
            rotation={shard.rotation}
          >
            <mesh material={glassMaterial}>
              <boxGeometry args={shard.size} />
            </mesh>
            <mesh material={wireMaterials[index]}>
              <boxGeometry args={shard.size} />
            </mesh>
          </group>
        ))}

        {DIAMONDS.map((diamond, index) => (
          <group
            key={`diamond-${index}`}
            ref={(group) => {
              diamondRefs.current[index] = group
            }}
            position={diamond.position}
            scale={diamond.size}
          >
            <mesh material={diamondMaterial}>
              <octahedronGeometry args={[1, 0]} />
            </mesh>
          </group>
        ))}

        <mesh ref={ring} rotation={[1.3, 0, 0]} position={[0.4, 0.2, -1.4]} material={ringMaterial}>
          <torusGeometry args={[2.4, 0.006, 3, 140]} />
        </mesh>
        <mesh rotation={[1.5, 0.4, 0]} position={[-0.6, -0.4, -2]} material={ringMaterial}>
          <torusGeometry args={[3.1, 0.005, 3, 160]} />
        </mesh>

        <points geometry={dustGeometry} material={dustMaterial} />
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
