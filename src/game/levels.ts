export interface LevelDef {
  id: number
  name: string
  goalScore: number
}

// Goal scores ramp up per level. Move limit isn't baked in here — it comes
// from the player's level (see player.ts) so a future leveling/skill-tree
// system can grant more turns without touching level design.
export const LEVELS: LevelDef[] = [
  { id: 1, name: 'Level 1', goalScore: 300 },
  { id: 2, name: 'Level 2', goalScore: 600 },
  { id: 3, name: 'Level 3', goalScore: 1000 },
  { id: 4, name: 'Level 4', goalScore: 1500 },
  { id: 5, name: 'Level 5', goalScore: 2200 },
]

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((level) => level.id === id)
}
