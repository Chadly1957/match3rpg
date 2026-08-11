// Placeholder player-progression hooks. Once the leveling system and skill
// tree exist, getPlayerLevel() should read real player state and
// getMoveLimit() should factor in skill-tree bonuses.
export function getPlayerLevel(): number {
  return 1
}

export function getMoveLimit(_playerLevel: number): number {
  return 5
}
