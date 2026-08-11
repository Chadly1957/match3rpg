import { GRID_SIZE, ICON_TYPES, type IconType } from './types'

export function randomIcon(): IconType {
  return ICON_TYPES[Math.floor(Math.random() * ICON_TYPES.length)]
}

// Builds a starting grid with no pre-existing 3-in-a-row matches.
export function createInitialGrid(): IconType[] {
  const grid: IconType[] = new Array(GRID_SIZE * GRID_SIZE)

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const index = row * GRID_SIZE + col
      const forbidden: IconType[] = []

      const left1 = col >= 1 ? grid[index - 1] : undefined
      const left2 = col >= 2 ? grid[index - 2] : undefined
      if (left1 && left1 === left2) forbidden.push(left1)

      const up1 = row >= 1 ? grid[index - GRID_SIZE] : undefined
      const up2 = row >= 2 ? grid[index - GRID_SIZE * 2] : undefined
      if (up1 && up1 === up2) forbidden.push(up1)

      const choices = ICON_TYPES.filter((icon) => !forbidden.includes(icon))
      grid[index] = choices[Math.floor(Math.random() * choices.length)]
    }
  }

  return grid
}

export function areAdjacent(indexA: number, indexB: number): boolean {
  const rowA = Math.floor(indexA / GRID_SIZE)
  const colA = indexA % GRID_SIZE
  const rowB = Math.floor(indexB / GRID_SIZE)
  const colB = indexB % GRID_SIZE

  const rowDiff = Math.abs(rowA - rowB)
  const colDiff = Math.abs(colA - colB)

  return rowDiff + colDiff === 1
}

// Returns true if the cell at `index` is part of a 3-in-a-row match
// (checking the full row and full column, since the grid is only 3x3).
export function hasMatchAt(grid: IconType[], index: number): boolean {
  const row = Math.floor(index / GRID_SIZE)
  const col = index % GRID_SIZE

  const rowStart = row * GRID_SIZE
  const rowMatch =
    grid[rowStart] === grid[rowStart + 1] && grid[rowStart + 1] === grid[rowStart + 2]

  const colMatch =
    grid[col] === grid[col + GRID_SIZE] && grid[col + GRID_SIZE] === grid[col + GRID_SIZE * 2]

  return rowMatch || colMatch
}

export function swap(grid: IconType[], indexA: number, indexB: number): IconType[] {
  const next = [...grid]
  const temp = next[indexA]
  next[indexA] = next[indexB]
  next[indexB] = temp
  return next
}

function hasAnyMatch(grid: IconType[]): boolean {
  return grid.some((_, index) => hasMatchAt(grid, index))
}

// Replaces the icons at `matchedIndexes` with new random icons so a
// resolved match doesn't sit in the grid indefinitely, retrying until
// the refill doesn't create another immediate match on its own.
export function refillMatched(grid: IconType[], matchedIndexes: number[]): IconType[] {
  let next = grid
  let attempts = 0

  do {
    next = [...grid]
    for (const index of matchedIndexes) {
      next[index] = randomIcon()
    }
    attempts += 1
  } while (hasAnyMatch(next) && attempts < 200)

  return next
}
