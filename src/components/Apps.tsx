import { useEffect, useState } from 'react'
import { discountedPrice, PRO_PLANS } from '../../apps/shared/pricing.js'
import { getSaleOffer } from '../../apps/shared/offers.js'

type Product = {
  id: string
  name: string
  kind: string
  description: string
  free: string[]
  pro: string[]
}
type ReleaseAsset = { name: string; size: number; browser_download_url: string }
type Release = { tag_name: string; assets: ReleaseAsset[] }

export const PRODUCTS: Product[] = [
  { id: 'arthasetu', name: 'ArthaSetu', kind: 'Personal finance · India', description: 'A private money workspace for Indian households: transactions, budgets, tax estimates, investments, and long-term plans.', free: ['Manual ledger and search', '50/30/20 budget', 'Up to two accounts', 'Basic tax estimate and JSON backup'], pro: ['XIRR and portfolio analysis', 'Loan payoff, tax comparison and FIRE tools', 'Encrypted backup and more accounts', 'Recurring bill tracking'] },
  { id: 'calorie-calculator', name: 'Calorie Calculator', kind: 'Health · Nutrition estimates', description: 'Estimate daily energy needs, BMI, and a simple macro split from your own profile and activity level.', free: ['Mifflin–St Jeor estimate', 'Activity and goal adjustment', 'BMI and macro estimates', 'No account or cloud profile'], pro: ['Private meal log', 'Multiple profiles', 'Seven-day nutrition trends', 'Exportable summaries'] },
  { id: 'pc-part-picker', name: 'PC Part Picker', kind: 'Hardware · Build planning', description: 'Plan a PC build with socket, memory, case, and power checks. Enter local shop prices to compare options.', free: ['Core component selection', 'Basic compatibility checks', 'Estimated power draw', 'Local price entry'], pro: ['Saved build library', 'Side-by-side comparisons', 'Price history and alerts', 'Shareable parts reports'] },
  { id: 'indian-banking-brief', name: 'Indian Banking Brief', kind: 'India · Banking news', description: 'Source-linked banking updates from RBI, SEBI, and selected news feeds, with a local headline cache and scheduled checks while open.', free: ['RBI releases and notifications', 'SEBI updates', 'Local headline cache', 'Links to original publishers'], pro: ['Custom RSS feeds', 'Private topic filters', 'Saved source groups', 'Feed refresh controls'] },
  { id: 'home-energy-estimator', name: 'Home Energy Estimator', kind: 'Home · Electricity planning', description: 'Estimate appliance use and a monthly electricity bill with your own tariff and fixed charges.', free: ['Appliance-by-appliance estimate', 'Editable tariff and billing period', 'Local appliance list', 'No utility sign-in'], pro: ['Saved household scenarios', 'Bill history', 'Seasonal comparisons', 'Detailed reports'] },
  { id: 'muslim-companion', name: 'Nur Companion', kind: 'Muslim daily companion', description: 'Qur’an reading, prayer times, Qibla direction, verse bookmarks, and a private dhikr counter.', free: ['Qur’an reader with credited translation', 'Prayer times and Qibla bearing', 'Local verse bookmarks and dhikr', 'Links to source libraries'], pro: ['Seven-day private reading insights', 'Personal reading history', 'Additional private study tools', 'Religious essentials stay free'] },
  { id: 'social-feed', name: 'Open Social', kind: 'Social · Federated web', description: 'A lightweight Mastodon-compatible public timeline and posting client. Connect to a server you choose.', free: ['Public timeline and server search', 'Post with a session-only token', 'No account required to preview', 'Links to the original server'], pro: ['Saved filters', 'Multiple server profiles', 'Personal feed layout', 'Exportable follows list'] },
  { id: 'archive-explorer', name: 'Archive Explorer', kind: 'Library · Internet Archive', description: 'Search Internet Archive metadata across texts, films, audio, software, and public collections.', free: ['Search titles and subjects', 'Filter by media type', 'Open source item pages', 'Rights information stays with each item'], pro: ['Saved searches', 'Private reading lists', 'Collection alerts', 'Exportable catalog notes'] },
  { id: 'offline-arcade', name: 'Offline Arcade', kind: 'Games · Offline play', description: 'Small casual games that work without a connection after installation: 2048, memory match, and tic-tac-toe.', free: ['Three playable games', 'Local high scores', 'Touch and keyboard controls', 'No ads or sign-in'], pro: ['Extra game packs', 'Custom themes', 'Local tournaments', 'Score history'] },
  { id: 'movie-guide', name: 'Where to Watch', kind: 'Film · Streaming discovery', description: 'Search films and shows, then check reported streaming, rental, and purchase providers by country.', free: ['Title search', 'Country selector', 'Provider and JustWatch links', 'No account required'], pro: ['Saved watchlist', 'Availability alerts', 'Shared household list', 'Viewing history'] },
  { id: 'war-watch', name: 'World Conflict Brief', kind: 'World · Conflict reporting', description: 'Frequently refreshed, source-linked coverage of conflicts and humanitarian developments from GDELT-monitored online news.', free: ['World conflict headline search', 'Two-minute refresh while open', 'Topic filters', 'Direct publisher links'], pro: ['Saved regions and topics', 'Custom source groups', 'Private reading list', 'Alert preferences'] },
]

