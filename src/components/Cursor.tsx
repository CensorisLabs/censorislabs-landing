import { useEffect, useRef } from 'react'

/**
 * A diamond reticle instead of a plain pointer: a bright core that tracks the
 * mouse exactly, a lagging ring that opens over interactive elements, and a
 * dimmer comet tail behind the pair. The native cursor is hidden only while
 * this is running on a fine pointer with motion allowed, so a failed script or
 * a touch device always gets the system pointer back.
 */
const TARGETS: Array<[string, string]> = [
  ['[data-cursor]', ''],
  ['a[href]', 'OPEN'],
  ['button', 'PRESS'],
  ['input, textarea, select', 'TYPE'],
]

function labelFor(element: Element | null): string {
  const custom = element?.closest<HTMLElement>('[data-cursor]')
  if (custom) return custom.dataset.cursor || ''

  for (const [selector, label] of TARGETS) {
    if (element?.closest(selector)) return label
  }
  return ''
}

export default function Cursor() {
  const root = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLSpanElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  const trail = useRef<HTMLSpanElement>(null)
  const label = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const wrap = root.current
    const ringNode = ring.current
    const dotNode = dot.current
    const trailNode = trail.current
    const labelNode = label.current
    if (!wrap || !ringNode || !dotNode || !trailNode || !labelNode) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    document.documentElement.classList.add('cursor-active')

    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 2
    let dotX = targetX
    let dotY = targetY
    let ringX = targetX
    let ringY = targetY
    let trailX = targetX
    let trailY = targetY
    let frame = 0
    let visible = false

    const render = () => {
      dotX += (targetX - dotX) * 0.42
      dotY += (targetY - dotY) * 0.42
      ringX += (targetX - ringX) * 0.16
      ringY += (targetY - ringY) * 0.16
      trailX += (targetX - trailX) * 0.07
      trailY += (targetY - trailY) * 0.07

      dotNode.style.transform = `translate3d(${dotX.toFixed(2)}px, ${dotY.toFixed(2)}px, 0) translate(-50%, -50%) rotate(45deg)`
      ringNode.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0) translate(-50%, -50%)`

      const skew = Math.min(Math.hypot(targetX - trailX, targetY - trailY) / 60, 1)
      trailNode.style.transform = `translate3d(${trailX.toFixed(2)}px, ${trailY.toFixed(2)}px, 0) translate(-50%, -50%) scale(${(1 + skew * 0.4).toFixed(3)})`
      trailNode.style.opacity = visible ? `${(0.45 - skew * 0.2).toFixed(3)}` : '0'

      frame = requestAnimationFrame(render)
    }

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      targetX = event.clientX
      targetY = event.clientY

      if (!visible) {
        visible = true
        dotX = ringX = trailX = targetX
        dotY = ringY = trailY = targetY
        wrap.classList.add('is-visible')
      }

      dotNode.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%) rotate(45deg)`
      ringNode.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`
      trailNode.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`
      trailNode.style.opacity = '0.3'

      const text = labelFor(event.target as Element | null)
      ringNode.classList.toggle('is-active', Boolean(text))
      labelNode.textContent = text
    }

    const press = () => wrap.classList.add('is-pressing')
    const release = () => wrap.classList.remove('is-pressing')
    const leave = () => {
      wrap.classList.remove('is-visible')
      visible = false
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', press)
    window.addEventListener('pointerup', release)
    document.addEventListener('pointerleave', leave)
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      document.documentElement.classList.remove('cursor-active')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', press)
      window.removeEventListener('pointerup', release)
      document.removeEventListener('pointerleave', leave)
    }
  }, [])

  return (
    <div ref={root} className="cursor" aria-hidden="true">
      <span ref={trail} className="cursor__trail" />
      <span ref={ring} className="cursor__ring">
        <span ref={label} className="cursor__label" />
      </span>
      <span ref={dot} className="cursor__dot" />
    </div>
  )
}
