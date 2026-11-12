import { useEffect, useState } from 'react'

type Product = {
  id: string
  name: string
  kind: string
  description: string
  free: string[]
  pro: string[]
  freeOnly?: boolean
}
type ReleaseAsset = { name: string; size: number; browser_download_url: string }
type Release = { tag_name: string; assets: ReleaseAsset[] }

export const PRODUCTS: Product[] = [
  { id: 'arthasetu', name: 'ArthaSetu', kind: 'Personal finance · India', description: 'A private money workspace for Indian households: transactions, budgets, tax estimates, investments, and long-term plans.', free: ['Manual ledger and search', '50/30/20 budget', 'Up to two accounts', 'Basic tax estimate and JSON backup'], pro: ['XIRR and portfolio analysis', 'Loan payoff, tax comparison and FIRE tools', 'Encrypted backup and more accounts', 'Recurring bill tracking'] },
  { id: 'calorie-calculator', name: 'AbsoluteCal', kind: 'Health · Personal food and activity tracker', description: 'A free, device-first health tracker for meals, movement, sleep, body trends and personal health notes, with optional Android Health Connect import. Every feature is free, permanently, with no Pro tier or account.', free: ['Food diary, custom foods, recipes, templates and meal plans', 'Barcode lookup and manual nutrition entries', 'Steps, workouts, strength sets and rest timer', 'GPS walk and run tracking with an on-device route map', 'Sleep, hydration, weight, mood and health logs', 'Tools page with 100+ derived stats, trends and data checks', 'Optional Android Health Connect read-only sync', 'Local lab report OCR suggestions and review', 'Vitals log: blood pressure, pulse, glucose, SpO2, temperature and breathing rate', 'Medication tick-list with 7-day adherence', 'Symptom diary with severity and notes', '7-day step summary with goal days and active minutes', 'Free forever: no Pro version, upgrade, subscription or account'], pro: [], freeOnly: true },
  { id: 'pc-part-picker', name: 'PC Part Picker', kind: 'Hardware · Build planning', description: 'Plan a PC build with socket, memory, case, and power checks. Enter local shop prices to compare options.', free: ['Core component selection', 'Basic compatibility checks', 'Estimated power draw', 'Local price entry'], pro: ['Saved build library', 'Side-by-side comparisons', 'Price history and alerts', 'Shareable parts reports'] },
  { id: 'indian-banking-brief', name: 'Indian Banking Brief', kind: 'India · Banking news', description: 'Source-linked banking updates from RBI, SEBI, and selected news feeds, with a local headline cache and scheduled checks while open.', free: ['RBI releases and notifications', 'SEBI updates', 'Local headline cache', 'Links to original publishers'], pro: ['Custom RSS feeds', 'Private topic filters', 'Saved source groups', 'Feed refresh controls'] },
  { id: 'home-energy-estimator', name: 'Home Energy Estimator', kind: 'Home · Electricity planning', description: 'Estimate appliance use and a monthly electricity bill with your own tariff and fixed charges.', free: ['Appliance-by-appliance estimate', 'Editable tariff and billing period', 'Local appliance list', 'No utility sign-in'], pro: ['Saved household scenarios', 'Bill history', 'Seasonal comparisons', 'Detailed reports'] },
  { id: 'muslim-companion', name: 'Nur Companion', kind: 'Muslim daily companion', description: 'Qur’an reading, prayer times, Qibla direction, verse bookmarks, and a private dhikr counter.', free: ['Qur’an reader with credited translation', 'Prayer times and Qibla bearing', 'Local verse bookmarks and dhikr', 'Links to source libraries'], pro: ['Seven-day private reading insights', 'Personal reading history', 'Additional private study tools', 'Religious essentials stay free'] },
  { id: 'social-feed', name: 'Open Social', kind: 'Social · Federated web', description: 'A lightweight Mastodon-compatible public timeline and posting client. Connect to a server you choose.', free: ['Public timeline and server search', 'Post with a session-only token', 'No account required to preview', 'Links to the original server'], pro: ['Saved filters', 'Multiple server profiles', 'Personal feed layout', 'Exportable follows list'] },
  { id: 'archive-explorer', name: 'Archive Explorer', kind: 'Library · Internet Archive', description: 'Search Internet Archive metadata across texts, films, audio, software, and public collections.', free: ['Search titles and subjects', 'Filter by media type', 'Open source item pages', 'Rights information stays with each item'], pro: ['Saved searches', 'Private reading lists', 'Collection alerts', 'Exportable catalog notes'] },
  { id: 'offline-arcade', name: 'Offline Arcade', kind: 'Games · Offline play', description: 'Small casual games that work without a connection after installation: 2048, memory match, and tic-tac-toe.', free: ['Three playable games', 'Local high scores', 'Touch and keyboard controls', 'No ads or sign-in'], pro: ['Extra game packs', 'Custom themes', 'Local tournaments', 'Score history'] },
  { id: 'movie-guide', name: 'Where to Watch', kind: 'Film · Streaming discovery', description: 'Search films and shows, then check reported streaming, rental, and purchase providers by country.', free: ['Title search', 'Country selector', 'Provider and JustWatch links', 'No account required'], pro: ['Saved watchlist', 'Availability alerts', 'Shared household list', 'Viewing history'] },
  { id: 'war-watch', name: 'World Conflict Brief', kind: 'World · Conflict reporting', description: 'Frequently refreshed, source-linked coverage of conflicts and humanitarian developments from GDELT-monitored online news.', free: ['World conflict headline search', 'Two-minute refresh while open', 'Topic filters', 'Direct publisher links'], pro: ['Saved regions and topics', 'Custom source groups', 'Private reading list', 'Alert preferences'] },
  { id: 'reading-tracker', name: 'Reading Tracker', kind: 'Books · Personal reading', description: 'A private, offline-first reading companion with a day-by-day plan, reading calendar, session timer, notes, highlights, goals, and an Android home-screen widget. Every feature is free, with no Pro version or subscription.', free: ['Personal bookshelves with tags, ratings and filters', 'Cover-photo text recognition and book-match confirmation', 'Reading plans, monthly calendar, session log and timer', 'Private notes, page highlights and book reviews', 'Reading buddy, streaks and reading goals', 'Android home-screen widget for your current read', 'CSV exports plus encrypted, restorable backups', 'Your library stays on this device; no account or cloud sync'], pro: [], freeOnly: true },
]


