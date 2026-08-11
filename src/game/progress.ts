import { LEVELS } from './levels'

const STORAGE_KEY = 'match3rpg.progress.v1'

export interface Progress {
  unlockedLevel: number
  bestScores: Record<number, number>
}

function defaultProgress(): Progress {
  return { unlockedLevel: 1, bestScores: {} }
}

function isValidProgress(value: unknown): value is Progress {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.unlockedLevel === 'number' && typeof candidate.bestScores === 'object'
}

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultProgress()
    const parsed: unknown = JSON.parse(raw)
    return isValidProgress(parsed) ? parsed : defaultProgress()
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

  const next: Progress = { unlockedLevel, bestScores }
  saveProgress(next)
  return next
}
