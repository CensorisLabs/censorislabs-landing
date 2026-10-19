import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'

import HeroFallback from './HeroFallback'

/**
 * Interactive hero backdrop: an ethereal wireframe Roman monolith.
 *
 * Behaviour:
 * - Slowly rotates; leans subtly toward the pointer; scroll rotates it further.
 * - Respects prefers-reduced-motion (renders a single static frame).
 * - Falls back to a pure SVG line pillar when WebGL is unavailable, so the
 *   layout never breaks on low-power or locked-down GPUs.
 * - Purely decorative: aria-hidden, pointer-events none.
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
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

interface SceneProps {
  scrollProgress: MutableRefObject<number>
  reduced: boolean
}

const GOLD = '#d4af37'
const BRONZE = '#c5a059'

function MonolithGeometry({ scrollProgress, reduced }: SceneProps) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const { size } = useThree()

  // The pillar sits to the right of copy on wide screens, centred behind it
  // on narrow screens.
  const offsetX = size.width > 980 ? 1.5 : 0
  const scale = size.width < 640 ? 0.72 : size.width < 1100 ? 0.82 : 0.9

  const lineMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: GOLD,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    [],
  )

  const massMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#1f2833',
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    [],
  )

  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: BRONZE,
        wireframe: true,
        transparent: true,
        opacity: 0.11,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      lineMaterial.dispose()
      massMaterial.dispose()
      ringMaterial.dispose()
    }
  }, [lineMaterial, massMaterial, ringMaterial])

  useFrame((state, delta) => {
    if (!group.current) return
    const pointer = state.pointer
    const scroll = scrollProgress.current
    const t = state.clock.elapsedTime

    const orbit = reduced ? 0 : t * 0.1
    const targetY = 0.35 + orbit + (reduced ? 0 : pointer.x * 0.22) + scroll * 0.55
    const targetX = reduced ? 0.06 : 0.06 + pointer.y * 0.05 + scroll * 0.08

    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetY, 2.2, delta)
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetX, 2.2, delta)

    if (ring.current && !reduced) {
      ring.current.rotation.z = -t * 0.06
      ring.current.rotation.x = 1.28 + Math.sin(t * 0.22) * 0.05
    }
  })

  return (
    <group ref={group} position={[offsetX, 0.1, 0]} scale={scale}>
      {/* Base plinth */}
      <mesh position={[0, -1.56, 0]} material={massMaterial}>
        <boxGeometry args={[1.9, 0.22, 1.9]} />
      </mesh>
      <mesh position={[0, -1.56, 0]} material={lineMaterial}>
        <boxGeometry args={[1.9, 0.22, 1.9]} />
      </mesh>
      <mesh position={[0, -1.38, 0]} material={massMaterial}>
        <boxGeometry args={[1.55, 0.16, 1.55]} />
      </mesh>
      <mesh position={[0, -1.38, 0]} material={lineMaterial}>
        <boxGeometry args={[1.55, 0.16, 1.55]} />
      </mesh>

      {/* Fluted shaft */}
      <mesh position={[0, 0, 0]} material={massMaterial}>
        <cylinderGeometry args={[0.5, 0.58, 2.6, 12, 1]} />
      </mesh>
      <mesh position={[0, 0, 0]} material={lineMaterial}>
        <cylinderGeometry args={[0.5, 0.58, 2.6, 12, 1]} />
      </mesh>

      {/* Capital */}
      <mesh position={[0, 1.38, 0]} material={massMaterial}>
        <boxGeometry args={[1.36, 0.16, 1.36]} />
      </mesh>
      <mesh position={[0, 1.38, 0]} material={lineMaterial}>
        <boxGeometry args={[1.36, 0.16, 1.36]} />
      </mesh>
      <mesh position={[0, 1.54, 0]} material={massMaterial}>
        <boxGeometry args={[1.62, 0.14, 1.62]} />
      </mesh>
      <mesh position={[0, 1.54, 0]} material={lineMaterial}>
        <boxGeometry args={[1.62, 0.14, 1.62]} />
      </mesh>

      {/* Orbiting rings — kept close to the pillar so they read as detail,
          not as stray geometry across the viewport. */}
      <mesh ref={ring} rotation={[1.3, 0, 0]} material={ringMaterial}>
        <torusGeometry args={[1.05, 0.004, 3, 120]} />
      </mesh>
      <mesh rotation={[1.46, 0.34, 0]} material={ringMaterial}>
        <torusGeometry args={[1.3, 0.003, 3, 140]} />
      </mesh>
    </group>
  )
}

export default function Monolith() {
  const reduced = usePrefersReducedMotion()
  const [webgl] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : supportsWebGL(),
  )
  const [ready, setReady] = useState(false)
  const scrollProgress = useRef(0)

  useEffect(() => {
    if (!webgl) return
    const onScroll = () => {
      const max = window.innerHeight * 1.2
      scrollProgress.current = Math.min(window.scrollY / max, 1)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [webgl])

  if (!webgl) {
    return <HeroFallback />
  }

  return (
    <div
      className="hero__canvas"
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 900ms ease' }}
      aria-hidden="true"
    >
      <Canvas
        frameloop={reduced ? 'demand' : 'always'}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.25, 6.2], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0b0c10', 0)
          setReady(true)
        }}
      >
        <MonolithGeometry scrollProgress={scrollProgress} reduced={reduced} />
      </Canvas>
    </div>
  )
}
