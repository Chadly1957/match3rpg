export interface LevelDef {
  id: number
  name: string
  goalScore: number
}

// Level 1's goal, then every level after compounds by GOAL_GROWTH — a
// single clean exponential instead of hand-tuned early levels plus a
// separate formula for the rest, since that hybrid stopped being easier to
// reason about than just picking a rate. Rounded to the nearest 50 for
// clean numbers.
const BASE_GOAL = 250
const GOAL_GROWTH = 1.3
const LEVEL_COUNT = 20
const ROUND_TO = 50

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step
}

function goalScoreForLevel(id: number): number {
  return roundToNearest(BASE_GOAL * GOAL_GROWTH ** (id - 1), ROUND_TO)
}

export const LEVELS: LevelDef[] = Array.from({ length: LEVEL_COUNT }, (_, i) => {
  const id = i + 1
  return { id, name: `Level ${id}`, goalScore: goalScoreForLevel(id) }
})

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((level) => level.id === id)
}

// Hazards (dead blocks) start appearing at HAZARD_START_LEVEL with a small
// drop rate, ramping up to HAZARD_MAX_RATE by HAZARD_RAMP_END_LEVEL, then
// holding steady from there.
const HAZARD_START_LEVEL = 5
const HAZARD_RAMP_END_LEVEL = 10
// Exported so the arrow power tile skill can ramp its own spawn rate along
// the exact same curve, just driven by skill points instead of game level.
export const HAZARD_MIN_RATE = 0.03
export const HAZARD_MAX_RATE = 0.08

export function getHazardRate(id: number): number {
  if (id < HAZARD_START_LEVEL) return 0
  if (id >= HAZARD_RAMP_END_LEVEL) return HAZARD_MAX_RATE

  const t = (id - HAZARD_START_LEVEL) / (HAZARD_RAMP_END_LEVEL - HAZARD_START_LEVEL)
  return HAZARD_MIN_RATE + t * (HAZARD_MAX_RATE - HAZARD_MIN_RATE)
}
