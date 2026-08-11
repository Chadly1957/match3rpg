import { useState } from 'react'
import GameScreen from './screens/GameScreen'
import Overworld from './screens/Overworld'
import { loadProgress, recordLevelResult, type Progress } from './game/progress'
import './App.css'

type Screen = { name: 'overworld' } | { name: 'level'; levelId: number }

function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [screen, setScreen] = useState<Screen>({ name: 'overworld' })

  const handleSelectLevel = (levelId: number) => {
    setScreen({ name: 'level', levelId })
  }

  const handleExitToOverworld = () => {
    setScreen({ name: 'overworld' })
  }

  const handleLevelResult = (levelId: number, score: number, passed: boolean) => {
    setProgress(recordLevelResult(levelId, score, passed))
  }

  if (screen.name === 'level') {
    return (
      <GameScreen
        levelId={screen.levelId}
        onExit={handleExitToOverworld}
        onLevelResult={handleLevelResult}
      />
    )
  }

  return <Overworld progress={progress} onSelectLevel={handleSelectLevel} />
}

export default App
