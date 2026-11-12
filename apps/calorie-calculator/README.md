# kcal — Calorie Tracker

A private, offline-first calorie, food, macro and habit tracker for Android, Windows and the web. kcal is part of the CensorisLabs suite: all data stays on the device, in `localStorage` under `censoris-kcal-v2`, with no accounts, no sync and no network calls.

Version **2.8.0**.

## Features

**Tools & insights**
- 42 offline calculators (BMI, BMR, TDEE, body fat, macros, MET burn, one-rep max, recipe scaling, units and more) that recalculate as you type.
- 61 insight cards computed from your own diary, weight log and wellbeing entries — energy balance, macro quality, body trend, habits and food timing.

**Daily tracking**
- Today dashboard with calorie ring, remaining budget and net balance (eaten − target + burned).
- Macro rings and chips for carbs, fat and protein: target vs eaten, per meal and per day.
- Meal-by-meal logging (breakfast, lunch, dinner, snacks) with subtotals and per-meal macros.
- Water logger with a ring, carry-over from the previous day, quick-add (100/250/500 ml or custom) and a weekly chart.
- Weight logger with trend arrow, quick-add dialog, recent history and a 7-day smoothed trend.
- Exercise logging with MET-based burn, a suggestion engine, and a calories-burned panel.
- Wellbeing check-in: sleep, caffeine, mood, energy and hunger — stored against the day you are viewing.

**Steps and movement**
- Ring, streak and a daily step goal (default 8,000, presets up to 20,000).
- One shared burn engine (`src/lib/movement.js`) used by Today, Progress, Insights, the Studio calculators and the exercise dialog, so every screen reports the same number.
- Distance from stride (measured or derived from height: 41.3% of height for women, 41.5% for men), walking time from cadence, and calories from the ACSM walking equation (VO₂ = 0.1 × speed in m/min + 3.5).
- Calories are **active**, not gross: the resting metabolism your daily target already contains is subtracted, so movement credit cannot double-count your BMR.
- Double-count guards: steps inside a logged walk or run are covered by that session, and the everyday steps implied by your activity level (3,000–15,000 depending on the multiplier) are already in your TDEE, so only steps beyond them are credited.
- Steps setup dialog (Today, Progress and More) for goal, cadence, measured stride and the step-credit switch, with a live preview.
- Android `TYPE_STEP_COUNTER` sensor bridge: delta-based counting that survives app restarts within a day, day rollover, and reboots (activity-recognition permission).
- "Sync device steps" keeps a larger manual entry for the day instead of overwriting it.
- Progress page shows a 14-day steps card with average, best day, distance and step credit; Insights adds distance, credit and assumed pace readings.

**Food, planning and records**
- Food database with portions, grams, net carbs and glycemic-load helpers.
- Balanced plate suggestions that adapt to the meal and your remaining targets, with 1-tap portion logging.
- Meal planner week grid, copy/clear day, and planned-vs-logged adherence.
- Meal history across the last 7 days with jump-to-day.
- Calendar month view with logged-day dots, per-day kcal and score, and streaks.
- Photo-based estimation flow in Studio: pick/take a photo, estimate the components, then log the result.
- Profile stats, BMR/TDEE summary, diet-quality score and achievements.
- Export/import of all data as a local JSON backup.

**Presentation**
- Seven-tab navigation, dark/light themes and a nature background mode with light-theme overrides.
- Keyboard shortcuts, offline chip and a feature guide in More.

## Scripts

```
npm install
npm run dev        # Vite dev server
npm run build      # production build into dist/
npm run preview    # serve the built app
npm run android:build   # build web assets + Gradle release APK (needs Android SDK/JDK)
npm run windows:build   # build + electron-builder portable exe
```

## Release history

See [CHANGELOG.md](./CHANGELOG.md).

## Disclaimer

kcal uses published equations (Mifflin–St Jeor, MET tables) and approximate food composition data. It is not medical advice, a diagnosis, or a substitute for a clinician or registered dietitian.
