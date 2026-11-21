import type { PuffAsset, ShapeId } from '../data/puffwork'

/**
 * Draws one Puffwork asset as a self-contained SVG string.
 *
 * The same markup powers the storefront cards, the large asset preview and the
 * free preview download, so what a visitor sees is exactly what they get. Every
 * gradient, pattern and mask is namespaced with `prefix` because several copies
 * of one asset can sit on the same page.
 */

const TUBE_SHAPES: ShapeId[] = ['ribbon', 'knot']

// A real trefoil sampled from its parametric curve, so the knot reads as a
// knot rather than a loop with a pinch in it.
const TREFOIL = (() => {
  const points: string[] = []
  for (let step = 0; step <= 96; step += 1) {
    const t = (step / 96) * Math.PI * 2
    const x = Math.sin(t) + 2 * Math.sin(2 * t)
    const y = Math.cos(t) - 2 * Math.cos(2 * t)
    points.push(`${(100 + x * 19).toFixed(1)} ${(96 + y * 19).toFixed(1)}`)
  }
  return `M${points.join(' L')}`
})()

const shapePath = (shape: ShapeId): string => {
  switch (shape) {
    case 'blob':
      return 'M104 20c33 0 61 17 68 45 7 29-15 45-33 65-18 20-31 50-59 46-28-4-53-27-55-53-2-26 12-45 22-61 10-16 23-42 57-42Z'
    case 'sphere':
      return 'M100 32a68 68 0 1 0 0 136 68 68 0 0 0 0-136Z'
    case 'torus':
      return 'M100 30a70 70 0 1 0 0 140 70 70 0 0 0 0-140Zm0 46a24 24 0 1 1 0 48 24 24 0 0 1 0-48Z'
    case 'pill':
      return 'M74 52h52a50 50 0 0 1 0 100H74A50 50 0 0 1 74 52Z'
    case 'cloud':
      return 'M56 146c-21 0-36-14-36-33 0-17 12-30 29-32 3-25 23-43 48-43 23 0 42 14 48 35 21 2 36 16 36 35 0 21-17 38-40 38Z'
    case 'ribbon':
      return 'M54 40c36 18 58 48 54 80-4 30 18 50 50 56'
    case 'knot':
      return TREFOIL
    case 'star':
      return 'M100 24c9 0 14 6 19 18l7 19 21 3c13 2 17 8 17 15 0 6-4 11-14 19l-16 13 5 20c3 12 0 18-8 21-7 3-13 0-22-9l-15-14-16 14c-9 9-15 12-22 9-8-3-11-9-8-21l5-20-16-13c-10-8-14-13-14-19 0-7 4-13 17-15l21-3 7-19c5-12 10-18 19-18Z'
  }
}

const escapeXml = (value: string) =>
  value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ?? character)

