export type SkillId = 'moves' | 'gridWidth' | 'gridHeight'

export interface SkillDef {
  id: SkillId
  name: string
  description: string
  maxLevel: number
}

// Caps are here mainly for sanity (an 8x8 board is already a lot of tiles
// for a phone screen) — tune once there's real playtesting to go on.
export const SKILLS: SkillDef[] = [
  {
    id: 'moves',
    name: 'Extra Moves',
    description: 'Grants +1 move per level, on every stage.',
    maxLevel: 15,
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
]

export type SkillLevels = Record<SkillId, number>

const STORAGE_KEY = 'match3rpg.skills.v1'

function defaultSkillLevels(): SkillLevels {
  return { moves: 0, gridWidth: 0, gridHeight: 0 }
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

export function canUpgradeSkill(skillId: SkillId, playerLevel: number, levels: SkillLevels): boolean {
  const def = SKILLS.find((skill) => skill.id === skillId)
  if (!def || levels[skillId] >= def.maxLevel) return false
  return availableSkillPoints(playerLevel, levels) > 0
}

export function upgradeSkill(skillId: SkillId, playerLevel: number, levels: SkillLevels): SkillLevels {
  if (!canUpgradeSkill(skillId, playerLevel, levels)) return levels
  const next = { ...levels, [skillId]: levels[skillId] + 1 }
  saveSkillLevels(next)
  return next
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