const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024

function ProductCard({ product }: { product: Product }) {
  return <article className="suite-card"><div className="suite-card__top"><span className="suite-card__kind">{product.kind}</span><span className="suite-card__badge">Free · every feature included</span></div><h3>{product.name}</h3><p>{product.description}</p><a className="suite-card__link" href={`#/apps/${product.id}`}>View app and downloads <span aria-hidden="true">↗</span></a></article>
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
  const readingTracker = appId === 'reading-tracker'
  const readingTrackerApk = 'https://github.com/CensorisLabs/censorislabs-landing/releases/latest/download/reading-tracker-android.apk'
  // Direct release paths keep the download visible even when the GitHub API is
  // rate limited or unavailable on the visitor's network.
  const directApk = `https://github.com/CensorisLabs/censorislabs-landing/releases/latest/download/${appId}-android.apk`
  const asset = (platform: 'windows' | 'android') => release?.find(item => item.name.toLowerCase() === `${appId}-${platform}.${platform === 'windows' ? 'exe' : 'apk'}`)
  const windows = readingTracker ? undefined : asset('windows'), android = asset('android')
  const matchingAssets = release?.filter(item => item.name.toLowerCase() === `${appId}-android.apk` || (appId !== 'reading-tracker' && item.name.toLowerCase() === `${appId}-windows.exe`)) || []
  const valid = (item?: ReleaseAsset) => item && item.size > 0 && item.size <= MAX_DOWNLOAD_BYTES
  const link = (item: ReleaseAsset | undefined, label: string, fallback?: string) => valid(item)
    ? <a className="btn btn--outline" href={item!.browser_download_url} rel="noreferrer">{label} · {(item!.size / 1024 / 1024).toFixed(1)} MB</a>
    // A direct release path is offered only when the API lookup failed, so a
    // genuinely missing installer still shows as unavailable instead of a 404.
    : fallback && (readingTracker || state === 'error' || state === 'idle') ? <a className="btn btn--outline" href={fallback} rel="noreferrer">{label}</a>
    : <button className="btn btn--outline" type="button" disabled>{label}</button>
  const status = readingTracker ? valid(android) ? `Signed Android APK available · ${tag}.` : 'Signed Android APK available to download below.'
    : state === 'loading' ? 'Checking the latest release…'
    : state === 'ready' && (valid(windows) || valid(android)) ? `Latest release ${tag} · each listed installer is under 100 MB.`
      : state === 'ready' && matchingAssets.length ? 'A matching installer exists but exceeds the 100 MB download limit.'
        : state === 'ready' && release?.length ? 'No matching installer has been published for this app yet.'
        : state === 'error' ? 'The release service is unavailable; try again later.'
          : 'No installer has been published yet. Downloads activate after a successful release build.'
  return <div className="suite-download-card"><div><p className="eyebrow">{readingTracker ? 'ANDROID' : 'WINDOWS + ANDROID'}</p><h2>App downloads</h2><p>{status}</p></div><div className="suite-downloads">{!readingTracker && link(windows, 'Windows (.exe)')}{link(android, 'Android (.apk)', readingTracker ? readingTrackerApk : directApk)}</div></div>
}

