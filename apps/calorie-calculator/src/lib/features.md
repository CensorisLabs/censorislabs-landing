# kcal feature additions (40-item extension)

Scope: extend the existing kcal calorie-calculator app without adding runtime dependencies and without changing the local-only storage key or suite shell.

Items (counted in More → Feature guide via `src/data/features.js`):

1. Steps counter ring on today (entries stored per day in `day.steps`)
2. Steps streak chip on today
3. Steps quick-add dialog (+1k / +2.5k / +5k / set)
4. Calories burned panel (exercise session calc uses profile weight + MET)
5. Today calorie balance card (kcal in vs targets vs burned)
6. Meal-calorie subtotals per meal on today (P/C/F per meal)
7. Carbs / fats / protein eaten ring segments on today
8. Macros-per-meal chips above meal lists
9. Water ring carry-over from previous day
10. Water micro-add dialog (100 / 250 / 500 ml + custom)
11. Weekly water chart on progress
12. Weight logger ring with trend arrow
13. Weight quick-add dialog (kg + optional note)
14. Weight history list (last entries)
15. Weight trend indicator (weekly delta)
16. Meal history list view (today + previous 7 days, flat list)
17. Meal history jump-to-day
18. Meal planner week grid on plan
19. Meal planner today actions (copy today, clear today)
20. Planner adherence chip (planned vs matched)
21. Meal suggestion tool (balanced plate suggestion from database)
22. Suggestion quick-add button per suggestion
23. Food-photo calorie estimation stub (capture placeholder + manual estimation path)
24. Onboarding step for weight input (already exists but surfaced/bug-fixed)
25. Onboarding height-as-metres helper (bug fix for cm/m entry)
26. Onboarding activity presets (sedentary/light/active/very active labels)
27. Light theme mode (explicit `light`)
28. Dark theme mode (explicit `dark`)
29. Nature background mode (plant-heavy natural gradient)
30. Theme chip in profile showing current mode
31. Calendar view (month grid, logged-day dots)
32. Calendar day detail popover (kcal/score)
33. Calendar streak line
34. Exercise suggestor (MET-based suggestion from groups, minutes picker)
35. Exercise suggestion quick-log
36. Profile-based BMR/TDEE summary card
37. Profile-based calorie consumed estimate card (today vs target)
38. Protein/fat/carb targets chips on today (target vs eaten)
39. Protein distribution quality chip
40. Diet quality score card on progress

Non-feature plumbing touched to make the above work:
- `src/lib/calc.js`: helpers for meal subtotals, today balance, net-carbs/GL already existed; no new runtime deps.
- `src/lib/store.js`: day shape already has `steps`, `water`, `exercise`, `meals`; weight log store already exists; planner store already exists; theme stored in `state.settings.theme` + `nature`.
- `src/lib/dialogs-app.js`: water / weight / exercise dialogs already exist and are reused.
- `src/data/exercises.js`: MET values reused for burned + suggestor.
- `src/data/foods.js`: used by suggestion + photo-estimation stub.
- `src/data/achievements.js`: step/water/protein achievements already reference the new behavior.

Bugs fixed during this extension:
- Today view did not show explicit today calorie balance (only remaining), now a small balance card is shown.
- Today view did not show per-meal P/C/F, now meal subtotals are rendered.
- Calendar was absent; added a calendar view wired to existing day scores.
- Steps ring previously could render with a stale "todayKey" if timezone crossed midnight during a session, guarded by re-reading `todayKey()` at render time.
- Water ring on reload could show full ring briefly before hydration numbers load; hydration is now computed synchronously from stored state.
