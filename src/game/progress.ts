import { LEVELS } from './levels'

const STORAGE_KEY = 'match3rpg.progress.v1'

// Once a level has been beaten, it can only be replayed this many more
// times — after that the overworld node still opens the replay dialog, but
// the Play button is disabled.
export const MAX_REPLAYS = 3

export interface Progress {
  unlockedLevel: number
  bestScores: Record<number, number>
  replaysUsed: Record<number, number>
}

function defaultProgress(): Progress {
  return { unlockedLevel: 1, bestScores: {}, replaysUsed: {} }
}

function isValidProgress(value: unknown): value is Progress {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.unlockedLevel === 'number' && typeof candidate.bestScores === 'object'
}

// Older saves predate replaysUsed — treat a missing field as "none used yet"
// rather than invalidating the whole save.
function normalizeProgress(progress: Progress): Progress {
  return { ...progress, replaysUsed: progress.replaysUsed ?? {} }
}

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultProgress()
    const parsed: unknown = JSON.parse(raw)
    return isValidProgress(parsed) ? normalizeProgress(parsed) : defaultProgress()
  } catch {
    return defaultProgress()
  }
}

function saveProgress(progress: Progress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Storage unavailable (private browsing, quota, etc.) — progress just
    // won't persist across sessions.
  }
}

export function isLevelUnlocked(progress: Progress, levelId: number): boolean {
  return levelId <= progress.unlockedLevel
}

export function resetProgress(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

// Records the outcome of a level attempt: the best score is kept regardless
// of pass/fail, and clearing the goal unlocks the next level.
export function recordLevelResult(levelId: number, score: number, passed: boolean): Progress {
  const progress = loadProgress()
  const bestScores = { ...progress.bestScores }
  bestScores[levelId] = Math.max(bestScores[levelId] ?? 0, score)

  let unlockedLevel = progress.unlockedLevel
  if (passed) {
    const nextLevelId = levelId + 1
    const hasNextLevel = LEVELS.some((level) => level.id === nextLevelId)
    if (hasNextLevel) unlockedLevel = Math.max(unlockedLevel, nextLevelId)
  }

  const next: Progress = { unlockedLevel, bestScores, replaysUsed: progress.replaysUsed }
  saveProgress(next)
  return next
}

// Beaten levels (id < unlockedLevel) get MAX_REPLAYS more attempts from the
// overworld map before the Play button locks out.
export function getReplaysRemaining(progress: Progress, levelId: number): number {
  const used = progress.replaysUsed[levelId] ?? 0
  return Math.max(0, MAX_REPLAYS - used)
}

// Spends one replay on a level, entering it. Call only when
// getReplaysRemaining is still above zero.
export function spendReplay(levelId: number): Progress {
  const progress = loadProgress()
  const replaysUsed = { ...progress.replaysUsed, [levelId]: (progress.replaysUsed[levelId] ?? 0) + 1 }
  const next: Progress = { ...progress, replaysUsed }
  saveProgress(next)
  return next
}
