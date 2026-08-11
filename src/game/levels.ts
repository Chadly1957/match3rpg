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
const GOAL_GROWTH = 1.5
const LEVEL_COUNT = 20
const ROUND_TO = 50

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step
}

function goalScoreForLevel(id: number): number {
  const handTuned = HAND_TUNED_GOALS[id - 1]
  if (handTuned !== undefined) return handTuned

  const lastHandTuned = HAND_TUNED_GOALS[HAND_TUNED_GOALS.length - 1]
  const stepsPast = id - HAND_TUNED_GOALS.length
  return roundToNearest(lastHandTuned * GOAL_GROWTH ** stepsPast, ROUND_TO)
}

export const LEVELS: LevelDef[] = Array.from({ length: LEVEL_COUNT }, (_, i) => {
  const id = i + 1
  return { id, name: `Level ${id}`, goalScore: goalScoreForLevel(id) }
})

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((level) => level.id === id)
}
