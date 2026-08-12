export type BountyId = 'tShape' | 'lShape' | 'doubleChain'

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
    xpReward: 200,
  },
  {
    id: 'lShape',
    name: 'L-Shape Match',
    description: 'Make an L-shaped match in a level you clear.',
    xpReward: 200,
  },
  {
    id: 'doubleChain',
    name: 'Double Chain',
    description: 'Trigger a cascade of at least 2 chained matches in a level you clear.',
    xpReward: 200,
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

export interface BountyState {
  date: string
  // Bounties the player has chosen to pursue today (bounded by capacity).
  selected: BountyId[]
  // Selected bounties already completed (and rewarded) today.
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

export function toggleBounty(state: BountyState, bountyId: BountyId, capacity: number): BountyState {
  const isSelected = state.selected.includes(bountyId)
  const isCompleted = state.completed.includes(bountyId)

  // A completed bounty is locked in for the day — no backing out of it.
  if (isCompleted) return state

  let selected: BountyId[]
  if (isSelected) {
    selected = state.selected.filter((id) => id !== bountyId)
  } else {
    if (state.selected.length >= capacity) return state
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
  achieved: { tShape: boolean; lShape: boolean; doubleChain: boolean },
): { state: BountyState; newlyCompleted: BountyId[] } {
  const newlyCompleted = state.selected.filter(
    (id) => !state.completed.includes(id) && achieved[id],
  )

  if (newlyCompleted.length === 0) return { state, newlyCompleted }

  const next: BountyState = { ...state, completed: [...state.completed, ...newlyCompleted] }
  saveBountyState(next)
  return { state: next, newlyCompleted }
}
