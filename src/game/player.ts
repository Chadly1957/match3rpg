// Move limit is kept separate from level design (see levels.ts) so a future
// skill tree can grant bonus turns per player level without editing level
// data. Flat 5 for now — tune once the skill tree exists.
export function getMoveLimit(_playerLevel: number): number {
  return 5
}
