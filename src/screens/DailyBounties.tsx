import Wiggle from '../components/Wiggle'
import { BOUNTIES, BOUNTY_SLOT_CAPACITY, DAILY_BOUNTY_LIMIT, type BountyId, type BountyState } from '../game/bounties'

interface DailyBountiesProps {
  bountyState: BountyState
  onToggle: (bountyId: BountyId) => void
  onExit: () => void
}

export default function DailyBounties({ bountyState, onToggle, onExit }: DailyBountiesProps) {
  const dailyLimitReached = bountyState.completed.length >= DAILY_BOUNTY_LIMIT
  const atCapacity = bountyState.selected.length >= BOUNTY_SLOT_CAPACITY

  return (
    <div className="screen">
      <div className="level-header">
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          <Wiggle>{'← Overworld'}</Wiggle>
        </button>
        <h1 className="title">
          <Wiggle>Daily Bounties</Wiggle>
        </h1>
      </div>

      <p className="message">
        {dailyLimitReached
          ? `Daily bounty limit reached (${bountyState.completed.length} / ${DAILY_BOUNTY_LIMIT}) — more open up at midnight.`
          : `1 bounty active at a time, up to ${DAILY_BOUNTY_LIMIT} per day (${bountyState.completed.length} / ${DAILY_BOUNTY_LIMIT} completed today). Complete it by clearing a level's goal while doing it.`}
      </p>

      <div className="skill-list">
        {BOUNTIES.map((bounty) => {
          const selected = bountyState.selected.includes(bounty.id)
          const completed = bountyState.completed.includes(bounty.id)

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
                <h2>
                  <Wiggle>{bounty.name}</Wiggle>
                </h2>
                <p>{bounty.description}</p>
                <p className="skill-card-level">+{bounty.xpReward} XP</p>
              </div>
              <button
                type="button"
                className={buttonClass}
                disabled={completed || (!selected && (atCapacity || dailyLimitReached))}
                onClick={() => onToggle(bounty.id)}
              >
                <Wiggle>{buttonLabel}</Wiggle>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
