// MET values are approximate averages from the Compendium of Physical
// Activities. Burn maths lives in lib/movement.js so every screen agrees.
import { exerciseCalories as netExerciseCalories, exerciseGross } from '../lib/movement.js'

export const EXERCISES = [
  { id: 'walk-slow', name: 'Walking, easy', met: 2.8, group: 'Walking' },
  { id: 'walk', name: 'Walking, brisk', met: 4.3, group: 'Walking' },
  { id: 'walk-hills', name: 'Walking uphill', met: 6, group: 'Walking' },
  { id: 'hike', name: 'Hiking', met: 6.5, group: 'Walking' },
  { id: 'stairs', name: 'Stair climbing', met: 8.8, group: 'Walking' },
  { id: 'run-easy', name: 'Running, easy jog', met: 7, group: 'Running' },
  { id: 'run', name: 'Running, 8 km/h', met: 8.3, group: 'Running' },
  { id: 'run-fast', name: 'Running, 11 km/h', met: 11, group: 'Running' },
  { id: 'treadmill', name: 'Treadmill incline', met: 9, group: 'Running' },
  { id: 'cycle-easy', name: 'Cycling, leisure', met: 5.8, group: 'Cycling' },
  { id: 'cycle', name: 'Cycling, moderate', met: 7.5, group: 'Cycling' },
  { id: 'cycle-fast', name: 'Cycling, vigorous', met: 10, group: 'Cycling' },
  { id: 'spinning', name: 'Indoor spin class', met: 8.5, group: 'Cycling' },
  { id: 'swim', name: 'Swimming, laps', met: 7, group: 'Water' },
  { id: 'swim-easy', name: 'Swimming, leisure', met: 5, group: 'Water' },
  { id: 'aqua', name: 'Aqua aerobics', met: 5.5, group: 'Water' },
  { id: 'strength', name: 'Weight training', met: 5, group: 'Strength' },
  { id: 'strength-heavy', name: 'Heavy strength session', met: 6.5, group: 'Strength' },
  { id: 'circuit', name: 'Circuit training', met: 8, group: 'Strength' },
  { id: 'hiit', name: 'HIIT', met: 9, group: 'Strength' },
  { id: 'calisthenics', name: 'Calisthenics', met: 6, group: 'Strength' },
  { id: 'yoga', name: 'Yoga, hatha', met: 2.5, group: 'Mind & body' },
  { id: 'yoga-power', name: 'Power yoga', met: 4, group: 'Mind & body' },
  { id: 'pilates', name: 'Pilates', met: 3, group: 'Mind & body' },
  { id: 'stretch', name: 'Stretching', met: 2.3, group: 'Mind & body' },
  { id: 'dance', name: 'Dancing', met: 5.5, group: 'Sport' },
  { id: 'zumba', name: 'Zumba', met: 6.5, group: 'Sport' },
  { id: 'badminton', name: 'Badminton', met: 5.5, group: 'Sport' },
  { id: 'tennis', name: 'Tennis', met: 7.3, group: 'Sport' },
  { id: 'cricket', name: 'Cricket', met: 4.8, group: 'Sport' },
  { id: 'football', name: 'Football', met: 7, group: 'Sport' },
  { id: 'basketball', name: 'Basketball', met: 6.5, group: 'Sport' },
  { id: 'volleyball', name: 'Volleyball', met: 4, group: 'Sport' },
  { id: 'boxing', name: 'Boxing training', met: 8, group: 'Sport' },
  { id: 'martial-arts', name: 'Martial arts', met: 10, group: 'Sport' },
  { id: 'skipping', name: 'Skipping rope', met: 11, group: 'Sport' },
  { id: 'gardening', name: 'Gardening', met: 3.8, group: 'Daily life' },
  { id: 'housework', name: 'Housework', met: 3.3, group: 'Daily life' },
  { id: 'cooking', name: 'Cooking', met: 2, group: 'Daily life' },
  { id: 'desk', name: 'Desk work', met: 1.3, group: 'Daily life' },
  { id: 'commute-cycle', name: 'Cycle commute', met: 6.8, group: 'Daily life' },
  { id: 'play-kids', name: 'Playing with children', met: 4, group: 'Daily life' },
]

export const EXERCISE_GROUPS = [...new Set(EXERCISES.map(item => item.group))]

export const EXERCISE_MAP = new Map(EXERCISES.map(item => [item.id, item]))

/** Active (net of resting) calories — the number credited back to the budget. */
export function exerciseCalories(met, minutes, weightKg) {
  return netExerciseCalories(met, minutes, weightKg)
}

/** Same burn including resting metabolism, for reference only. */
export function exerciseCaloriesGross(met, minutes, weightKg) {
  return exerciseGross(met, minutes, weightKg)
}
