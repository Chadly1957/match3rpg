import type { TileType } from '../game/types'

interface IconProps {
  type: TileType
}

// Every shape is one black-on-transparent PNG (public/icons/<type>.png)
// recolored entirely in CSS via mask-image: the browser reads the PNG's
// alpha channel as a stencil and paints background-color through it, so a
// single asset per shape works for every color theme — no per-color image
// exports needed. The actual pixel color inside the PNG doesn't matter,
// only its transparency.
export default function Icon({ type }: IconProps) {
  return <span className={`icon-mask icon-mask--${type}`} aria-hidden="true" />
}
