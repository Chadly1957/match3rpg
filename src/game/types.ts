export type IconType = 'star' | 'square' | 'circle'

export const ICON_TYPES: IconType[] = ['star', 'square', 'circle']

// A hazard is a dead block: it can occupy a cell and be dragged around like
// any other tile, but it never matches — not even with another hazard — and
// scores nothing. It's destroyed the moment gravity carries it into the
// bottom row.
export type TileType = IconType | 'hazard'

// A tile keeps a stable `id` across moves so React keeps the same DOM node
// as its row/col change — that's what lets a swap or a fall animate via a
// CSS transition on transform instead of the icon just popping to its new
// slot.
export interface Tile {
  id: number
  type: TileType
  row: number
  col: number
}

// Board dimensions are no longer fixed at 3x3 — the Grid Width / Grid
// Height skills grow them independently, so every board function takes an
// explicit size instead of reading a module-level constant.
export interface BoardSize {
  rows: number
  cols: number
}
