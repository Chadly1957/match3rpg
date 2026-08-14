import LockIcon from '../components/LockIcon'
import Wiggle from '../components/Wiggle'
import XpBar from '../components/XpBar'
import {
  SKILLS,
  availableSkillPoints,
  canUpgradeSkill,
  isSkillLocked,
  totalSkillPointsSpent,
  type SkillId,
  type SkillLevels,
} from '../game/skills'
import type { PlayerXpState } from '../game/playerProgress'

interface SkillTreeProps {
  playerXp: PlayerXpState
  skillLevels: SkillLevels
  onUpgrade: (skillId: SkillId) => void
  onRespec: () => void
  onExit: () => void
}

export default function SkillTree({ playerXp, skillLevels, onUpgrade, onRespec, onExit }: SkillTreeProps) {
  const points = availableSkillPoints(playerXp.level, skillLevels)
  const spent = totalSkillPointsSpent(skillLevels)

  const handleRespecClick = () => {
    const confirmed = window.confirm(
      'Respec all skill points? Every point you\'ve spent is refunded for free so you can try a different build.',
    )
    if (confirmed) onRespec()
  }

  return (
    <div className="screen">
      <div className="level-header">
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          <Wiggle>{'← Overworld'}</Wiggle>
        </button>
        <h1 className="title">
          <Wiggle>Skill Tree</Wiggle>
        </h1>
      </div>

      <XpBar xpState={playerXp} />

      <p className="message">
        {points} skill point{points === 1 ? '' : 's'} available — earn more by leveling up.
      </p>

      <button
        type="button"
        className="btn btn--ghost"
        disabled={spent === 0}
        onClick={handleRespecClick}
      >
        <Wiggle>{`Respec (${spent} point${spent === 1 ? '' : 's'})`}</Wiggle>
      </button>

      <div className="skill-list">
        {SKILLS.map((skill) => {
          const level = skillLevels[skill.id]
          const maxed = level >= skill.maxLevel
          const canUpgrade = canUpgradeSkill(skill.id, playerXp.level, skillLevels)
          const locked = isSkillLocked(skill.id, playerXp.level, skillLevels)

          return (
            <div key={skill.id} className={locked ? 'skill-card skill-card--locked' : 'skill-card'}>
              <div className="skill-card-info">
                <h2>
                  <Wiggle>{skill.name}</Wiggle>
                </h2>
                <p>{skill.description}</p>
                <p className="skill-card-level">
                  Level {level} / {skill.maxLevel}
                </p>
              </div>
              {locked ? (
                <div className="skill-card-lock">
                  <LockIcon className="skill-card-lock-icon" />
                  <span>Unlocked at Player Level {skill.lock?.requiresPlayerLevel}</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn skill-card-btn"
                  disabled={!canUpgrade}
                  onClick={() => onUpgrade(skill.id)}
                >
                  <Wiggle>{maxed ? 'Max' : '+1'}</Wiggle>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
