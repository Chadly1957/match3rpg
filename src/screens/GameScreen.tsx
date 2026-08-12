import { useState } from 'react'
import Board, { type BoardResult, type BountyFlags } from '../components/Board'
import XpBar from '../components/XpBar'
import { getLevel } from '../game/levels'
import { getGridConfig, getMoveLimit, type SkillLevels } from '../game/skills'
import { getBounty, type BountyId } from '../game/bounties'
import type { PlayerXpState } from '../game/playerProgress'

interface GameScreenProps {
  levelId: number
  playerXp: PlayerXpState
  skillLevels: SkillLevels
  bountyRewards: BountyId[]
  onExit: () => void
  onLevelResult: (levelId: number, score: number, passed: boolean, bountyFlags: BountyFlags) => void
}

export default function GameScreen({
  levelId,
  playerXp,
  skillLevels,
  bountyRewards,
  onExit,
  onLevelResult,
}: GameScreenProps) {
  const level = getLevel(levelId)
  const moveLimit = getMoveLimit(skillLevels)
  const { rows, cols } = getGridConfig(skillLevels)

  const [attempt, setAttempt] = useState(0)
  const [score, setScore] = useState(0)
  const [movesLeft, setMovesLeft] = useState(moveLimit)
  const [result, setResult] = useState<BoardResult | null>(null)

  if (!level) {
    return (
      <div className="screen">
        <p className="message">Level not found.</p>
        <button type="button" className="btn" onClick={onExit}>
          Back to overworld
        </button>
      </div>
    )
  }

  const goalReached = score >= level.goalScore

  const handleFinish = (boardResult: BoardResult) => {
    setResult(boardResult)
    onLevelResult(levelId, boardResult.score, boardResult.passed, boardResult.bountyFlags)
  }

  const handleRetry = () => {
    setResult(null)
    setScore(0)
    setMovesLeft(moveLimit)
    setAttempt((n) => n + 1)
  }

  return (
    <div className="screen">
      <div className="level-header">
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          ← Overworld
        </button>
        <h1 className="title">{level.name}</h1>
      </div>

      <div className="hud">
        <div className="hud-stat">
          <span className="hud-label">Score</span>
          <span className={goalReached ? 'hud-value hud-value--goal' : 'hud-value'}>
            {score} <span className="hud-goal">/ {level.goalScore}</span>
          </span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Moves</span>
          <span className="hud-value">{movesLeft}</span>
        </div>
      </div>

      <div className="board-wrap">
        <Board
          key={attempt}
          rows={rows}
          cols={cols}
          moveLimit={moveLimit}
          goalScore={level.goalScore}
          onScoreChange={setScore}
          onMovesChange={setMovesLeft}
          onFinish={handleFinish}
        />

        {result && (
          <div className="level-result">
            <h2>{result.passed ? 'Level Complete!' : 'Out of Moves'}</h2>
            <p>
              Final score: {result.score} / {level.goalScore}
            </p>
            {result.passed ? (
              <>
                <p className="level-result-xp">+{result.score} XP</p>
                {bountyRewards.map((id) => {
                  const bounty = getBounty(id)
                  if (!bounty) return null
                  return (
                    <p key={id} className="level-result-bounty">
                      Bounty complete: {bounty.name} +{bounty.xpReward} XP
                    </p>
                  )
                })}
                <XpBar xpState={playerXp} />
              </>
            ) : (
              <p className="level-result-hint">Give it another shot.</p>
            )}
            <div className="level-result-actions">
              <button type="button" className="btn" onClick={handleRetry}>
                Retry
              </button>
              <button type="button" className="btn btn--ghost" onClick={onExit}>
                Overworld
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
