export type IconType = 'star' | 'square' | 'circle'

export const ICON_TYPES: IconType[] = ['star', 'square', 'circle']

export const GRID_SIZE = 3

// A tile keeps a stable `id` across moves so React keeps the same DOM node
// as its row/col change — that's what lets a swap or a fall animate via a
// CSS transition on transform instead of the icon just popping to its new
// slot.
export interface Tile {
  id: number
  type: IconType
  row: number
  col: number
}
