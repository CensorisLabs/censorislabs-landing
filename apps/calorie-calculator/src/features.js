// Shared presentation helpers + the feature index.
// Everything here is pure so the numbers stay predictable and testable.

export const TIPS = [
  'Log meals as you eat them — it takes 20 seconds and keeps the day accurate.',
  'A brisk 10-minute walk after a meal counts. Start the walk timer and go.',
  'Protein first at breakfast tends to keep you fuller until lunch.',
  'Weigh yourself at the same time of day for a fair comparison.',
  'Drink a glass of water before you reach for a snack.',
  'Steps add up: the last 10 minutes of walking can beat a 5-minute burst.',
  'Cook once, log once — save the meal as a template for later.',
  'A missed day is a day, not a setback. Log today and carry on.',
  'Check the label portion size before entering grams; servings are often smaller than they look.',
  'Sleep is part of the plan. Late nights make appetite harder to manage.',
  'Use the favorites star for the five foods you eat most weeks.',
  'Strength sessions protect muscle while you lose fat. Two a week is plenty.',
]

const LB = 2.20462
const IN = 0.393701

export const isImperial = units => units === 'imperial'

export function formatWeight(kg, units = 'metric') {
  const value = Number(kg)
  if (!Number.isFinite(value) || value <= 0) return '—'
  return isImperial(units) ? `${Math.round(value * LB * 10) / 10} lb` : `${Math.round(value * 10) / 10} kg`
}

export function formatDistance(km, units = 'metric') {
  const value = Number(km) || 0
  if (isImperial(units)) {
    const miles = value * 0.621371
    return miles < 0.1 ? `${Math.round(miles * 5280)} ft` : `${Math.round(miles * 100) / 100} mi`
  }
  return value < 0.1 ? `${Math.round(value * 1000)} m` : `${Math.round(value * 100) / 100} km`
}

export function formatWater(ml, units = 'metric') {
  const value = Math.max(0, Number(ml) || 0)
  return isImperial(units) ? `${Math.round(value / 29.5735)} oz` : `${Math.round(value)} ml`
}

export function formatHeight(cm, units = 'metric') {
  const value = Number(cm)
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (!isImperial(units)) return `${Math.round(value)} cm`
  const totalInches = value * IN
  return `${Math.floor(totalInches / 12)}′ ${Math.round(totalInches % 12)}″`
}

// Grams per 100 g → the portion actually eaten.
export function mealKcalOf(meal) {
  return Math.round((Number(meal?.nutrients?.kcal) || 0) * (Number(meal?.grams) || 0) / 100)
}

export function netCalories(eaten, burned) {
  return Math.round((Number(eaten) || 0) - (Number(burned) || 0))
}

// Linear trend from the last two weight readings, projected to a goal weight.
export function goalProjection(weights = [], goalKg = 0) {
  const goal = Number(goalKg)
  const points = (weights || [])
    .filter(item => Number(item.kg) > 0)
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (!points.length || !goal) return null
  const latest = points[points.length - 1]
  const current = Number(latest.kg)
  const remaining = current - goal
  if (Math.abs(remaining) < 0.2) return { current, goal, remaining: 0, perWeek: 0, weeks: 0, date: latest.date }
  if (points.length < 2) return { current, goal, remaining: Math.round(remaining * 10) / 10, perWeek: 0, weeks: null, date: '' }
  const first = points[Math.max(0, points.length - 8)]
  const days = Math.max(1, Math.round((new Date(`${latest.date}T12:00:00`) - new Date(`${first.date}T12:00:00`)) / 86400000))
  const perDay = (current - Number(first.kg)) / days
  const perWeek = Math.round(perDay * 7 * 100) / 100
  // A trend only projects a date when it actually moves toward the goal.
  if (!perDay || Math.sign(perDay) !== -Math.sign(remaining)) return { current, goal, remaining: Math.round(remaining * 10) / 10, perWeek, weeks: null, date: '' }
  const weeks = Math.abs(remaining / (perDay * 7))
  const date = new Date(`${latest.date}T12:00:00`)
  date.setDate(date.getDate() + Math.round(weeks * 7))
  return {
    current, goal, remaining: Math.round(remaining * 10) / 10, perWeek, weeks: Math.round(weeks * 10) / 10,
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  }
}

