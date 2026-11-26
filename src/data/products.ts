/**
 * The app suite catalogue. Kept apart from the components so the sitemap
 * generator and the reviews form can read it without JSX.
 */

export type Product = {
  id: string
  name: string
  kind: string
  description: string
  free: string[]
  pro?: string[]
  freeOnly?: boolean
}
type ReleaseAsset = { name: string; size: number; browser_download_url: string }
type Release = { tag_name: string; assets: ReleaseAsset[]; body?: string; published_at?: string }

export const PRODUCTS: Product[] = [
  { id: 'arthasetu', name: 'ArthaSetu', kind: 'Personal finance · India', description: 'A private money workspace for Indian households: transactions, budgets, tax estimates, investments, and long-term plans.', free: ['Manual ledger with date, type and account pickers, plus month filtering', 'Duplicate transactions, split them across categories, repeat them monthly and export CSV', 'Bank statement CSV import with category suggestions and merchant rules', '50/30/20 budget', 'Unlimited local accounts', 'Basic tax estimate and JSON backup'] },
  { id: 'calorie-calculator', name: 'AbsoluteCal', kind: 'Health · Personal food and activity tracker', description: 'A free, device-first health tracker for meals, movement, sleep, body trends and personal health notes. Every feature is free, permanently, with no Pro tier or account.', free: ['Food diary, custom foods, recipes, templates and meal plans', 'Recently logged foods for one-tap repeat logging', 'On-device camera barcode scanning and manual nutrition entries',
    'Offline branded barcode catalogue plus a foods CSV importer',
    'Import a MyFitnessPal diary or Apple Health CSV', 'Steps, workouts, strength sets and rest timer', 'GPS walk and run tracking with an on-device route map', 'Sleep, hydration, weight, mood and health logs',
    'Water and meal reminders that fire while the app is closed (Android)', 'Tools page with 100+ derived stats, trends and data checks', 'Local lab report OCR suggestions and review', 'Vitals log: blood pressure, pulse, glucose, SpO2, temperature and breathing rate', 'Medication tick-list with 7-day adherence', 'Symptom diary with severity and notes', '7-day step summary with goal days and active minutes', 'Free forever: no Pro version, upgrade, subscription or account'], freeOnly: true },
  { id: 'pc-part-picker', name: 'PC Part Picker', kind: 'Hardware · Build planning', description: 'Plan a PC build with socket, memory, case, and power checks. Enter local shop prices to compare options.', free: ['Core component selection', 'Basic compatibility checks', 'Estimated power draw', 'Local price entry', 'Saved build library with load and delete', 'Copyable parts list for sharing'] },
  { id: 'indian-banking-brief', name: 'Indian Banking Brief', kind: 'India · Banking news', description: 'Source-linked banking updates from RBI, SEBI, and selected news feeds, with a local headline cache and scheduled checks while open.', free: ['RBI releases and notifications', 'SEBI updates', 'Add your own RSS or Atom feeds', 'Save headlines and filter the feed', 'Local headline cache and publisher links'] },
  { id: 'home-energy-estimator', name: 'Home Energy Estimator', kind: 'Home · Electricity planning', description: 'Estimate appliance use and a monthly electricity bill with your own tariff and fixed charges.', free: ['Appliance-by-appliance estimate', 'Common-appliance presets for faster entry', 'Editable tariff and billing period', 'Local appliance list', 'No utility sign-in'] },
  { id: 'muslim-companion', name: 'Nur Companion', kind: 'Muslim daily companion', description: 'Qur’an reading, prayer times, Qibla direction, verse bookmarks, and a private dhikr counter.', free: ['Qur’an reader with credited translation', 'Prayer times and Qibla bearing', 'Local verse bookmarks and surah reading rhythm', 'Dhikr counter with 33/100/500/1000 targets', 'Links to source libraries'] },
  { id: 'social-feed', name: 'Open Social', kind: 'Social · Federated web', description: 'A lightweight Mastodon-compatible public timeline and posting client. Connect to a server you choose.', free: ['Public timeline and server search', 'Post with a session-only token', 'Character counter and draft autosave', 'Remembers your server, never your token', 'Links to the original server'] },
  { id: 'archive-explorer', name: 'Archive Explorer', kind: 'Library · Internet Archive', description: 'Search Internet Archive metadata across texts, films, audio, software, and public collections.', free: ['Search titles and subjects', 'Filter by media type', 'Save items and copy your saved list', 'Recent searches on this device', 'Rights information stays with each item'] },
  { id: 'offline-arcade', name: 'Offline Arcade', kind: 'Games · Offline play', description: 'Small casual games that work without a connection after installation: 2048, memory match, and tic-tac-toe.', free: ['Three playable games', '2048 undo and resume', 'Local high scores', 'Touch and keyboard controls', 'No ads or sign-in'] },
  { id: 'movie-guide', name: 'Where to Watch', kind: 'Film · Streaming discovery', description: 'Search a curated catalogue of films and shows on your device, keep a watchlist, and open the current streaming, rent or buy options on JustWatch for your country.', free: ['Curated offline catalogue with genre filters', 'Watchlist and surprise picker', 'Country-specific JustWatch links', 'No API key, account or sign-in'] },
  { id: 'war-watch', name: 'World Conflict Brief', kind: 'World · Conflict reporting', description: 'Frequently refreshed, source-linked coverage of conflicts and humanitarian developments from GDELT-monitored online news.', free: ['World conflict headline search', 'Two-minute refresh while open', 'Saved stories and remembered topic', 'Direct publisher links'] },
  { id: 'reading-tracker', name: 'Reading Tracker', kind: 'Books · Personal reading', description: 'A private, offline-first reading companion with a day-by-day plan, reading calendar, session timer, notes, highlights, goals, and an Android home-screen widget. Every feature is free, with no Pro version or subscription.', free: ['Personal bookshelves with tags, ratings and filters', 'Goodreads library CSV import', 'Cover-photo text recognition and book-match confirmation', 'Reading plans, monthly calendar, session log and timer', 'Private notes, page highlights and book reviews', 'Reading buddy, streaks and reading goals', 'Android home-screen widget for your current read', 'CSV exports plus encrypted, restorable backups', 'Your library stays on this device; no account or cloud sync'], freeOnly: true },
]
