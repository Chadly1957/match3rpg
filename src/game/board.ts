import { ICON_TYPES, type BoardSize, type IconType, type Tile, type TileType } from './types'

let nextTileId = 0

function createTile(type: TileType, row: number, col: number): Tile {
  return { id: nextTileId++, type, row, col }
}

export function randomIcon(): IconType {
  return ICON_TYPES[Math.floor(Math.random() * ICON_TYPES.length)]
}

// Rolls what a newly-created fill tile should be: usually a normal icon,
// occasionally a hazard once hazardRate is above 0 (see levels.ts for how
// that rate ramps in starting around level 5), or an arrow power tile once
// arrowRate is above 0 (unlocked and ramped via the Arrow Tile skill).
function rollFillType(hazardRate: number, arrowRate: number): TileType {
  if (hazardRate > 0 && Math.random() < hazardRate) return 'hazard'
  if (arrowRate > 0 && Math.random() < arrowRate) return 'arrow'
  return randomIcon()
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

// A hazard never matches — not even with another hazard — so it gets a key
// unique to its own tile id, guaranteeing it never compares equal to
// anything else on the board. An arrow matches normally along a row, but
// never down a column — it gets the same unique-key treatment, just only
// for the vertical pass.
function matchKey(tile: Tile | undefined, orientation: 'row' | 'col'): string | undefined {
  if (!tile) return undefined
  if (tile.type === 'hazard') return `hazard-${tile.id}`
  if (tile.type === 'arrow' && orientation === 'col') return `arrow-${tile.id}`
  return tile.type
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
      const prev = matchKey(grid[row * cols + (col - 1)], 'row')
      const curr = col < cols ? matchKey(grid[row * cols + col], 'row') : undefined
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
      const prev = matchKey(grid[(row - 1) * cols + col], 'col')
      const curr = row < rows ? matchKey(grid[row * cols + col], 'col') : undefined
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

// A run of 3+ arrows scores like any other match (via scoreForMatch above),
// but also detonates every other row it appears in: every tile across that
// row gets cleared alongside the match, whatever type it is. Returns the ids
// of those *extra* tiles (i.e. not already part of the match itself), so the
// caller can add them to what gets cleared.
export function arrowRowClearIds(tiles: Tile[], matches: MatchResult, { cols }: BoardSize): Set<number> {
  const grid = new Map<number, Tile>()
  for (const tile of tiles) grid.set(tile.row * cols + tile.col, tile)

  const arrowRows = new Set<number>()
  for (const run of matches.runs) {
    if (run.orientation !== 'row') continue
    const isArrowRun = run.cells.every((cell) => grid.get(cell.row * cols + cell.col)?.type === 'arrow')
    if (isArrowRun) arrowRows.add(run.cells[0].row)
  }

  const extraIds = new Set<number>()
  for (const row of arrowRows) {
    for (let col = 0; col < cols; col++) {
      const tile = grid.get(row * cols + col)
      if (tile && !matches.ids.has(tile.id)) extraIds.add(tile.id)
    }
  }
  return extraIds
}

// Every icon an arrow row-clear sweeps up beyond the arrow match itself
// scores as if it were one more tile in that match — hazards are along for
// the ride but stay worth nothing, same as when they're cleared normally.
export function scoreForArrowWipe(tiles: Tile[], extraIds: Set<number>, combo: number): number {
  let scoringTiles = 0
  for (const tile of tiles) {
    if (extraIds.has(tile.id) && tile.type !== 'hazard') scoringTiles += 1
  }
  return scoringTiles * EXTRA_TILE_POINTS * combo
}

// Drops surviving tiles down to fill the gaps left by cleared cells, and
// creates new tiles for the empty slots at the top. Returns two arrays:
// `settled` is the final resting state (what the board should look like
// once everything has landed), and `spawned` is the same board but with
// the new tiles placed above row 0 (negative rows) — render `spawned`
// first, then `settled`, and the CSS transition on transform animates the
// survivors dropping and the new tiles falling in from above.
//
// hazardRate is the chance each newly-created fill tile is a hazard instead
// of a normal icon, and arrowRate is the same for arrow power tiles. This
// does one straightforward gravity pass — it does NOT special-case a hazard
// landing in the bottom row; that's handled by the caller (see
// ejectBottomHazards) so it can play out as a visible bounce-and-fall-off
// animation instead of resolving invisibly here.
export function collapseAndRefill(
  tiles: Tile[],
  clearedIds: Set<number>,
  { rows, cols }: BoardSize,
  hazardRate = 0,
  arrowRate = 0,
): { spawned: Tile[]; settled: Tile[] } {
  const survivors = tiles.filter((t) => !clearedIds.has(t.id))
  const settled: Tile[] = []
  const spawned: Tile[] = []

  for (let col = 0; col < cols; col++) {
    const originalColumn = survivors.filter((t) => t.col === col).sort((a, b) => a.row - b.row)
    const missing = rows - originalColumn.length
    const newTiles = Array.from({ length: missing }, () => createTile(rollFillType(hazardRate, arrowRate), 0, col))
    const column = [...newTiles, ...originalColumn]

    column.forEach((tile, i) => {
      const finalRow = i
      settled.push({ ...tile, row: finalRow })
      const isNew = newTiles.includes(tile)
      spawned.push({ ...tile, row: isNew ? finalRow - missing : finalRow })
    })
  }

  return { spawned, settled }
}

// Ids of hazard tiles currently resting in the board's bottom row — these
// are the ones that should bounce out next.
export function getBottomHazardIds(tiles: Tile[], { rows }: BoardSize): number[] {
  return tiles.filter((t) => t.type === 'hazard' && t.row === rows - 1).map((t) => t.id)
}
