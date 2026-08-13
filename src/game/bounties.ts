export type BountyId =
  | 'tShape'
  | 'lShape'
  | 'doubleChain'
  | 'fourInRow'
  | 'chain5'
  | 'chain10'

export interface BountyDef {
  id: BountyId
  name: string
  description: string
  xpReward: number
}

export const BOUNTIES: BountyDef[] = [
  {
    id: 'tShape',
    name: 'T-Shape Match',
    description: 'Make a T-shaped match in a level you clear.',
    xpReward: 400,
  },
  {
    id: 'lShape',
    name: 'L-Shape Match',
    description: 'Make an L-shaped match in a level you clear.',
    xpReward: 400,
  },
  {
    id: 'doubleChain',
    name: 'Double Chain',
    description: 'Trigger a cascade of at least 2 chained matches in a level you clear.',
    xpReward: 400,
  },
  {
    id: 'fourInRow',
    name: '4 in a Row',
    description: 'Match 4 or more of the same icon in a row or column, in a level you clear.',
    xpReward: 500,
  },
  {
    id: 'chain5',
    name: '5x Chain',
    description: 'Trigger a cascade of at least 5 chained matches in a level you clear.',
    xpReward: 750,
  },
  {
    id: 'chain10',
    name: '10x Chain',
    description: 'Trigger a cascade of at least 10 chained matches in a level you clear.',
    xpReward: 1600,
  },
]

export function getBounty(id: BountyId): BountyDef | undefined {
  return BOUNTIES.find((bounty) => bounty.id === id)
}

// Local calendar date (not UTC) so bounties reset at the player's actual
// midnight rather than an arbitrary UTC boundary.
export function todayKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// The player can only ever have one bounty active at a time, but can burn
// through up to DAILY_BOUNTY_LIMIT of them across a single day — complete
// one (or drop it unfinished) to free the slot back up for another pick.
export const BOUNTY_SLOT_CAPACITY = 1
export const DAILY_BOUNTY_LIMIT = 3

export interface BountyState {
  date: string
  // The bounty the player has chosen to pursue right now (at most
  // BOUNTY_SLOT_CAPACITY entries).
  selected: BountyId[]
  // Selected bounties already completed (and rewarded) today — capped at
  // DAILY_BOUNTY_LIMIT for the day.
  completed: BountyId[]
}

const STORAGE_KEY = 'match3rpg.bounties.v1'

function freshState(): BountyState {
  return { date: todayKey(), selected: [], completed: [] }
}

function isValidBountyId(value: unknown): value is BountyId {
  return typeof value === 'string' && BOUNTIES.some((bounty) => bounty.id === value)
}

function isValidState(value: unknown): value is BountyState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.date === 'string' &&
    Array.isArray(candidate.selected) &&
    candidate.selected.every(isValidBountyId) &&
    Array.isArray(candidate.completed) &&
    candidate.completed.every(isValidBountyId)
  )
}

function saveBountyState(state: BountyState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable — today's bounty picks just won't persist.
  }
}

export function resetBountyState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

// Loading on a new calendar day silently resets selection/completion — that
// IS the daily reset, no cron or background job needed.
export function loadBountyState(): BountyState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    const parsed: unknown = JSON.parse(raw)
    if (!isValidState(parsed) || parsed.date !== todayKey()) return freshState()
    return parsed
  } catch {
    return freshState()
  }
}

export function toggleBounty(state: BountyState, bountyId: BountyId): BountyState {
  const isSelected = state.selected.includes(bountyId)
  const isCompleted = state.completed.includes(bountyId)

  // A completed bounty is locked in for the day — no backing out of it.
  if (isCompleted) return state

  let selected: BountyId[]
  if (isSelected) {
    selected = state.selected.filter((id) => id !== bountyId)
  } else {
    if (state.selected.length >= BOUNTY_SLOT_CAPACITY) return state
    // Every bounty for the day has already been earned — no new pick until
    // tomorrow's reset.
    if (state.completed.length >= DAILY_BOUNTY_LIMIT) return state
    selected = [...state.selected, bountyId]
  }

  const next: BountyState = { ...state, selected }
  saveBountyState(next)
  return next
}

// Marks any selected-but-not-yet-completed bounties satisfied by this
// level clear as completed. Returns the new state plus the list of bounty
// ids newly completed (so the caller knows how much XP to award).
export function completeBounties(
  state: BountyState,
  achieved: Record<BountyId, boolean>,
): { state: BountyState; newlyCompleted: BountyId[] } {
  const newlyCompleted = state.selected.filter(
    (id) => !state.completed.includes(id) && achieved[id],
  )

  if (newlyCompleted.length === 0) return { state, newlyCompleted }

  const next: BountyState = { ...state, completed: [...state.completed, ...newlyCompleted] }
  saveBountyState(next)
  return { state: next, newlyCompleted }
}
