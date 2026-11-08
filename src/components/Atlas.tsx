import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import './Atlas.css'

type Layer = 'All' | 'Civilizations' | 'Routes' | 'Ideas' | 'People' | 'Wars'
type AtlasEvent = { id: string; year: number; title: string; place: string; category: Exclude<Layer, 'All'>; detail: string; lat: number; lon: number }
type GeoPosition = [number, number]
type GeoRing = GeoPosition[]
type GeoPolygon = GeoRing[]
type GeoGeometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: GeoPolygon | GeoPolygon[] }
type CountryProperties = { name: string; sovereign: string; iso: string; formal: string }
type HistoryProperties = { name: string; from: number; to: number; area: number; wiki: string; wikidata: string; memberOf: string }
type AtlasFeature<P> = { type: 'Feature'; properties: P; geometry: GeoGeometry }
type AtlasMapData = { type: 'FeatureCollection'; features: AtlasFeature<CountryProperties>[] }
type AtlasHistoryData = { type: 'FeatureCollection'; features: AtlasFeature<HistoryProperties>[] }
type WarActivity = [year: number, eventCount: number, fatalities: number]
type WarProperties = {
  id: string; source: string; year: number; yearEnd: number; title: string; war: string; place: string; country: string
  sideA: string; sideB: string; participants?: string[]; winner?: string; loser?: string; theatre?: string
  lat: number; lon: number; years?: number[]; activity?: WarActivity[]; eventCount?: number; fatalities?: number
}
type WarFeature = { type: 'Feature'; properties: WarProperties; geometry: { type: 'Point'; coordinates: [number, number] } }
type AtlasWarData = { type: 'FeatureCollection'; features: WarFeature[] }
type MapPoint = { lat: number; lon: number }
const EMPTY_COUNTRIES: AtlasFeature<CountryProperties>[] = []
const EMPTY_HISTORY: AtlasFeature<HistoryProperties>[] = []
const EMPTY_WARS: WarFeature[] = []
const CENTURY_YEARS = [...Array.from({ length: 30 }, (_, index) => -3000 + index * 100), 1, ...Array.from({ length: 19 }, (_, index) => 101 + index * 100), 2022]

function yearAtCenturyStep(index: number) { return CENTURY_YEARS[Math.max(0, Math.min(CENTURY_YEARS.length - 1, index))] }
function centuryStepForYear(year: number) { return CENTURY_YEARS.reduce((nearest, candidate, index) => Math.abs(candidate - year) < Math.abs(CENTURY_YEARS[nearest] - year) ? index : nearest, 0) }
function centuryWindowForStep(step: number): [number, number] {
  const safeStep = Math.max(0, Math.min(CENTURY_YEARS.length - 1, step))
  const year = yearAtCenturyStep(safeStep)
  if (safeStep === CENTURY_YEARS.length - 1) return [2001, 2022]
  return [year, year + 99]
}
function warActiveInWindow(war: WarProperties, from: number, to: number) {
  return war.activity ? war.activity.some(([year]) => year >= from && year <= to) : war.year <= to && war.yearEnd >= from
}
function warStatsInWindow(war: WarProperties, from: number, to: number) {
  if (war.activity) return war.activity.filter(([year]) => year >= from && year <= to)
  return [] as WarActivity[]
}
function formatWarPeriod(war: WarProperties, from: number, to: number) {
  const years = warStatsInWindow(war, from, to).map(([year]) => year)
  const start = years.length ? Math.min(...years) : Math.max(from, war.year)
  const end = years.length ? Math.max(...years) : Math.min(to, war.yearEnd)
  return start === end ? formatYear(start) : `${formatYear(start)} — ${formatYear(end)}`
}

const EVENTS: AtlasEvent[] = [
  { id: 'ur', year: -3000, title: 'Cities rise beside the Tigris and Euphrates', place: 'Southern Mesopotamia', category: 'Civilizations', detail: 'Early city life took shape in a network of communities between the great rivers.', lat: 31.3, lon: 45.6 },
  { id: 'silk-road', year: -130, title: 'A route opens across Central Asia', place: 'Chang’an to the western oases', category: 'Routes', detail: 'Diplomatic journeys helped connect older regional trade routes across Eurasia.', lat: 39.9, lon: 116.4 },
  { id: 'ashoka', year: -268, title: 'Ashoka becomes Mauryan emperor', place: 'Pataliputra', category: 'Civilizations', detail: 'The Mauryan court at Pataliputra governed a large and diverse South Asian empire.', lat: 25.6, lon: 85.1 },
  { id: 'alexandria', year: -250, title: 'Alexandria gathers scholars and navigators', place: 'Egypt', category: 'Ideas', detail: 'The city became a major center of learning in the Hellenistic Mediterranean.', lat: 31.2, lon: 29.9 },
  { id: 'roman', year: 117, title: 'Rome reaches its greatest territorial extent', place: 'Mediterranean world', category: 'Civilizations', detail: 'At the start of Hadrian’s reign, Roman rule stretched from Britain to the Near East.', lat: 41.9, lon: 12.5 },
  { id: 'baghdad', year: 830, title: 'A center of translation and study flourishes', place: 'Baghdad', category: 'Ideas', detail: 'Scholars in Abbasid Baghdad translated, debated and extended work from many traditions.', lat: 33.3, lon: 44.4 },
  { id: 'angkor', year: 1150, title: 'Angkor’s temple city reaches a high point', place: 'Khmer Empire', category: 'Civilizations', detail: 'A vast urban and water-management landscape supported the Khmer capital region.', lat: 13.4, lon: 103.9 },
  { id: 'timbuktu', year: 1324, title: 'A famous pilgrimage crosses the Sahara', place: 'Mali and the western Sahel', category: 'People', detail: 'Mansa Musa’s pilgrimage brought attention to Mali’s wealth and trans-Saharan connections.', lat: 16.8, lon: -3.0 },
  { id: 'samarkand', year: 1404, title: 'Samarkand becomes a Timurid capital', place: 'Central Asia', category: 'Ideas', detail: 'Craft, architecture and astronomy thrived at a crossroads linking many regions.', lat: 39.7, lon: 66.9 },
  { id: 'cusco', year: 1450, title: 'The Inca build from a highland capital', place: 'Cusco, Andes', category: 'Civilizations', detail: 'A road system and local alliances connected the Inca heartland across the Andes.', lat: -13.5, lon: -71.97 },
  { id: 'printing', year: 1455, title: 'Movable type changes European bookmaking', place: 'Mainz', category: 'Ideas', detail: 'The spread of printing reshaped how texts could be produced and circulated.', lat: 50.0, lon: 8.3 },
  { id: 'magellan', year: 1522, title: 'A circumnavigation is completed', place: 'Indian and Pacific oceans', category: 'Routes', detail: 'The expedition that began with Ferdinand Magellan returned under Juan Sebastián Elcano.', lat: -33.9, lon: 18.4 },
  { id: 'steam', year: 1769, title: 'A new era of steam power begins', place: 'Britain', category: 'Ideas', detail: 'Improved steam engines helped transform industry, transport and urban life.', lat: 53.5, lon: -2.2 },
  { id: 'present', year: 2022, title: 'One connected, changing world', place: 'Earth', category: 'People', detail: 'Explore the eras, journeys and ideas that shape a shared planetary story.', lat: 0, lon: 0 },
]

