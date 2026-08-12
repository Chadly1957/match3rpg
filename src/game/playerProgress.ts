// Player XP/level system (the character's RPG level — distinct from the
// numbered game levels on the overworld map). XP required to advance grows
// geometrically each level, which is the standard "each level takes
// meaningfully longer than the last" RPG curve. Starting values (275 XP for
// level 1→2, +25% per level) are a reasonable base to tune once real
// playtesting data exists.
const BASE_XP = 275
const XP_GROWTH = 1.25

const STORAGE_KEY = 'match3rpg.playerXp.v1'

// A cleared level's score doesn't convert 1:1 to XP — only a quarter of it
// does, so grid-size/moves investment (which inflates score a lot) doesn't
// also trivially blow out player leveling.
const SCORE_TO_XP_RATE = 0.25

export function xpFromScore(score: number): number {
  return Math.round(score * SCORE_TO_XP_RATE)
}

export function xpRequiredForLevel(level: number): number {
  return Math.round(BASE_XP * XP_GROWTH ** (level - 1))
}

export interface PlayerXpState {
  level: number
  totalXp: number
  xpIntoLevel: number
  xpForNextLevel: number
}

export function computePlayerXpState(totalXp: number): PlayerXpState {
  let level = 1
  let remaining = totalXp

  while (remaining >= xpRequiredForLevel(level)) {
    remaining -= xpRequiredForLevel(level)
    level += 1
  }

  return { level, totalXp, xpIntoLevel: remaining, xpForNextLevel: xpRequiredForLevel(level) }
}

export function loadTotalXp(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  } catch {
    return 0
  }
}

function saveTotalXp(totalXp: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(totalXp))
  } catch {
    // Storage unavailable — XP just won't persist across sessions.
  }
}

// Awards XP (e.g. the final score of a cleared level) and persists the new
// total. Returns the new total so callers can recompute level state.
export function addXp(amount: number): number {
  const next = loadTotalXp() + Math.max(0, amount)
  saveTotalXp(next)
  return next
}

export function resetPlayerXp(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
