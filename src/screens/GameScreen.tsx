import { useState } from 'react'
import Board, { type BoardResult, type BountyFlags } from '../components/Board'
import XpBar from '../components/XpBar'
import { getHazardRate, getLevel } from '../game/levels'
import {
  availableSkillPoints,
  getArrowSpawnRate,
  getGridConfig,
  getMoveLimit,
  getScoreMultiplier,
  type SkillLevels,
} from '../game/skills'
import { getBounty, type BountyId, type BountyState } from '../game/bounties'
import type { PlayerXpState } from '../game/playerProgress'

const NO_BOUNTY_PROGRESS: BountyFlags = {
  tShape: false,
  lShape: false,
  doubleChain: false,
  fourInRow: false,
  chain5: false,
  chain10: false,
}

interface GameScreenProps {
  levelId: number
  playerXp: PlayerXpState
  skillLevels: SkillLevels
  bountyState: BountyState
  bountyRewards: BountyId[]
  onExit: () => void
  onSelectLevel: (levelId: number) => void
  onOpenSkillTree: () => void
  onLevelResult: (levelId: number, score: number, passed: boolean, bountyFlags: BountyFlags) => void
}

export default function GameScreen({
  levelId,
  playerXp,
  skillLevels,
  bountyState,
  bountyRewards,
  onExit,
  onSelectLevel,
  onOpenSkillTree,
  onLevelResult,
}: GameScreenProps) {
  const level = getLevel(levelId)
  const nextLevel = getLevel(levelId + 1)
  const moveLimit = getMoveLimit(skillLevels)
  const { rows, cols } = getGridConfig(skillLevels)
  const hazardRate = getHazardRate(levelId)
  const arrowRate = getArrowSpawnRate(skillLevels)
  const scoreMultiplier = getScoreMultiplier(skillLevels)

  const [attempt, setAttempt] = useState(0)
  const [score, setScore] = useState(0)
  const [movesLeft, setMovesLeft] = useState(moveLimit)
  const [liveBountyFlags, setLiveBountyFlags] = useState<BountyFlags>(NO_BOUNTY_PROGRESS)
  const [result, setResult] = useState<BoardResult | null>(null)
  // Captured fresh at the start of each round (mount + every retry) so the
  // XP bar has a real starting point to animate from, and so we can tell
  // whether clearing THIS round pushed the player to a new level.
  const [playerXpAtRoundStart, setPlayerXpAtRoundStart] = useState(playerXp)
  const [xpAnimationDone, setXpAnimationDone] = useState(false)

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
    setLiveBountyFlags(NO_BOUNTY_PROGRESS)
    setPlayerXpAtRoundStart(playerXp)
    setXpAnimationDone(false)
    setAttempt((n) => n + 1)
  }

  const leveledUp = result?.passed === true && playerXp.level > playerXpAtRoundStart.level
  const skillPoints = availableSkillPoints(playerXp.level, skillLevels)
  const totalXpGained = result?.passed ? playerXp.totalXp - playerXpAtRoundStart.totalXp : 0

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
          hazardRate={hazardRate}
          arrowRate={arrowRate}
          scoreMultiplier={scoreMultiplier}
          onScoreChange={setScore}
          onMovesChange={setMovesLeft}
          onBountyProgress={setLiveBountyFlags}
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
                <p className="level-result-xp level-result-xp--pop">+{totalXpGained} XP!</p>
                {bountyRewards.map((id) => {
                  const bounty = getBounty(id)
                  if (!bounty) return null
                  return (
                    <p key={id} className="level-result-bounty">
                      Bounty complete: {bounty.name} +{bounty.xpReward} XP
                    </p>
                  )
                })}
                <XpBar
                  xpState={playerXp}
                  leveledUp={leveledUp && xpAnimationDone}
                  animateFrom={playerXpAtRoundStart}
                  onAnimationComplete={() => setXpAnimationDone(true)}
                />
                {leveledUp && xpAnimationDone && (
                  <button type="button" className="btn btn--ghost nav-btn" onClick={onOpenSkillTree}>
                    Assign Skills
                    {skillPoints > 0 && <span className="nav-badge">{skillPoints}</span>}
                  </button>
                )}
              </>
            ) : (
              <p className="level-result-hint">Give it another shot.</p>
            )}
            <div className="level-result-actions">
              {result.passed && nextLevel ? (
                <button type="button" className="btn" onClick={() => onSelectLevel(nextLevel.id)}>
                  Next Level
                </button>
              ) : (
                <button type="button" className="btn" onClick={handleRetry}>
                  Retry
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={onExit}>
                Overworld
              </button>
            </div>
          </div>
        )}
      </div>

      {bountyState.selected.length > 0 && (
        <div className="board-bounties">
          {bountyState.selected.map((id) => {
            const bounty = getBounty(id)
            if (!bounty) return null
            const redeemed = bountyState.completed.includes(id)
            const checked = redeemed || liveBountyFlags[id]

            return (
              <div
                key={id}
                className={
                  redeemed
                    ? 'board-bounty board-bounty--redeemed'
                    : checked
                      ? 'board-bounty board-bounty--checked'
                      : 'board-bounty'
                }
              >
                <span className="board-bounty-check" aria-hidden="true">
                  {checked ? '✓' : ''}
                </span>
                <span className="board-bounty-name">{bounty.name}</span>
                <span className="board-bounty-status">
                  {redeemed ? 'Redeemed' : checked ? 'Clear level to redeem' : `+${bounty.xpReward} XP`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
