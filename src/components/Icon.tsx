import type { TileType } from '../game/types'

interface IconProps {
  type: TileType
}

export default function Icon({ type }: IconProps) {
  switch (type) {
    case 'star':
      return (
        <svg viewBox="0 0 24 24" className="icon-svg icon-star" aria-hidden="true">
          <path
            d="M12 2.5 15 9.2 22.2 10 16.8 14.7 18.4 21.8 12 18 5.6 21.8 7.2 14.7 1.8 10 9 9.2 Z"
            fill="currentColor"
          />
        </svg>
      )
    case 'square':
      return (
        <svg viewBox="0 0 24 24" className="icon-svg icon-square" aria-hidden="true">
          <rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="currentColor" />
        </svg>
      )
    case 'circle':
      return (
        <svg viewBox="0 0 24 24" className="icon-svg icon-circle" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="currentColor" />
        </svg>
      )
    case 'hazard':
      return (
        <svg viewBox="0 0 24 24" className="icon-svg icon-hazard" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" />
          <path
            d="M7 7 17 17M17 7 7 17"
            stroke="var(--hazard-mark)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      )
  }
}
