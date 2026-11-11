// Live calculators for kcal. Every entry is a self-contained tool: a list of
// inputs, pure maths, and a formatted answer. No network, no dependencies.
//
// Values come from the UI as strings; `num()` coerces them safely so a blank
// or half-typed field never produces NaN on screen.

const num = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const r = (value, digits = 0) => {
  const factor = 10 ** digits
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor
}
const fmt = (value, digits = 0) => r(value, digits).toLocaleString('en-IN', { maximumFractionDigits: digits })
const kg = value => `${fmt(value, 1)} kg`
const kcal = value => `${fmt(value)} kcal`
const clampPct = value => Math.max(0, Math.min(100, value))

const ACTIVITY_OPTIONS = [
  { value: '1.2', label: 'Sedentary' },
  { value: '1.375', label: 'Light — 1-3 days' },
  { value: '1.55', label: 'Moderate — 3-5 days' },
  { value: '1.725', label: 'Active — 6-7 days' },
  { value: '1.9', label: 'Very active / labour' },
]

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

/** Mifflin-St Jeor — the least biased of the common BMR formulas. */
function mifflin(values) {
  const weight = num(values.weight, 70)
  const height = num(values.height, 170)
  const age = num(values.age, 30)
  const base = 10 * weight + 6.25 * height - 5 * age
  return num(values.sex === 'female' ? base - 161 : base + 5, 0)
}

function tdeeOf(values) {
  return mifflin(values) * num(values.activity, 1.375)
}

import { stepMetrics } from '../lib/movement.js'

