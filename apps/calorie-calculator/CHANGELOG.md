# Changelog

## 2.5.0 — update handling and a single version

### Added
- When a newer build has finished downloading, kcal says so in a toast and asks you to reopen the app. The diary is saved locally first, so nothing is lost by updating.
- `src/shared/version.js` is now the one place the displayed version comes from, so the About card can no longer drift from the build.

### Changed
- The About card showed 2.3.0 while the package was 2.4.0; both now read 2.5.0 from the shared constant.
- The service-worker cache is named for this release, so older cached shells are cleared on first load after the update.

## 2.4.0 — one movement model

### Fixed
- Today, Progress, Insights and the Studio calculators disagreed about step calories (0.045 kcal/step on one screen, 0.00057 × weight on another). All of them now call `src/lib/movement.js`.
- Steps credited to the budget could not be explained: the number was a gross walking estimate added on top of a target that already includes resting metabolism. Credit is now net of resting metabolism (ACSM walking equation) and the UI states the basis.
- A logged walk was paid for twice — once as the exercise entry and again as the steps it contains. Steps covered by a logged walk or run are no longer credited separately.
- The Android step counter restarted from zero every time the app reopened; it now adds sensor deltas, so steps taken while kcal was closed still count, and a reboot no longer wipes the day.
- Syncing device steps overwrote a larger manual entry for the day. The larger value is kept.
- The step goal lived in settings while stride and cadence were unused; goal, cadence, stride and the credit switch are now profile fields with migration from the old `settings.stepGoal`, and More, Today and Progress all edit the same value.
- Step-goal achievements counted against a hard-coded 10,000 instead of your own goal.

### Added
- **Steps setup** dialog (Today, Progress, More): goal presets, cadence, measured stride override, step-credit toggle and a live preview of distance, time and calories.
- **Movement card** on Today: goal ring, distance, walking minutes, active vs including-resting calories, the credited amount and why, plus a pace line.
- **Movement insights**: 7-day distance, 7-day step credit and the assumed pace, with the activity-baseline explanation.
- Steps dialog shows live distance, active minutes, active calories and gross calories before you save.

## 2.3.0 — tools and insights

### Tools (More → Tools)
- 42 live calculators in four groups, each recalculating as you type with a colour-coded answer and a one-tap copy:
  - Body: BMI, BMR (Mifflin-St Jeor), TDEE, body fat (US Navy), lean mass, ideal weight, waist-to-height, water target, protein target, fibre target, deficit planner, time-to-goal, weekly change rate, macro split, net carbs, glycemic load, carb cycling, refeed budget, safe calorie floor.
  - Activity: MET burn, calories from steps, walk time, one-rep max, heart-rate zones, VO2 max, pace and speed, cycling burn, hiking burn.
  - Food: recipe scaler, per-100 g converter, % daily value, alcohol calories, plate balance score, calorie density, swap savings, restaurant buffer, cost per 1,000 kcal.
  - Units: kg↔lb, cm↔in, ml↔fl oz, kcal↔kJ, °C↔°F.
- Search across every tool, and each card copies its result.

### Insights (More → Insights)
- 61 computed readings from your own log, grouped into Energy, Macros, Body, Habits and Food & timing.
- Energy: average intake and burn, deficit, adaptive maintenance, variability, weekend vs weekday, week-on-week recap, days over/under target, adherence, surplus days.
- Macros: protein average and per-kg value, protein hit days, carb and fat share, fibre, sugar, sodium, protein spread and consistency, micronutrient coverage, fibre per 1,000 kcal.
- Body: 14-day trend, 30-day change, goal progress and projected date, BMI, body fat, waist change, hydration.
- Habits: streaks, logged days, water, steps, sleep, mood, training minutes, caffeine, weigh-in and measurement recency.
- Food & timing: most logged food, variety, most missed meal, dinner/breakfast/snack share, calorie density, protein source, spend, average meal size, favourite share, busiest day.
- "Copy all" turns the page into plain text for a review or a visit to a clinician.

## 2.2.0 — full release

### Fixed
- Progress page crashed with `ReferenceError: dietQuality is not defined`, which left the Nutrition and Achievements tabs blank. The missing branch in `renderProgress` is restored and both tabs render.
- Wellbeing check-ins (steps, sleep, caffeine, mood, energy, hunger) were always written to today even while viewing a past day. All seven call sites now pass the viewed date, so history is no longer overwritten.
- The diary "History" tool button had no click handler; it now scrolls to the history card and highlights it.
- The Studio photo-estimate form had no submit handler; estimating now populates the estimate and logs it.
- The steps dialog had no date, so steps could land on the wrong day. Today and Progress now share one `openStepsLog({ date })` helper.
- The CSS tail was truncated mid-rule, breaking calendar styles; the block is repaired and brace balance verified.
- Bottom navigation overflowed with the new calendar tab (now seven columns) and the Plan icon was missing.
- Light theme now overrides the bottom bar and offline chip instead of leaving dark text on a light bar.
- Duplicate macro cards removed from Today.

### Added
- **Meal-aware balanced plate suggestions** — portions adapt to the meal and remaining macros, with plate totals and a deep link straight into the portion dialog (pre-filled grams).
- **Daily step goal** (default 8,000) in More → Settings, used by the step streak, Progress chart and burn calculation.
- **14-day steps card** on Progress with average, best day, distance and calorie burn.
- **Smoothed weight card** on Progress: 7-day average, weekly rate of change and a plateau watch.
- **Calories burned estimate** from steps, scaled to body weight.
- Android step counter plugin using `Sensor.TYPE_STEP_COUNTER` (not the accelerometer): reboot baseline, day-rollover handling, `ACTIVITY_RECOGNITION` permission and an optional `stepcounter` hardware feature.
- Feature-guide entry and release metadata for the above.

### Changed
- Version now 2.2.0 (Android `versionCode` 4).
- Progress and Today share dialog helpers instead of duplicating step/wellbeing forms.

## 2.1.0
- Steps, water, weight and exercise rings on Today; meal-level macros; meal suggestions; photo estimation; calendar; planner adherence; 14-day trends; light/nature themes.

## 2.0.0
- Rebuilt UI shell, profiles, achievements, export/import and the CensorisLabs suite shell.
