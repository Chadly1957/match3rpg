import { useState } from 'react'
import GameScreen from './screens/GameScreen'
import Overworld from './screens/Overworld'
import SkillTree from './screens/SkillTree'
import DailyBounties from './screens/DailyBounties'
import type { BountyFlags } from './components/Board'
import { loadProgress, recordLevelResult, type Progress } from './game/progress'
import { addXp, computePlayerXpState, loadTotalXp, type PlayerXpState } from './game/playerProgress'
import { getBountyCapacity, loadSkillLevels, upgradeSkill, type SkillId, type SkillLevels } from './game/skills'
import {
  completeBounties,
  getBounty,
  loadBountyState,
  toggleBounty,
  type BountyId,
  type BountyState,
} from './game/bounties'
import './App.css'

type Screen =
  | { name: 'overworld' }
  | { name: 'level'; levelId: number }
  | { name: 'skills' }
  | { name: 'bounties' }

function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [playerXp, setPlayerXp] = useState<PlayerXpState>(() =>
    computePlayerXpState(loadTotalXp()),
  )
  const [skillLevels, setSkillLevels] = useState<SkillLevels>(() => loadSkillLevels())
  const [bountyState, setBountyState] = useState<BountyState>(() => loadBountyState())
  const [bountyRewards, setBountyRewards] = useState<BountyId[]>([])
  const [screen, setScreen] = useState<Screen>({ name: 'overworld' })

  const handleSelectLevel = (levelId: number) => {
    // Loading fresh here (rather than trusting the state from a previous
    // day) is what makes the midnight reset actually take effect while the
    // app stays open across the boundary.
    setBountyState(loadBountyState())
    setBountyRewards([])
    setScreen({ name: 'level', levelId })
  }

  const handleOpenSkillTree = () => {
    setScreen({ name: 'skills' })
  }

  const handleOpenBounties = () => {
    setBountyState(loadBountyState())
    setScreen({ name: 'bounties' })
  }

  const handleExitToOverworld = () => {
    setScreen({ name: 'overworld' })
  }

  const handleLevelResult = (
    levelId: number,
    score: number,
    passed: boolean,
    bountyFlags: BountyFlags,
  ) => {
    setProgress(recordLevelResult(levelId, score, passed))

    // Only a cleared level's score counts toward player XP — a failed
    // attempt still shows the score, but doesn't feed the character. A
    // bounty can likewise only be banked off the back of a goal-reached
    // clear, never a loss.
    if (!passed) {
      setBountyRewards([])
      return
    }

    let totalXp = addXp(score)

    const { state: nextBountyState, newlyCompleted } = completeBounties(bountyState, bountyFlags)
    setBountyState(nextBountyState)
    setBountyRewards(newlyCompleted)

    for (const id of newlyCompleted) {
      const bounty = getBounty(id)
      if (bounty) totalXp = addXp(bounty.xpReward)
    }

    setPlayerXp(computePlayerXpState(totalXp))
  }

  const handleUpgradeSkill = (skillId: SkillId) => {
    setSkillLevels(upgradeSkill(skillId, playerXp.level, skillLevels))
  }

  const handleToggleBounty = (bountyId: BountyId) => {
    const capacity = getBountyCapacity(skillLevels)
    setBountyState(toggleBounty(bountyState, bountyId, capacity))
  }

  if (screen.name === 'level') {
    return (
      <GameScreen
        levelId={screen.levelId}
        playerXp={playerXp}
        skillLevels={skillLevels}
        bountyRewards={bountyRewards}
        onExit={handleExitToOverworld}
        onLevelResult={handleLevelResult}
      />
    )
  }

  if (screen.name === 'skills') {
    return (
      <SkillTree
        playerXp={playerXp}
        skillLevels={skillLevels}
        onUpgrade={handleUpgradeSkill}
        onExit={handleExitToOverworld}
      />
    )
  }

  if (screen.name === 'bounties') {
    return (
      <DailyBounties
        bountyState={bountyState}
        capacity={getBountyCapacity(skillLevels)}
        onToggle={handleToggleBounty}
        onExit={handleExitToOverworld}
      />
    )
  }

  return (
    <Overworld
      progress={progress}
      playerXp={playerXp}
      skillLevels={skillLevels}
      bountyState={bountyState}
      onSelectLevel={handleSelectLevel}
      onOpenSkillTree={handleOpenSkillTree}
      onOpenBounties={handleOpenBounties}
    />
  )
}

export default App