export const CALCULATORS = [
  // ---------------- body ----------------
  {
    id: 'bmi', group: 'Body', title: 'BMI', note: 'Weight ÷ height². A screening number, not a diagnosis.',
    fields: [
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'height', label: 'Height', unit: 'cm', value: 170 },
    ],
    compute: v => {
      const height = num(v.height, 170) / 100
      const bmi = height > 0 ? num(v.weight, 70) / (height * height) : 0
      const band = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy range' : bmi < 30 ? 'Overweight' : 'Obese'
      const low = 18.5 * height * height
      const high = 24.9 * height * height
      return { headline: fmt(bmi, 1), unit: 'BMI', note: band, tone: bmi >= 18.5 && bmi < 25 ? 'good' : 'amber', rows: [['Healthy weight for this height', `${fmt(low, 1)} – ${fmt(high, 1)} kg`]] }
    },
  },
  {
    id: 'bmr', group: 'Body', title: 'BMR (Mifflin-St Jeor)', note: 'Resting burn before any movement.',
    fields: [
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'height', label: 'Height', unit: 'cm', value: 170 },
      { key: 'age', label: 'Age', unit: 'yrs', value: 30 },
      { key: 'sex', label: 'Sex', type: 'select', options: SEX_OPTIONS, value: 'male' },
    ],
    compute: v => ({ headline: fmt(mifflin(v)), unit: 'kcal/day', note: 'Burned at complete rest', rows: [['Per hour', kcal(mifflin(v) / 24)]] }),
  },
  {
    id: 'tdee', group: 'Body', title: 'TDEE', note: 'Daily burn including your typical activity.',
    fields: [
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'height', label: 'Height', unit: 'cm', value: 170 },
      { key: 'age', label: 'Age', unit: 'yrs', value: 30 },
      { key: 'sex', label: 'Sex', type: 'select', options: SEX_OPTIONS, value: 'male' },
      { key: 'activity', label: 'Activity', type: 'select', options: ACTIVITY_OPTIONS, value: '1.375' },
    ],
    compute: v => {
      const base = mifflin(v)
      const total = tdeeOf(v)
      return { headline: fmt(total), unit: 'kcal/day', note: `${fmt(total - base)} kcal above BMR`, rows: [['Cut 10%', kcal(total * 0.9)], ['Bulk +10%', kcal(total * 1.1)]] }
    },
  },
  {
    id: 'bodyfat', group: 'Body', title: 'Body fat (US Navy)', note: 'Tape-measure estimate, ±3%.',
    fields: [
      { key: 'sex', label: 'Sex', type: 'select', options: SEX_OPTIONS, value: 'male' },
      { key: 'height', label: 'Height', unit: 'cm', value: 170 },
      { key: 'waist', label: 'Waist', unit: 'cm', value: 85 },
      { key: 'neck', label: 'Neck', unit: 'cm', value: 38 },
      { key: 'hip', label: 'Hip (women)', unit: 'cm', value: 95 },
    ],
    compute: v => {
      const height = num(v.height, 170)
      const waist = num(v.waist, 85)
      const neck = num(v.neck, 38)
      const hip = num(v.hip, 95)
      const male = 495 / (1.0324 - 0.19077 * Math.log10(Math.max(1, waist - neck)) + 0.15456 * Math.log10(Math.max(1, height))) - 450
      const female = 495 / (1.29579 - 0.35004 * Math.log10(Math.max(1, waist + hip - neck)) + 0.221 * Math.log10(Math.max(1, height))) - 450
      const value = v.sex === 'female' ? female : male
      const safe = Math.max(3, Math.min(60, Number.isFinite(value) ? value : 0))
      return { headline: fmt(safe, 1), unit: '% body fat', note: safe < 20 ? 'Athletic / lean range' : safe < 25 ? 'Average range' : 'Above average', rows: [['Lean mass at 70 kg', kg(70 * (1 - safe / 100))]] }
    },
  },
  {
    id: 'lean-mass', group: 'Body', title: 'Lean body mass', note: 'Weight minus fat mass.',
    fields: [
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'bf', label: 'Body fat', unit: '%', value: 20 },
    ],
    compute: v => {
      const fat = num(v.weight, 70) * clampPct(num(v.bf, 20)) / 100
      return { headline: kg(num(v.weight, 70) - fat), note: 'Everything that is not fat', rows: [['Fat mass', kg(fat)], ['Protein target at 1.8 g/kg lean', `${fmt((num(v.weight, 70) - fat) * 1.8)} g`]] }
    },
  },
  {
    id: 'ideal-weight', group: 'Body', title: 'Ideal weight (Devine)', note: 'Clinical dosing formula; a range matters more than one number.',
    fields: [
      { key: 'height', label: 'Height', unit: 'cm', value: 170 },
      { key: 'sex', label: 'Sex', type: 'select', options: SEX_OPTIONS, value: 'male' },
    ],
    compute: v => {
      const inches = num(v.height, 170) / 2.54
      const base = v.sex === 'female' ? 45.5 : 50
      const ideal = base + 2.3 * Math.max(0, inches - 60)
      return { headline: kg(ideal), note: 'Devine formula', rows: [['±10% range', `${fmt(ideal * 0.9, 1)} – ${fmt(ideal * 1.1, 1)} kg`]] }
    },
  },
  {
    id: 'waist-height', group: 'Body', title: 'Waist-to-height ratio', note: 'Below 0.5 is the usual healthy guide.',
    fields: [
      { key: 'waist', label: 'Waist', unit: 'cm', value: 85 },
      { key: 'height', label: 'Height', unit: 'cm', value: 170 },
    ],
    compute: v => {
      const ratio = num(v.waist, 85) / Math.max(1, num(v.height, 170))
      return { headline: fmt(ratio, 2), note: ratio < 0.5 ? 'Healthy' : ratio < 0.6 ? 'Elevated' : 'High', tone: ratio < 0.5 ? 'good' : 'amber', rows: [['Waist at 0.5 for this height', `${fmt(num(v.height, 170) * 0.5, 0)} cm`]] }
    },
  },
  {
    id: 'water', group: 'Body', title: 'Water target', note: '35 ml/kg plus a training allowance.',
    fields: [
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'exercise', label: 'Exercise today', unit: 'min', value: 30 },
    ],
    compute: v => {
      const base = num(v.weight, 70) * 35
      const extra = num(v.exercise, 30) * 12
      return { headline: `${fmt((base + extra) / 1000, 1)} L`, note: `${fmt(8 * 1)} glasses of 250 ml ≈ ${fmt((base + extra) / 250, 0)} glasses`, rows: [['Base need', `${fmt(base / 1000, 1)} L`], ['Training allowance', `${fmt(extra / 1000, 1)} L`]] }
    },
  },
  {
    id: 'protein', group: 'Body', title: 'Protein target', note: 'Higher while cutting or lifting.',
    fields: [
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'rate', label: 'g per kg', value: 1.8 },
    ],
    compute: v => {
      const grams = num(v.weight, 70) * num(v.rate, 1.8)
      return { headline: `${fmt(grams)} g`, note: `${kcal(grams * 4)} of protein`, rows: [['Per meal across 3 meals', `${fmt(grams / 3)} g`], ['Whey scoops (24 g each)', fmt(grams / 24, 1)]] }
    },
  },
  {
    id: 'fibre', group: 'Body', title: 'Fibre target', note: '14 g per 1,000 kcal is the standard guide.',
    fields: [{ key: 'calories', label: 'Daily calories', unit: 'kcal', value: 2000 }],
    compute: v => {
      const grams = num(v.calories, 2000) * 14 / 1000
      return { headline: `${fmt(grams)} g`, note: 'Aim for variety: pulses, fruit, vegetables, whole grains', rows: [['Cups of cooked dal', fmt(grams / 5, 1)], ['Grams of chia to close a 10 g gap', fmt(10 / 0.34, 0)]] }
    },
  },
  {
    id: 'deficit', group: 'Body', title: 'Calorie deficit planner', note: 'Shows the weekly loss a deficit really produces.',
    fields: [
      { key: 'tdee', label: 'TDEE', unit: 'kcal', value: 2400 },
      { key: 'intake', label: 'Planned intake', unit: 'kcal', value: 1900 },
    ],
    compute: v => {
      const deficit = num(v.tdee, 2400) - num(v.intake, 1900)
      const weekly = deficit * 7 / 7700
      return {
        headline: `${fmt(deficit)} kcal`, unit: 'per day', tone: deficit > 0 ? 'good' : 'bad',
        note: deficit > 0 ? 'Daily deficit' : 'Daily surplus',
        rows: [['Weekly weight change', kg(weekly)], ['Monthly', kg(weekly * 4.345)], ['Share of TDEE', `${fmt(num(v.tdee, 2400) ? (deficit / num(v.tdee, 2400)) * 100 : 0)}%`]],
      }
    },
  },
  {
    id: 'time-to-goal', group: 'Body', title: 'Time to goal weight', note: 'At a steady deficit of 7,700 kcal per kg.',
    fields: [
      { key: 'current', label: 'Current', unit: 'kg', value: 78 },
      { key: 'goal', label: 'Goal', unit: 'kg', value: 70 },
      { key: 'deficit', label: 'Daily deficit', unit: 'kcal', value: 400 },
    ],
    compute: v => {
      const delta = Math.abs(num(v.current, 78) - num(v.goal, 70))
      const daily = Math.abs(num(v.deficit, 400))
      const days = daily > 0 ? delta * 7700 / daily : 0
      return {
        headline: days > 0 ? `${fmt(days)} days` : '—', note: days > 0 ? `About ${fmt(days / 7, 1)} weeks for ${kg(delta)}` : 'Add a deficit to see a date',
        rows: [['Weekly rate', kg(daily * 7 / 7700)], ['Finish around', days > 0 ? new Date(Date.now() + days * 86_400_000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—']],
      }
    },
  },
  {
    id: 'weekly-rate', group: 'Body', title: 'Weight change rate', note: '0.5–1% of body weight per week is the sustainable band.',
    fields: [
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'week', label: 'Change this week', unit: 'kg', value: -0.4 },
    ],
    compute: v => {
      const pct = num(v.week, -0.4) / Math.max(1, num(v.weight, 70)) * 100
      const band = Math.abs(pct) <= 1 ? 'Inside the sustainable band' : 'Faster than usual — watch recovery'
      return { headline: `${fmt(pct, 2)}%`, unit: 'per week', note: band, tone: Math.abs(pct) <= 1 ? 'good' : 'amber', rows: [['Over four weeks', kg(num(v.week, -0.4) * 4.345)]] }
    },
  },
  {
    id: 'macro-split', group: 'Body', title: 'Macro split from calories', note: 'Percentages must add to 100.',
    fields: [
      { key: 'calories', label: 'Calories', unit: 'kcal', value: 2000 },
      { key: 'protein', label: 'Protein', unit: '%', value: 30 },
      { key: 'carbs', label: 'Carbs', unit: '%', value: 40 },
      { key: 'fat', label: 'Fat', unit: '%', value: 30 },
    ],
    compute: v => {
      const c = num(v.calories, 2000)
      const total = num(v.protein, 30) + num(v.carbs, 40) + num(v.fat, 30)
      return {
        headline: `${fmt(total)}%`, unit: 'allocated', tone: Math.abs(total - 100) < 1 ? 'good' : 'amber',
        note: Math.abs(total - 100) < 1 ? 'Balanced allocation' : `Adjust by ${fmt(100 - total)}% to reach 100`,
        rows: [
          ['Protein', `${fmt(c * num(v.protein, 30) / 100 / 4)} g`],
          ['Carbs', `${fmt(c * num(v.carbs, 40) / 100 / 4)} g`],
          ['Fat', `${fmt(c * num(v.fat, 30) / 100 / 9)} g`],
        ],
      }
    },
  },
  {
    id: 'net-carbs', group: 'Body', title: 'Net carbs', note: 'Total carbs minus fibre.',
    fields: [
      { key: 'carbs', label: 'Total carbs', unit: 'g', value: 45 },
      { key: 'fibre', label: 'Fibre', unit: 'g', value: 8 },
    ],
    compute: v => {
      const net = Math.max(0, num(v.carbs, 45) - num(v.fibre, 8))
      return { headline: `${fmt(net)} g`, note: `${fmt(net * 4)} kcal of digestible carbohydrate`, rows: [['Share that is fibre', `${fmt(num(v.carbs, 45) ? (num(v.fibre, 8) / num(v.carbs, 45)) * 100 : 0)}%`]] }
    },
  },
  {
    id: 'glycemic-load', group: 'Body', title: 'Glycemic load', note: 'GI × available carbs ÷ 100. Under 10 is low.',
    fields: [
      { key: 'gi', label: 'Glycemic index', value: 55 },
      { key: 'carbs', label: 'Carbs in serving', unit: 'g', value: 30 },
    ],
    compute: v => {
      const load = num(v.gi, 55) * num(v.carbs, 30) / 100
      return { headline: fmt(load, 1), note: load < 10 ? 'Low' : load < 20 ? 'Moderate' : 'High', tone: load < 10 ? 'good' : 'amber', rows: [['Carb grams to stay under 10 GL', `${fmt(num(v.gi, 55) ? 1000 / num(v.gi, 55) : 0)} g`]] }
    },
  },
  {
    id: 'carb-cycle', group: 'Body', title: 'Carb cycling', note: 'High days around training, low days on rest.',
    fields: [
      { key: 'calories', label: 'Weekly calories', unit: 'kcal', value: 14_000 },
      { key: 'highDays', label: 'High days', value: 3 },
      { key: 'ratio', label: 'High:low carb ratio', value: 2 },
    ],
    compute: v => {
      const high = Math.max(0, Math.min(7, num(v.highDays, 3)))
      const low = 7 - high
      const ratio = Math.max(0.5, num(v.ratio, 2))
      const weight = high * ratio + low
      const per = num(v.calories, 14_000) / Math.max(1, weight)
      return {
        headline: `${fmt(per * ratio / 4)} g`, unit: 'carbs on high days',
        rows: [['Low-day carbs', `${fmt(per / 4)} g`], ['High-day calories', kcal(per * ratio)], ['Low-day calories', kcal(per)]],
      }
    },
  },
  {
    id: 'refeed', group: 'Body', title: 'Refeed day budget', note: 'Adds carbs back at maintenance for a day.',
    fields: [
      { key: 'tdee', label: 'TDEE', unit: 'kcal', value: 2400 },
      { key: 'intake', label: 'Current intake', unit: 'kcal', value: 1900 },
    ],
    compute: v => {
      const tdee = num(v.tdee, 2400)
      return { headline: kcal(tdee), unit: 'on the refeed day', rows: [['Extra carbs vs now', `${fmt((tdee - num(v.intake, 1900)) / 4)} g`], ['Extra calories', kcal(tdee - num(v.intake, 1900))]] }
    },
  },
  {
    id: 'calorie-floor', group: 'Body', title: 'Safe calorie floor', note: 'Never plan below your resting burn by much.',
    fields: [{ key: 'bmr', label: 'BMR', unit: 'kcal', value: 1600 }],
    compute: v => {
      const floor = num(v.bmr, 1600) * 1.1
      return { headline: kcal(floor), note: 'A softer floor than BMR alone protects muscle and energy', rows: [['Protein at the floor', `${fmt(floor * 0.3 / 4)} g`]] }
    },
  },

  // ---------------- activity ----------------
  {
    id: 'met-burn', group: 'Activity', title: 'Exercise burn (MET)', note: 'Net of resting: (MET − 1) × 3.5 × kg ÷ 200 × minutes.',
    fields: [
      { key: 'met', label: 'MET of activity', value: 6 },
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'minutes', label: 'Minutes', value: 45 },
    ],
    compute: v => {
      const net = (num(v.met, 6) - 1) * 3.5 * num(v.weight, 70) / 200
      const gross = num(v.met, 6) * 3.5 * num(v.weight, 70) / 200
      return { headline: kcal(net * num(v.minutes, 45)), note: `${fmt(net, 1)} kcal/min active · ${fmt(gross, 1)} including resting`, rows: [['Per hour active', kcal(net * 60)], ['A brisk walk is about 4.3 MET', kcal((4.3 - 1) * 3.5 * num(v.weight, 70) / 200 * num(v.minutes, 45))]] }
    },
  },
  {
    id: 'steps-burn', group: 'Activity', title: 'Calories from steps', note: 'Distance × body weight, using your stride and cadence.',
    fields: [
      { key: 'steps', label: 'Steps', value: 8000 },
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'height', label: 'Height', unit: 'cm', value: 170 },
      { key: 'cadence', label: 'Steps per minute', value: 100 },
    ],
    compute: v => {
      const profile = { weightKg: num(v.weight, 70), heightCm: num(v.height, 170), stepCadence: num(v.cadence, 100) }
      const metrics = stepMetrics({ steps: num(v.steps, 8000), profile })
      return {
        headline: kcal(metrics.activeKcal),
        note: `${fmt(metrics.distanceKm, 2)} km at ${Math.round(metrics.strideM * 100)} cm stride`,
        rows: [
          ['Distance', `${fmt(metrics.distanceKm, 2)} km`],
          ['Walking time', `${fmt(metrics.minutes)} min at ${fmt(metrics.speedKmh, 1)} km/h`],
          ['Including resting metabolism', kcal(metrics.grossKcal)],
          ['Per 1,000 steps', kcal(metrics.kcalPerStep * 1000)],
        ],
      }
    },
  },
  {
    id: 'walk-time', group: 'Activity', title: 'Walk time for a target', note: 'How long a step goal takes at your cadence.',
    fields: [
      { key: 'steps', label: 'Steps', value: 8000 },
      { key: 'cadence', label: 'Steps per minute', value: 110 },
      { key: 'height', label: 'Height', unit: 'cm', value: 170 },
    ],
    compute: v => {
      const metrics = stepMetrics({ steps: num(v.steps, 8000), profile: { heightCm: num(v.height, 170), stepCadence: num(v.cadence, 110), weightKg: 70 } })
      return { headline: `${fmt(metrics.minutes)} min`, note: `${fmt(metrics.distanceKm, 2)} km · ${fmt(metrics.speedKmh, 1)} km/h`, rows: [['Distance', `${fmt(metrics.distanceKm, 2)} km`], ['Active burn at 70 kg', kcal(metrics.activeKcal)]] }
    },
  },
  {
    id: '1rm', group: 'Activity', title: 'One-rep max (Epley)', note: 'Estimate from a set you actually did.',
    fields: [
      { key: 'weight', label: 'Weight lifted', unit: 'kg', value: 60 },
      { key: 'reps', label: 'Reps', value: 8 },
    ],
    compute: v => {
      const reps = Math.max(1, num(v.reps, 8))
      const max = num(v.weight, 60) * (1 + reps / 30)
      return { headline: kg(max), note: 'Estimated 1RM', rows: [['5 reps at', kg(max * 0.9)], ['10 reps at', kg(max * 0.75)]] }
    },
  },
  {
    id: 'hr-zones', group: 'Activity', title: 'Heart-rate zones', note: 'Simple 220-minus-age estimate.',
    fields: [{ key: 'age', label: 'Age', unit: 'yrs', value: 30 }],
    compute: v => {
      const max = 220 - num(v.age, 30)
      return {
        headline: `${fmt(max)} bpm`, unit: 'estimated max',
        rows: [['Zone 1 recovery', `${fmt(max * 0.5)}–${fmt(max * 0.6)}`], ['Zone 2 easy', `${fmt(max * 0.6)}–${fmt(max * 0.7)}`], ['Zone 3 tempo', `${fmt(max * 0.7)}–${fmt(max * 0.8)}`], ['Zone 4 threshold', `${fmt(max * 0.8)}–${fmt(max * 0.9)}`], ['Zone 5 max', `${fmt(max * 0.9)}–${fmt(max)}`]],
      }
    },
  },
  {
    id: 'vo2max', group: 'Activity', title: 'VO₂ max (Rockport)', note: 'From a walk test: 1.6 km as fast as you can.',
    fields: [
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'age', label: 'Age', unit: 'yrs', value: 30 },
      { key: 'minutes', label: 'Walk time', unit: 'min', value: 14 },
      { key: 'hr', label: 'Pulse at finish', unit: 'bpm', value: 140 },
      { key: 'sex', label: 'Sex', type: 'select', options: SEX_OPTIONS, value: 'male' },
    ],
    compute: v => {
      const value = 132.853 - 0.0769 * num(v.weight, 70) - 0.3877 * num(v.age, 30) + 6.315 * (v.sex === 'female' ? 0 : 1) - 3.2649 * num(v.minutes, 14) - 0.1565 * num(v.hr, 140)
      const safe = Math.max(10, Math.min(80, value))
      return { headline: fmt(safe, 1), unit: 'ml/kg/min', note: safe < 30 ? 'Below average' : safe < 45 ? 'Average' : 'Above average', rows: [['Fitness band', safe < 30 ? 'Build an aerobic base' : safe < 45 ? 'Solid for most goals' : 'Strong aerobic engine']] }
    },
  },
  {
    id: 'pace', group: 'Activity', title: 'Pace and speed', note: 'Distance and time to pace.',
    fields: [
      { key: 'distance', label: 'Distance', unit: 'km', value: 5 },
      { key: 'minutes', label: 'Time', unit: 'min', value: 30 },
    ],
    compute: v => {
      const distance = Math.max(0.1, num(v.distance, 5))
      const minutes = Math.max(0.1, num(v.minutes, 30))
      const pace = minutes / distance
      return { headline: `${fmt(Math.floor(pace))}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')}`, unit: 'per km', rows: [['Speed', `${fmt(distance / (minutes / 60), 1)} km/h`], ['5K at this pace', `${fmt(pace * 5, 0)} min`], ['10K at this pace', `${fmt(pace * 10, 0)} min`]] }
    },
  },
  {
    id: 'cycle-burn', group: 'Activity', title: 'Cycling burn', note: 'Speed decides the MET.',
    fields: [
      { key: 'speed', label: 'Speed', unit: 'km/h', value: 20 },
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'minutes', label: 'Minutes', value: 45 },
    ],
    compute: v => {
      const speed = num(v.speed, 20)
      const met = speed < 16 ? 4 : speed < 19 ? 6.8 : speed < 22 ? 8 : speed < 25 ? 10 : 12
      const burn = met * 3.5 * num(v.weight, 70) / 200 * num(v.minutes, 45)
      return { headline: kcal(burn), note: `${fmt(met, 1)} MET at ${fmt(speed)} km/h`, rows: [['Per hour', kcal(burn * 60 / Math.max(1, num(v.minutes, 45)))]] }
    },
  },
  {
    id: 'hike-burn', group: 'Activity', title: 'Hiking burn', note: 'Uphill adds roughly 0.5 MET per 100 m of climb.',
    fields: [
      { key: 'weight', label: 'Weight', unit: 'kg', value: 70 },
      { key: 'hours', label: 'Hours', value: 3 },
      { key: 'climb', label: 'Climb', unit: 'm', value: 400 },
    ],
    compute: v => {
      const met = 6 + num(v.climb, 400) / 200
      const burn = met * 3.5 * num(v.weight, 70) / 200 * num(v.hours, 3) * 60
      return { headline: kcal(burn), note: `${fmt(met, 1)} MET average`, rows: [['Per hour', kcal(burn / Math.max(0.1, num(v.hours, 3)))], ['Water to carry', `${fmt(num(v.hours, 3) * 0.5, 1)} L`]] }
    },
  },

  // ---------------- food ----------------
  {
    id: 'recipe-scale', group: 'Food', title: 'Recipe scaler', note: 'Rescale a recipe to the servings you cooked.',
    fields: [
      { key: 'calories', label: 'Calories in recipe', unit: 'kcal', value: 1800 },
      { key: 'servings', label: 'Recipe servings', value: 4 },
      { key: 'wanted', label: 'Servings you want', value: 5 },
    ],
    compute: v => {
      const per = num(v.calories, 1800) / Math.max(1, num(v.servings, 4))
      return { headline: kcal(per * Math.max(1, num(v.wanted, 5))), note: `${kcal(per)} per serving`, rows: [['Scale factor', `×${fmt(num(v.wanted, 5) / Math.max(1, num(v.servings, 4)), 2)}`]] }
    },
  },
  {
    id: 'per-100g', group: 'Food', title: 'Per-100 g converter', note: 'Match a nutrition label to a portion.',
    fields: [
      { key: 'kcal100', label: 'Calories per 100 g', value: 120 },
      { key: 'grams', label: 'Portion', unit: 'g', value: 180 },
    ],
    compute: v => {
      const portion = num(v.kcal100, 120) * num(v.grams, 180) / 100
      return { headline: kcal(portion), note: `${fmt(num(v.grams, 180) / 100, 2)} × 100 g`, rows: [['Calories per gram', fmt(num(v.kcal100, 120) / 100, 2)], ['Two portions', kcal(portion * 2)]] }
    },
  },
  {
    id: 'dv', group: 'Food', title: 'Percent of daily value', note: 'Against a 2,000 kcal reference day.',
    fields: [
      { key: 'value', label: 'Nutrient amount', unit: 'g', value: 12 },
      { key: 'reference', label: 'Reference (g per day)', value: 50 },
    ],
    compute: v => {
      const pct = Math.max(0, num(v.reference, 50)) > 0 ? num(v.value, 12) / Math.max(0.01, num(v.reference, 50)) * 100 : 0
      return { headline: `${fmt(pct)}%`, note: 'of the daily value', rows: [['To hit 100%', `${fmt(num(v.reference, 50))} g`]] }
    },
  },
  {
    id: 'alcohol', group: 'Food', title: 'Alcohol calories', note: '7 kcal per gram of pure alcohol.',
    fields: [
      { key: 'ml', label: 'Drink volume', unit: 'ml', value: 330 },
      { key: 'abv', label: 'ABV', unit: '%', value: 5 },
      { key: 'count', label: 'Drinks', value: 1 },
    ],
    compute: v => {
      const grams = num(v.ml, 330) * num(v.abv, 5) / 100 * 0.789
      const each = grams * 7
      return { headline: kcal(each * num(v.count, 1)), note: `${fmt(grams, 1)} g alcohol per drink`, rows: [['Share of a 2,000 kcal day', `${fmt(num(v.count, 1) * each / 2000 * 100)}%`]] }
    },
  },
  {
    id: 'plate', group: 'Food', title: 'Plate balance score', note: 'Half vegetables, a quarter protein, a quarter carbs.',
    fields: [
      { key: 'veg', label: 'Vegetables', unit: '%', value: 50 },
      { key: 'protein', label: 'Protein', unit: '%', value: 25 },
      { key: 'carbs', label: 'Carbs', unit: '%', value: 25 },
    ],
    compute: v => {
      const total = num(v.veg, 50) + num(v.protein, 25) + num(v.carbs, 25)
      const score = clampPct(100 - (Math.abs(num(v.veg, 50) - 50) + Math.abs(num(v.protein, 25) - 25) + Math.abs(num(v.carbs, 25) - 25)) / 1.5)
      return { headline: `${fmt(score)}%`, note: score > 80 ? 'Well built plate' : score > 55 ? 'Close — add vegetables' : 'Rebuild the plate', tone: score > 80 ? 'good' : 'amber', rows: [['Total', `${fmt(total)}%`], ['Largest share', num(v.veg, 50) >= num(v.protein, 25) && num(v.veg, 50) >= num(v.carbs, 25) ? 'Vegetables' : num(v.protein, 25) >= num(v.carbs, 25) ? 'Protein' : 'Carbs']] }
    },
  },
  {
    id: 'density', group: 'Food', title: 'Calorie density', note: 'kcal per 100 g tells you how filling a food is.',
    fields: [
      { key: 'kcal', label: 'Calories', value: 250 },
      { key: 'grams', label: 'Weight', unit: 'g', value: 200 },
    ],
    compute: v => {
      const density = num(v.kcal, 250) / Math.max(1, num(v.grams, 200)) * 100
      return { headline: fmt(density), unit: 'kcal/100 g', note: density < 100 ? 'Very filling' : density < 250 ? 'Moderate' : density < 400 ? 'Dense' : 'Very dense', tone: density < 250 ? 'good' : 'amber', rows: [['Grams for 300 kcal', `${fmt(300 / Math.max(1, density) * 100)} g`]] }
    },
  },
  {
    id: 'swap', group: 'Food', title: 'Food swap savings', note: 'What a swap does over a week and a month.',
    fields: [
      { key: 'a', label: 'Current food', unit: 'kcal', value: 550 },
      { key: 'b', label: 'Swap food', unit: 'kcal', value: 380 },
      { key: 'times', label: 'Times per week', value: 4 },
    ],
    compute: v => {
      const delta = (num(v.a, 550) - num(v.b, 380)) * num(v.times, 4)
      return { headline: kcal(delta), unit: 'per week', tone: delta > 0 ? 'good' : 'amber', note: delta > 0 ? 'Saved each week' : 'This swap adds calories', rows: [['Per month', kcal(delta * 4.345)], ['Weight impact per month', kg(delta * 4.345 / 7700)]] }
    },
  },
  {
    id: 'restaurant', group: 'Food', title: 'Restaurant buffer', note: 'How much room a meal out leaves.',
    fields: [
      { key: 'target', label: 'Daily target', unit: 'kcal', value: 2000 },
      { key: 'eaten', label: 'Already eaten', unit: 'kcal', value: 900 },
      { key: 'menu', label: 'Menu item', unit: 'kcal', value: 850 },
    ],
    compute: v => {
      const room = num(v.target, 2000) - num(v.eaten, 900)
      const over = num(v.menu, 850) - room
      return { headline: kcal(Math.abs(over)), unit: over > 0 ? 'over budget' : 'spare', tone: over > 0 ? 'bad' : 'good', note: over > 0 ? 'Split the dish or walk it off' : 'Fits your day', rows: [['Walk to offset overshoot', `${fmt(over > 0 ? over / 4.3 : 0)} min`]] }
    },
  },
  {
    id: 'cost-kcal', group: 'Food', title: 'Cost per 1,000 kcal', note: 'Protein per rupee matters as much as price.',
    fields: [
      { key: 'price', label: 'Price', unit: '₹', value: 120 },
      { key: 'kcal', label: 'Calories', value: 500 },
      { key: 'protein', label: 'Protein', unit: 'g', value: 20 },
    ],
    compute: v => {
      const perKcal = num(v.price, 120) / Math.max(1, num(v.kcal, 500)) * 1000
      return { headline: `₹${fmt(perKcal)}`, unit: 'per 1,000 kcal', rows: [['Cost per 10 g protein', `₹${fmt(num(v.price, 120) / Math.max(1, num(v.protein, 20)) * 10, 1)}`]] }
    },
  },

  // ---------------- units ----------------
  {
    id: 'kg-lb', group: 'Units', title: 'kg ↔ lb', note: '1 kg = 2.20462 lb.',
    fields: [{ key: 'kg', label: 'Kilograms', unit: 'kg', value: 70 }],
    compute: v => ({ headline: `${fmt(num(v.kg, 70) * 2.20462, 1)} lb`, note: 'Pounds', rows: [['Stones and pounds', `${fmt(num(v.kg, 70) * 2.20462 / 14, 1)} st`]] }),
  },
  {
    id: 'cm-in', group: 'Units', title: 'cm ↔ in', note: '1 in = 2.54 cm.',
    fields: [{ key: 'cm', label: 'Centimetres', unit: 'cm', value: 170 }],
    compute: v => {
      const totalInches = num(v.cm, 170) / 2.54
      return { headline: `${fmt(totalInches, 1)} in`, note: 'Inches', rows: [['Feet and inches', `${Math.floor(totalInches / 12)}′ ${fmt(totalInches % 12, 1)}″`]] }
    },
  },
  {
    id: 'ml-oz', group: 'Units', title: 'ml ↔ fl oz', note: '1 fl oz = 29.5735 ml.',
    fields: [{ key: 'ml', label: 'Millilitres', unit: 'ml', value: 500 }],
    compute: v => ({ headline: `${fmt(num(v.ml, 500) / 29.5735, 1)} oz`, note: 'US fluid ounces', rows: [['Cups (240 ml)', fmt(num(v.ml, 500) / 240, 2)]] }),
  },
  {
    id: 'kcal-kj', group: 'Units', title: 'kcal ↔ kJ', note: '1 kcal = 4.184 kJ.',
    fields: [{ key: 'kcal', label: 'Kilocalories', unit: 'kcal', value: 500 }],
    compute: v => ({ headline: `${fmt(num(v.kcal, 500) * 4.184)} kJ`, note: 'Kilojoules', rows: [['Kilojoules → kcal', `${fmt(num(v.kcal, 500) * 4.184 / 4.184)} kcal`]] }),
  },
  {
    id: 'temp', group: 'Units', title: '°C ↔ °F', note: 'For oven and body temperatures.',
    fields: [{ key: 'c', label: 'Celsius', unit: '°C', value: 180 }],
    compute: v => ({ headline: `${fmt(num(v.c, 180) * 9 / 5 + 32)} °F`, note: 'Fahrenheit', rows: [['Body temperature 37 °C', `${fmt(98.6)} °F`]] }),
  },
]

export const CALCULATOR_GROUPS = ['Body', 'Activity', 'Food', 'Units']
export { kcal as formatKcal, kg as formatKg, fmt as formatNumber }
