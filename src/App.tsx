import { useState } from 'react'
import GameScreen from './screens/GameScreen'
import Overworld from './screens/Overworld'
import SkillTree from './screens/SkillTree'
import { loadProgress, recordLevelResult, type Progress } from './game/progress'
import { addXp, computePlayerXpState, loadTotalXp, type PlayerXpState } from './game/playerProgress'
import { loadSkillLevels, upgradeSkill, type SkillId, type SkillLevels } from './game/skills'
import './App.css'

type Screen = { name: 'overworld' } | { name: 'level'; levelId: number } | { name: 'skills' }

function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [playerXp, setPlayerXp] = useState<PlayerXpState>(() =>
    computePlayerXpState(loadTotalXp()),
  )
  const [skillLevels, setSkillLevels] = useState<SkillLevels>(() => loadSkillLevels())
  const [screen, setScreen] = useState<Screen>({ name: 'overworld' })

  const handleSelectLevel = (levelId: number) => {
    setScreen({ name: 'level', levelId })
  }

  const handleOpenSkillTree = () => {
    setScreen({ name: 'skills' })
  }

  const handleExitToOverworld = () => {
    setScreen({ name: 'overworld' })
  }

  const handleLevelResult = (levelId: number, score: number, passed: boolean) => {
    setProgress(recordLevelResult(levelId, score, passed))
    // Only a cleared level's score counts toward player XP — a failed
    // attempt still shows the score, but doesn't feed the character.
    if (passed) {
      setPlayerXp(computePlayerXpState(addXp(score)))
    }
  }

  const handleUpgradeSkill = (skillId: SkillId) => {
    setSkillLevels(upgradeSkill(skillId, playerXp.level, skillLevels))
  }

  if (screen.name === 'level') {
    return (
      <GameScreen
        levelId={screen.levelId}
        playerXp={playerXp}
        skillLevels={skillLevels}
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

  return (
    <Overworld
      progress={progress}
      playerXp={playerXp}
      skillLevels={skillLevels}
      onSelectLevel={handleSelectLevel}
      onOpenSkillTree={handleOpenSkillTree}
    />
  )
}

export default App
