// Every color in the app is built from two tokens (--ink/--paper, see
// index.css) plus alpha variants — so a whole new theme is just a
// [data-theme="..."] block overriding those two, no component changes
// needed. This file tracks which one is picked and persists it, plus each
// theme's own ink/paper pair (so the picker UI can preview a theme's
// colors without switching to it) and what unlocks it.
export type ThemeId = 'mono' | 'blue'

export interface ThemeUnlock {
  // 'level': unlocked once that numbered game level has been cleared.
  // 'playerLevel': unlocked once the player has reached that character level.
  type: 'level' | 'playerLevel'
  value: number
}

export interface ThemeDef {
  id: ThemeId
  name: string
  ink: string
  paper: string
  // null means always available — the starting theme.
  unlock: ThemeUnlock | null
}

export const THEMES: ThemeDef[] = [
  { id: 'mono', name: 'Black & White', ink: '#000000', paper: '#ffffff', unlock: null },
  {
    id: 'blue',
    name: 'Light Blue',
    ink: '#000000',
    paper: '#a6d8ff',
    unlock: { type: 'level', value: 20 },
  },
]

export function isThemeUnlocked(theme: ThemeDef, unlockedGameLevel: number, playerLevel: number): boolean {
  if (!theme.unlock) return true
  if (theme.unlock.type === 'level') return unlockedGameLevel > theme.unlock.value
  return playerLevel >= theme.unlock.value
}

export function unlockDescription(unlock: ThemeUnlock): string {
  return unlock.type === 'level' ? `Unlocked at Level ${unlock.value}` : `Unlocked at Player Level ${unlock.value}`
}

const DEFAULT_THEME: ThemeId = 'mono'
const STORAGE_KEY = 'match3rpg.theme.v1'

function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((theme) => theme.id === value)
}

export function loadTheme(): ThemeId {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isValidThemeId(raw) ? raw : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function saveTheme(theme: ThemeId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage unavailable — the theme choice just won't persist across sessions.
  }
}
