export type IconType = 'star' | 'square' | 'circle'

export const ICON_TYPES: IconType[] = ['star', 'square', 'circle']

// A hazard is a dead block: it can occupy a cell and be dragged around like
// any other tile, but it never matches — not even with another hazard — and
// scores nothing. It's destroyed the moment gravity carries it into the
// bottom row.
//
// A glass hazard is the same dead-weight, never-matches, scores-nothing
// deal, but destroyed differently: every match made in a cell orthogonally
// adjacent to it cracks it once, and the third crack destroys it outright,
// wherever it happens to be sitting — it does NOT clear on reaching the
// bottom row the way a plain hazard does. Replaces the plain hazard as the
// spawn from level GLASS_HAZARD_START_LEVEL onward (see levels.ts).
//
// An arrow is a power tile: it matches normally, horizontally or
// vertically, and completing a 3+ run detonates every row the run passes
// through — a horizontal run wipes its one row, a vertical run wipes one
// row per tile in the run — clearing every tile across those rows and
// scoring the extras as bonus matches.
export type TileType = IconType | 'hazard' | 'glassHazard' | 'arrow'

// A tile keeps a stable `id` across moves so React keeps the same DOM node
// as its row/col change — that's what lets a swap or a fall animate via a
// CSS transition on transform instead of the icon just popping to its new
// slot.
export interface Tile {
  id: number
  type: TileType
  row: number
  col: number
  // Only meaningful for a 'glassHazard' tile: how many adjacent matches
  // have cracked it so far (0-2 — the 3rd crack destroys it, so a tile
  // never actually renders at 3).
  cracks?: number
}

// Board dimensions are no longer fixed at 3x3 — the Grid Width / Grid
// Height skills grow them independently, so every board function takes an
// explicit size instead of reading a module-level constant.
export interface BoardSize {
  rows: number
  cols: number
}
