/**
 * Puffwork — the illustration store's catalogue.
 *
 * Everything here is local data: shapes, palettes, copy and prices. No network
 * requests, no checkout. The store builds an order summary a visitor can copy
 * or send through the request form, and says plainly that payment is not
 * connected yet.
 */

export type Material = 'knit' | 'foil' | 'velvet' | 'glass'
export type ShapeId = 'blob' | 'sphere' | 'torus' | 'pill' | 'cloud' | 'ribbon' | 'knot' | 'star'
export type Category = 'Objects' | 'Shapes'

export type Palette = {
  name: string
  main: string
  alt: string
  deep: string
  back: string
}

export type PuffAsset = {
  slug: string
  name: string
  material: Material
  shape: ShapeId
  category: Category
  colors: Palette
  blurb: string
  detail: string
  tags: string[]
  formats: string[]
  price: number
  featured: boolean
}

export const MATERIALS: { id: Material; label: string; note: string }[] = [
  { id: 'knit', label: 'Knit', note: 'Ribbed, matte, soft to the edge' },
  { id: 'foil', label: 'Foil', note: 'Crinkled metal with hard specular streaks' },
  { id: 'velvet', label: 'Velvet', note: 'Deep pile that swallows the highlight' },
  { id: 'glass', label: 'Glass', note: 'Thin blown shells with a bright rim' },
]

