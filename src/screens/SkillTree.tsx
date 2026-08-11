import XpBar from '../components/XpBar'
import { SKILLS, availableSkillPoints, canUpgradeSkill, type SkillId, type SkillLevels } from '../game/skills'
import type { PlayerXpState } from '../game/playerProgress'

interface SkillTreeProps {
  playerXp: PlayerXpState
  skillLevels: SkillLevels
  onUpgrade: (skillId: SkillId) => void
  onExit: () => void
}

export default function SkillTree({ playerXp, skillLevels, onUpgrade, onExit }: SkillTreeProps) {
  const points = availableSkillPoints(playerXp.level, skillLevels)

  return (
    <div className="screen">
      <div className="level-header">
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          ← Overworld
        </button>
        <h1 className="title">Skill Tree</h1>
      </div>

      <XpBar xpState={playerXp} />

      <p className="message">
        {points} skill point{points === 1 ? '' : 's'} available — earn more by leveling up.
      </p>

      <div className="skill-list">
        {SKILLS.map((skill) => {
          const level = skillLevels[skill.id]
          const maxed = level >= skill.maxLevel
          const canUpgrade = canUpgradeSkill(skill.id, playerXp.level, skillLevels)

          return (
            <div key={skill.id} className="skill-card">
              <div className="skill-card-info">
                <h2>{skill.name}</h2>
                <p>{skill.description}</p>
                <p className="skill-card-level">
                  Level {level} / {skill.maxLevel}
                </p>
              </div>
              <button
                type="button"
                className="btn skill-card-btn"
                disabled={!canUpgrade}
                onClick={() => onUpgrade(skill.id)}
              >
                {maxed ? 'Max' : '+1'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
