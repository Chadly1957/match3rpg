import { useState } from 'react'
import GameScreen from './screens/GameScreen'
import Overworld from './screens/Overworld'
import { loadProgress, recordLevelResult, type Progress } from './game/progress'
import { addXp, computePlayerXpState, loadTotalXp, type PlayerXpState } from './game/playerProgress'
import './App.css'

type Screen = { name: 'overworld' } | { name: 'level'; levelId: number }

function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [playerXp, setPlayerXp] = useState<PlayerXpState>(() =>
    computePlayerXpState(loadTotalXp()),
  )
  const [screen, setScreen] = useState<Screen>({ name: 'overworld' })

  const handleSelectLevel = (levelId: number) => {
    setScreen({ name: 'level', levelId })
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

  if (screen.name === 'level') {
    return (
      <GameScreen
        levelId={screen.levelId}
        playerXp={playerXp}
        onExit={handleExitToOverworld}
        onLevelResult={handleLevelResult}
      />
    )
  }

  return <Overworld progress={progress} playerXp={playerXp} onSelectLevel={handleSelectLevel} />
}

export default App