export const ASSETS: PuffAsset[] = [
  {
    slug: 'marshmallow-knot',
    name: 'Marshmallow Knot',
    material: 'knit',
    shape: 'knot',
    category: 'Objects',
    colors: { name: 'Cream', main: '#fff4e4', alt: '#ffd39b', deep: '#d99b55', back: '#fdf4e8' },
    blurb: 'A loop of ribbed wool that folds like a pretzel and never quite touches itself.',
    detail:
      'Built as a single continuous tube so the knit ribs wrap around the folds instead of breaking at a seam. The highlight is deliberately low so it reads as yarn rather than plastic.',
    tags: ['hero', 'soft', 'loop-ready', 'warm'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', '30 s seamless loop'],
    price: 24,
    featured: true,
  },
  {
    slug: 'jelly-foil',
    name: 'Jelly Foil No. 1',
    material: 'foil',
    shape: 'blob',
    category: 'Objects',
    colors: { name: 'Acid', main: '#f1f6b0', alt: '#d5f65a', deep: '#7e9226', back: '#f6f8e2' },
    blurb: 'An acid-yellow foil puddle, dented in three places on purpose.',
    detail:
      'The crinkle is real geometry: three dents and one pinch create the bands of light. Swap the palette and the same dents read as chrome instead of paper.',
    tags: ['hero', 'metal', 'acid', 'still'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', 'Substance material'],
    price: 22,
    featured: true,
  },
  {
    slug: 'velvet-orb',
    name: 'Velvet Orb',
    material: 'velvet',
    shape: 'sphere',
    category: 'Objects',
    colors: { name: 'Plum', main: '#d24a92', alt: '#a02668', deep: '#3f0a2b', back: '#fbeaf3' },
    blurb: 'A plum velvet sphere with the light pulled to one soft shoulder.',
    detail:
      'Velvet needs a highlight that dies quickly. The gradient falls off within the first third of the form and the rim takes a deep tint instead of a bright edge.',
    tags: ['hero', 'fabric', 'dark', 'texture'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', 'Tileable velvet shader'],
    price: 26,
    featured: true,
  },
  {
    slug: 'glass-ribbon',
    name: 'Glass Ribbon',
    material: 'glass',
    shape: 'ribbon',
    category: 'Shapes',
    colors: { name: 'Ice', main: '#eafaff', alt: '#c2ecff', deep: '#5f9fc4', back: '#eef9fd' },
    blurb: 'A blown ribbon that curves twice and ends mid-air.',
    detail:
      'A thin shell with a bright inner edge, so it holds up on white as well as on a dark cover. Render at any scale — the rim is vector, not a texture.',
    tags: ['hero', 'transparent', 'cool', 'loop-ready'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', '30 s seamless loop'],
    price: 18,
    featured: true,
  },
  {
    slug: 'bubblegum-donut',
    name: 'Bubblegum Donut',
    material: 'glass',
    shape: 'torus',
    category: 'Shapes',
    colors: { name: 'Bubblegum', main: '#ffe6f3', alt: '#ffb6d5', deep: '#cd5f8f', back: '#fdeef5' },
    blurb: 'A blown ring with a thick skin and a highlight that runs the whole way round.',
    detail:
      'The thickness changes as the ring turns, which is what keeps it from looking like a flat sticker. Comes with a second version that is slightly squashed.',
    tags: ['ring', 'transparent', 'playful', 'loop-ready'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', '30 s seamless loop'],
    price: 20,
    featured: false,
  },
  {
    slug: 'butter-pillow',
    name: 'Butter Pillow',
    material: 'knit',
    shape: 'pill',
    category: 'Objects',
    colors: { name: 'Butter', main: '#fff7dc', alt: '#ffe493', deep: '#c8a23c', back: '#fdf8e9' },
    blurb: 'A squashed cushion in butter wool, stitched along every edge.',
    detail:
      'The stitch ring is drawn as a pattern that follows the rounded rectangle, so the corners keep their rhythm instead of pinching.',
    tags: ['cushion', 'warm', 'soft', 'still'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', 'Tileable knit pattern'],
    price: 22,
    featured: false,
  },
  {
    slug: 'mercury-pod',
    name: 'Mercury Pod',
    material: 'foil',
    shape: 'sphere',
    category: 'Objects',
    colors: { name: 'Silver', main: '#f6f8fc', alt: '#c6cddd', deep: '#616a80', back: '#f0f2f7' },
    blurb: 'A liquid-metal droplet with one flat facet where it met the floor.',
    detail:
      'The facet is what makes it read as poured metal rather than a ball. It also gives type something to sit against in a layout.',
    tags: ['metal', 'neutral', 'hero', 'still'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', 'Substance material'],
    price: 28,
    featured: true,
  },
  {
    slug: 'plush-cloud',
    name: 'Plush Cloud',
    material: 'velvet',
    shape: 'cloud',
    category: 'Objects',
    colors: { name: 'Sky', main: '#e8f1ff', alt: '#c2d8ff', deep: '#6d8fc9', back: '#edf3fc' },
    blurb: 'A five-lobed cloud in pale blue velvet, heavy at the bottom.',
    detail:
      'The lobes overlap with soft creases so it reads as one stuffed object. A second file drops the creases for a cleaner silhouette.',
    tags: ['cloud', 'soft', 'cool', 'hero'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', '30 s seamless loop'],
    price: 26,
    featured: false,
  },
  {
    slug: 'cellophane-twist',
    name: 'Cellophane Twist',
    material: 'glass',
    shape: 'knot',
    category: 'Shapes',
    colors: { name: 'Mint', main: '#e9fff5', alt: '#b6f0d7', deep: '#4f9c7c', back: '#edfbf4' },
    blurb: 'A clear mint twist that folds through itself without a visible join.',
    detail:
      'Clear shapes live or die on the rim. This one carries a 2 px highlight on the inner edge and a softer one outside, so it stays readable on cream.',
    tags: ['transparent', 'green', 'loop-ready', 'playful'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', '30 s seamless loop'],
    price: 24,
    featured: false,
  },
  {
    slug: 'candy-ring',
    name: 'Candy Ring',
    material: 'foil',
    shape: 'torus',
    category: 'Shapes',
    colors: { name: 'Coral', main: '#ffe7d8', alt: '#ffb47c', deep: '#d2662a', back: '#fdf0e6' },
    blurb: 'A coral foil ring with a crushed outer edge.',
    detail:
      'The crush runs around the outside only, so the inside of the ring stays clean and the silhouette still feels deliberate.',
    tags: ['ring', 'metal', 'warm', 'still'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', 'Substance material'],
    price: 20,
    featured: false,
  },
  {
    slug: 'wool-ball',
    name: 'Wool Ball',
    material: 'knit',
    shape: 'sphere',
    category: 'Objects',
    colors: { name: 'Moss', main: '#f1f5dd', alt: '#cfdfa3', deep: '#83944d', back: '#f4f6ea' },
    blurb: 'A moss-green ball of yarn that keeps its ribs all the way to the poles.',
    detail:
      'Ribs compress towards the top and bottom instead of banding, which is the small detail that separates a ball of wool from a beach ball.',
    tags: ['soft', 'green', 'texture', 'still'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', 'Tileable knit pattern'],
    price: 22,
    featured: false,
  },
  {
    slug: 'chrome-blob',
    name: 'Chrome Blob',
    material: 'foil',
    shape: 'blob',
    category: 'Objects',
    colors: { name: 'Chrome', main: '#eef1fa', alt: '#b3bfdf', deep: '#4a5686', back: '#eff1f8' },
    blurb: 'Cold chrome, dented once, holding a clean horizon line.',
    detail:
      'The horizon reflection is placed, not simulated, so it sits exactly where you want it behind a headline.',
    tags: ['hero', 'metal', 'cool', 'still'],
    formats: ['PNG 4K + transparent', 'SVG vector', 'Blender scene', 'Substance material'],
    price: 30,
    featured: true,
  },
]

export type PuffBundle = {
  slug: string
  name: string
  blurb: string
  assetSlugs: string[]
  price: number
  accent: string
}

export const BUNDLES: PuffBundle[] = [
  {
    slug: 'soft-start',
    name: 'Soft Start',
    blurb: 'Four objects that work together: one knit, one foil, one glass, one cushion. Enough for a landing page that needs no other art.',
    assetSlugs: ['marshmallow-knot', 'glass-ribbon', 'butter-pillow', 'bubblegum-donut'],
    price: 64,
    accent: '#f3d9a4',
  },
  {
    slug: 'studio-eight',
    name: 'Studio Eight',
    blurb: 'The working set. Two of each material, chosen so a hero, a section break and a social card can all come from the same family.',
    assetSlugs: ['marshmallow-knot', 'jelly-foil', 'velvet-orb', 'glass-ribbon', 'mercury-pod', 'plush-cloud', 'candy-ring', 'chrome-blob'],
    price: 139,
    accent: '#d9c7f5',
  },
  {
    slug: 'everything',
    name: 'The Whole Puff',
    blurb: 'All twelve objects, both categories, every palette variant and every loop. One licence, no renewals, free updates for a year.',
    assetSlugs: ASSETS.map(asset => asset.slug),
    price: 189,
    accent: '#bfe6cf',
  },
]

export type LicenceId = 'personal' | 'commercial' | 'extended'

export type Licence = {
  id: LicenceId
  name: string
  multiplier: number
  summary: string
  terms: string[]
}

export const LICENCES: Licence[] = [
  {
    id: 'personal',
    name: 'Personal',
    multiplier: 1,
    summary: 'One project, no client, no resale.',
    terms: [
      'Use in one personal or in-house project',
      'Edit, recolour and crop freely',
      'No client work, paid products or template resale',
      'Credit optional, never required',
    ],
  },
  {
    id: 'commercial',
    name: 'Commercial',
    multiplier: 2.2,
    summary: 'Unlimited client projects. The licence most studios pick.',
    terms: [
      'Unlimited client and commercial projects',
      'Unlimited impressions across web, print and video',
      'Edits and recolours stay licensed',
      'One team of up to ten people',
      'No resale of the files themselves',
    ],
  },
  {
    id: 'extended',
    name: 'Extended',
    multiplier: 4,
    summary: 'For products that ship the artwork inside them.',
    terms: [
      'Everything in Commercial',
      'Resale inside a template, course or merch product',
      'Apps, games and physical goods',
      'Teams above ten people',
      'Source files may be handed to your client',
    ],
  },
]

export const bySlug = (slug: string) => ASSETS.find(asset => asset.slug === slug)
export const bundleBySlug = (slug: string) => BUNDLES.find(bundle => bundle.slug === slug)
export const bundleAssets = (bundle: PuffBundle) =>
  bundle.assetSlugs.map(bySlug).filter((asset): asset is PuffAsset => Boolean(asset))
export const bundleValue = (bundle: PuffBundle) =>
  bundleAssets(bundle).reduce((total, asset) => total + asset.price, 0)
export const licencePrice = (base: number, licence: LicenceId) => {
  const multiplier = LICENCES.find(item => item.id === licence)?.multiplier ?? 1
  return Math.round(base * multiplier)
}
export const licenceById = (licence: LicenceId) => LICENCES.find(item => item.id === licence) ?? LICENCES[0]
export const relatedAssets = (asset: PuffAsset, limit = 3) =>
  ASSETS.filter(item => item.slug !== asset.slug)
    .sort((a, b) => {
      const score = (item: PuffAsset) => (item.material === asset.material ? 2 : 0) + (item.category === asset.category ? 1 : 0)
      return score(b) - score(a)
    })
    .slice(0, limit)
export const assetBundles = (slug: string) => BUNDLES.filter(bundle => bundle.assetSlugs.includes(slug))
