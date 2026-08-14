import type { TileType } from '../game/types'

interface IconProps {
  type: TileType
  // Tiles sitting in the grid pass their stable tile id here to get a
  // continuous idle "breathing" wiggle (see .icon-mask--live in App.css),
  // staggered per-tile so the board doesn't pulse in lockstep. Overlay
  // clones (dragged icon, hazard eject) omit this — they're already
  // mid-animation via their own transform and would fight with it.
  seed?: number
}

// Every shape is one black-on-transparent PNG (public/icons/<type>.png)
// recolored entirely in CSS via mask-image: the browser reads the PNG's
// alpha channel as a stencil and paints background-color through it, so a
// single asset per shape works for every color theme — no per-color image
// exports needed. The actual pixel color inside the PNG doesn't matter,
// only its transparency.
export default function Icon({ type, seed }: IconProps) {
  const live = seed !== undefined
  return (
    <span
      className={live ? `icon-mask icon-mask--${type} icon-mask--live` : `icon-mask icon-mask--${type}`}
      style={live ? { animationDelay: `${(seed % 9) * 0.18}s` } : undefined}
      aria-hidden="true"
    />
  )
}
