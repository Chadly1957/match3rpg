import { Fragment, useEffect, useRef, useState } from 'react'
import LockIcon from '../components/LockIcon'
import ThemeSwatch from '../components/ThemeSwatch'
import Wiggle from '../components/Wiggle'
import XpBar from '../components/XpBar'
import { LEVELS } from '../game/levels'
import { getReplaysRemaining, isLevelUnlocked, type Progress } from '../game/progress'
import type { PlayerXpState } from '../game/playerProgress'
import { availableSkillPoints, type SkillLevels } from '../game/skills'
import { activeSelection, BOUNTY_SLOT_CAPACITY, DAILY_BOUNTY_LIMIT, type BountyState } from '../game/bounties'
import { isThemeUnlocked, THEMES, unlockDescription, type ThemeId } from '../game/theme'

interface OverworldProps {
  progress: Progress
  playerXp: PlayerXpState
  skillLevels: SkillLevels
  bountyState: BountyState
  theme: ThemeId
  hasUnseenTheme: boolean
  onSelectLevel: (levelId: number) => void
  onReplayLevel: (levelId: number) => void
  onOpenSkillTree: () => void
  onOpenBounties: () => void
  onWipeProgress: () => void
  onSelectTheme: (theme: ThemeId) => void
  onThemeMenuOpened: () => void
}

// Bottom-to-top winding path: level 1 at the bottom, highest level at the
// top, alternating left/right so the connectors zig-zag instead of running
// straight up. Node positions are computed in real pixels (matching the
// .map container's own CSS width formula, min(86vw, 360px), the same way
// Board.tsx derives cell size from the viewport instead of measuring the
// DOM) so the connector lines below can be trimmed by an exact pixel
// radius rather than fighting SVG viewBox stretch.
const NODE_SPACING_PX = 128
const NODE_TOP_PADDING_PX = 60
const NODE_BOTTOM_PADDING_PX = 60
const NODE_RADIUS_PX = 28
// Extra breathing room beyond the node's edge, so the connector visibly
// stops short of each circle instead of just kissing its outline.
const NODE_LINE_GAP_PX = 20
const NODE_LINE_INSET_PX = NODE_RADIUS_PX + NODE_LINE_GAP_PX

function getMapWidth(): number {
  return Math.min(window.innerWidth * 0.86, 360)
}

function getMapHeight(levelCount: number): number {
  return NODE_TOP_PADDING_PX + NODE_SPACING_PX * (levelCount - 1) + NODE_BOTTOM_PADDING_PX
}

function getNodePosition(id: number, levelCount: number, mapWidth: number): { x: number; y: number } {
  const y = NODE_TOP_PADDING_PX + NODE_SPACING_PX * (levelCount - id)
  const x = id % 2 === 1 ? mapWidth * 0.3 : mapWidth * 0.7
  return { x, y }
}