// A simple weekly report card. Every score is derived from what the user logged,
// and components with no data are skipped rather than counted as failures.
export function weeklyGrade({ calorieDays = 0, targetHit = 0, stepDays = 0, stepGoalDays = 0, sleepAvg = 0, sleepGoal = 8, logStreak = 0 }) {
  const parts = []
  if (calorieDays > 0) parts.push({ key: 'Nutrition', score: Math.round(Math.min(1, targetHit / calorieDays) * 100), detail: `${targetHit}/${calorieDays} days within target` })
  if (stepDays > 0) parts.push({ key: 'Movement', score: Math.round(Math.min(1, stepGoalDays / stepDays) * 100), detail: `${stepGoalDays}/${stepDays} days hit step goal` })
  if (sleepAvg > 0) parts.push({ key: 'Sleep', score: Math.round(Math.min(1, sleepAvg / Math.max(1, sleepGoal)) * 100), detail: `${Math.round(sleepAvg * 10) / 10} h average` })
  if (logStreak > 0) parts.push({ key: 'Consistency', score: Math.min(100, logStreak * 14), detail: `${logStreak}-day logging streak` })
  if (!parts.length) return { grade: '—', score: 0, parts, summary: 'Log a few days to get a report card.' }
  const score = Math.round(parts.reduce((sum, part) => sum + part.score, 0) / parts.length)
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'E'
  return { grade, score, parts, summary: score >= 80 ? 'Strong week — keep the same rhythm.' : score >= 60 ? 'Solid base. Pick one habit to tighten up.' : 'Start small: log every meal for three days.' }
}

export function achievements({ meals = 0, steps = 0, streak = 0, workouts = 0, waters = 0, weights = 0, sleepNights = 0 }) {
  return [
    { id: 'first-meal', label: 'First meal logged', done: meals > 0 },
    { id: 'meal-25', label: '25 meals logged', done: meals >= 25 },
    { id: 'meal-100', label: '100 meals logged', done: meals >= 100 },
    { id: 'steps-10k', label: '10,000 steps in a day', done: steps >= 10000 },
    { id: 'streak-3', label: '3-day streak', done: streak >= 3 },
    { id: 'streak-7', label: '7-day streak', done: streak >= 7 },
    { id: 'streak-30', label: '30-day streak', done: streak >= 30 },
    { id: 'workout-10', label: '10 workouts', done: workouts >= 10 },
    { id: 'water-8', label: '8 glasses in a day', done: waters >= 8 },
    { id: 'weigh-5', label: '5 weigh-ins', done: weights >= 5 },
    { id: 'sleep-7', label: '7 nights of sleep logged', done: sleepNights >= 7 },
  ]
}

