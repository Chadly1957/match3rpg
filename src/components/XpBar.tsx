import type { PlayerXpState } from '../game/playerProgress'

interface XpBarProps {
  xpState: PlayerXpState
}

export default function XpBar({ xpState }: XpBarProps) {
  const percent = Math.min(100, (xpState.xpIntoLevel / xpState.xpForNextLevel) * 100)

  return (
    <div className="xp-bar">
      <div className="xp-bar-level">Lv {xpState.level}</div>
      <div className="xp-bar-track">
        <div className="xp-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="xp-bar-text">
        {xpState.xpIntoLevel} / {xpState.xpForNextLevel} XP
      </div>
    </div>
  )
}