// Trims a connector so it stops at the edge of each node's circle instead
// of running to its center — otherwise the line is drawn straight under
// the node, and shows through as an ugly cross-hatch wherever the node's
// background isn't fully opaque.
function insetToward(from: { x: number; y: number }, to: { x: number; y: number }, inset: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return { x: from.x + (dx / len) * inset, y: from.y + (dy / len) * inset }
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
  theme,
  hasUnseenTheme,
  onSelectLevel,
  onReplayLevel,
  onOpenSkillTree,
  onOpenBounties,
  onWipeProgress,
  onSelectTheme,
  onThemeMenuOpened,
}: OverworldProps) {
  const points = availableSkillPoints(playerXp.level, skillLevels)
  const hasOpenBountySlot =
    activeSelection(bountyState).length < BOUNTY_SLOT_CAPACITY && bountyState.completed.length < DAILY_BOUNTY_LIMIT
  const currentNodeRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [replayLevelId, setReplayLevelId] = useState<number | null>(null)
  const [mapWidth, setMapWidth] = useState(getMapWidth)

  // With dozens of levels the map is taller than the viewport — jump to the
  // player's current level on load instead of always starting at level 1.
  useEffect(() => {
    currentNodeRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  useEffect(() => {
    const compute = () => setMapWidth(getMapWidth())
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  const mapHeight = getMapHeight(LEVELS.length)

  const handleWipeClick = () => {
    setMenuOpen(false)
    const confirmed = window.confirm(
      'Wipe all progress? This resets levels, player XP, skills, and bounties — for testing only, cannot be undone.',
    )
    if (confirmed) onWipeProgress()
  }

  const handleMenuToggle = () => {
    setMenuOpen((open) => {
      const next = !open
      if (next) onThemeMenuOpened()
      return next
    })
  }

  return (
    <div className="overworld-screen">
      <div className="overworld-header">
        <div className="overworld-title-row">
          <h1 className="title">
            <Wiggle>Overworld</Wiggle>
          </h1>
          <div className="menu-wrap">
            <button
              type="button"
              className="btn btn--ghost menu-btn"
              onClick={handleMenuToggle}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <MenuIcon />
              {hasUnseenTheme && <span className="nav-badge">1</span>}
            </button>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="menu-dropdown">
                  <div className="menu-section-label">
                    <Wiggle>Theme</Wiggle>
                  </div>
                  {THEMES.map((t) => {
                    const unlocked = isThemeUnlocked(t, progress.unlockedLevel, playerXp.level)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={[
                          'menu-item',
                          'menu-theme-item',
                          theme === t.id ? 'menu-theme-item--active' : '',
                          !unlocked ? 'menu-theme-item--locked' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={!unlocked}
                        onClick={() => onSelectTheme(t.id)}
                      >
                        <ThemeSwatch ink={t.ink} paper={t.paper} className="menu-theme-swatch" />
                        <span className="menu-theme-info">
                          <Wiggle>{t.name}</Wiggle>
                          {!unlocked && t.unlock && (
                            <span className="menu-theme-unlock-hint">{unlockDescription(t.unlock)}</span>
                          )}
                        </span>
                        {!unlocked && <LockIcon className="menu-theme-lock-icon" />}
                      </button>
                    )
                  })}
                  <div className="menu-divider" />
                  <button
                    type="button"
                    className="menu-item menu-item--danger"
                    onClick={handleWipeClick}
                  >
                    <Wiggle>Wipe Progress</Wiggle>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <XpBar xpState={playerXp} />

        <div className="nav-row">
          <button type="button" className="btn nav-btn" onClick={onOpenSkillTree}>
            <Wiggle>Skill Tree</Wiggle>
            {points > 0 && <span className="nav-badge">{points}</span>}
          </button>
          <button type="button" className="btn btn--ghost nav-btn" onClick={onOpenBounties}>
            <Wiggle>Daily Bounties</Wiggle>
            {hasOpenBountySlot && <span className="nav-badge">1</span>}
          </button>
        </div>

        <p className="message">Clear a level's goal score to unlock the next.</p>
      </div>

      <div className="overworld-map-scroll">
        <div className="map" style={{ width: mapWidth, height: mapHeight }}>
          <svg
            className="map-lines"
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            aria-hidden="true"
          >
            {LEVELS.slice(0, -1).map((level, i) => {
              const from = getNodePosition(level.id, LEVELS.length, mapWidth)
              const to = getNodePosition(LEVELS[i + 1].id, LEVELS.length, mapWidth)
              const start = insetToward(from, to, NODE_LINE_INSET_PX)
              const end = insetToward(to, from, NODE_LINE_INSET_PX)
              const active = level.id < progress.unlockedLevel
              return (
                <line
                  key={level.id}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className={active ? 'map-line map-line--active' : 'map-line'}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </svg>

          {LEVELS.map((level) => {
            const pos = getNodePosition(level.id, LEVELS.length, mapWidth)
            const unlocked = isLevelUnlocked(progress, level.id)
            const completed = level.id < progress.unlockedLevel
            const isCurrent = level.id === progress.unlockedLevel
            const bestScore = progress.bestScores[level.id]

            const status = completed ? 'completed' : unlocked ? 'unlocked' : 'locked'
            // A theme tied to clearing this specific level gets a little
            // floating preview badge on its node, advertising the reward
            // whether or not the level (and so the theme) is cleared yet.
            const themeUnlockedHere = THEMES.find((t) => t.unlock?.type === 'level' && t.unlock.value === level.id)

            return (
              <Fragment key={level.id}>
                <button
                  ref={isCurrent ? currentNodeRef : undefined}
                  type="button"
                  className={`node node--${status}`}
                  style={{ left: pos.x, top: pos.y }}
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
                {themeUnlockedHere && (
                  <div
                    className="theme-unlock-badge"
                    style={{ left: pos.x + 28, top: pos.y - 28 }}
                    title={`Clear this level to unlock the ${themeUnlockedHere.name} theme`}
                  >
                    <ThemeSwatch
                      ink={themeUnlockedHere.ink}
                      paper={themeUnlockedHere.paper}
                      className="theme-unlock-badge-swatch"
                    />
                    <span className="theme-unlock-badge-label">
                      <Wiggle>New Theme!</Wiggle>
                    </span>
                  </div>
                )}
              </Fragment>
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
              <h2>
                <Wiggle>{level.name}</Wiggle>
              </h2>
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
                  <Wiggle>Play</Wiggle>
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setReplayLevelId(null)}>
                  <Wiggle>Overworld</Wiggle>
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
