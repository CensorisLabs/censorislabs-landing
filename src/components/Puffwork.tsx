import { useMemo, useState, type CSSProperties, type PointerEvent } from 'react'

import {
  ASSETS,
  BUNDLES,
  LICENCES,
  MATERIALS,
  assetBundles,
  bundleAssets,
  bundleBySlug,
  bundleValue,
  bySlug,
  licenceById,
  licencePrice,
  relatedAssets,
  type LicenceId,
  type Material,
  type PuffAsset,
  type PuffBundle,
} from '../data/puffwork'
import { puffSvg } from '../lib/puff-svg'
import './Puffwork.css'

type Status = '' | 'copied' | 'failed'

function Art({ asset, variant = 'card' }: { asset: PuffAsset; variant?: string }) {
  const svg = useMemo(() => puffSvg(asset, `${variant}-${asset.slug}`), [asset, variant])
  return (
    <div
      className={`puff-art puff-art--${variant}`}
      style={{ '--puff-art-back': asset.colors.back } as CSSProperties}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function MaterialPill({ material }: { material: Material }) {
  const label = MATERIALS.find(item => item.id === material)?.label ?? material
  return <span className={`puff-pill puff-pill--${material}`}>{label}</span>
}

function Price({ value, was }: { value: number; was?: number }) {
  return (
    <span className="puff-price">
      ${value}
      {was && was > value ? <s>${was}</s> : null}
    </span>
  )
}

function downloadPreview(asset: PuffAsset) {
  const svg = puffSvg(asset, 'download')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `puffwork-${asset.slug}-preview.svg`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function LicencePicker({
  base,
  licence,
  onChange,
  assetName,
}: {
  base: number
  licence: LicenceId
  onChange: (next: LicenceId) => void
  assetName: string
}) {
  const chosen = licenceById(licence)
  return (
    <div className="puff-licence">
      <div className="puff-licence__head">
        <h2>Licence</h2>
        <p>{chosen.summary}</p>
      </div>
      <div className="puff-licence__options" role="radiogroup" aria-label={`Licence for ${assetName}`}>
        {LICENCES.map(option => (
          <label key={option.id} className={`puff-licence__option${licence === option.id ? ' is-active' : ''}`}>
            <input
              type="radio"
              name="puff-licence"
              value={option.id}
              checked={licence === option.id}
              onChange={() => onChange(option.id)}
            />
            <span className="puff-licence__name">
              {option.name}
              {option.id === 'commercial' ? <em>Most picked</em> : null}
            </span>
            <span className="puff-licence__price">${licencePrice(base, option.id)}</span>
            <span className="puff-licence__summary">{option.summary}</span>
          </label>
        ))}
      </div>
      <ul className="puff-licence__terms">
        {chosen.terms.map(term => (
          <li key={term}>{term}</li>
        ))}
      </ul>
    </div>
  )
}

function OrderPanel({
  name,
  base,
  licence,
  slug,
}: {
  name: string
  base: number
  licence: LicenceId
  slug: string
}) {
  const [status, setStatus] = useState<Status>('')
  const chosen = licenceById(licence)
  const total = licencePrice(base, licence)
  const summary = `Puffwork order summary\nPack: ${name}\nLicence: ${chosen.name}\nPrice: $${total} USD\nReference: ${slug}\nCheckout is not connected yet — reply to this summary to arrange payment.`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setStatus('copied')
      setTimeout(() => setStatus(''), 2600)
    } catch {
      setStatus('failed')
    }
  }

  return (
    <aside className="puff-order" aria-live="polite">
      <div className="puff-order__row">
        <span>{chosen.name} licence</span>
        <Price value={total} />
      </div>
      <p className="puff-order__note">
        These are the files you would receive. Checkout is not connected on this site yet — build the summary now, and it will be
        waiting in your message.
      </p>
      <div className="puff-actions">
        <button className="puff-btn puff-btn--solid" type="button" onClick={copy}>
          {status === 'copied' ? 'Summary copied' : 'Copy order summary'}
        </button>
        <a className="puff-btn puff-btn--ghost" href="#/request">
          Request this pack
        </a>
      </div>
      {status === 'failed' ? (
        <label className="puff-order__fallback">
          <span>Copying was blocked. Select and copy this instead:</span>
          <textarea readOnly value={summary} rows={6} />
        </label>
      ) : null}
    </aside>
  )
}

function AssetCard({ asset }: { asset: PuffAsset }) {
  return (
    <a className="puff-card" href={`#/puffwork/${asset.slug}`} style={{ '--puff-card-back': asset.colors.back } as CSSProperties}>
      <Art asset={asset} />
      <div className="puff-card__meta">
        <div>
          <h3>{asset.name}</h3>
          <p>
            <MaterialPill material={asset.material} /> {asset.colors.name}
          </p>
        </div>
        <Price value={asset.price} />
      </div>
    </a>
  )
}

function BundleCard({ bundle }: { bundle: PuffBundle }) {
  const [first, second, third] = bundleAssets(bundle)
  const value = bundleValue(bundle)
  return (
    <a className="puff-bundle-card" href={`#/puffwork/bundle/${bundle.slug}`} style={{ '--puff-bundle-accent': bundle.accent } as CSSProperties}>
      <div className="puff-bundle-card__stack" aria-hidden="true">
        {[first, second, third].filter((asset): asset is PuffAsset => Boolean(asset)).map(asset => (
          <Art key={asset.slug} asset={asset} variant="stack" />
        ))}
      </div>
      <div className="puff-bundle-card__body">
        <h3>{bundle.name}</h3>
        <p>{bundle.blurb}</p>
        <div className="puff-bundle-card__foot">
          <Price value={bundle.price} was={value} />
          <span>{bundle.assetSlugs.length} objects</span>
        </div>
      </div>
    </a>
  )
}

function Hero() {
  const floats: { asset: string; className: string }[] = [
    { asset: 'marshmallow-knot', className: 'puff-float--a' },
    { asset: 'jelly-foil', className: 'puff-float--b' },
    { asset: 'velvet-orb', className: 'puff-float--c' },
    { asset: 'glass-ribbon', className: 'puff-float--d' },
    { asset: 'mercury-pod', className: 'puff-float--e' },
    { asset: 'bubblegum-donut', className: 'puff-float--f' },
  ]

  const parallax = (event: PointerEvent<HTMLElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5
    event.currentTarget.style.setProperty('--puff-mx', x.toFixed(3))
    event.currentTarget.style.setProperty('--puff-my', y.toFixed(3))
  }

  return (
    <section className="puff-hero" onPointerMove={parallax} aria-labelledby="puff-hero-title">
      <div className="puff-hero__floats" aria-hidden="true">
        {floats.map(({ asset, className }) => {
          const item = bySlug(asset)
          return item ? (
            <div key={asset} className={`puff-float ${className}`}>
              <Art asset={item} variant="hero" />
            </div>
          ) : null
        })}
      </div>
      <div className="puff-hero__inner">
        <p className="puff-eyebrow">Puffwork · an illustration store by CensorisLabs</p>
        <h1 id="puff-hero-title" className="puff-hero__title">
          Puff<span>work</span>
        </h1>
        <p className="puff-hero__lede">
          Inflatable abstract 3D objects — knit, foil, velvet and glass — that float next to your words instead of shouting over
          them. Twelve packs, three bundles, one honest licence.
        </p>
        <div className="puff-actions">
          <button
            className="puff-btn puff-btn--solid"
            type="button"
            onClick={() => document.getElementById('puff-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Browse the library
          </button>
          <a className="puff-btn puff-btn--ghost" href="#/puffwork/bundle/everything">
            Get the whole set — $189
          </a>
        </div>
        <dl className="puff-hero__stats">
          <div>
            <dt>Objects</dt>
            <dd>12</dd>
          </div>
          <div>
            <dt>Materials</dt>
            <dd>4</dd>
          </div>
          <div>
            <dt>Formats</dt>
            <dd>PNG · SVG · Blend · Loop</dd>
          </div>
          <div>
            <dt>Renewals</dt>
            <dd>None</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

function Store() {
  const [material, setMaterial] = useState<'all' | Material>('all')
  const [color, setColor] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'featured' | 'low' | 'high'>('featured')

  const colors = useMemo(() => {
    const seen = new Map<string, string>()
    for (const asset of ASSETS) seen.set(asset.colors.name, asset.colors.alt)
    return [...seen]
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = ASSETS.filter(asset => {
      if (material !== 'all' && asset.material !== material) return false
      if (color !== 'all' && asset.colors.name !== color) return false
      if (!needle) return true
      return `${asset.name} ${asset.material} ${asset.colors.name} ${asset.tags.join(' ')} ${asset.blurb}`.toLowerCase().includes(needle)
    })
    if (sort === 'low') return [...list].sort((a, b) => a.price - b.price)
    if (sort === 'high') return [...list].sort((a, b) => b.price - a.price)
    return [...list].sort((a, b) => Number(b.featured) - Number(a.featured))
  }, [material, color, query, sort])

  const reset = () => {
    setMaterial('all')
    setColor('all')
    setQuery('')
    setSort('featured')
  }

  return (
    <>
      <Hero />

      <section className="puff-section" id="puff-library" aria-labelledby="puff-library-title">
        <div className="puff-wrap">
          <div className="puff-section__head">
            <div>
              <p className="puff-eyebrow">The library</p>
              <h2 id="puff-library-title">Twelve ways to make a page feel soft</h2>
            </div>
            <p>
              Every object is drawn as a single continuous surface so colours, grain and highlights line up from the thumbnail to a
              4K export. Filter by material, palette or a word.
            </p>
          </div>

          <div className="puff-filters">
            <div className="puff-filter-row" role="group" aria-label="Filter by material">
              <button type="button" className={material === 'all' ? 'is-on' : ''} aria-pressed={material === 'all'} onClick={() => setMaterial('all')}>
                All materials
              </button>
              {MATERIALS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={material === item.id ? 'is-on' : ''}
                  aria-pressed={material === item.id}
                  onClick={() => setMaterial(item.id)}
                  title={item.note}
                >
                  <span className={`puff-dot puff-dot--${item.id}`} aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="puff-filter-row puff-filter-row--colors" role="group" aria-label="Filter by palette">
              <button type="button" className={color === 'all' ? 'is-on' : ''} aria-pressed={color === 'all'} onClick={() => setColor('all')}>
                Any palette
              </button>
              {colors.map(([name, swatch]) => (
                <button
                  key={name}
                  type="button"
                  className={color === name ? 'is-on' : ''}
                  aria-pressed={color === name}
                  onClick={() => setColor(name)}
                >
                  <span className="puff-dot" style={{ background: swatch }} aria-hidden="true" />
                  {name}
                </button>
              ))}
            </div>

            <div className="puff-filter-row puff-filter-row--tools">
              <label className="puff-search">
                <span className="visually-hidden">Search the library</span>
                <input
                  type="search"
                  value={query}
                  placeholder="Search objects, materials, tags…"
                  onChange={event => setQuery(event.target.value)}
                />
              </label>
              <label className="puff-sort">
                <span>Sort</span>
                <select value={sort} onChange={event => setSort(event.target.value as typeof sort)}>
                  <option value="featured">Featured first</option>
                  <option value="low">Price: low to high</option>
                  <option value="high">Price: high to low</option>
                </select>
              </label>
              <p className="puff-count" aria-live="polite">
                {filtered.length} of {ASSETS.length}
              </p>
            </div>
          </div>

          {filtered.length ? (
            <div className="puff-grid">
              {filtered.map(asset => (
                <AssetCard key={asset.slug} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="puff-empty">
              <p>Nothing matches that combination yet.</p>
              <button className="puff-btn puff-btn--ghost" type="button" onClick={reset}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="puff-section puff-section--tint" aria-labelledby="puff-bundles-title">
        <div className="puff-wrap">
          <div className="puff-section__head">
            <div>
              <p className="puff-eyebrow">Bundles</p>
              <h2 id="puff-bundles-title">Buy the family, not the one object</h2>
            </div>
            <p>Bundles are priced below the sum of their parts, and a bundle licence covers every object inside it at once.</p>
          </div>
          <div className="puff-bundles">
            {BUNDLES.map(bundle => (
              <BundleCard key={bundle.slug} bundle={bundle} />
            ))}
          </div>
        </div>
      </section>

      <section className="puff-section" aria-labelledby="puff-licence-title">
        <div className="puff-wrap puff-licence-grid">
          <div>
            <p className="puff-eyebrow">Licensing</p>
            <h2 id="puff-licence-title">Three licences. No renewals. No surprise clauses.</h2>
            <p className="puff-licence-lede">
              The price you see is the price for the licence you pick. Everything below is the whole agreement in plain words — the
              longer version is on each pack page.
            </p>
          </div>
          <div className="puff-licence-cards">
            {LICENCES.map(licence => (
              <article key={licence.id} className="puff-licence-card">
                <h3>{licence.name}</h3>
                <p>{licence.summary}</p>
                <ul>
                  {licence.terms.slice(0, 3).map(term => (
                    <li key={term}>{term}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="puff-cta">
        <div className="puff-wrap puff-cta__inner">
          <h2>Need an object that does not exist yet?</h2>
          <p>Describe the shape, the material and where it has to sit. Custom objects start at $180 and join the library for free.</p>
          <div className="puff-actions">
            <a className="puff-btn puff-btn--solid" href="#/request">
              Request a custom object
            </a>
            <a className="puff-btn puff-btn--ghost" href="#/apps">
              See the software studio
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

function AssetPage({ slug }: { slug: string }) {
  const asset = bySlug(slug)
  const [licence, setLicence] = useState<LicenceId>('commercial')

  if (!asset) return <Missing title="That pack is not in the library" />

  const bundles = assetBundles(asset.slug)
  const related = relatedAssets(asset)

  return (
    <>
      <section className="puff-detail">
        <div className="puff-wrap">
          <nav className="puff-crumbs" aria-label="Breadcrumb">
            <a href="#/puffwork">Puffwork</a>
            <span aria-hidden="true">/</span>
            <span>{asset.category}</span>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{asset.name}</span>
          </nav>

          <div className="puff-detail__grid">
            <div className="puff-detail__visual" style={{ '--puff-art-back': asset.colors.back } as CSSProperties}>
              <Art asset={asset} variant="detail" />
              <div className="puff-detail__visual-meta">
                <MaterialPill material={asset.material} />
                <span>{asset.colors.name}</span>
                <span>{asset.shape}</span>
              </div>
            </div>

            <div className="puff-detail__body">
              <p className="puff-eyebrow">{asset.category} · {asset.material}</p>
              <h1>{asset.name}</h1>
              <p className="puff-detail__lede">{asset.blurb}</p>
              <p className="puff-detail__detail">{asset.detail}</p>

              <div className="puff-tags">
                {asset.tags.map(tag => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>

              <ul className="puff-formats">
                {asset.formats.map(format => (
                  <li key={format}>{format}</li>
                ))}
              </ul>

              <LicencePicker base={asset.price} licence={licence} onChange={setLicence} assetName={asset.name} />

              <OrderPanel name={asset.name} base={asset.price} licence={licence} slug={asset.slug} />

              <div className="puff-actions">
                <button className="puff-btn puff-btn--ghost" type="button" onClick={() => downloadPreview(asset)}>
                  Download preview SVG
                </button>
                <span className="puff-fineprint">Preview only. The licensed pack includes the 4K renders and source scene.</span>
              </div>

              {bundles.length ? (
                <div className="puff-included">
                  <h2>Also in</h2>
                  <div className="puff-included__list">
                    {bundles.map(bundle => (
                      <a key={bundle.slug} href={`#/puffwork/bundle/${bundle.slug}`}>
                        <b>{bundle.name}</b>
                        <span>
                          {bundle.assetSlugs.length} objects · ${bundle.price}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {related.length ? (
        <section className="puff-section puff-section--tint" aria-labelledby="puff-related-title">
          <div className="puff-wrap">
            <div className="puff-section__head">
              <div>
                <p className="puff-eyebrow">Pairs well with</p>
                <h2 id="puff-related-title">Same family, different shape</h2>
              </div>
              <p>Objects that share a material or a category, so a set still feels made together.</p>
            </div>
            <div className="puff-grid">
              {related.map(item => (
                <AssetCard key={item.slug} asset={item} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}

function BundlePage({ slug }: { slug: string }) {
  const bundle = bundleBySlug(slug)
  const [licence, setLicence] = useState<LicenceId>('commercial')
  if (!bundle) return <Missing title="That bundle is not on sale" />
  const assets = bundleAssets(bundle)
  const value = bundleValue(bundle)
  const saving = value - bundle.price

  return (
    <>
      <section className="puff-detail">
        <div className="puff-wrap">
          <nav className="puff-crumbs" aria-label="Breadcrumb">
            <a href="#/puffwork">Puffwork</a>
            <span aria-hidden="true">/</span>
            <span>Bundles</span>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{bundle.name}</span>
          </nav>

          <div className="puff-detail__grid">
            <div className="puff-detail__visual puff-detail__visual--bundle" style={{ '--puff-art-back': bundle.accent } as CSSProperties}>
              <div className="puff-bundle-hero" aria-hidden="true">
                {assets.slice(0, 4).map(asset => (
                  <Art key={asset.slug} asset={asset} variant="bundle" />
                ))}
              </div>
              <div className="puff-detail__visual-meta">
                <span>{assets.length} objects</span>
                <span>One licence covers all</span>
              </div>
            </div>

            <div className="puff-detail__body">
              <p className="puff-eyebrow">Bundle · save ${saving}</p>
              <h1>{bundle.name}</h1>
              <p className="puff-detail__lede">{bundle.blurb}</p>

              <div className="puff-bundle-includes">
                {assets.map(asset => (
                  <a key={asset.slug} href={`#/puffwork/${asset.slug}`}>
                    <span>{asset.name}</span>
                    <span>${asset.price}</span>
                  </a>
                ))}
              </div>
              <p className="puff-fineprint">
                Buying separately: ${value}. As a bundle: ${bundle.price}. You save ${saving}.
              </p>

              <LicencePicker base={bundle.price} licence={licence} onChange={setLicence} assetName={bundle.name} />

              <OrderPanel name={`${bundle.name} bundle`} base={bundle.price} licence={licence} slug={bundle.slug} />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function Missing({ title }: { title: string }) {
  return (
    <section className="puff-detail puff-detail--missing">
      <div className="puff-wrap">
        <p className="puff-eyebrow">Puffwork</p>
        <h1>{title}</h1>
        <p>It may have been renamed. The library has every pack that is currently on sale.</p>
        <a className="puff-btn puff-btn--solid" href="#/puffwork">
          Back to the library
        </a>
      </div>
    </section>
  )
}

export default function Puffwork({ path }: { path?: string }) {
  if (!path) return <Store />
  if (path.startsWith('bundle/')) return <BundlePage slug={path.slice('bundle/'.length)} />
  return <AssetPage slug={path} />
}
