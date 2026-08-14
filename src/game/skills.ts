export type SkillId = 'moves' | 'gridWidth' | 'gridHeight' | 'scoreMultiplier' | 'arrowIcon'

// Same ramp width as the hazard's 5-level climb (game level 5 to 10) —
// point 1 unlocks the icon at the hazard's floor rate, point ARROW_MAX_LEVEL
// reaches its ceiling rate.
const ARROW_MAX_LEVEL = 6

// A skill can gate part (or all) of its range behind a player level: no
// point at skillLevel >= fromSkillLevel can be bought until the player has
// reached requiresPlayerLevel, no matter how many skill points are sitting
// unspent. Points below fromSkillLevel are unaffected.
export interface SkillLock {
  fromSkillLevel: number
  requiresPlayerLevel: number
}

export interface SkillDef {
  id: SkillId
  name: string
  description: string
  maxLevel: number
  lock?: SkillLock
}

const STAT_UNLOCK_PLAYER_LEVEL = 10

// Caps are here mainly for sanity (an 8x8 board is already a lot of tiles
// for a phone screen) — tune once there's real playtesting to go on.
export const SKILLS: SkillDef[] = [
  {
    id: 'moves',
    name: 'Extra Moves',
    description: 'Grants +1 move per level, on every stage.',
    maxLevel: 15,
    // Levels 1-5 are open from the start; 6-15 need the player level.
    lock: { fromSkillLevel: 6, requiresPlayerLevel: STAT_UNLOCK_PLAYER_LEVEL },
  },
  {
    id: 'gridWidth',
    name: 'Grid Width',
    description: 'Adds +1 column to the board, on every stage.',
    maxLevel: 5,
  },
  {
    id: 'gridHeight',
    name: 'Grid Height',
    description: 'Adds +1 row to the board, on every stage.',
    maxLevel: 5,
  },
  {
    id: 'scoreMultiplier',
    name: 'Score Multiplier',
    description: 'Matches are worth 15% more points per level, compounding.',
    maxLevel: 10,
    lock: { fromSkillLevel: 1, requiresPlayerLevel: STAT_UNLOCK_PLAYER_LEVEL },
  },
  {
    id: 'arrowIcon',
    name: 'Arrow Tile',
    description:
      'Unlocks the arrow icon. Matching it wipes every row the match crosses. Further points raise how often it appears.',
    maxLevel: ARROW_MAX_LEVEL,
    lock: { fromSkillLevel: 1, requiresPlayerLevel: STAT_UNLOCK_PLAYER_LEVEL },
  },
]

export type SkillLevels = Record<SkillId, number>

const STORAGE_KEY = 'match3rpg.skills.v1'

function defaultSkillLevels(): SkillLevels {
  return { moves: 0, gridWidth: 0, gridHeight: 0, scoreMultiplier: 0, arrowIcon: 0 }
}

function isValidSkillLevels(value: unknown): value is SkillLevels {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return SKILLS.every((skill) => typeof candidate[skill.id] === 'number')
}

export function loadSkillLevels(): SkillLevels {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSkillLevels()
    const parsed: unknown = JSON.parse(raw)
    return isValidSkillLevels(parsed) ? parsed : defaultSkillLevels()
  } catch {
    return defaultSkillLevels()
  }
}

function saveSkillLevels(levels: SkillLevels): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(levels))
  } catch {
    // Storage unavailable — skill points just won't persist across sessions.
  }
}

export function resetSkillLevels(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

export function totalSkillPointsSpent(levels: SkillLevels): number {
  return SKILLS.reduce((sum, skill) => sum + levels[skill.id], 0)
}

// One skill point per player level gained past level 1.
export function totalSkillPointsEarned(playerLevel: number): number {
  return Math.max(0, playerLevel - 1)
}

export function availableSkillPoints(playerLevel: number, levels: SkillLevels): number {
  return totalSkillPointsEarned(playerLevel) - totalSkillPointsSpent(levels)
}

// True once the *next* point for this skill is gated behind a player level
// the player hasn't reached yet — used to show a lock icon in the skill
// tree rather than just a greyed-out "+1" (which reads as "no points left"
// even when the real reason is the level gate).
export function isSkillLocked(skillId: SkillId, playerLevel: number, levels: SkillLevels): boolean {
  const def = SKILLS.find((skill) => skill.id === skillId)
  if (!def?.lock) return false
  const nextLevel = levels[skillId] + 1
  return nextLevel >= def.lock.fromSkillLevel && playerLevel < def.lock.requiresPlayerLevel
}

export function canUpgradeSkill(skillId: SkillId, playerLevel: number, levels: SkillLevels): boolean {
  const def = SKILLS.find((skill) => skill.id === skillId)
  if (!def || levels[skillId] >= def.maxLevel) return false
  if (isSkillLocked(skillId, playerLevel, levels)) return false
  return availableSkillPoints(playerLevel, levels) > 0
}

export function upgradeSkill(skillId: SkillId, playerLevel: number, levels: SkillLevels): SkillLevels {
  if (!canUpgradeSkill(skillId, playerLevel, levels)) return levels
  const next = { ...levels, [skillId]: levels[skillId] + 1 }
  saveSkillLevels(next)
  return next
}

// Refunds every spent skill point for free, so players can try a different
// build without losing progress — unlike resetSkillLevels (the testing-only
// wipe), this is a real player-facing feature, kept as its own function so
// the intent at each call site stays clear even though the effect is the
// same reset to all-zero levels.
export function respecSkillLevels(): SkillLevels {
  const fresh = defaultSkillLevels()
  saveSkillLevels(fresh)
  return fresh
}

export const BASE_MOVE_LIMIT = 5
export const BASE_GRID_SIZE = 3

export function getMoveLimit(levels: SkillLevels): number {
  return BASE_MOVE_LIMIT + levels.moves
}

export interface GridConfig {
  rows: number
  cols: number
}

export function getGridConfig(levels: SkillLevels): GridConfig {
  return { cols: BASE_GRID_SIZE + levels.gridWidth, rows: BASE_GRID_SIZE + levels.gridHeight }
}

const SCORE_MULTIPLIER_PER_LEVEL = 1.15

// Compounding, same as XP/level growth: level 2 is 1.15x, level 3 is
// 1.15^2 (~1.32x), and so on — each point makes the previous ones worth
// more too, not just +15% flat each time.
export function getScoreMultiplier(levels: SkillLevels): number {
  return SCORE_MULTIPLIER_PER_LEVEL ** levels.scoreMultiplier
}

const ARROW_BASE_RATE = 0.05
const ARROW_MAX_RATE = 0.2

// The first point just unlocks the arrow icon at ARROW_BASE_RATE; every
// point after that ramps it up linearly toward ARROW_MAX_RATE.
export function getArrowSpawnRate(levels: SkillLevels): number {
  const level = levels.arrowIcon
  if (level <= 0) return 0
  if (level >= ARROW_MAX_LEVEL) return ARROW_MAX_RATE

  const t = (level - 1) / (ARROW_MAX_LEVEL - 1)
  return ARROW_BASE_RATE + t * (ARROW_MAX_RATE - ARROW_BASE_RATE)
}
