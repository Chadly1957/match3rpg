import { GRID_SIZE, ICON_TYPES, type IconType, type Tile } from './types'

let nextTileId = 0

function createTile(type: IconType, row: number, col: number): Tile {
  return { id: nextTileId++, type, row, col }
}

export function randomIcon(): IconType {
  return ICON_TYPES[Math.floor(Math.random() * ICON_TYPES.length)]
}

// Builds a starting board with no pre-existing 3-in-a-row matches.
export function createInitialTiles(): Tile[] {
  const typeGrid: IconType[] = new Array(GRID_SIZE * GRID_SIZE)
  const tiles: Tile[] = []

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const index = row * GRID_SIZE + col
      const forbidden: IconType[] = []

      const left1 = col >= 1 ? typeGrid[index - 1] : undefined
      const left2 = col >= 2 ? typeGrid[index - 2] : undefined
      if (left1 && left1 === left2) forbidden.push(left1)

      const up1 = row >= 1 ? typeGrid[index - GRID_SIZE] : undefined
      const up2 = row >= 2 ? typeGrid[index - GRID_SIZE * 2] : undefined
      if (up1 && up1 === up2) forbidden.push(up1)

      const choices = ICON_TYPES.filter((icon) => !forbidden.includes(icon))
      const type = choices[Math.floor(Math.random() * choices.length)]
      typeGrid[index] = type
      tiles.push(createTile(type, row, col))
    }
  }

  return tiles
}

export function tileIdAt(tiles: Tile[], row: number, col: number): number | null {
  const tile = tiles.find((t) => t.row === row && t.col === col)
  return tile ? tile.id : null
}

// Swaps two tiles' positions in place (same ids, same DOM nodes) so the
// swap itself animates via the CSS transition on transform.
export function swapTiles(tiles: Tile[], idA: number, idB: number): Tile[] {
  const tileA = tiles.find((t) => t.id === idA)
  const tileB = tiles.find((t) => t.id === idB)
  if (!tileA || !tileB) return tiles

  return tiles.map((t) => {
    if (t.id === idA) return { ...t, row: tileB.row, col: tileB.col }
    if (t.id === idB) return { ...t, row: tileA.row, col: tileA.col }
    return t
  })
}

export interface MatchResult {
  ids: Set<number>
  // Number of distinct 3-in-a-row runs found (a swap can complete two runs
  // at once — one through each swapped tile — and each counts separately
  // for scoring, even though the matched cell sets can overlap).
  runCount: number
}

// Scans the whole board for every run of 3+ equal icons, horizontal and
// vertical, and returns the matched tile ids plus how many separate runs
// were found. Multiple simultaneous matches all get flagged in one pass.
export function findMatches(tiles: Tile[]): MatchResult {
  const grid: (Tile | undefined)[] = new Array(GRID_SIZE * GRID_SIZE)
  for (const tile of tiles) {
    grid[tile.row * GRID_SIZE + tile.col] = tile
  }

  const ids = new Set<number>()
  let runCount = 0

  for (let row = 0; row < GRID_SIZE; row++) {
    let runStart = 0
    for (let col = 1; col <= GRID_SIZE; col++) {
      const prev = grid[row * GRID_SIZE + (col - 1)]?.type
      const curr = col < GRID_SIZE ? grid[row * GRID_SIZE + col]?.type : undefined
      if (curr !== prev) {
        if (col - runStart >= 3) {
          runCount += 1
          for (let c = runStart; c < col; c++) {
            const tile = grid[row * GRID_SIZE + c]
            if (tile) ids.add(tile.id)
          }
        }
        runStart = col
      }
    }
  }

  for (let col = 0; col < GRID_SIZE; col++) {
    let runStart = 0
    for (let row = 1; row <= GRID_SIZE; row++) {
      const prev = grid[(row - 1) * GRID_SIZE + col]?.type
      const curr = row < GRID_SIZE ? grid[row * GRID_SIZE + col]?.type : undefined
      if (curr !== prev) {
        if (row - runStart >= 3) {
          runCount += 1
          for (let r = runStart; r < row; r++) {
            const tile = grid[r * GRID_SIZE + col]
            if (tile) ids.add(tile.id)
          }
        }
        runStart = row
      }
    }
  }

  return { ids, runCount }
}

const POINTS_PER_RUN = 30

// Chain reactions are worth progressively more: each cascade step (combo)
// multiplies the base points, matching the "chains matter" feel of the
// eventual RPG scoring system.
export function scoreForMatch(runCount: number, combo: number): number {
  return runCount * POINTS_PER_RUN * combo
}

// Drops surviving tiles down to fill the gaps left by matched tiles, and
// creates new tiles for the empty slots at the top. Returns two arrays:
// `settled` is the final resting state (what the board should look like
// once everything has landed), and `spawned` is the same board but with
// the new tiles placed above row 0 (negative rows) — render `spawned`
// first, then `settled`, and the CSS transition on transform animates the
// survivors dropping and the new tiles falling in from above.
export function collapseAndRefill(
  tiles: Tile[],
  matchedIds: Set<number>,
): { spawned: Tile[]; settled: Tile[] } {
  const survivors = tiles.filter((t) => !matchedIds.has(t.id))
  const settled: Tile[] = []
  const spawned: Tile[] = []

  for (let col = 0; col < GRID_SIZE; col++) {
    const columnSurvivors = survivors.filter((t) => t.col === col).sort((a, b) => a.row - b.row)
    const missing = GRID_SIZE - columnSurvivors.length

    columnSurvivors.forEach((tile, i) => {
      const finalRow = missing + i
      settled.push({ ...tile, row: finalRow })
      spawned.push({ ...tile, row: finalRow })
    })

    for (let i = 0; i < missing; i++) {
      const type = randomIcon()
      const finalRow = i
      const tile = createTile(type, finalRow, col)
      settled.push(tile)
      spawned.push({ ...tile, row: finalRow - missing })
    }
  }

  return { spawned, settled }
}
