// Every color in the app is built from two tokens (--ink/--paper, see
// index.css) plus alpha variants — so a whole new theme is just a
// [data-theme="..."] block overriding those two, no component changes
// needed. This file just tracks which one is picked and persists it.
export type ThemeId = 'mono' | 'blue'

export interface ThemeDef {
  id: ThemeId
  name: string
  // Representative color shown as a little swatch in the picker UI.
  swatch: string
}

export const THEMES: ThemeDef[] = [
  { id: 'mono', name: 'Black & White', swatch: '#ffffff' },
  { id: 'blue', name: 'Light Blue', swatch: '#a6d8ff' },
]

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
