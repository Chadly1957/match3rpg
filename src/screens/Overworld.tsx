import { useEffect, useRef, useState } from 'react'
import XpBar from '../components/XpBar'
import { LEVELS } from '../game/levels'
import { isLevelUnlocked, type Progress } from '../game/progress'
import type { PlayerXpState } from '../game/playerProgress'
import { availableSkillPoints, getBountyCapacity, type SkillLevels } from '../game/skills'
import type { BountyState } from '../game/bounties'

interface OverworldProps {
  progress: Progress
  playerXp: PlayerXpState
  skillLevels: SkillLevels
  bountyState: BountyState
  onSelectLevel: (levelId: number) => void
  onOpenSkillTree: () => void
  onOpenBounties: () => void
  onWipeProgress: () => void
}

// Bottom-to-top winding path: level 1 at the bottom, highest level at the
// top, alternating left/right so the line zig-zags instead of running
// straight up. Positions are percentages of the map container, so this
// scales to however many levels LEVELS ends up with.
const NODE_SPACING_PX = 110
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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="node-icon" aria-hidden="true">
      <path
        d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"
        fill="currentColor"
      />
    </svg>
  )
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
  onOpenSkillTree,
  onOpenBounties,
  onWipeProgress,
}: OverworldProps) {
  const points = availableSkillPoints(playerXp.level, skillLevels)
  const bountyCapacity = getBountyCapacity(skillLevels)
  const openBountySlots = bountyCapacity - bountyState.selected.length
  const currentNodeRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

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
            {openBountySlots > 0 && <span className="nav-badge">{openBountySlots}</span>}
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
                onClick={() => onSelectLevel(level.id)}
                aria-label={`${level.name}${completed ? ' (completed)' : unlocked ? '' : ' (locked)'}`}
              >
                {completed ? <CheckIcon /> : status === 'locked' ? <LockIcon /> : <span className="node-number">{level.id}</span>}
                <span className="node-label">{level.name}</span>
                {bestScore !== undefined && <span className="node-score">Best {bestScore}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
