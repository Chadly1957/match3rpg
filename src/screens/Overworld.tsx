import { LEVELS } from '../game/levels'
import { isLevelUnlocked, type Progress } from '../game/progress'

interface OverworldProps {
  progress: Progress
  onSelectLevel: (levelId: number) => void
}

// Bottom-to-top winding path positions, in percent of the map container.
const NODE_POSITIONS: Record<number, { x: number; y: number }> = {
  1: { x: 30, y: 88 },
  2: { x: 70, y: 68 },
  3: { x: 30, y: 48 },
  4: { x: 70, y: 28 },
  5: { x: 50, y: 8 },
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

export default function Overworld({ progress, onSelectLevel }: OverworldProps) {
  return (
    <div className="screen">
      <h1 className="title">Overworld</h1>
      <p className="message">Clear a level's goal score to unlock the next.</p>

      <div className="map">
        <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {LEVELS.slice(0, -1).map((level, i) => {
            const from = NODE_POSITIONS[level.id]
            const to = NODE_POSITIONS[LEVELS[i + 1].id]
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
          const pos = NODE_POSITIONS[level.id]
          const unlocked = isLevelUnlocked(progress, level.id)
          const completed = level.id < progress.unlockedLevel
          const bestScore = progress.bestScores[level.id]

          const status = completed ? 'completed' : unlocked ? 'unlocked' : 'locked'

          return (
            <button
              key={level.id}
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
  )
}
