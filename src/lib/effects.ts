type Cleanup = () => void

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const REVEAL_SELECTOR = [
  '[data-reveal]',
  '.section-title',
  '.section-lede',
  '.eyebrow',
  '.product',
  '.suite-card',
  '.suite-plan',
  '.ledger-wrap',
  '.principle',
  '.legal__panel',
  '.about-snapshot',
  '.about-app-card',
  '.review-card',
  '.review-form',
].join(',')

/**
 * Adds a staggered fade-up reveal to the marked blocks as they enter the
 * viewport. Elements are unobserved once shown so scrolling stays cheap.
 */
export function initReveals(): Cleanup {
  if (prefersReducedMotion()) return () => {}

  const targets = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR))
  if (!targets.length) return () => {}

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-revealed')
        observer.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
  )

  targets.forEach((element, index) => {
    if (element.classList.contains('is-revealed')) return
    element.classList.add('reveal')
    element.style.setProperty('--reveal-delay', `${(index % 5) * 70}ms`)
    observer.observe(element)
  })

  return () => observer.disconnect()
}

const TILT_SELECTOR = '[data-tilt],.product,.suite-card,.about-app-card,.floating-chip'

/**
 * Writes pointer position into CSS custom properties so any element can
 * compose its own 3D transform and a light that follows the cursor.
 */
export function initTilt(): Cleanup {
  if (prefersReducedMotion()) return () => {}
  if (!window.matchMedia('(pointer: fine)').matches) return () => {}

  const teardown: Cleanup[] = []

  document.querySelectorAll<HTMLElement>(TILT_SELECTOR).forEach((element) => {
    let frame = 0

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const rect = element.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width - 0.5
      const y = (event.clientY - rect.top) / rect.height - 0.5
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        element.style.setProperty('--tilt-x', `${(-y * 6).toFixed(2)}deg`)
        element.style.setProperty('--tilt-y', `${(x * 8).toFixed(2)}deg`)
        element.style.setProperty('--spot-x', `${((x + 0.5) * 100).toFixed(1)}%`)
        element.style.setProperty('--spot-y', `${((y + 0.5) * 100).toFixed(1)}%`)
      })
    }

    const reset = () => {
      element.style.setProperty('--tilt-x', '0deg')
      element.style.setProperty('--tilt-y', '0deg')
    }

    element.addEventListener('pointermove', move, { passive: true })
    element.addEventListener('pointerleave', reset)
    teardown.push(() => {
      cancelAnimationFrame(frame)
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerleave', reset)
    })
  })

  return () => teardown.forEach((fn) => fn())
}

/**
 * Soft levitation: each card gets a slow, offset float so sections feel alive
 * without becoming noisy. Disabled for reduced motion.
 */
export function initScrollDrift(): Cleanup {
  if (prefersReducedMotion()) return () => {}

  const layers = Array.from(document.querySelectorAll<HTMLElement>('[data-drift]'))
  if (!layers.length) return () => {}

  let frame = 0
  const update = () => {
    const scroll = window.scrollY
    for (const layer of layers) {
      const depth = Number(layer.dataset.drift || '0.08')
      layer.style.transform = `translate3d(0, ${(-scroll * depth).toFixed(2)}px, 0)`
    }
    frame = 0
  }

  const onScroll = () => {
    if (frame) return
    frame = requestAnimationFrame(update)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  update()

  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('scroll', onScroll)
  }
}
