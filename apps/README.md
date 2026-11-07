# CensorisLabs app source

The suite contains ArthaSetu and eleven independent companion apps. App source, common UI, price rules, coupon thresholds, and Android/Windows build scripts are in this repository.

## Catalog

| App | App ID | What it does | Network use |
| --- | --- | --- | --- |
| ArthaSetu | `arthasetu` | Offline-first Indian personal finance, budgeting, tax estimates, investments and planning | Optional bank feeds are not connected; local data stays on device |
| AbsoluteCal | `calorie-calculator` | Fully free, local health tracker for meal logging, activity, sleep, hydration, body trends, manual vitals and Health Connect import | Optional Open Food Facts lookup and Android Health Connect read access; data stays on-device |
| PC Part Picker | `pc-part-picker` | Local component selection and basic compatibility checks | None |
| Indian Banking Brief | `indian-banking-brief` | RBI/SEBI updates and source-linked news with two-hour foreground checks | RSS and publisher links |
| Home Energy Estimator | `home-energy-estimator` | Appliance energy and electricity cost estimates | None |
| Nur Companion | `muslim-companion` | Qur’an reader, prayer-time lookup, Qibla bearing, bookmarks and dhikr | AlQuran Cloud and AlAdhan; links to Quran.com, Sunnah.com and QuranEnc |
| Open Social | `social-feed` | Public timeline, search, posts, likes and boosts for Mastodon-compatible servers | Chosen server; an optional token stays in memory only |
| Archive Explorer | `archive-explorer` | Internet Archive catalog search, type filters and item links | Internet Archive Advanced Search API |
| Offline Arcade | `offline-arcade` | 2048, memory match and tic-tac-toe | None after install |
| Where to Watch | `movie-guide` | Movie/show search and regional streaming-provider discovery | JustWatch search links; TMDB provider API only after CensorisLabs has a commercial license |
| World Conflict Brief | `war-watch` | Conflict and humanitarian news headlines with publisher links | GDELT DOC 2.0, refresh every two minutes while the app is open |
| Reading Tracker | `reading-tracker` | Private bookshelves, difficulty-based daily reading plans, calendar, timer, notes, highlights, a buddy, and on-device cover OCR with a book-match confirmation | Cover OCR runs locally; only the extracted title/ISBN is sent to Google Books or Open Library after you request a lookup |

Third-party news and provider lists can be incomplete or delayed. Source links remain visible; the apps do not claim coverage of every publisher or immediate alerts while closed. Qur’an translations keep their source attribution. This repository does not mirror entire third-party libraries.

## Shared design, offers, and licenses

`shared/shell.js` and `shared/polish.css` give companion apps four themes, low-end mode, glass card styling, and the use-based offer meter. `shared/pricing.js` is the single source for ₹69 monthly, ₹299 yearly, ₹499 early-bird lifetime, and ₹999 standard lifetime plans. `shared/offers.js` unlocks a 10% coupon at 15 recorded app actions and a 15% coupon at 30; it chooses one eight-hour 10% sale window in each UTC week.

Use counts are local to each app installation and can be cleared by the user. First-1,000-user 30% eligibility needs a server-side customer counter. Checkout, billing, refunds, and license issuance are not connected, so the UI shows offers as pending checkout verification and does not take payment or activate an unverified purchase.

The public key `VITE_LICENSE_PUBLIC_KEY` verifies signed suite tokens on device. Never commit the private signing key. The release workflow reads `LICENSE_PUBLIC_KEY` from GitHub Actions secrets.

## Builds and size limit

Every app has `npm run build`, `npm run android:build`, and `npm run windows:build`. App source is separate; the root Vite site is the Vercel deployment. For release builds:

Reading Tracker provides `npm run build`, `npm run publish:web` and `npm run android:build`. Its Android build adds a native home-screen widget. The web app is copied to the site at `/reading-tracker/`.

AbsoluteCal (release asset slug `calorie-calculator`) is fully free with no Pro tier. It keeps profiles, meal and health records on-device, and supports manual food entry, recipes, meal plans, workout logs, sleep, hydration, weight trends, user-entered vitals, Android Health Connect read-only imports, Android local reminders, on-device lab-report OCR suggestions, and JSON/CSV exports. Barcode lookup contacts Open Food Facts only when requested. Estimates and OCR are informational and must be checked. Apple Health, Garmin, Strava, Oura, CGMs, ECG/EDA sensors, remote AI food recognition, and clinical services are not connected in this build.

Reading Tracker cover recognition uses Tesseract.js in the app. Its first OCR run needs an internet connection to fetch the OCR worker and English language data; the cover image is processed on-device and is never sent to the book catalog APIs.

1. Install Node.js 22. Android signing also needs JDK 17 and the Android SDK; Windows packaging runs on a Windows GitHub Actions runner.
2. Add `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEYSTORE_PASSWORD`, and `ANDROID_KEY_PASSWORD` to GitHub Actions secrets for signed APKs.
3. Push a semantic tag such as `v1.0.0` to run `.github/workflows/release-apps.yml`.
4. The workflow uploads `<app-id>-android.apk` and `<app-id>-windows.exe` release assets and fails before publishing if any is over 100 MB.

Local Android builds without a release keystore produce a debug APK. The release workflow requires the configured signing keystore. Windows EXEs are portable and unsigned until a code-signing certificate is configured. The site reads the latest GitHub release and enables only matching assets below the 100 MB limit.

## External data requirements

- **Where to Watch:** TMDB says its free developer API is for non-commercial use, requires attribution and an approved logo, and commercial projects should obtain a commercial license. The app includes attribution and keeps provider API mode disabled until configured. Watch-provider results are sourced with JustWatch and are not exhaustive. Do not set `VITE_TMDB_COMMERCIAL_LICENSE=true` before CensorisLabs receives the commercial license.
- **World Conflict Brief:** uses GDELT's online news index, not a full list of all reporting outlets. The two-minute cadence runs only while open; there is no push service.
- **Open Social:** is a Mastodon-compatible ActivityPub client, not a client for X. Public timeline and status search availability vary by server.
