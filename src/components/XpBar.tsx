import type { PlayerXpState } from '../game/playerProgress'

interface XpBarProps {
  xpState: PlayerXpState
  leveledUp?: boolean
}

export default function XpBar({ xpState, leveledUp = false }: XpBarProps) {
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
      {leveledUp && <div className="xp-bar-levelup">Leveled Up!</div>}
    </div>
  )
}
