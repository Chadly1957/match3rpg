import { BOUNTIES, type BountyId, type BountyState } from '../game/bounties'

interface DailyBountiesProps {
  bountyState: BountyState
  capacity: number
  onToggle: (bountyId: BountyId) => void
  onExit: () => void
}

export default function DailyBounties({ bountyState, capacity, onToggle, onExit }: DailyBountiesProps) {
  return (
    <div className="screen">
      <div className="level-header">
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          ← Overworld
        </button>
        <h1 className="title">Daily Bounties</h1>
      </div>

      <p className="message">
        Pick up to {capacity} {capacity === 1 ? 'bounty' : 'bounties'} ({bountyState.selected.length}{' '}
        / {capacity} selected). Complete one by clearing a level's goal while doing it — resets at
        midnight.
      </p>

      <div className="skill-list">
        {BOUNTIES.map((bounty) => {
          const selected = bountyState.selected.includes(bounty.id)
          const completed = bountyState.completed.includes(bounty.id)
          const atCapacity = bountyState.selected.length >= capacity

          let buttonLabel = 'Select'
          let buttonClass = 'btn btn--ghost skill-card-btn'
          if (completed) {
            buttonLabel = 'Done'
            buttonClass = 'btn skill-card-btn skill-card-btn--done'
          } else if (selected) {
            buttonLabel = 'Selected'
            buttonClass = 'btn skill-card-btn'
          }

          return (
            <div key={bounty.id} className="skill-card">
              <div className="skill-card-info">
                <h2>{bounty.name}</h2>
                <p>{bounty.description}</p>
                <p className="skill-card-level">+{bounty.xpReward} XP</p>
              </div>
              <button
                type="button"
                className={buttonClass}
                disabled={completed || (!selected && atCapacity)}
                onClick={() => onToggle(bounty.id)}
              >
                {buttonLabel}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
