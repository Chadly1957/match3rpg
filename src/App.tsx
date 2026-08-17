import { useEffect, useState } from 'react'
import GameScreen from './screens/GameScreen'
import Overworld from './screens/Overworld'
import SkillTree from './screens/SkillTree'
import DailyBounties from './screens/DailyBounties'
import type { BountyFlags } from './components/Board'
import { loadProgress, recordLevelResult, resetProgress, spendReplay, type Progress } from './game/progress'
import {
  addXp,
  computePlayerXpState,
  loadTotalXp,
  resetPlayerXp,
  xpFromScore,
  type PlayerXpState,
} from './game/playerProgress'
import {
  loadSkillLevels,
  resetSkillLevels,
  respecSkillLevels,
  upgradeSkill,
  type SkillId,
  type SkillLevels,
} from './game/skills'
import {
  completeBounties,
  getBounty,
  loadBountyState,
  resetBountyState,
  toggleBounty,
  type BountyId,
  type BountyState,
} from './game/bounties'
import {
  isThemeUnlocked,
  loadSeenThemes,
  loadTheme,
  resetSeenThemes,
  saveSeenThemes,
  saveTheme,
  THEMES,
  type ThemeId,
} from './game/theme'
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
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme())
  const [seenThemeIds, setSeenThemeIds] = useState<ThemeId[]>(() => loadSeenThemes())

  // The theme lives on the document root (not a wrapper div) so every
  // themed CSS variable in index.css applies from the very top down,
  // exactly like the light/dark handling any other themed page would use.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const handleSelectTheme = (nextTheme: ThemeId) => {
    const def = THEMES.find((t) => t.id === nextTheme)
    // Belt-and-suspenders: the menu already disables a locked theme's
    // button, but don't trust the UI alone to enforce the unlock.
    if (!def || !isThemeUnlocked(def, progress.unlockedLevel, playerXp.level)) return
    setTheme(nextTheme)
    saveTheme(nextTheme)
  }

  const unlockedThemeIds = THEMES.filter((t) => isThemeUnlocked(t, progress.unlockedLevel, playerXp.level)).map(
    (t) => t.id,
  )
  const hasUnseenTheme = unlockedThemeIds.some((id) => !seenThemeIds.includes(id))

  // Called when the player opens the hamburger menu — clears the "something
  // new in here" badge by marking every currently-unlocked theme as seen.
  const handleThemeMenuOpened = () => {
    if (!hasUnseenTheme) return
    setSeenThemeIds(unlockedThemeIds)
    saveSeenThemes(unlockedThemeIds)
  }

  const handleSelectLevel = (levelId: number) => {
    // Loading fresh here (rather than trusting the state from a previous
    // day) is what makes the midnight reset actually take effect while the
    // app stays open across the boundary.
    setBountyState(loadBountyState())
    setBountyRewards([])
    setScreen({ name: 'level', levelId })
  }

  const handleReplayLevel = (levelId: number) => {
    setProgress(spendReplay(levelId))
    handleSelectLevel(levelId)
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

    let totalXp = addXp(xpFromScore(score))

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

  const handleRespecSkills = () => {
    setSkillLevels(respecSkillLevels())
  }

  const handleToggleBounty = (bountyId: BountyId) => {
    setBountyState(toggleBounty(bountyState, bountyId))
  }

  // Testing-only escape hatch: wipes every piece of persisted state
  // (level progress, player XP, skill points, bounty picks) and resets the
  // app back to a brand-new save.
  const handleWipeProgress = () => {
    resetProgress()
    resetPlayerXp()
    resetSkillLevels()
    resetBountyState()
    resetSeenThemes()

    setProgress(loadProgress())
    setPlayerXp(computePlayerXpState(loadTotalXp()))
    setSkillLevels(loadSkillLevels())
    setBountyState(loadBountyState())
    setBountyRewards([])
    setSeenThemeIds(loadSeenThemes())
  }

  if (screen.name === 'level') {
    return (
      <GameScreen
        key={screen.levelId}
        levelId={screen.levelId}
        playerXp={playerXp}
        skillLevels={skillLevels}
        bountyState={bountyState}
        bountyRewards={bountyRewards}
        onExit={handleExitToOverworld}
        onSelectLevel={handleSelectLevel}
        onOpenSkillTree={handleOpenSkillTree}
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
        onRespec={handleRespecSkills}
        onExit={handleExitToOverworld}
      />
    )
  }

  if (screen.name === 'bounties') {
    return (
      <DailyBounties
        bountyState={bountyState}
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
      theme={theme}
      hasUnseenTheme={hasUnseenTheme}
      onSelectLevel={handleSelectLevel}
      onReplayLevel={handleReplayLevel}
      onOpenSkillTree={handleOpenSkillTree}
      onOpenBounties={handleOpenBounties}
      onWipeProgress={handleWipeProgress}
      onSelectTheme={handleSelectTheme}
      onThemeMenuOpened={handleThemeMenuOpened}
    />
  )
}

export default App