const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024

function ProductCard({ product }: { product: Product }) {
  return <article className="suite-card"><div className="suite-card__top"><span className="suite-card__kind">{product.kind}</span><span className="suite-card__badge">Release builds</span></div><h3>{product.name}</h3><p>{product.description}</p><a className="suite-card__link" href={`#/apps/${product.id}`}>View app and downloads <span aria-hidden="true">↗</span></a></article>
}

function Pricing({ discount = 0 }: { discount?: number }) {
  return <div className="suite-pricing" aria-label="Shared CensorisLabs Pro pricing">{PRO_PLANS.map(plan => <article className="suite-plan" key={plan.id}><h4>{plan.name}</h4><strong>{discount ? <>{discountedPrice(plan.price, discount)} <del>{plan.price}</del></> : plan.price}</strong><span>{discount ? '10% timed sale · checkout confirmation required' : plan.note}</span></article>)}</div>
}

function useRelease(appId?: string) {
  const [release, setRelease] = useState<ReleaseAsset[] | null>(null)
  const [tag, setTag] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle')
  useEffect(() => {
    if (!appId) return
    let alive = true
    setState('loading')
    fetch('https://api.github.com/repos/CensorisLabs/censorislabs-landing/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(response => { if (!response.ok) throw new Error(`Release lookup returned ${response.status}`); return response.json() as Promise<Release> })
      .then(data => { if (alive) { setTag(data.tag_name || ''); setRelease(Array.isArray(data.assets) ? data.assets : []); setState(data.assets?.length ? 'ready' : 'empty') } })
      .catch(() => { if (alive) setState('error') })
    return () => { alive = false }
  }, [appId])
  return { release, tag, state }
}

function Downloads({ appId }: { appId: string }) {
  const { release, tag, state } = useRelease(appId)
  const asset = (platform: 'windows' | 'android') => release?.find(item => item.name.toLowerCase() === `${appId}-${platform}.${platform === 'windows' ? 'exe' : 'apk'}`)
  const windows = asset('windows'), android = asset('android')
  const valid = (item?: ReleaseAsset) => item && item.size > 0 && item.size <= MAX_DOWNLOAD_BYTES
  const link = (item: ReleaseAsset | undefined, label: string) => valid(item)
    ? <a className="btn btn--outline" href={item!.browser_download_url} rel="noreferrer">{label} · {(item!.size / 1024 / 1024).toFixed(1)} MB</a>
    : <button className="btn btn--outline" type="button" disabled>{label}</button>
  const status = state === 'loading' ? 'Checking the latest release…'
    : state === 'ready' && (valid(windows) || valid(android)) ? `Latest release ${tag} · each listed installer is under 100 MB.`
      : state === 'ready' && release?.length ? 'Release files exceed the 100 MB limit or do not match this app.'
        : state === 'error' ? 'The release service is unavailable; try again later.'
          : 'No installer has been published yet. Downloads activate after a successful release build.'
  return <div className="suite-download-card"><div><p className="eyebrow">WINDOWS + ANDROID</p><h2>App downloads</h2><p>{status}</p></div><div className="suite-downloads">{link(windows, 'Windows (.exe)')}{link(android, 'Android (.apk)')}</div></div>
}

function InstallWarning() {
  return <aside className="suite-warning" aria-labelledby="install-warning-title">
    <p className="eyebrow">BEFORE YOU INSTALL</p>
    <h2 id="install-warning-title">Why does my device show a warning?</h2>
    <p className="suite-warning__lede">These warnings do not mean the app was flagged as harmful. They appear because CensorisLabs installers are downloaded directly from GitHub releases instead of the Microsoft Store or Google Play, and our publisher identity is new, so Windows and Android do not recognise it yet. Your device shows the same prompt for any installer it has not seen enough of.</p>
    <div className="suite-feature-columns">
      <article className="suite-feature-card">
        <p className="eyebrow">WINDOWS</p>
        <h3>“Windows protected your PC”</h3>
        <p>SmartScreen shows this for installers from publishers it has no history with. The Windows installer is not signed with a paid code-signing certificate yet, so the publisher is listed as unknown.</p>
        <ol>
          <li>Click <b>More info</b> on the blue screen.</li>
          <li>Check that the file name matches the app you downloaded.</li>
          <li>Click <b>Run anyway</b>.</li>
        </ol>
      </article>
      <article className="suite-feature-card">
        <p className="eyebrow">ANDROID</p>
        <h3>Unknown apps and Play Protect</h3>
        <p>Android warns about any APK that does not come from Google Play. The APK is signed with the CensorisLabs release key, but Play Protect has not seen it before.</p>
        <ol>
          <li>If your browser says the file may be harmful, choose <b>Download anyway</b> or <b>Keep</b>.</li>
          <li>When asked, allow your browser or file manager to <b>Install unknown apps</b>. You can turn this off again afterwards.</li>
          <li>If Play Protect calls the app unrecognised, tap <b>More details</b>, then <b>Install anyway</b>.</li>
        </ol>
      </article>
    </div>
    <p className="suite-checkout-note">Only install files downloaded from this page or the official CensorisLabs GitHub releases. If an installer came from anywhere else, do not run it. Exact wording differs slightly between Windows and Android versions.</p>
  </aside>
}

export default function Apps({ appId }: { appId?: string }) {
  const selected = PRODUCTS.find(product => product.id === appId)
  const sale = getSaleOffer()
  if (appId && selected) return <section className="section suite-page" aria-labelledby="suite-page-title"><div className="container"><a className="suite-back" href="#/apps">← All apps</a><div className="suite-detail-head"><p className="eyebrow">CENSORISLABS APP SUITE · {selected.kind}</p><span className="suite-card__badge">Windows + Android releases</span></div><h1 className="suite-page-title" id="suite-page-title">{selected.name}</h1><p className="suite-lede">{selected.description}</p><div className="suite-feature-columns"><article className="suite-feature-card"><p className="eyebrow">FREE</p><h2>Start with the essentials</h2><ul>{selected.free.map(feature => <li key={feature}>{feature}</li>)}</ul></article><article className="suite-feature-card suite-feature-card--pro"><p className="eyebrow">PRO</p><h2>More room to grow</h2><ul>{selected.pro.map(feature => <li key={feature}>{feature}</li>)}</ul></article></div><div className="suite-pricing-head"><div><p className="eyebrow">ONE SHARED PRO FORMAT</p><h2>Choose your plan</h2></div><p>Use offers unlock at 15 and 30 app actions. Checkout must validate discount eligibility.</p></div><Pricing discount={sale?.percent} />{sale && <div className="suite-offer-note"><b>Timed sale · 10% off</b><span>Event {sale.eventId}. The amount shown is a preview; checkout must validate the code.</span></div>}<div className="suite-offer-note"><b>Use more, save more</b><span>10% after 15 uses · 15% after 30 uses · first 1,000 verified customers get 30% off. Offers are not redeemable until checkout is connected.</span></div><p className="suite-checkout-note">Checkout and account-wide offer allocation are not connected yet. No payment is processed on this site.</p><Downloads appId={selected.id} /><InstallWarning /></div></section>

  return <section className="section suite-directory" id="apps" aria-labelledby="suite-title"><div className="container"><div className="suite-directory__head"><div><p className="eyebrow">The CensorisLabs app suite</p><h2 className="section-title" id="suite-title">Useful tools, built to stay yours</h2></div><p className="section-lede">Ten focused companions alongside ArthaSetu. The site publishes verified Windows and Android installers from the release pipeline as soon as they are available.</p></div><div className="suite-grid">{PRODUCTS.map(product => <ProductCard key={product.id} product={product} />)}</div><div className="suite-pricing-head"><div><p className="eyebrow">ONE PRICE FORMAT ACROSS THE SUITE</p><h2>Four ways to go Pro</h2></div><p>Shared plans, use-based coupons, and first-1,000 offers are subject to checkout confirmation.</p></div><Pricing discount={sale?.percent} />{sale && <div className="suite-offer-note"><b>Timed sale · 10% off</b><span>Event {sale.eventId}. The displayed price is a preview until checkout is configured.</span></div>}<div className="suite-offer-note"><b>Offers across every app</b><span>15 uses unlock a 10% coupon; 30 uses unlock a 15% coupon. The first 1,000 verified accounts get 30% off.</span></div><p className="suite-checkout-note">Installers are published from versioned GitHub releases and only shown here when the asset exists and is under 100 MB. Push the source updates, then publish a version tag to build the files.</p><p className="suite-checkout-note">Windows or Android may show an “unknown publisher” warning the first time you install. It is expected for direct downloads, and each app page explains why and how to continue.</p></div></section>
}