function InstallWarning({ androidOnly = false }: { androidOnly?: boolean }) {
  return <aside className="suite-warning" aria-labelledby="install-warning-title">
    <p className="eyebrow">BEFORE YOU INSTALL</p>
    <h2 id="install-warning-title">Why does my device show a warning?</h2>
    <p className="suite-warning__lede">These warnings do not mean the app was flagged as harmful. They appear because CensorisLabs installers are downloaded directly from GitHub releases instead of the Microsoft Store or Google Play, and our publisher identity is new, so Windows and Android do not recognise it yet. Your device shows the same prompt for any installer it has not seen enough of.</p>
    <div className="suite-feature-columns">
      {!androidOnly && <article className="suite-feature-card">
        <p className="eyebrow">WINDOWS</p>
        <h3>“Windows protected your PC”</h3>
        <p>SmartScreen shows this for installers from publishers it has no history with. The Windows installer is not signed with a paid code-signing certificate yet, so the publisher is listed as unknown.</p>
        <ol>
          <li>Click <b>More info</b> on the blue screen.</li>
          <li>Check that the file name matches the app you downloaded.</li>
          <li>Click <b>Run anyway</b>.</li>
        </ol>
      </article>}
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
  if (appId && selected) {
    const readingTracker = selected.id === 'reading-tracker'
    const features = [...selected.free, ...selected.pro]
    return <section className="section suite-page" aria-labelledby="suite-page-title"><div className="container">
      <a className="suite-back" href="#/apps">← All apps</a>
      <div className="suite-detail-head"><p className="eyebrow">CENSORISLABS APP SUITE · {selected.kind}</p><span className="suite-card__badge">Free · every feature included</span></div>
      <h1 className="suite-page-title" id="suite-page-title">{selected.name}</h1><p className="suite-lede">{selected.description}</p>
      <div className="suite-feature-columns suite-feature-columns--free-only">
        <article className="suite-feature-card"><p className="eyebrow">EVERYTHING IS INCLUDED</p><h2>No subscription, no account, no lockouts</h2><ul>{features.map(feature => <li key={feature}>{feature}</li>)}</ul><p className="suite-checkout-note">Every feature in {selected.name} is free forever. There is no Pro tier, upgrade, trial, or payment anywhere in the app.</p></article>
      </div>
      {readingTracker && <div className="suite-download-card"><div><p className="eyebrow">OPEN IN YOUR BROWSER</p><h2>Use Reading Tracker</h2><p>Your books and notes stay in this browser on this device.</p></div><div className="suite-downloads"><a className="btn btn--outline" href="/reading-tracker/">Open Reading Tracker</a></div></div>}
      <Downloads appId={selected.id} /><InstallWarning androidOnly={readingTracker} />
    </div></section>
  }

  return <section className="section suite-directory" id="apps" aria-labelledby="suite-title"><div className="container"><div className="suite-directory__head"><div><p className="eyebrow">The CensorisLabs app suite</p><h2 className="section-title" id="suite-title">Useful tools, built to stay yours</h2></div><p className="suite-lede">Every app is free, with every feature included. No subscriptions, upgrades, accounts, or trials. The site publishes verified Windows and Android installers from the release pipeline as soon as they are available.</p></div><div className="suite-grid">{PRODUCTS.map(product => <ProductCard key={product.id} product={product} />)}</div><p className="suite-checkout-note">Installers are published from versioned GitHub releases and only shown here when the asset exists and is under 100 MB. Windows or Android may show an “unknown publisher” warning the first time you install; each app page explains why and how to continue.</p></div></section>
}
