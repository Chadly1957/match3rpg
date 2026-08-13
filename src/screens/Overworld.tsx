import { useEffect, useRef, useState } from 'react'
import LockIcon from '../components/LockIcon'
import XpBar from '../components/XpBar'
import { LEVELS } from '../game/levels'
import { getReplaysRemaining, isLevelUnlocked, type Progress } from '../game/progress'
import type { PlayerXpState } from '../game/playerProgress'
import { availableSkillPoints, type SkillLevels } from '../game/skills'
import { BOUNTY_SLOT_CAPACITY, DAILY_BOUNTY_LIMIT, type BountyState } from '../game/bounties'

interface OverworldProps {
  progress: Progress
  playerXp: PlayerXpState
  skillLevels: SkillLevels
  bountyState: BountyState
  onSelectLevel: (levelId: number) => void
  onReplayLevel: (levelId: number) => void
  onOpenSkillTree: () => void
  onOpenBounties: () => void
  onWipeProgress: () => void
}

// Bottom-to-top winding path: level 1 at the bottom, highest level at the
// top, alternating left/right so the line zig-zags instead of running
// straight up. Positions are percentages of the map container, so this
// scales to however many levels LEVELS ends up with.
const NODE_SPACING_PX = 128
const NODE_TOP_PADDING_PX = 60
const NODE_BOTTOM_PADDING_PX = 60

function getMapHeight(levelCount: number): number {
  return NODE_TOP_PADDING_PX + NODE_SPACING_PX * (levelCount - 1) + NODE_BOTTOM_PADDING_PX
}

function getNodePosition(id: number, levelCount: number): { x: number; y: number } {
  const mapHeight = getMapHeight(levelCount)
  const yPx = NODE_TOP_PADDING_PX + NODE_SPACING_PX * (levelCount - id)
  const x = id % 2 === 1 ? 30 : 70
  return { x, y: (yPx / mapHeight) * 100 }
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="node-icon" aria-hidden="true">
      <path
        d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4l-1.4-1.4z"
        fill="currentColor"
      />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" className="menu-icon" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function Overworld({
  progress,
  playerXp,
  skillLevels,
  bountyState,
  onSelectLevel,
  onReplayLevel,
  onOpenSkillTree,
  onOpenBounties,
  onWipeProgress,
}: OverworldProps) {
  const points = availableSkillPoints(playerXp.level, skillLevels)
  const hasOpenBountySlot =
    bountyState.selected.length < BOUNTY_SLOT_CAPACITY && bountyState.completed.length < DAILY_BOUNTY_LIMIT
  const currentNodeRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [replayLevelId, setReplayLevelId] = useState<number | null>(null)

  // With up to 20 levels the map is taller than the viewport — jump to the
  // player's current level on load instead of always starting at level 1.
  useEffect(() => {
    currentNodeRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  const mapHeight = getMapHeight(LEVELS.length)

  const handleWipeClick = () => {
    setMenuOpen(false)
    const confirmed = window.confirm(
      'Wipe all progress? This resets levels, player XP, skills, and bounties — for testing only, cannot be undone.',
    )
    if (confirmed) onWipeProgress()
  }

  return (
    <div className="overworld-screen">
      <div className="overworld-header">
        <div className="overworld-title-row">
          <h1 className="title">Overworld</h1>
          <div className="menu-wrap">
            <button
              type="button"
              className="btn btn--ghost menu-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <MenuIcon />
            </button>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="menu-dropdown">
                  <button
                    type="button"
                    className="menu-item menu-item--danger"
                    onClick={handleWipeClick}
                  >
                    Wipe Progress
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <XpBar xpState={playerXp} />

        <div className="nav-row">
          <button type="button" className="btn nav-btn" onClick={onOpenSkillTree}>
            Skill Tree
            {points > 0 && <span className="nav-badge">{points}</span>}
          </button>
          <button type="button" className="btn btn--ghost nav-btn" onClick={onOpenBounties}>
            Daily Bounties
            {hasOpenBountySlot && <span className="nav-badge">1</span>}
          </button>
        </div>

        <p className="message">Clear a level's goal score to unlock the next.</p>
      </div>

      <div className="overworld-map-scroll">
        <div className="map" style={{ height: mapHeight }}>
          <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {LEVELS.slice(0, -1).map((level, i) => {
              const from = getNodePosition(level.id, LEVELS.length)
              const to = getNodePosition(LEVELS[i + 1].id, LEVELS.length)
              const active = level.id < progress.unlockedLevel
              return (
                <line
                  key={level.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={active ? 'map-line map-line--active' : 'map-line'}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </svg>

          {LEVELS.map((level) => {
            const pos = getNodePosition(level.id, LEVELS.length)
            const unlocked = isLevelUnlocked(progress, level.id)
            const completed = level.id < progress.unlockedLevel
            const isCurrent = level.id === progress.unlockedLevel
            const bestScore = progress.bestScores[level.id]

            const status = completed ? 'completed' : unlocked ? 'unlocked' : 'locked'

            return (
              <button
                key={level.id}
                ref={isCurrent ? currentNodeRef : undefined}
                type="button"
                className={`node node--${status}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                disabled={!unlocked}
                onClick={() => (completed ? setReplayLevelId(level.id) : onSelectLevel(level.id))}
                aria-label={`${level.name}${completed ? ' (completed)' : unlocked ? '' : ' (locked)'}`}
              >
                {completed ? (
                  <CheckIcon />
                ) : status === 'locked' ? (
                  <LockIcon className="node-icon" />
                ) : (
                  <span className="node-number">{level.id}</span>
                )}
                <span className="node-label">{level.name}</span>
                <span className="node-goal">Goal {level.goalScore}</span>
                {bestScore !== undefined && <span className="node-score">Best {bestScore}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {replayLevelId !== null && (() => {
        const level = LEVELS.find((l) => l.id === replayLevelId)
        if (!level) return null
        const remaining = getReplaysRemaining(progress, replayLevelId)

        return (
          <div className="modal-backdrop" onClick={() => setReplayLevelId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>{level.name}</h2>
              <p className="modal-replay-count">
                {remaining > 0
                  ? `${remaining} ${remaining === 1 ? 'Replay' : 'Replays'} Remaining`
                  : 'No Replays Remaining'}
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={remaining <= 0}
                  onClick={() => {
                    setReplayLevelId(null)
                    onReplayLevel(level.id)
                  }}
                >
                  Play
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setReplayLevelId(null)}>
                  Overworld
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