export const FEATURES = [
  // Home
  { group: 'Home', name: 'Calories remaining headline', detail: 'The number people open a tracker for, first thing on the front page.' },
  { group: 'Home', name: 'Eaten, burned and goal breakdown', detail: 'Three figures under the ring so the maths is never a mystery.' },
  { group: 'Home', name: 'Net calorie figure', detail: 'Food minus recorded exercise, shown next to the raw intake.' },
  { group: 'Home', name: 'Steps tile with goal ring', detail: 'Today’s steps and how far they are from your goal.' },
  { group: 'Home', name: 'Calories burned tile', detail: 'Step energy plus logged workouts, labelled as an estimate.' },
  { group: 'Home', name: 'Water tile with quick add', detail: 'One tap for a glass, bottle or your own preset.' },
  { group: 'Home', name: 'Weight tile with trend', detail: 'Latest weight and the 7-day average change.' },
  { group: 'Home', name: 'Start a walk button', detail: 'The primary action on the dashboard, always reachable.' },
  { group: 'Home', name: 'Live walk timer', detail: 'Elapsed time running while the walk is active.' },
  { group: 'Home', name: 'Live walk distance', detail: 'GPS distance when permitted, pace-based estimate otherwise.' },
  { group: 'Home', name: 'Live walk step estimate', detail: 'Steps derived from distance or cadence.' },
  { group: 'Home', name: 'Live walk calorie burn', detail: 'MET-based estimate using your body weight.' },
  { group: 'Home', name: 'Pause and resume a walk', detail: 'Stops the clock without ending or losing the session.' },
  { group: 'Home', name: 'Finish walk saves the session', detail: 'Writes minutes, distance, steps and calories into the activity log.' },
  { group: 'Home', name: 'Walk or run mode', detail: 'Each mode has its own paces, so speed and burn match the effort.' },
  { group: 'Home', name: 'Accurate GPS tracking', detail: 'High-accuracy fixes with jitter, weak-signal and teleport rejection before distance is added.' },
  { group: 'Home', name: 'Moving or standing still', detail: 'Live movement state from GPS speed, so you can tell the track is following you.' },
  { group: 'Home', name: 'GPS signal quality', detail: 'Shows accuracy in metres and hides distance rather than guessing when the fix is vague.' },
  { group: 'Home', name: 'Live route map', detail: 'Draws the shape of the walk as it happens, on the device, with no map tiles or location upload.' },
  { group: 'Home', name: 'Start photo', detail: 'Take one live photo when the session begins; compressed and kept on this device.' },
  { group: 'Home', name: 'Finish photo', detail: 'A second photo at the end, shown next to the session in history.' },
  { group: 'Home', name: 'Post-session check-in', detail: 'Who you were with, how it felt, where you went, the weather and a short note.' },
  { group: 'Home', name: 'Meal-by-meal summary', detail: 'Breakfast, lunch, dinner and snacks with totals on the front page.' },
  { group: 'Home', name: 'Logging streak', detail: 'Consecutive days with any entry, so consistency is visible.' },
  { group: 'Home', name: 'Achievement badges', detail: 'Eleven milestones from first meal to a 30-day streak.' },
  { group: 'Home', name: 'Daily practical tip', detail: 'A rotating, plain-language habit suggestion.' },
  { group: 'Home', name: 'Seven-day mini chart', detail: 'This week’s calories and steps without leaving the dashboard.' },
  { group: 'Home', name: 'Day navigation arrows', detail: 'Step back to yesterday or forward again in one tap.' },
  { group: 'Home', name: 'Time-aware greeting', detail: 'Good morning, afternoon or evening, with your name.' },
  { group: 'Home', name: 'Quick add water', detail: 'Preset amounts save a trip to the health screen.' },
  { group: 'Home', name: 'Quick log steps', detail: 'Add a step count straight from the dashboard.' },
  { group: 'Home', name: 'Quick log weight', detail: 'A single field, right where the weight tile sits.' },

  // Diary
  { group: 'Diary', name: 'Meal slots', detail: 'Breakfast, lunch, dinner and snacks as separate sections.' },
  { group: 'Diary', name: 'Per-slot calorie totals', detail: 'See which meal is carrying the day.' },
  { group: 'Diary', name: 'Add food straight into a slot', detail: 'The add button preselects the meal you tapped.' },
  { group: 'Diary', name: 'Built-in food database', detail: 'Indian and everyday foods with per-100 g values.' },
  { group: 'Diary', name: 'Keyword food search', detail: 'Matches names, local names and categories.' },
  { group: 'Diary', name: 'Category filter', detail: 'Grains, dals, dairy, produce and more.' },
  { group: 'Diary', name: 'Portion presets', detail: 'One cup, one roti, one slice — with gram equivalents.' },
  { group: 'Diary', name: 'Custom gram amounts', detail: 'Type any portion from 1 to 5,000 g.' },
  { group: 'Diary', name: 'Favorite foods', detail: 'Star the foods you eat every week for instant access.' },
  { group: 'Diary', name: 'Recent foods', detail: 'Your last logged items, one tap to log again.' },
  { group: 'Diary', name: 'Most-logged foods', detail: 'Frequency-ranked shortcuts built from your own diary.' },
  { group: 'Diary', name: 'Quick add calories', detail: 'Log an unknown meal as a plain calorie figure.' },
  { group: 'Diary', name: 'Custom foods from labels', detail: 'Save a packaged food once and reuse it.' },
  { group: 'Diary', name: 'Barcode lookup', detail: 'Product data from Open Food Facts, reviewed before saving.' },
  { group: 'Diary', name: 'Camera barcode scanning', detail: 'EAN/UPC detection where the browser supports it.' },
  { group: 'Diary', name: 'Meal photos', detail: 'Attach a compressed photo that stays on the device.' },
  { group: 'Diary', name: 'Meal notes', detail: 'A short note on the meal, place or portion.' },
  { group: 'Diary', name: 'Recipes with per-serving nutrition', detail: 'Save a dish once, log a serving later.' },
  { group: 'Diary', name: 'Meal templates', detail: 'Save a whole slot as a template and apply it again.' },
  { group: 'Diary', name: 'Meal planning', detail: 'Plan meals for a future date.' },
  { group: 'Diary', name: 'Copy yesterday’s meals', detail: 'Repeats a day in one tap.' },
  { group: 'Diary', name: 'Duplicate a recent meal', detail: 'Re-log any previous entry.' },
  { group: 'Diary', name: 'Undo a delete', detail: 'Removing an entry offers an immediate undo.' },
  { group: 'Diary', name: 'Macro progress', detail: 'Protein, carbohydrate and fat against targets.' },
  { group: 'Diary', name: 'Fiber, sugar and sodium', detail: 'Tracked against editable daily limits.' },
  { group: 'Diary', name: 'Per-meal breakdown', detail: 'A compact calorie split for the day.' },
  { group: 'Diary', name: 'Print-friendly diary', detail: 'Print or save the day as a PDF.' },
  { group: 'Diary', name: 'Meal CSV export', detail: 'Download every meal entry as a spreadsheet.' },

  // Activity
  { group: 'Activity', name: 'Exercise database', detail: 'Twenty common activities with MET values.' },
  { group: 'Activity', name: 'Exercise search', detail: 'Filter the list instead of scrolling.' },
  { group: 'Activity', name: 'Custom activity by MET', detail: 'Add anything the list does not cover.' },
  { group: 'Activity', name: 'Workout templates', detail: 'Preset durations for the walks and sessions you repeat.' },
  { group: 'Activity', name: 'Manual step entry', detail: 'Type the number from your phone or watch.' },
  { group: 'Activity', name: 'Phone motion step estimate', detail: 'Foreground accelerometer counting where supported.' },
  { group: 'Activity', name: 'Steps-to-distance estimate', detail: 'Converts steps using an average stride.' },
  { group: 'Activity', name: 'Active minutes', detail: 'Total logged exercise time for the day.' },
  { group: 'Activity', name: 'Training load', detail: 'MET-minutes for the day and the week.' },
  { group: 'Activity', name: 'Load ratio', detail: 'Recent load compared with your own baseline.' },
  { group: 'Activity', name: 'Heart-rate zones', detail: 'Age-based zone estimate from a logged reading.' },
  { group: 'Activity', name: 'Rest timer', detail: 'Countdown between sets, with a notification.' },
  { group: 'Activity', name: 'Strength set logging', detail: 'Sets, reps, load and muscle group.' },
  { group: 'Activity', name: 'GPS walk', detail: 'Distance from real fixes, plus a route map kept locally unless you turn route saving off.' },
  { group: 'Activity', name: 'Walk history', detail: 'Every session with duration, distance, burn, photos and check-in tags.' },
  { group: 'Activity', name: 'Run history with photos', detail: 'The twenty most recent sessions keep their start and finish photos.' },
  { group: 'Activity', name: 'Walk CSV export', detail: 'Duration, distance, steps, calories, pace, company and notes in one sheet.' },
  { group: 'Activity', name: 'Step source and trust level', detail: 'Says whether today counts come from a device, a walk session, motion or manual entry.' },
  { group: 'Activity', name: 'Stride length', detail: 'Stored in centimetres and used to turn counted steps into distance.' },
  { group: 'Activity', name: 'Stride calibration', detail: 'Walk a measured stretch and enter steps plus metres to get a real stride.' },
  { group: 'Activity', name: 'Phone motion step counter', detail: 'Adaptive peak detection with a refractory window; foreground only, with its limits stated.' },
  { group: 'Activity', name: 'Plus or minus 250 steps', detail: 'Nudge a step total when you know the real number.' },
  { group: 'Activity', name: 'Most common walking company', detail: 'The check-in answers roll up into a simple summary.' },
  { group: 'Activity', name: 'Step goal editor', detail: 'Set a daily target that matches your routine.' },

  // Health
  { group: 'Health', name: 'Sleep log with stages', detail: 'Hours, quality, deep and REM as entered.' },
  { group: 'Health', name: 'Seven-day sleep debt', detail: 'Shortfall against your own sleep goal.' },
  { group: 'Health', name: 'Recovery score', detail: 'Sleep, energy and resting heart rate combined.' },
  { group: 'Health', name: 'Mood and energy check-in', detail: 'A five-point daily reflection.' },
  { group: 'Health', name: 'Stress level', detail: 'Logged alongside mood.' },
  { group: 'Health', name: 'Water logging', detail: 'Any drink, any amount, with daily totals.' },
  { group: 'Health', name: 'Weight and body fat', detail: 'Both stored per day with a 7-day average.' },
  { group: 'Health', name: 'Body measurements', detail: 'Waist, chest and hips over time.' },
  { group: 'Health', name: 'BMI with category', detail: 'Calculated from your height and latest weight.' },
  { group: 'Health', name: 'BMR and maintenance', detail: 'Mifflin–St Jeor rest and daily estimates.' },
  { group: 'Health', name: 'Blood pressure log', detail: 'Systolic and diastolic as one reading.' },
  { group: 'Health', name: 'Glucose log', detail: 'Manual readings with unit handling.' },
  { group: 'Health', name: 'SpO₂, HRV and temperature', detail: 'Optional vitals kept with the day.' },
  { group: 'Health', name: 'Symptom log', detail: 'Name, severity and note.' },
  { group: 'Health', name: 'Cycle notes', detail: 'Private dates and notes.' },
  { group: 'Health', name: 'Lab results', detail: 'Test, value, unit and reference note.' },
  { group: 'Health', name: 'Lab report OCR', detail: 'Reads a photo on-device and fills a suggestion for review.' },
  { group: 'Health', name: 'Medicine reminders', detail: 'Named reminders with a daily time.' },
  { group: 'Health', name: 'Fasting timer', detail: 'Elapsed-time only, no health claims.' },
  { group: 'Health', name: 'Health Connect sync', detail: 'Read-only import of the day you choose, Android only.' },
  { group: 'Health', name: 'Emergency card', detail: 'Contact, allergies and blood type, stored locally.' },
  { group: 'Health', name: 'Multiple profiles', detail: 'Separate trackers on one device.' },

  // Progress
  { group: 'Progress', name: 'Seven and thirty-day ranges', detail: 'Switch the window on every chart.' },
  { group: 'Progress', name: 'Weight chart with goal line', detail: 'Your trend against the target you set.' },
  { group: 'Progress', name: 'Calorie chart', detail: 'Daily food energy for the range.' },
  { group: 'Progress', name: 'Steps chart', detail: 'Movement across the range.' },
  { group: 'Progress', name: 'Sleep chart', detail: 'Nightly hours against your goal.' },
  { group: 'Progress', name: 'Water chart', detail: 'Hydration across the range.' },
  { group: 'Progress', name: 'Weekly report card', detail: 'Nutrition, movement, sleep and consistency, graded.' },
  { group: 'Progress', name: 'Goal weight projection', detail: 'Estimated date from your own recent trend.' },
  { group: 'Progress', name: 'Personal records', detail: 'Best steps, longest walk, best week.' },
  { group: 'Progress', name: 'Challenges', detail: 'Step, water, logging and sleep targets with progress.' },
  { group: 'Progress', name: 'Weekly averages', detail: 'Averages that skip days with no entries.' },
  { group: 'Progress', name: 'JSON backup export', detail: 'A complete local copy of your data.' },
  { group: 'Progress', name: 'Backup restore', detail: 'Restore a backup on this device.' },

  // Pacing, completeness and trends
  { group: 'Home', name: 'Calorie pacing check', detail: 'Compares food logged with where the day is, so a quiet morning is not called a miss.' },
  { group: 'Home', name: 'Day completeness nudge', detail: 'Six things a full tracking day usually has, and which are still open.' },
  { group: 'Home', name: 'Macros left in grams', detail: 'How much protein, carbohydrate and fat remain against your targets.' },
  { group: 'Home', name: 'Yesterday comparison', detail: 'Today’s food energy against the previous day.' },
  { group: 'Home', name: 'Copy today’s numbers', detail: 'A plain-text day summary for a message to a coach or a friend.' },
  { group: 'Diary', name: 'Food list ordering by nutrient density', detail: 'Sort by protein or fiber per 100 kcal, or by least sugar, not just alphabetically.' },
  { group: 'Diary', name: 'Quick add with macros', detail: 'Optional protein, carb and fat grams on a fast calorie entry.' },
  { group: 'Diary', name: 'Copy any day’s meals', detail: 'Bring every meal from a chosen past day into the day you are editing.' },
  { group: 'Activity', name: 'Weekly active minutes', detail: 'Rolling 7-day walking and running minutes against a goal you can change.' },
  { group: 'Activity', name: 'Live walking cadence', detail: 'Steps per minute while the session runs.' },
  { group: 'Activity', name: 'Walk history filter', detail: 'Show all sessions, only walks, or only runs.' },
  { group: 'Activity', name: 'Delete a single session', detail: 'Remove one walk or run without touching the rest of the log.' },
  { group: 'Activity', name: 'Step-goal streak', detail: 'Consecutive days that reached your step goal, plus your best run.' },
  { group: 'Health', name: 'Blood pressure band', detail: 'A plain reading of the common adult bands, with an explicit not-a-diagnosis note.' },
  { group: 'Health', name: 'Glucose log and average', detail: 'Recent readings, a 7-day average and counts above or below a general band.' },
  { group: 'Health', name: 'Sleep timing steadiness', detail: 'How far apart your bedtimes sit across a fortnight, measured across midnight.' },
  { group: 'Health', name: 'Repeat symptom patterns', detail: 'Which of your own symptom notes recur in the last month.' },
  { group: 'Health', name: 'Reminder adherence', detail: 'Share of the medicine reminders you created that you ticked off this week.' },
  { group: 'Health', name: 'Fasting history', detail: 'Finished fasts with their length and an average.' },
  { group: 'Health', name: 'Lab value trend', detail: 'The same test name on two dates, compared without interpreting it.' },
  { group: 'Health', name: 'Days since last cycle note', detail: 'A private count from the date you last recorded, with no prediction.' },
  { group: 'Progress', name: 'Logging heatmap', detail: 'Eight weeks of days, shaded by how much of the day was recorded.' },
  { group: 'Progress', name: 'Day-of-week pattern', detail: 'Average food energy per weekday, and the day closest to your target.' },
  { group: 'Progress', name: 'Goal weight progress', detail: 'How far you have come from your first weigh-in and what is left.' },
  { group: 'Progress', name: 'Body fat change', detail: 'The difference between your first and latest body-fat entry.' },
  { group: 'Progress', name: 'This week versus last', detail: 'Averages for the last seven days next to the seven before.' },
  { group: 'Settings', name: 'Storage usage and record counts', detail: 'See how much each kind of record takes on this device.' },
  { group: 'Settings', name: 'Remove one record type', detail: 'Clear a single collection for the active profile instead of everything.' },
  { group: 'Settings', name: 'Backup reminder', detail: 'A nudge when no export has been taken in the last month.' },
  { group: 'Settings', name: 'Adjustable weekly activity goal', detail: 'Set the active minutes you are working towards each week.' },

  // Tools · nutrition density
  { group: 'Tools', name: 'Macro calorie split', detail: 'How much of today’s energy came from protein, carbohydrate and fat.' },
  { group: 'Tools', name: 'Target calorie split', detail: 'The same split calculated from your macro targets, for comparison.' },
  { group: 'Tools', name: 'Sugar share of calories', detail: 'Sugar energy as a percentage of everything eaten today.' },
  { group: 'Tools', name: 'Protein per 1,000 kcal', detail: 'Protein density that lets very different days be compared.' },
  { group: 'Tools', name: 'Fiber per 1,000 kcal', detail: 'Fiber density for the day.' },
  { group: 'Tools', name: 'Sodium per 1,000 kcal', detail: 'Sodium density rather than a raw total.' },
  { group: 'Tools', name: 'Largest meal today', detail: 'The single entry carrying the most energy.' },
  { group: 'Tools', name: 'Average entry size', detail: 'Mean calories per logged item today.' },
  { group: 'Tools', name: 'Median entry size', detail: 'Middle entry size, which one huge meal cannot distort.' },
  { group: 'Tools', name: 'Foods logged twice today', detail: 'Repeated entries, useful for spotting a double-logged meal.' },
  { group: 'Tools', name: 'How entries were added', detail: 'Share of today’s items from quick add, templates, search or manual entry.' },
  { group: 'Tools', name: 'Protein by meal', detail: 'Protein grams in each meal slot against your daily target.' },
  { group: 'Tools', name: 'Different foods today', detail: 'Distinct foods compared with the number of entries.' },
  { group: 'Tools', name: 'Calories from drinks', detail: 'Energy from drinks and drink-like entries.' },
  { group: 'Tools', name: 'Calorie density per 100 g', detail: 'How energy-dense today’s food was by weight.' },
  { group: 'Tools', name: 'Recipes saved', detail: 'Recipe count and the average calories per serving.' },
  { group: 'Tools', name: 'Custom foods used', detail: 'How many of your own foods have actually been logged.' },
  { group: 'Tools', name: 'Favorites still available', detail: 'Saved favorites that still exist in the food list.' },
  { group: 'Tools', name: 'Planned versus eaten', detail: 'The gap between today’s meal plan and what was logged.' },
  { group: 'Tools', name: 'Macro furthest behind target', detail: 'Which macro is furthest from its target, and by how much.' },
  { group: 'Tools', name: 'Biggest calorie source today', detail: 'The single food contributing the most calories.' },
  { group: 'Tools', name: 'Biggest sugar source today', detail: 'The single food contributing the most sugar.' },
  { group: 'Tools', name: 'Biggest sodium source today', detail: 'The single food contributing the most sodium.' },
  { group: 'Tools', name: 'Biggest protein source today', detail: 'The single food contributing the most protein.' },
  { group: 'Tools', name: 'Energy share by meal', detail: 'What percentage of today’s calories each meal slot provided.' },

  // Tools · movement
  { group: 'Tools', name: 'Walk session count', detail: 'Sessions saved with a timer.' },
  { group: 'Tools', name: 'Walk minutes logged', detail: 'Total minutes across every saved session.' },
  { group: 'Tools', name: 'Distance walked', detail: 'Total distance across all saved sessions.' },
  { group: 'Tools', name: 'Average session distance', detail: 'Typical distance per session.' },
  { group: 'Tools', name: 'Longest session', detail: 'Date and duration of the longest saved walk or run.' },
  { group: 'Tools', name: 'Pace trend', detail: 'Your latest pace against your first, in minutes per kilometre.' },
  { group: 'Tools', name: 'Walks versus runs', detail: 'The mix of walking and running sessions.' },
  { group: 'Tools', name: 'Average steps on logged days', detail: 'Mean steps across the last 30 days that have step data.' },
  { group: 'Tools', name: 'Best step day', detail: 'The highest step day in the last 30 days.' },
  { group: 'Tools', name: 'Lowest step day', detail: 'The quietest logged step day in the last 30 days.' },
  { group: 'Tools', name: 'Step-goal hit rate', detail: 'How many logged days reached your step goal.' },
  { group: 'Tools', name: 'Days with no movement', detail: 'Days in the window with neither steps nor logged activity.' },
  { group: 'Tools', name: 'Device vs hand-logged steps', detail: 'Where today’s step total came from.' },
  { group: 'Tools', name: 'Distance in the last 30 days', detail: 'Kilometres walked or run in the rolling month.' },
  { group: 'Tools', name: 'Most logged activity', detail: 'The workout you record most often.' },
  { group: 'Tools', name: 'Strength volume', detail: 'Sets logged and the total kilograms moved.' },
  { group: 'Tools', name: 'Muscle groups logged', detail: 'Which muscle groups appear in your strength entries.' },
  { group: 'Tools', name: 'MET-minutes logged', detail: 'Intensity multiplied by minutes across every activity.' },
  { group: 'Tools', name: 'Average session length', detail: 'Mean minutes per logged activity.' },
  { group: 'Tools', name: 'Check-in completion', detail: 'How many saved sessions had their finish questions answered.' },

  // Tools · walk check-in details
  { group: 'Tools', name: 'Who you walked with', detail: 'The company recorded across sessions.' },
  { group: 'Tools', name: 'How walks felt', detail: 'The effort ratings you recorded.' },
  { group: 'Tools', name: 'Where you walked', detail: 'The places you recorded.' },
  { group: 'Tools', name: 'Weather you recorded', detail: 'The conditions attached to sessions.' },
  { group: 'Tools', name: 'Sessions with a photo', detail: 'Photo coverage across saved sessions.' },
  { group: 'Tools', name: 'Sessions with a route map', detail: 'Route coverage across saved sessions.' },

  // Tools · sleep
  { group: 'Tools', name: 'Nights logged', detail: 'How many sleep nights the log holds.' },
  { group: 'Tools', name: 'Average sleep', detail: 'Mean hours across logged nights.' },
  { group: 'Tools', name: 'Nights that met your goal', detail: 'Nights at or above your sleep goal.' },
  { group: 'Tools', name: 'Shortest night', detail: 'The lowest logged night.' },
  { group: 'Tools', name: 'Average bedtime', detail: 'A single bedtime average that handles midnight.' },
  { group: 'Tools', name: 'Average wake time', detail: 'The mean of the wake times you entered.' },
  { group: 'Tools', name: 'Average sleep quality', detail: 'Quality ratings averaged 1–5.' },
  { group: 'Tools', name: 'Deep and REM share', detail: 'Stage hours as a share of total sleep.' },
  { group: 'Tools', name: 'Weekend versus weekday sleep', detail: 'How much later or longer you sleep at weekends.' },
  { group: 'Tools', name: 'Nights more than an hour short', detail: 'Count of nights well below your goal.' },
  { group: 'Tools', name: 'Bedtime regularity', detail: 'Average deviation from your usual bedtime.' },

  // Tools · body
  { group: 'Tools', name: 'Weight rate per week', detail: 'The slope of your weigh-ins, expressed weekly.' },
  { group: 'Tools', name: 'Weight range in your log', detail: 'Lowest and highest weigh-in recorded.' },
  { group: 'Tools', name: 'BMI from latest weight', detail: 'BMI calculated from your newest weigh-in and profile height.' },
  { group: 'Tools', name: 'Waist-to-height', detail: 'Waist measurement divided by height.' },
  { group: 'Tools', name: 'Waist-to-hip', detail: 'Ratio from your latest body measurements.' },
  { group: 'Tools', name: 'Lean mass estimate', detail: 'Weight split into estimated fat and lean mass from body fat.' },
  { group: 'Tools', name: 'Weigh-in cadence', detail: 'How often you actually weigh in.' },
  { group: 'Tools', name: 'Measurement change', detail: 'Waist, chest and hip change between your first and latest entries.' },

  // Tools · consistency
  { group: 'Tools', name: 'Habit completion rate', detail: 'Share of possible habit check-ins over 30 days.' },
  { group: 'Tools', name: 'Longest current habit streak', detail: 'The best active streak across your habits.' },
  { group: 'Tools', name: 'Habits never checked', detail: 'Habits you added but have not ticked off.' },
  { group: 'Tools', name: 'Average energy', detail: 'Mean energy rating from daily check-ins.' },
  { group: 'Tools', name: 'Average stress', detail: 'Mean stress rating from daily check-ins.' },
  { group: 'Tools', name: 'Symptom entries', detail: 'Symptoms noted in the last 30 days.' },
  { group: 'Tools', name: 'Days with a symptom', detail: 'Distinct days that carry a symptom note.' },
  { group: 'Tools', name: 'Average symptom severity', detail: 'Mean severity of your own ratings.' },
  { group: 'Tools', name: 'Water goal hit rate', detail: 'Days in the last week that reached your water goal.' },
  { group: 'Tools', name: 'Best logging streak', detail: 'Your longest run of consecutive days with any entry.' },
  { group: 'Tools', name: 'Best step weekday', detail: 'The weekday with your highest average steps.' },
  { group: 'Tools', name: 'Best calorie weekday', detail: 'The weekday with your highest average food energy.' },

  // Tools · vitals
  { group: 'Tools', name: 'Resting heart-rate average', detail: 'Mean of the resting readings you entered.' },
  { group: 'Tools', name: 'HRV average', detail: 'Mean heart-rate variability from your entries.' },
  { group: 'Tools', name: 'Lowest SpO₂', detail: 'The lowest oxygen saturation reading recorded.' },
  { group: 'Tools', name: 'Highest temperature', detail: 'The highest temperature reading recorded.' },
  { group: 'Tools', name: 'Blood-pressure average', detail: 'Mean systolic and diastolic across your readings.' },
  { group: 'Tools', name: 'Glucose lowest', detail: 'Lowest glucose value in your log.' },
  { group: 'Tools', name: 'Glucose highest', detail: 'Highest glucose value in your log.' },
  { group: 'Tools', name: 'Glucose average', detail: 'Mean of the glucose values you entered.' },
  { group: 'Tools', name: 'Vitals coverage', detail: 'Days in the last week with a vitals entry.' },

  // Tools · data health
  { group: 'Tools', name: 'Largest collection', detail: 'Which record type takes the most rows.' },
  { group: 'Tools', name: 'Total records stored', detail: 'Every stored row across all collections.' },
  { group: 'Tools', name: 'Date range covered', detail: 'First and last dated record, and the span between them.' },
  { group: 'Tools', name: 'Records with a missing profile', detail: 'Rows pointing at a profile that no longer exists.' },
  { group: 'Tools', name: 'Implausible records', detail: 'Rows that would distort statistics, such as zero-gram meals.' },
  { group: 'Tools', name: 'Collections still empty', detail: 'Record types you have never used.' },
  { group: 'Tools', name: 'Photo storage', detail: 'Approximate space used by attached photos.' },
  { group: 'Tools', name: 'Route storage', detail: 'Route points stored and their approximate size.' },
  { group: 'Tools', name: 'Backup age', detail: 'How long since your last JSON export.' },
  { group: 'Tools', name: 'Records per profile', detail: 'The record count for each profile on this device.' },
  { group: 'Tools', name: 'Planned days', detail: 'Meal plans and the days they cover.' },
  { group: 'Tools', name: 'Template library', detail: 'Saved meal templates and their item counts.' },
  { group: 'Tools', name: 'Journal words', detail: 'Words written across your journal entries.' },
  { group: 'Tools', name: 'Local storage used', detail: 'Total size and collection count for this device.' },

  // Tools · copy shortcuts
  { group: 'Tools', name: 'Export every stat as CSV', detail: 'Download every Tools row as a spreadsheet.' },
  { group: 'Tools', name: 'Copy the tools summary', detail: 'Put every Tools row on the clipboard as plain text.' },
  { group: 'Tools', name: 'Copy yesterday’s breakfast', detail: 'Bring yesterday’s breakfast forward with one tap.' },
  { group: 'Tools', name: 'Copy yesterday’s lunch', detail: 'Bring yesterday’s lunch forward with one tap.' },
  { group: 'Tools', name: 'Copy yesterday’s dinner', detail: 'Bring yesterday’s dinner forward with one tap.' },
  { group: 'Tools', name: 'Copy yesterday’s snacks', detail: 'Bring yesterday’s snacks forward with one tap.' },

  // Settings
  { group: 'Settings', name: 'Metric and imperial units', detail: 'Weight, distance, water and height in either system.' },
  { group: 'Settings', name: 'Light and dark theme', detail: 'The MyFitnessPal-style light look, or a dark version.' },
  { group: 'Settings', name: 'Large and extra-large text', detail: 'Bigger type across the whole app.' },
  { group: 'Settings', name: 'Reduce motion', detail: 'Fewer transitions and effects.' },
  { group: 'Settings', name: 'Calorie goal with or without exercise', detail: 'Choose whether burned calories are added back.' },
  { group: 'Settings', name: 'Adjustable macro goals', detail: 'Protein per kilogram plus protein, carb and fat targets.' },
  { group: 'Settings', name: 'Adjustable water presets', detail: 'Choose the three quick-add amounts.' },
  { group: 'Settings', name: 'Editable nutrient limits', detail: 'Fiber, sugar and sodium targets.' },
  { group: 'Settings', name: 'Searchable feature index', detail: 'Every feature in the app, in one list.' },
  { group: 'Settings', name: 'Keyboard shortcuts', detail: 'Jump between sections and open the food search.' },
  { group: 'Settings', name: 'Privacy and limits', detail: 'What is stored, what is sent, and what is estimated.' },
]

export const FEATURE_COUNT = FEATURES.length

export function searchFeatures(query, list = FEATURES) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return list
  const terms = q.split(/\s+/)
  return list.filter(item => terms.every(term => `${item.group} ${item.name} ${item.detail}`.toLowerCase().includes(term)))
}
