export interface LevelDef {
  id: number
  name: string
  goalScore: number
}

// The first 5 goal scores are hand-picked for an early, gentle ramp. Beyond
// that, scores compound by GOAL_GROWTH per level — levels are meant to keep
// scaling indefinitely as players sink skill points into moves/grid size,
// so a fixed formula is easier to extend than hand-tuning every entry.
const HAND_TUNED_GOALS = [300, 600, 1000, 1500, 2200]
// Was 1.5 (+50% per level), which made levels past ~8 essentially
// unreachable and only got worse each level further in since it compounds.
// Scaled back 25%: the +50% increment itself is cut by a quarter, down to
// +37.5% per level (1 + 0.5 * 0.75).
const GOAL_GROWTH = 1.375
const LEVEL_COUNT = 20
const ROUND_TO = 50
// Applied uniformly to every level's goal (hand-tuned and formula-derived
// alike) — an across-the-board 10% easier target.
const GOAL_SCALE = 0.9

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step
}

function goalScoreForLevel(id: number): number {
  const handTuned = HAND_TUNED_GOALS[id - 1]
  const raw =
    handTuned !== undefined
      ? handTuned
      : HAND_TUNED_GOALS[HAND_TUNED_GOALS.length - 1] *
        GOAL_GROWTH ** (id - HAND_TUNED_GOALS.length)

  return roundToNearest(raw * GOAL_SCALE, ROUND_TO)
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
const HAZARD_MIN_RATE = 0.03
const HAZARD_MAX_RATE = 0.08

export function getHazardRate(id: number): number {
  if (id < HAZARD_START_LEVEL) return 0
  if (id >= HAZARD_RAMP_END_LEVEL) return HAZARD_MAX_RATE

  const t = (id - HAZARD_START_LEVEL) / (HAZARD_RAMP_END_LEVEL - HAZARD_START_LEVEL)
  return HAZARD_MIN_RATE + t * (HAZARD_MAX_RATE - HAZARD_MIN_RATE)
}
