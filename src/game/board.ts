import { ICON_TYPES, type BoardSize, type IconType, type Tile } from './types'

let nextTileId = 0

function createTile(type: IconType, row: number, col: number): Tile {
  return { id: nextTileId++, type, row, col }
}

export function randomIcon(): IconType {
  return ICON_TYPES[Math.floor(Math.random() * ICON_TYPES.length)]
}

// Builds a starting board with no pre-existing 3-in-a-row matches.
export function createInitialTiles({ rows, cols }: BoardSize): Tile[] {
  const typeGrid: IconType[] = new Array(rows * cols)
  const tiles: Tile[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col
      const forbidden: IconType[] = []

      const left1 = col >= 1 ? typeGrid[index - 1] : undefined
      const left2 = col >= 2 ? typeGrid[index - 2] : undefined
      if (left1 && left1 === left2) forbidden.push(left1)

      const up1 = row >= 1 ? typeGrid[index - cols] : undefined
      const up2 = row >= 2 ? typeGrid[index - cols * 2] : undefined
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

export interface RunInfo {
  orientation: 'row' | 'col'
  // Cells in order along the run, so index 0 and index length-1 are its
  // two ends — used to tell a corner (L-shape) from a crossing (T-shape)
  // when two runs intersect.
  cells: { row: number; col: number; id: number }[]
}

export interface MatchResult {
  ids: Set<number>
  // Every distinct 3+-in-a-row run found (a swap can complete two runs at
  // once — one through each swapped tile — and each scores separately,
  // even though the matched cell sets can overlap).
  runs: RunInfo[]
}

// Scans the whole board for every run of 3+ equal icons, horizontal and
// vertical, and returns the matched tile ids plus each run's cells.
// Multiple simultaneous matches all get flagged in one pass.
export function findMatches(tiles: Tile[], { rows, cols }: BoardSize): MatchResult {
  const grid: (Tile | undefined)[] = new Array(rows * cols)
  for (const tile of tiles) {
    grid[tile.row * cols + tile.col] = tile
  }

  const ids = new Set<number>()
  const runs: RunInfo[] = []

  for (let row = 0; row < rows; row++) {
    let runStart = 0
    for (let col = 1; col <= cols; col++) {
      const prev = grid[row * cols + (col - 1)]?.type
      const curr = col < cols ? grid[row * cols + col]?.type : undefined
      if (curr !== prev) {
        if (col - runStart >= 3) {
          const cells: RunInfo['cells'] = []
          for (let c = runStart; c < col; c++) {
            const tile = grid[row * cols + c]
            if (tile) {
              ids.add(tile.id)
              cells.push({ row, col: c, id: tile.id })
            }
          }
          runs.push({ orientation: 'row', cells })
        }
        runStart = col
      }
    }
  }

  for (let col = 0; col < cols; col++) {
    let runStart = 0
    for (let row = 1; row <= rows; row++) {
      const prev = grid[(row - 1) * cols + col]?.type
      const curr = row < rows ? grid[row * cols + col]?.type : undefined
      if (curr !== prev) {
        if (row - runStart >= 3) {
          const cells: RunInfo['cells'] = []
          for (let r = runStart; r < row; r++) {
            const tile = grid[r * cols + col]
            if (tile) {
              ids.add(tile.id)
              cells.push({ row: r, col, id: tile.id })
            }
          }
          runs.push({ orientation: 'col', cells })
        }
        runStart = row
      }
    }
  }

  return { ids, runs }
}

export interface MatchShapes {
  tShape: boolean
  lShape: boolean
}

// A run crossing another run at right angles forms either a corner (both
// runs meet at one of their ends — an L/corner shape) or a crossing (the
// intersection falls in the middle of at least one run — a T or + shape).
export function detectMatchShapes(runs: RunInfo[]): MatchShapes {
  const rowRuns = runs.filter((r) => r.orientation === 'row')
  const colRuns = runs.filter((r) => r.orientation === 'col')

  let tShape = false
  let lShape = false

  for (const hRun of rowRuns) {
    const crossRow = hRun.cells[0].row

    for (const vRun of colRuns) {
      const crossCol = vRun.cells[0].col

      const hIndex = hRun.cells.findIndex((cell) => cell.col === crossCol)
      const vIndex = vRun.cells.findIndex((cell) => cell.row === crossRow)
      if (hIndex === -1 || vIndex === -1) continue // runs don't actually cross

      const hIsEndpoint = hIndex === 0 || hIndex === hRun.cells.length - 1
      const vIsEndpoint = vIndex === 0 || vIndex === vRun.cells.length - 1

      if (hIsEndpoint && vIsEndpoint) {
        lShape = true
      } else {
        tShape = true
      }
    }
  }

  return { tShape, lShape }
}

const BASE_RUN_POINTS = 30
const EXTRA_TILE_POINTS = 20

function pointsForRunLength(length: number): number {
  return BASE_RUN_POINTS + Math.max(0, length - 3) * EXTRA_TILE_POINTS
}

// Chain reactions are worth progressively more: each cascade step (combo)
// multiplies the base points, matching the "chains matter" feel of the RPG
// scoring system. Longer runs (possible once the board is bigger than 3x3)
// score more than a plain 3-in-a-row.
export function scoreForMatch(runs: RunInfo[], combo: number): number {
  const basePoints = runs.reduce((sum, run) => sum + pointsForRunLength(run.cells.length), 0)
  return basePoints * combo
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
  { rows, cols }: BoardSize,
): { spawned: Tile[]; settled: Tile[] } {
  const survivors = tiles.filter((t) => !matchedIds.has(t.id))
  const settled: Tile[] = []
  const spawned: Tile[] = []

  for (let col = 0; col < cols; col++) {
    const columnSurvivors = survivors.filter((t) => t.col === col).sort((a, b) => a.row - b.row)
    const missing = rows - columnSurvivors.length

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
