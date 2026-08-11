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

// Scans the whole board for every run of 3+ equal icons, horizontal and
// vertical, and returns the union of matched cell indexes. Multiple
// simultaneous matches all get flagged in one pass.
export function findMatches(grid: IconType[]): Set<number> {
  const matched = new Set<number>()

  // Horizontal runs
  for (let row = 0; row < GRID_SIZE; row++) {
    let runStart = 0
    for (let col = 1; col <= GRID_SIZE; col++) {
      const prev = grid[row * GRID_SIZE + (col - 1)]
      const curr = col < GRID_SIZE ? grid[row * GRID_SIZE + col] : undefined
      if (curr !== prev) {
        if (col - runStart >= 3) {
          for (let c = runStart; c < col; c++) matched.add(row * GRID_SIZE + c)
        }
        runStart = col
      }
    }
  }

  // Vertical runs
  for (let col = 0; col < GRID_SIZE; col++) {
    let runStart = 0
    for (let row = 1; row <= GRID_SIZE; row++) {
      const prev = grid[(row - 1) * GRID_SIZE + col]
      const curr = row < GRID_SIZE ? grid[row * GRID_SIZE + col] : undefined
      if (curr !== prev) {
        if (row - runStart >= 3) {
          for (let r = runStart; r < row; r++) matched.add(r * GRID_SIZE + col)
        }
        runStart = row
      }
    }
  }

  return matched
}

export function swap(grid: IconType[], indexA: number, indexB: number): IconType[] {
  const next = [...grid]
  const temp = next[indexA]
  next[indexA] = next[indexB]
  next[indexB] = temp
  return next
}

// Clears matched cells and drops the surviving icons in each column down to
// fill the gaps, refilling the newly-empty cells at the top with new random
// icons — like gravity pulling the column down and new tiles falling in.
// Deliberately does NOT avoid creating new matches: cascades formed by the
// falling icons are a feature, resolved as chained combos by the caller.
export function collapseAndRefill(grid: IconType[], matchedIndexes: Iterable<number>): IconType[] {
  const matchedSet = new Set(matchedIndexes)
  const next: IconType[] = new Array(GRID_SIZE * GRID_SIZE)

  for (let col = 0; col < GRID_SIZE; col++) {
    const surviving: IconType[] = []
    for (let row = 0; row < GRID_SIZE; row++) {
      const index = row * GRID_SIZE + col
      if (!matchedSet.has(index)) surviving.push(grid[index])
    }

    const missing = GRID_SIZE - surviving.length
    const column = [...Array.from({ length: missing }, () => randomIcon()), ...surviving]

    for (let row = 0; row < GRID_SIZE; row++) {
      next[row * GRID_SIZE + col] = column[row]
    }
  }

  return next
}