export function puffSvg(asset: PuffAsset, prefix = 'puff'): string {
  const id = `${prefix}-${asset.slug}`
  const { main, alt, deep } = asset.colors
  const tube = TUBE_SHAPES.includes(asset.shape)
  const path = shapePath(asset.shape)
  const tubeWidth = asset.shape === 'ribbon' ? 34 : 22

  const maskBody = tube
    ? `<path d="${path}" fill="none" stroke="#fff" stroke-width="${tubeWidth}" stroke-linecap="round" stroke-linejoin="round" />`
    : `<path d="${path}" fill="#fff" fill-rule="evenodd" />`

  const basePaint = asset.material === 'foil'
    ? `<linearGradient id="${id}-base" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#ffffff" />
         <stop offset=".22" stop-color="${main}" />
         <stop offset=".44" stop-color="${alt}" />
         <stop offset=".58" stop-color="#ffffff" />
         <stop offset=".78" stop-color="${alt}" />
         <stop offset="1" stop-color="${deep}" />
       </linearGradient>`
    : `<radialGradient id="${id}-base" cx=".36" cy=".28" r=".92">
         <stop offset="0" stop-color="#ffffff" />
         <stop offset=".28" stop-color="${main}" />
         <stop offset=".78" stop-color="${alt}" />
         <stop offset="1" stop-color="${deep}" />
       </radialGradient>`

  const materialLayer = (() => {
    switch (asset.material) {
      case 'knit':
        return `<rect width="200" height="200" fill="url(#${id}-knit)" opacity=".5" />
          <rect width="200" height="200" fill="url(#${id}-knit-shadow)" opacity=".28" />`
      case 'foil':
        return `<rect width="200" height="200" fill="url(#${id}-streak)" opacity=".85" />
          <path d="M-40 152 118 -24 152 4 -6 176Z" fill="#ffffff" opacity=".3" />
          <path d="M16 208 176 34 200 62 40 228Z" fill="#ffffff" opacity=".18" />
          <path d="M-20 40 60 -20 76 -6 -8 56Z" fill="${deep}" opacity=".25" />`
      case 'velvet':
        return `<rect width="200" height="200" fill="url(#${id}-rim)" opacity=".9" />
          <ellipse cx="72" cy="58" rx="48" ry="34" fill="#ffffff" opacity=".26" filter="url(#${id}-blur)" transform="rotate(-18 72 58)" />
          <ellipse cx="126" cy="136" rx="34" ry="20" fill="${deep}" opacity=".22" filter="url(#${id}-blur)" />`
      case 'glass':
        return `<rect width="200" height="200" fill="url(#${id}-glass)" opacity=".55" />
          <ellipse cx="74" cy="58" rx="34" ry="19" fill="#ffffff" opacity=".62" filter="url(#${id}-blur)" transform="rotate(-26 74 58)" />
          <ellipse cx="132" cy="140" rx="24" ry="11" fill="#ffffff" opacity=".34" filter="url(#${id}-blur)" transform="rotate(-26 132 140)" />`
    }
  })()

  const tubeBody = tube
    ? `<path d="${path}" fill="none" stroke="${deep}" stroke-width="${tubeWidth + 4}" stroke-linecap="round" stroke-linejoin="round" />
       <path d="${path}" fill="none" stroke="url(#${id}-base)" stroke-width="${tubeWidth}" stroke-linecap="round" stroke-linejoin="round" />
       <g mask="url(#${id}-mask)">${materialLayer}</g>
       <path d="${path}" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(-5 -7)" filter="url(#${id}-blur)" />`
    : `<path d="${path}" fill="url(#${id}-base)" fill-rule="evenodd" />
       <g mask="url(#${id}-mask)">${materialLayer}</g>
       <path d="${path}" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="1.6" fill-rule="evenodd" />`

  const shadow = asset.shape === 'cloud'
    ? '<ellipse cx="100" cy="160" rx="62" ry="10" fill="#1b1410" opacity=".12" filter="url(#' + id + '-blur)" />'
    : '<ellipse cx="100" cy="180" rx="50" ry="9" fill="#1b1410" opacity=".15" filter="url(#' + id + '-blur)" />'

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${escapeXml(`${asset.name} — ${asset.material} ${asset.shape}`)}" preserveAspectRatio="xMidYMid meet">
  <defs>
    ${basePaint}
    <radialGradient id="${id}-rim" cx=".44" cy=".36" r=".78">
      <stop offset=".45" stop-color="${deep}" stop-opacity="0" />
      <stop offset="1" stop-color="${deep}" stop-opacity=".85" />
    </radialGradient>
    <radialGradient id="${id}-glass" cx=".4" cy=".32" r=".8">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".9" />
      <stop offset=".55" stop-color="${main}" stop-opacity=".25" />
      <stop offset="1" stop-color="${alt}" stop-opacity=".55" />
    </radialGradient>
    <linearGradient id="${id}-streak" x1="0" y1="0" x2="1" y2=".8">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".55" />
      <stop offset=".28" stop-color="#ffffff" stop-opacity="0" />
      <stop offset=".46" stop-color="${deep}" stop-opacity=".28" />
      <stop offset=".6" stop-color="#ffffff" stop-opacity=".42" />
      <stop offset=".78" stop-color="#ffffff" stop-opacity="0" />
      <stop offset="1" stop-color="${deep}" stop-opacity=".22" />
    </linearGradient>
    <pattern id="${id}-knit" width="16" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)">
      <path d="M0 8 Q4 2 8 8 T16 8" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="1.6" />
    </pattern>
    <pattern id="${id}-knit-shadow" width="16" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)">
      <path d="M0 10 Q4 4 8 10 T16 10" fill="none" stroke="${deep}" stroke-opacity=".5" stroke-width="1.6" />
    </pattern>
    <mask id="${id}-mask" maskUnits="userSpaceOnUse">${maskBody}</mask>
    <filter id="${id}-blur" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" />
    </filter>
  </defs>
  ${shadow}
  ${tubeBody}
</svg>`
}
