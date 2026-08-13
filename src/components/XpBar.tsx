import { useEffect, useState } from 'react'
import { xpRequiredForLevel, type PlayerXpState } from '../game/playerProgress'

interface XpBarProps {
  xpState: PlayerXpState
  leveledUp?: boolean
  // When set, the bar animates from this starting state up to xpState
  // instead of rendering xpState immediately — used on the level-result
  // screen so the player watches the XP actually fill in (and, if it
  // crosses one or more level thresholds, watches each of those play out
  // too) instead of the bar just snapping straight to its new position.
  animateFrom?: PlayerXpState
  onAnimationComplete?: () => void
}

const FILL_DURATION_MS = 500
const LEVEL_UP_PAUSE_MS = 550

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

// Same "force two real paints" trick Board.tsx uses for tile falls: without
// it, resetting the fill to 0% and then animating it back up in the same
// commit never gives the browser anything to actually transition from.
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

interface DisplayState {
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
}

export default function XpBar({ xpState, leveledUp = false, animateFrom, onAnimationComplete }: XpBarProps) {
  const [display, setDisplay] = useState<DisplayState>(() => animateFrom ?? xpState)
  const [instantFill, setInstantFill] = useState(false)
  const [justLeveledUp, setJustLeveledUp] = useState(false)

  useEffect(() => {
    if (!animateFrom) return
    let cancelled = false
    const gained = xpState.totalXp - animateFrom.totalXp

    async function animate() {
      let level = animateFrom!.level
      let remaining = animateFrom!.xpIntoLevel + gained
      let required = xpRequiredForLevel(level)

      setDisplay({ level, xpIntoLevel: animateFrom!.xpIntoLevel, xpForNextLevel: required })
      await nextFrame()

      // Walk one level at a time: fill this level's bar to 100%, pause on
      // the level-up flash, snap back to 0% with no transition, then keep
      // going — covers gaining several levels in a single payout too.
      while (remaining >= required) {
        setDisplay({ level, xpIntoLevel: required, xpForNextLevel: required })
        await sleep(FILL_DURATION_MS)
        if (cancelled) return

        remaining -= required
        level += 1
        required = xpRequiredForLevel(level)
        setJustLeveledUp(true)

        setInstantFill(true)
        setDisplay({ level, xpIntoLevel: 0, xpForNextLevel: required })
        await nextFrame()
        if (cancelled) return
        setInstantFill(false)
        await sleep(LEVEL_UP_PAUSE_MS)
        if (cancelled) return
      }

      setDisplay({ level, xpIntoLevel: remaining, xpForNextLevel: required })
      await sleep(FILL_DURATION_MS)
      if (!cancelled) onAnimationComplete?.()
    }

    void animate()
    return () => {
      cancelled = true
    }
    // animateFrom/xpState are a fixed snapshot for this component's whole
    // lifetime (it's mounted fresh each time a level-result payout needs
    // animating), so this is intentionally a mount-only effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const percent = Math.min(100, (display.xpIntoLevel / display.xpForNextLevel) * 100)

  return (
    <div className="xp-bar">
      <div className="xp-bar-level">Lv {display.level}</div>
      <div className="xp-bar-track">
        <div
          className={instantFill ? 'xp-bar-fill xp-bar-fill--instant' : 'xp-bar-fill'}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="xp-bar-text">
        {display.xpIntoLevel} / {display.xpForNextLevel} XP
      </div>
      {(leveledUp || justLeveledUp) && <div className="xp-bar-levelup">Leveled Up!</div>}
    </div>
  )
}