function polygonsOf(geometry: GeoGeometry): GeoPolygon[] {
  return geometry.type === 'Polygon' ? [geometry.coordinates as GeoPolygon] : geometry.coordinates as GeoPolygon[]
}

function polityColor(name: string, alpha: number, lightness = 49) {
  let hash = 2166136261
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  const value = hash >>> 0
  const hue = value % 360
  const saturation = 50 + ((value >>> 8) % 18)
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`
}

function unwrapRing(ring: GeoRing, reference?: number) {
  if (!ring.length) return [] as GeoPosition[]
  const result: GeoPosition[] = []
  let previous = ring[0][0]
  let offset = reference === undefined ? 0 : 360 * Math.round((reference - previous) / 360)
  result.push([previous + offset, ring[0][1]])
  for (const [rawLon, lat] of ring.slice(1)) {
    let lon = rawLon + offset
    while (lon - previous > 180) { lon -= 360; offset -= 360 }
    while (lon - previous < -180) { lon += 360; offset += 360 }
    result.push([lon, lat])
    previous = lon
  }
  return result
}

function drawFeature(ctx: CanvasRenderingContext2D, feature: AtlasFeature<unknown>, fill: string, stroke: string, lineWidth: number, width: number, height: number) {
  const xy = ([lon, lat]: GeoPosition): [number, number] => [(lon + 180) / 360 * width, (90 - lat) / 180 * height]
  for (const polygon of polygonsOf(feature.geometry)) {
    if (!polygon[0]?.length) continue
    const outer = unwrapRing(polygon[0])
    const center = outer.reduce((sum, point) => sum + point[0], 0) / Math.max(1, outer.length)
    const rings = [outer, ...polygon.slice(1).map(ring => unwrapRing(ring, center))]
    const { min, max } = outer.reduce((bounds, point) => ({ min: Math.min(bounds.min, point[0]), max: Math.max(bounds.max, point[0]) }), { min: Infinity, max: -Infinity })
    const shifts = [0, ...(min < -180 ? [360] : []), ...(max > 180 ? [-360] : [])]
    for (const shift of shifts) {
      ctx.beginPath()
      for (const ring of rings) {
        ring.forEach((point, index) => {
          const [x, y] = xy([point[0] + shift, point[1]])
          if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        })
        ctx.closePath()
      }
      if (fill !== 'transparent') { ctx.fillStyle = fill; ctx.fill('evenodd') }
      if (stroke !== 'transparent' && lineWidth > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke() }
    }
  }
}

function makeEarthTexture(countries: AtlasFeature<CountryProperties>[], historical: AtlasFeature<HistoryProperties>[], selectedCountry: string | undefined, selectedAuthorities: AtlasFeature<HistoryProperties>[], year: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 4096
  canvas.height = 2048
  const ctx = canvas.getContext('2d')!
  const ocean = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  ocean.addColorStop(0, '#f0e9f5')
  ocean.addColorStop(0.5, '#e8e0ef')
  ocean.addColorStop(1, '#f5eef7')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const xy = ([lon, lat]: [number, number]): [number, number] => [(lon + 180) / 360 * canvas.width, (90 - lat) / 180 * canvas.height]
  ctx.lineWidth = 1
  for (let lat = -75; lat <= 75; lat += 15) {
    ctx.beginPath()
    for (let lon = -180; lon <= 180; lon += 2) {
      const [x, y] = xy([lon, lat])
      if (lon === -180) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = lat === 0 ? 'rgba(121, 82, 146, .2)' : 'rgba(121, 82, 146, .08)'
    ctx.stroke()
  }
  for (let lon = -165; lon <= 180; lon += 15) {
    ctx.beginPath()
    for (let lat = -89; lat <= 89; lat += 2) {
      const [x, y] = xy([lon, lat])
      if (lat === -89) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = lon === 0 ? 'rgba(121, 82, 146, .2)' : 'rgba(121, 82, 146, .08)'
    ctx.stroke()
  }

  countries.forEach(feature => drawFeature(ctx, feature, '#e5e1e8', 'transparent', 0, canvas.width, canvas.height))
  historical.forEach(feature => drawFeature(ctx, feature, polityColor(feature.properties.name, .86, 55), polityColor(feature.properties.name, .92, 36), 1.2, canvas.width, canvas.height))
  if (year >= 2022) countries.forEach(feature => drawFeature(ctx, feature, 'transparent', 'rgba(107, 77, 123, .68)', .8, canvas.width, canvas.height))
  selectedAuthorities.forEach(feature => drawFeature(ctx, feature, 'rgba(255, 92, 138, .25)', 'rgba(206, 47, 108, .98)', 3, canvas.width, canvas.height))
  if (selectedCountry && year >= 2022) {
    const selected = countries.find(feature => feature.properties.name === selectedCountry)
    if (selected) drawFeature(ctx, selected, 'rgba(192, 132, 252, .2)', 'rgba(142, 72, 190, .95)', 2.8, canvas.width, canvas.height)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function pointInRing(point: MapPoint, ring: GeoRing) {
  const continuous = unwrapRing(ring, point.lon)
  if (!continuous.length) return false
  const centerLongitude = continuous.reduce((sum, [lon]) => sum + lon, 0) / continuous.length
  const queryLongitude = point.lon + 360 * Math.round((centerLongitude - point.lon) / 360)
  let inside = false
  for (let i = 0, j = continuous.length - 1; i < continuous.length; j = i++) {
    const xi = continuous[i][0]
    const xj = continuous[j][0]
    const yi = continuous[i][1]
    const yj = continuous[j][1]
    const crosses = (yi > point.lat) !== (yj > point.lat) && queryLongitude < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function featureContainsPoint(feature: AtlasFeature<unknown>, point: MapPoint) {
  return polygonsOf(feature.geometry).some(polygon => polygon.length > 0 && pointInRing(point, polygon[0]) && !polygon.slice(1).some(hole => pointInRing(point, hole)))
}

function findAuthorities(features: AtlasFeature<HistoryProperties>[], point: MapPoint, year: number) {
  const found = features.filter(feature => feature.properties.from <= year && feature.properties.to >= year && featureContainsPoint(feature, point))
  const unique = [...new Map(found.map(feature => [feature.properties.name, feature])).values()]
  return unique.sort((a, b) => a.properties.area - b.properties.area).slice(0, 4)
}

function latLon(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180
  const theta = (lon + 180) * Math.PI / 180
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta))
}

function Globe({ events, warMarkers, routes, labels, lowMotion, countries, historical, selectedCountry, selectedAuthorities, selectedPoint, selectedWarId, year, onSelectLocation, onSelectWar }: {
  events: AtlasEvent[]
  warMarkers: WarFeature[]
  routes: boolean
  labels: boolean
  lowMotion: boolean
  countries: AtlasFeature<CountryProperties>[]
  historical: AtlasFeature<HistoryProperties>[]
  selectedCountry?: string
  selectedAuthorities: AtlasFeature<HistoryProperties>[]
  selectedPoint?: MapPoint
  selectedWarId?: string
  year: number
  onSelectLocation: (point: MapPoint) => void
  onSelectWar: (war: WarFeature) => void
}) {
  const world = useRef<THREE.Group>(null)
  const { gl, camera } = useThree()
  const texture = useMemo(() => makeEarthTexture(countries, historical, selectedCountry, selectedAuthorities, year), [countries, historical, selectedAuthorities, selectedCountry, year])
  const spin = useRef({ x: 0.12, y: -2.1 })
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const distance = useRef(5.85)
  const routeMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: '#d29aff', transparent: true, opacity: 0.75 }), [])
  const warMarkerMesh = useMemo(() => {
    const geometry = new THREE.SphereGeometry(1, 8, 6)
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.86, toneMapped: false })
    const mesh = new THREE.InstancedMesh(geometry, material, warMarkers.length)
    const marker = new THREE.Object3D()
    const color = new THREE.Color()
    warMarkers.forEach((feature, index) => {
      const war = feature.properties
      marker.position.copy(latLon(war.lat, war.lon, 1.624))
      const isUcdp = war.source.startsWith('UCDP')
      const magnitude = Math.min(isUcdp ? 0.003 : 0.005, Math.log10((war.eventCount ?? 1) + 1) * (isUcdp ? 0.0009 : 0.0014))
      const radius = (isUcdp ? 0.0065 : 0.014) + magnitude
      marker.scale.setScalar(radius)
      marker.updateMatrix()
      mesh.setMatrixAt(index, marker.matrix)
      const markerColor = war.id === selectedWarId ? '#7c36a2' : war.source.startsWith('UCDP') ? '#dc4b76' : '#ef8a42'
      mesh.setColorAt(index, color.set(markerColor))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    return mesh
  }, [selectedWarId, warMarkers])

  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => () => {
    warMarkerMesh.geometry.dispose()
    const material = warMarkerMesh.material
    if (Array.isArray(material)) material.forEach(item => item.dispose()); else material.dispose()
  }, [warMarkerMesh])
  useEffect(() => {
    const canvas = gl.domElement
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
    }
    const onMove = (event: PointerEvent) => {
      if (!drag.current || drag.current.id !== event.pointerId) return
      const dx = event.clientX - drag.current.x
      const dy = event.clientY - drag.current.y
      spin.current.y += dx * 0.006
      spin.current.x = THREE.MathUtils.clamp(spin.current.x + dy * 0.005, -1.0, 1.0)
      drag.current.x = event.clientX
      drag.current.y = event.clientY
    }
    const onUp = (event: PointerEvent) => {
      if (drag.current?.id === event.pointerId) drag.current = null
    }
    const onWheel = (event: WheelEvent) => {
      distance.current = THREE.MathUtils.clamp(distance.current + event.deltaY * 0.003, 3.35, 7.8)
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useEffect(() => {
    if (!selectedPoint) return
    const point = latLon(selectedPoint.lat, selectedPoint.lon, 1)
    const targetY = Math.atan2(-point.x, point.z)
    const zAfterY = -point.x * Math.sin(targetY) + point.z * Math.cos(targetY)
    spin.current.x = Math.atan2(point.y, zAfterY)
    spin.current.y = targetY
  }, [selectedPoint])

  const routeLines = useMemo(() => {
    const endpoints: Array<{ from: [number, number]; to: [number, number]; year: number }> = [
      { from: [31.3, 45.6], to: [39.9, 116.4], year: -130 },
      { from: [41.9, 12.5], to: [33.3, 44.4], year: 117 },
      { from: [16.8, -3], to: [31.2, 29.9], year: 1324 },
      { from: [39.7, 66.9], to: [41.9, 12.5], year: 1404 },
    ]
    return endpoints.filter(route => route.year <= year).map(({ from: a, to: b }) => {
      const start = latLon(a[0], a[1], 1.615)
      const end = latLon(b[0], b[1], 1.615)
      const points: THREE.Vector3[] = []
      for (let i = 0; i <= 48; i++) {
        const t = i / 48
        const point = start.clone().lerp(end, t).normalize().multiplyScalar(1.61 + Math.sin(Math.PI * t) * 0.1)
        points.push(point)
      }
      return new THREE.BufferGeometry().setFromPoints(points)
    })
  }, [year])
  const routeObjects = useMemo(() => routeLines.map(line => new THREE.Line(line, routeMaterial)), [routeLines, routeMaterial])
  useEffect(() => () => { routeLines.forEach(line => line.dispose()); routeMaterial.dispose() }, [routeLines, routeMaterial])

  useFrame((_, delta) => {
    if (world.current) {
      if (!lowMotion && !drag.current) spin.current.y += delta * 0.035
      world.current.rotation.x = THREE.MathUtils.damp(world.current.rotation.x, spin.current.x, 6, delta)
      world.current.rotation.y = THREE.MathUtils.damp(world.current.rotation.y, spin.current.y, 6, delta)
    }
    camera.position.z = THREE.MathUtils.damp(camera.position.z, distance.current, 5, delta)
    camera.lookAt(0, 0, 0)
  })

  return <>
    <ambientLight intensity={0.85} />
    <directionalLight position={[-3, 3, 4]} intensity={1.25} color="#ffffff" />
    <pointLight position={[3, -2, -2]} intensity={0.7} color="#a855f7" />
    <mesh scale={1.075}><sphereGeometry args={[1.65, 48, 48]} /><meshBasicMaterial color="#a855f7" transparent opacity={0.09} side={THREE.BackSide} /></mesh>
    <group ref={world}>
      <mesh onClick={event => {
        if (!world.current) return
        const localPoint = world.current.worldToLocal(event.point.clone()).normalize()
        const lat = Math.asin(THREE.MathUtils.clamp(localPoint.y, -1, 1)) * 180 / Math.PI
        const rawLon = Math.atan2(localPoint.z, -localPoint.x) * 180 / Math.PI - 180
        onSelectLocation({ lat, lon: ((rawLon + 540) % 360) - 180 })
      }}>
        <sphereGeometry args={[1.6, 96, 64]} />
        <meshStandardMaterial map={texture} roughness={0.91} metalness={0.02} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.68, 0.006, 5, 144]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.5} />
      </mesh>
      {selectedPoint && <mesh position={latLon(selectedPoint.lat, selectedPoint.lon, 1.635)}>
        <sphereGeometry args={[0.028, 16, 12]} />
        <meshBasicMaterial color="#ff5c8a" />
      </mesh>}
      <primitive object={warMarkerMesh} onClick={event => {
        event.stopPropagation()
        const feature = typeof event.instanceId === 'number' ? warMarkers[event.instanceId] : undefined
        if (feature) onSelectWar(feature)
      }} />
      {routes && routeObjects.map((line, index) => <primitive object={line} key={`route-${index}`} />)}
      {labels && events.filter(event => event.year <= year).map(event => <mesh key={event.id} position={latLon(event.lat, event.lon, 1.625)}>
        <sphereGeometry args={[event.id === 'present' ? 0.026 : 0.018, 12, 10]} />
        <meshBasicMaterial color={event.category === 'Ideas' ? '#ff86b2' : '#d2a7ff'} />
      </mesh>)}
    </group>
    <Stars />
  </>
}

function Stars() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(420 * 3)
    let seed = 91425
    const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
    for (let i = 0; i < 420; i++) {
      const radius = 4.4 + random() * 4
      const a = random() * Math.PI * 2
      const z = random() * 2 - 1
      const s = Math.sqrt(1 - z * z)
      positions[i * 3] = radius * s * Math.cos(a)
      positions[i * 3 + 1] = radius * z
      positions[i * 3 + 2] = radius * s * Math.sin(a)
    }
    const stars = new THREE.BufferGeometry()
    stars.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return stars
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <points geometry={geometry}><pointsMaterial color="#d9c3ff" size={0.016} transparent opacity={0.67} sizeAttenuation depthWrite={false} /></points>
}

function formatYear(year: number) { return year < 0 ? `${Math.abs(year).toLocaleString()} BCE` : year === 0 ? '1 BCE / 1 CE' : `${year.toLocaleString()} CE` }

async function loadCompressedAtlasData<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, cache: 'no-cache' })
  if (!response.ok) throw new Error(`Map data request failed (${response.status})`)
  if (response.headers.get('content-type')?.includes('text/html')) throw new Error('Map data file was not found at this URL.')
  const bytes = await response.arrayBuffer()
  const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2))
  const isGzip = header[0] === 0x1f && header[1] === 0x8b
  if (!isGzip) return JSON.parse(new TextDecoder().decode(bytes)) as T
  if (!('DecompressionStream' in window)) throw new Error('This browser cannot open the compressed map layers.')
  const stream = new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).json() as T
}

export default function Atlas() {
  const [year, setYear] = useState(801)
  const [mapYear, setMapYear] = useState(801)
  const [layer, setLayer] = useState<Layer>('All')
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState<AtlasEvent>(EVENTS[5])
  const [playing, setPlaying] = useState(false)
  const [routes, setRoutes] = useState(true)
  const [labels, setLabels] = useState(true)
  const [territories, setTerritories] = useState(true)
  const [showWarMarkers, setShowWarMarkers] = useState(true)
  const [mapData, setMapData] = useState<AtlasMapData | null>(null)
  const [historyData, setHistoryData] = useState<AtlasHistoryData | null>(null)
  const [warData, setWarData] = useState<AtlasWarData | null>(null)
  const [mapError, setMapError] = useState('')
  const [warsError, setWarsError] = useState('')
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null)
  const [selectedWar, setSelectedWar] = useState<WarFeature | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(true)
  const [rightCollapsed, setRightCollapsed] = useState(true)
  const [warResultLimit, setWarResultLimit] = useState(5)
  const [lowMotion, setLowMotion] = useState(() => document.documentElement.dataset.performance === 'low' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [expanded, setExpanded] = useState(false)
  const page = useRef<HTMLElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      loadCompressedAtlasData<AtlasMapData>('/atlas/countries-10m.geojson.gz', controller.signal),
      loadCompressedAtlasData<AtlasHistoryData>('/atlas/history-0.2.1.geojson.gz', controller.signal),
    ]).then(([countries, history]) => {
      setMapData(countries)
      setHistoryData(history)
    }).catch(error => {
      if (error.name !== 'AbortError') setMapError(error instanceof Error ? error.message : 'Map data could not be loaded.')
    })
    Promise.allSettled([
      loadCompressedAtlasData<AtlasWarData>('/atlas/wars-hced-v3.geojson.gz', controller.signal),
      loadCompressedAtlasData<AtlasWarData>('/atlas/wars-ucdp-26.1.geojson.gz', controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return
      const features: WarFeature[] = []
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') features.push(...result.value.features)
        else if (result.reason?.name !== 'AbortError') setWarsError(`${index === 0 ? 'Historical battle' : 'UCDP war'} source could not be loaded: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`)
      })
      setWarData({ type: 'FeatureCollection', features })
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setMapYear(year), 140)
    return () => window.clearTimeout(timer)
  }, [year])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setYear(current => yearAtCenturyStep((centuryStepForYear(current) + 1) % CENTURY_YEARS.length)), 650)
    return () => window.clearInterval(timer)
  }, [playing])

  useEffect(() => {
    const onFullscreenChange = () => setExpanded(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
      }
      if (event.key === 'Escape') setPlaying(false)
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  useEffect(() => {
    const nearest = EVENTS.reduce((best, event) => Math.abs(event.year - year) < Math.abs(best.year - year) ? event : best, EVENTS[0])
    setFocus(nearest)
  }, [year])

  useEffect(() => setWarResultLimit(5), [layer, mapYear, query])

  const shown = EVENTS.filter(event => (layer === 'All' || (layer !== 'Wars' && event.category === layer)) && `${event.title} ${event.place} ${event.detail}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year)).slice(0, 5)
  const [periodStart, periodEnd] = centuryWindowForStep(centuryStepForYear(mapYear))
  const activeWars = useMemo(() => warData ? warData.features.filter(feature => warActiveInWindow(feature.properties, periodStart, periodEnd)) : EMPTY_WARS, [periodEnd, periodStart, warData])
  const matchingWars = useMemo(() => {
    const search = query.trim().toLowerCase()
    return activeWars.filter(feature => {
      const war = feature.properties
      return !search || `${war.title} ${war.war} ${war.place} ${war.country} ${war.sideA} ${war.sideB} ${war.winner} ${war.loser}`.toLowerCase().includes(search)
    }).sort((a, b) => {
      const countA = warStatsInWindow(a.properties, periodStart, periodEnd).reduce((sum, [, events]) => sum + events, 0) || 1
      const countB = warStatsInWindow(b.properties, periodStart, periodEnd).reduce((sum, [, events]) => sum + events, 0) || 1
      return countB - countA || a.properties.title.localeCompare(b.properties.title)
    })
  }, [activeWars, periodEnd, periodStart, query])
  const warsShown = matchingWars.slice(0, warResultLimit)
  const selectedCountry = useMemo(() => selectedPoint && mapData ? mapData.features.find(feature => featureContainsPoint(feature, selectedPoint)) ?? null : null, [mapData, selectedPoint])
  const activeHistory = useMemo(() => territories && historyData ? historyData.features.filter(feature => feature.properties.from <= mapYear && feature.properties.to >= mapYear).sort((a, b) => b.properties.area - a.properties.area) : EMPTY_HISTORY, [historyData, mapYear, territories])
  const authorities = useMemo(() => selectedPoint && historyData ? findAuthorities(historyData.features, selectedPoint, mapYear) : [], [historyData, mapYear, selectedPoint])
  useEffect(() => {
    if (selectedWar && !warActiveInWindow(selectedWar.properties, periodStart, periodEnd)) {
      setSelectedWar(null)
      setSelectedPoint(null)
    }
  }, [periodEnd, periodStart, selectedWar])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await page.current?.requestFullscreen()
    } catch {
      setExpanded(value => !value)
    }
  }

  const authorityMarkup = authorities.length ? authorities.map(feature => {
    const { name, from, to, wiki, wikidata, memberOf } = feature.properties
    const wikiUrl = wiki ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wiki.replaceAll(' ', '_'))}` : wikidata ? `https://www.wikidata.org/wiki/${encodeURIComponent(wikidata)}` : ''
    return <article className="atlas-authority" key={`${name}-${from}-${to}`}>
      <strong>{name}</strong>
      <small>Mapped period: {formatYear(from)} — {formatYear(to)}</small>
      {memberOf && <small>Associated with {memberOf.replace(/[()]/g, '')}</small>}
      {wikiUrl && <a href={wikiUrl} target="_blank" rel="noreferrer">Read about this polity ↗</a>}
    </article>
  }) : <p className="atlas-no-authority">No matching polity is mapped at this location for {formatYear(year)}.</p>

  return <section className={`atlas-page${expanded ? ' atlas-page--expanded' : ''}`} ref={page} aria-label="Interactive 3D world history atlas">
    <div className="atlas-ambient" aria-hidden="true" />
    <Canvas className="atlas-canvas" dpr={[1, 1.6]} camera={{ position: [0, 0, 5.85], fov: 39 }} gl={{ alpha: true, antialias: true }}>
      <Globe events={EVENTS} warMarkers={showWarMarkers ? activeWars : EMPTY_WARS} routes={routes} labels={labels} lowMotion={lowMotion} countries={mapData?.features ?? EMPTY_COUNTRIES} historical={activeHistory} selectedCountry={selectedCountry?.properties.name} selectedAuthorities={authorities.slice(0, 1)} selectedPoint={selectedPoint ?? undefined} selectedWarId={selectedWar?.properties.id} year={mapYear} onSelectLocation={point => { setSelectedWar(null); setSelectedPoint(point); setLeftCollapsed(true); setRightCollapsed(false) }} onSelectWar={war => { setSelectedWar(war); setSelectedPoint({ lat: war.properties.lat, lon: war.properties.lon }); setLeftCollapsed(true); setRightCollapsed(false) }} />
    </Canvas>

    <header className="atlas-topbar">
      <a href="#top" className="atlas-brand" aria-label="Back to CensorisLabs home"><span>◈</span><b>CENSORISLABS</b></a>
      <div className="atlas-title"><span>THE LIVING ATLAS</span><small>TIME · PLACE · PEOPLE</small></div>
      <div className="atlas-top-actions"><span className="atlas-live"><i /> INTERACTIVE GLOBE</span><button className="atlas-icon-button" onClick={() => setLowMotion(value => !value)} aria-pressed={lowMotion} title="Toggle gentle motion">{lowMotion ? '◌' : '✧'}<span>Motion</span></button><button className="atlas-fullscreen" onClick={toggleFullscreen}><span aria-hidden="true">{expanded ? '⤢' : '⛶'}</span>{expanded ? 'Exit full screen' : 'Full screen'}</button></div>
    </header>

    <aside className={`atlas-panel atlas-panel--left${leftCollapsed ? ' is-collapsed' : ''}`}>
      <button className="atlas-collapse" onClick={() => setLeftCollapsed(value => !value)} aria-expanded={!leftCollapsed} aria-label={leftCollapsed ? 'Open stories and wars panel' : 'Collapse story panel'}>{leftCollapsed ? 'STORIES + WARS ＋' : '−'}</button>
      {!leftCollapsed && <>
        <div className="atlas-kicker">A WORLD IN MOTION <span>STORIES + WARS</span></div>
        <h1>History has<br /><em>many centers.</em></h1>
        <p className="atlas-intro">Travel across centuries, follow old routes and meet the people who connected the world.</p>
        <label className="atlas-search"><span aria-hidden="true">⌕</span><input ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder={layer === 'Wars' ? 'Search a war, side or place' : 'Search a place or story'} aria-label="Search atlas events" /><kbd>Ctrl K</kbd></label>
        <div className="atlas-filter-label">EXPLORE BY LENS</div>
        <div className="atlas-filters">{(['All', 'Civilizations', 'Routes', 'Ideas', 'People', 'Wars'] as const).map(item => <button className={layer === item ? 'active' : ''} key={item} onClick={() => setLayer(item)}>{item === 'All' ? '✦' : item === 'Routes' ? '⌁' : item === 'Ideas' ? '◉' : item === 'People' ? '♙' : item === 'Wars' ? '⚔' : '⬡'}<span>{item === 'Wars' ? 'Wars + battles' : item}</span></button>)}</div>
        <div className="atlas-results-label"><span>{layer === 'Wars' ? 'WARS IN THIS CENTURY' : 'NEAR THIS MOMENT'}</span><span>{layer === 'Wars' ? `${matchingWars.length.toLocaleString()} LOCATIONS` : `${shown.length.toString().padStart(2, '0')} STORIES`}</span></div>
        <div className="atlas-story-list">{layer === 'Wars' ? warsShown.length ? warsShown.map(feature => {
          const war = feature.properties
          return <button className={`atlas-story atlas-story--war${selectedWar?.properties.id === war.id ? ' selected' : ''}`} key={war.id} onClick={() => { setSelectedWar(feature); setSelectedPoint({ lat: war.lat, lon: war.lon }); setLeftCollapsed(true); setRightCollapsed(false) }}><span className="atlas-story-date">{formatWarPeriod(war, periodStart, periodEnd)}</span><b>{war.title}</b><small><i />{war.place}{war.country ? ` · ${war.country}` : ''}</small></button>
        }) : <p className="atlas-no-results">{query ? 'No documented war locations match this search in this century.' : mapYear < -1468 ? 'The sourced battle catalogue begins in 1468 BCE. No earlier markers are available here.' : 'No matching war or battle records in this century. That is a source coverage gap, not proof that no wars occurred.'}</p> : shown.length ? shown.map(event => <button className={`atlas-story${focus.id === event.id ? ' selected' : ''}`} key={event.id} onClick={() => { setFocus(event); setSelectedWar(null); setSelectedPoint(null); setLeftCollapsed(true); setRightCollapsed(false); setYear(yearAtCenturyStep(centuryStepForYear(event.year))) }}><span className="atlas-story-date">{formatYear(event.year)}</span><b>{event.title}</b><small><i />{event.place}</small></button>) : <p className="atlas-no-results">No stories match this search. Try another place or lens.</p>}</div>
        {layer === 'Wars' && matchingWars.length > warResultLimit && <button className="atlas-load-more" onClick={() => setWarResultLimit(count => count + 10)}>Show 10 more war locations <span>{matchingWars.length - warResultLimit} left</span></button>}
        <div className="atlas-source-note"><i>✳</i><span>Natural Earth (public domain); Seshat Cliopatria polities (CC BY 4.0); Historical Conflict Event Dataset (CC0); UCDP GED (CC BY 4.0). Historical battle records through 1988; UCDP state-war events for 1989–2022, limited to conflict-years coded as war (1,000+ battle deaths). Coverage is incomplete; blank periods do not mean no wars.
          <div className="atlas-source-legend"><span><i className="layer-dot layer-dot--battle" /> Historical battles</span><span><i className="layer-dot layer-dot--war" /> UCDP war events</span></div>
          <div className="atlas-source-links"><a href="https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/6ZFC0V" target="_blank" rel="noreferrer">Harvard dataset ↗</a><a href="https://doi.org/10.1177/00220027221119085" target="_blank" rel="noreferrer">HCED research paper ↗</a><a href="https://ucdp.uu.se/downloads/ged/ged261.pdf" target="_blank" rel="noreferrer">UCDP GED codebook ↗</a><a href="https://ucdp.uu.se/downloads/ucdpprio/ucdp-prio-acd-261.pdf" target="_blank" rel="noreferrer">UCDP/PRIO conflict codebook ↗</a></div>
        </span></div>
      </>}
    </aside>

    <aside className={`atlas-panel atlas-panel--right${rightCollapsed ? ' is-collapsed' : ''}`}>
      <button className="atlas-collapse" onClick={() => setRightCollapsed(value => !value)} aria-expanded={!rightCollapsed} aria-label={rightCollapsed ? 'Open details panel' : 'Collapse details panel'}>{rightCollapsed ? (selectedWar ? `WAR · ${selectedWar.properties.title.slice(0, 14)}` : selectedCountry?.properties.name ?? 'DETAILS') + ' ＋' : '−'}</button>
      {!rightCollapsed && <>
        <div className="atlas-era"><span>TIME LENS</span><strong>{formatYear(year)}</strong><small>{year < -1000 ? 'EARLY CIVILIZATIONS' : year < 500 ? 'ANCIENT WORLD' : year < 1450 ? 'CONNECTED WORLDS' : year < 1800 ? 'EARLY MODERN' : 'MODERN ERA'}</small></div>
        {selectedWar ? <div className="atlas-country-detail atlas-war-detail">
          <div className="atlas-detail-tag"><span>WAR LOCATION</span><span>◦ &nbsp;{selectedWar.properties.lat.toFixed(2)}°, {selectedWar.properties.lon.toFixed(2)}°</span></div>
          <h2>{selectedWar.properties.title || selectedWar.properties.war || 'Recorded conflict'}</h2>
          <p className="atlas-place">⌖ &nbsp;{selectedWar.properties.place}{selectedWar.properties.country ? ` · ${selectedWar.properties.country}` : ''}</p>
          {selectedWar.properties.war && selectedWar.properties.war !== selectedWar.properties.title && <p className="atlas-war-name">Conflict: {selectedWar.properties.war}</p>}
          <p className="atlas-war-period">Recorded period: {formatWarPeriod(selectedWar.properties, selectedWar.properties.year, selectedWar.properties.yearEnd)}</p>
          <div className="atlas-authorities-label">WHO FOUGHT HERE?</div>
          {selectedWar.properties.participants?.length ? <p className="atlas-war-participants">{selectedWar.properties.participants.join(' · ')}</p> : <div className="atlas-war-sides"><p><small>Side A</small><b>{selectedWar.properties.sideA || 'Not named in source'}</b></p><p><small>Side B</small><b>{selectedWar.properties.sideB || 'Not named in source'}</b></p></div>}
          {(selectedWar.properties.winner || selectedWar.properties.loser) && <p className="atlas-war-result">{selectedWar.properties.winner ? `Recorded winner: ${selectedWar.properties.winner}. ` : ''}{selectedWar.properties.loser ? `Recorded loser: ${selectedWar.properties.loser}.` : ''}</p>}
          {selectedWar.properties.source.startsWith('UCDP') && <p className="atlas-war-count">{selectedWar.properties.eventCount?.toLocaleString()} georeferenced lethal events at this place across the recorded conflict years; best-estimate deaths total {selectedWar.properties.fatalities?.toLocaleString() ?? 'not reported'}.</p>}
          {selectedWar.properties.theatre && <p className="atlas-war-period">Theatre: {selectedWar.properties.theatre}</p>}
          <p className="atlas-data-note">Source: {selectedWar.properties.source}. These are documented locations, not a complete map of every battle or front. UCDP points use the most specific place named in the source; older event coverage is uneven.</p>
          <a className="atlas-war-source-link" href={selectedWar.properties.source.startsWith('UCDP') ? 'https://ucdp.uu.se/downloads/' : 'https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/6ZFC0V'} target="_blank" rel="noreferrer">Open source data + methods ↗</a>
        </div> : selectedPoint ? <div className="atlas-country-detail">
          <div className="atlas-detail-tag"><span>PLACE SELECTED</span><span>◦ &nbsp;{selectedPoint.lat.toFixed(1)}°, {selectedPoint.lon.toFixed(1)}°</span></div>
          <h2>{selectedCountry?.properties.name ?? (mapData ? 'Open water' : 'Finding country…')}</h2>
          {selectedCountry && <p className="atlas-place">On today’s map{selectedCountry.properties.sovereign !== selectedCountry.properties.name ? ` · ${selectedCountry.properties.sovereign}` : ''}</p>}
          <div className="atlas-authorities-label">WHO HELD THIS LAND?</div>
          <div className="atlas-authority-list">{authorityMarkup}</div>
          <p className="atlas-data-note">Historical coverage is uneven and borders are approximate. Blank land means no polity is mapped here; it is not proof that nobody lived here. The source does not consistently name individual rulers.</p>
        </div> : <div className="atlas-detail"><div className="atlas-detail-tag"><span>{focus.category.toUpperCase()}</span><span>◦  STORY</span></div><h2>{focus.title}</h2><p className="atlas-place">⌖ &nbsp;{focus.place}</p><p className="atlas-detail-copy">{focus.detail}</p><button className="atlas-follow" onClick={() => setYear(focus.year)}>Explore this moment <span>↗</span></button></div>}
        <div className="atlas-map-layers"><span className="atlas-filter-label">MAP LAYERS</span><label><span><i className="layer-dot layer-dot--gold" />Historic polities</span><input type="checkbox" checked={territories} onChange={event => setTerritories(event.target.checked)} /></label><label><span><i className="layer-dot layer-dot--war" />Major wars + battles</span><input type="checkbox" checked={showWarMarkers} onChange={event => setShowWarMarkers(event.target.checked)} /></label><label><span><i className="layer-dot layer-dot--gold" />Journey lines</span><input type="checkbox" checked={routes} onChange={event => setRoutes(event.target.checked)} /></label><label><span><i className="layer-dot layer-dot--mint" />Place markers</span><input type="checkbox" checked={labels} onChange={event => setLabels(event.target.checked)} /></label></div>
        <div className="atlas-instructions"><span>DRAG TO ROTATE</span><span>SCROLL TO ZOOM · CLICK A PLACE</span></div>
      </>}
    </aside>

    <div className="atlas-globe-caption"><span>RECORDED POLITIES COLOURED · UNMAPPED LAND LEFT NEUTRAL</span><span>{selectedWar?.properties.title ?? selectedCountry?.properties.name ?? 'TIME · PLACE · PEOPLE'}</span></div>
    {mapError ? <div className="atlas-data-status atlas-data-status--error">{mapError}</div> : !mapData || !historyData ? <div className="atlas-data-status">LOADING HISTORICAL BORDERS <i /></div> : !warData ? <div className="atlas-data-status">LOADING WAR RECORDS <i /></div> : null}
    {warsError && <div className="atlas-data-status atlas-data-status--error">{warsError} The historical map remains available.</div>}

    <footer className="atlas-timeline"><div className="atlas-timeline-head"><div><span className="atlas-filter-label">BORDERS CHANGE BY CENTURY</span><strong>{formatYear(year)}</strong></div><button className={`atlas-play${playing ? ' is-playing' : ''}`} onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pause timeline' : 'Play timeline'}>{playing ? 'Ⅱ' : '▶'}<span>{playing ? 'Pause' : 'Play timeline'}</span></button><div className="atlas-timeline-actions"><span>51 HISTORICAL SNAPSHOTS</span><button onClick={() => { setYear(-3000); setPlaying(false) }}>Reset to start ↺</button></div></div><div className="atlas-range-wrap"><div className="atlas-ticks"><span>3000 BCE</span><span>1 CE</span><span>1000</span><span>1500</span><span>2022 CE</span></div><input aria-label="Choose a century" type="range" min="0" max={CENTURY_YEARS.length - 1} step="1" value={centuryStepForYear(year)} onChange={event => { setYear(yearAtCenturyStep(Number(event.target.value))); setPlaying(false) }} style={{ '--range-progress': `${centuryStepForYear(year) / (CENTURY_YEARS.length - 1) * 100}%` } as CSSProperties} /><div className="atlas-event-ticks" aria-hidden="true">{EVENTS.map(event => <i key={event.id} style={{ left: `${centuryStepForYear(event.year) / (CENTURY_YEARS.length - 1) * 100}%` }} />)}</div></div><div className="atlas-timeline-foot"><span>3000 BCE</span><span>ONE SNAPSHOT PER CENTURY · POLITY BORDERS ARE APPROXIMATE</span><span>2022 CE</span></div></footer>
  </section>
}
