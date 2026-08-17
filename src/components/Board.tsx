import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Icon from './Icon'
import {
  arrowRowClearIds,
  collapseAndRefill,
  crackAdjacentGlassHazards,
  createInitialTiles,
  detectMatchShapes,
  findMatches,
  getBottomHazardIds,
  scoreForArrowWipe,
  scoreForMatch,
  swapTiles,
  tileIdAt,
} from '../game/board'
import type { BoardSize, Tile, TileType } from '../game/types'
import type { BountyId } from '../game/bounties'

const SWAP_BACK_DELAY_MS = 350
const MATCH_HIGHLIGHT_MS = 500
const FALL_DELAY_MS = 350
const HAZARD_EJECT_MS = 900
const HAZARD_EJECT_GUARD = 30

const MAX_CELL_PX = 100
const MIN_CELL_PX = 28

const DEFAULT_MESSAGE = 'Drag an icon onto another to swap it.'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

export type BountyFlags = Record<BountyId, boolean>

const NO_BOUNTY_PROGRESS: BountyFlags = {
  tShape: false,
  lShape: false,
  doubleChain: false,
  fourInRow: false,
  chain5: false,
  chain10: false,
}

export interface BoardResult {
  score: number
  passed: boolean
  bountyFlags: BountyFlags
}

interface BoardProps extends BoardSize {
  moveLimit: number
  goalScore: number
  hazardRate?: number
  hazardVariant?: 'hazard' | 'glassHazard'
  arrowRate?: number
  scoreMultiplier?: number
  onScoreChange?: (score: number) => void
  onMovesChange?: (movesLeft: number) => void
  onBountyProgress?: (flags: BountyFlags) => void
  onFinish: (result: BoardResult) => void
}

export default function Board({
  rows,
  cols,
  moveLimit,
  goalScore,
  hazardRate = 0,
  hazardVariant = 'hazard',
  arrowRate = 0,
  scoreMultiplier = 1,
  onScoreChange,
  onMovesChange,
  onBountyProgress,
  onFinish,
}: BoardProps) {
  const [tiles, setTiles] = useState<Tile[]>(() => createInitialTiles({ rows, cols }))
  const [cellSize, setCellSize] = useState(0)
  const [dragTileId, setDragTileId] = useState<number | null>(null)
  const [hoverTileId, setHoverTileId] = useState<number | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [invalidPair, setInvalidPair] = useState<[number, number] | null>(null)
  const [matchedIds, setMatchedIds] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  // Hazards that just touched the bottom row, flying out as a one-off
  // visual clone — rendered outside the clipped .board box (like
  // dragged-icon) so the bounce-and-fall-off is actually visible past the
  // board's edge instead of getting clipped by its overflow:hidden.
  const [ejectingHazards, setEjectingHazards] = useState<
    { key: number; x: number; y: number; type: TileType }[]
  >([])
  const ejectKeyRef = useRef(0)

  // Game logic reads/writes this ref so it always sees the live board,
  // independent of React's render/commit timing.
  const tilesRef = useRef(tiles)

  const dragTileIdRef = useRef<number | null>(null)
  const hoverTileIdRef = useRef<number | null>(null)

  const scoreRef = useRef(0)
  const movesLeftRef = useRef(moveLimit)
  const finishedRef = useRef(false)
  // Accumulated across the whole round (every swap and cascade), not reset
  // per-swap, since a bounty just needs to happen at some point in the
  // level, not on the specific move that ends it.
  const bountyFlagsRef = useRef<BountyFlags>({ ...NO_BOUNTY_PROGRESS })

  const busyRef = useRef(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const applyTiles = useCallback((next: Tile[]) => {
    tilesRef.current = next
    setTiles(next)
  }, [])

  // The board's pixel size is derived (not measured): bigger boards need
  // smaller cells to fit the same footprint, so cell size is computed from
  // the viewport and row/col count rather than from the board's own
  // rendered size.
  useLayoutEffect(() => {
    const compute = () => {
      const availableWidth = Math.min(window.innerWidth * 0.92, 480)
      const availableHeight = Math.min(window.innerHeight * 0.55, 480)
      const size = Math.min(MAX_CELL_PX, availableWidth / cols, availableHeight / rows)
      setCellSize(Math.max(MIN_CELL_PX, size))
    }

    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [rows, cols])

  // Spawns a fixed-position visual clone for each hazard tile that just
  // touched the bottom row, at its actual on-screen position, then removes
  // itself once the bounce-and-fall-off animation has had time to finish.
  const spawnHazardEjects = useCallback(
    (bottomTiles: Tile[]) => {
      const rect = boardRef.current?.getBoundingClientRect()
      if (!rect || cellSize <= 0) return

      const newEjects = bottomTiles.map((tile) => ({
        key: ejectKeyRef.current++,
        x: rect.left + tile.col * cellSize,
        y: rect.top + tile.row * cellSize,
        type: tile.type,
      }))

      setEjectingHazards((current) => [...current, ...newEjects])
      window.setTimeout(() => {
        const keys = new Set(newEjects.map((e) => e.key))
        setEjectingHazards((current) => current.filter((e) => !keys.has(e.key)))
      }, HAZARD_EJECT_MS)
    },
    [cellSize],
  )

  const cellFromPoint = useCallback(
    (clientX: number, clientY: number): { row: number; col: number } | null => {
      const rect = boardRef.current?.getBoundingClientRect()
      if (!rect) return null

      const localX = clientX - rect.left
      const localY = clientY - rect.top
      if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) return null

      const col = Math.min(cols - 1, Math.floor((localX / rect.width) * cols))
      const row = Math.min(rows - 1, Math.floor((localY / rect.height) * rows))
      return { row, col }
    },
    [rows, cols],
  )

  // Runs one collapse-and-refill pass and animates it in (spawn above the
  // board, then settle into place). Shared by both the normal
  // match-clearing drop and the follow-up drop after a hazard ejects.
  const dropAndSettle = useCallback(
    async (clearedIds: Set<number>) => {
      const { spawned, settled } = collapseAndRefill(
        tilesRef.current,
        clearedIds,
        { rows, cols },
        hazardRate,
        arrowRate,
        hazardVariant,
      )
      // flushSync forces each state update to commit as its own paint —
      // without it React may coalesce the spawn and settle updates into a
      // single commit, and the browser never paints the spawn position, so
      // the CSS transition has nothing to animate from and the fall just
      // snaps straight to its resting place.
      flushSync(() => applyTiles(spawned))
      await nextFrame()
      flushSync(() => applyTiles(settled))
      await sleep(FALL_DELAY_MS)
    },
    [applyTiles, hazardRate, arrowRate, hazardVariant, rows, cols],
  )

  // After tiles settle, any hazard now sitting in the bottom row bounces
  // out (a visual-only clone flies off screen) and the real board data
  // clears it immediately so the column can drop again — which can itself
  // deliver a fresh hazard straight to the bottom, so this keeps going
  // until none remain. Bounded since each pass clears at least one hazard
  // from a finite board.
  const resolveHazardEjections = useCallback(async () => {
    for (let guard = 0; guard < HAZARD_EJECT_GUARD; guard++) {
      const bottomIds = getBottomHazardIds(tilesRef.current, { rows, cols })
      if (bottomIds.length === 0) return

      const bottomTiles = tilesRef.current.filter((t) => bottomIds.includes(t.id))
      spawnHazardEjects(bottomTiles)

      await dropAndSettle(new Set(bottomIds))
    }
  }, [rows, cols, spawnHazardEjects, dropAndSettle])

  const attemptSwap = useCallback(
    async (a: number, b: number) => {
      if (busyRef.current || finishedRef.current) return
      busyRef.current = true

      applyTiles(swapTiles(tilesRef.current, a, b))

      let matches = findMatches(tilesRef.current, { rows, cols })

      if (matches.ids.size === 0) {
        setInvalidPair([a, b])
        setMessage('No match — swapping back.')
        await sleep(SWAP_BACK_DELAY_MS)
        applyTiles(swapTiles(tilesRef.current, a, b))
        setInvalidPair(null)
        setMessage(DEFAULT_MESSAGE)
        busyRef.current = false
        return
      }

      // A swap that produces a match uses up one of the player's turns.
      movesLeftRef.current -= 1
      onMovesChange?.(movesLeftRef.current)

      let combo = 0
      while (matches.ids.size > 0) {
        const arrowExtraIds = arrowRowClearIds(tilesRef.current, matches, { rows, cols })

        // Cracking happens before we settle on this step's cleared-id set:
        // any glass hazard adjacent to this match takes a hit, and a third
        // hit adds it straight into what gets cleared (worth nothing).
        const { updatedTiles, destroyedIds: crackedGlassIds } = crackAdjacentGlassHazards(tilesRef.current, matches)
        applyTiles(updatedTiles)

        const clearedIds =
          arrowExtraIds.size > 0 || crackedGlassIds.size > 0
            ? new Set([...matches.ids, ...arrowExtraIds, ...crackedGlassIds])
            : matches.ids

        const { points: matchPoints, comboAfter } = scoreForMatch(matches.runs, combo)
        combo = comboAfter

        setMatchedIds(clearedIds)
        setMessage(combo === 1 ? 'Match!' : `Combo x${combo}!`)

        const shapes = detectMatchShapes(matches.runs)
        bountyFlagsRef.current.tShape ||= shapes.tShape
        bountyFlagsRef.current.lShape ||= shapes.lShape
        bountyFlagsRef.current.doubleChain ||= combo >= 2
        bountyFlagsRef.current.chain5 ||= combo >= 5
        bountyFlagsRef.current.chain10 ||= combo >= 10
        bountyFlagsRef.current.fourInRow ||= matches.runs.some((run) => run.cells.length >= 4)
        onBountyProgress?.({ ...bountyFlagsRef.current })

        const wipePoints = scoreForArrowWipe(tilesRef.current, arrowExtraIds, combo)
        scoreRef.current += Math.round((matchPoints + wipePoints) * scoreMultiplier)
        onScoreChange?.(scoreRef.current)

        await sleep(MATCH_HIGHLIGHT_MS)

        flushSync(() => setMatchedIds(new Set()))
        await dropAndSettle(clearedIds)
        await resolveHazardEjections()

        matches = findMatches(tilesRef.current, { rows, cols })
      }

      const reachedGoal = scoreRef.current >= goalScore
      const outOfMoves = movesLeftRef.current <= 0

      // The round always plays out the full move limit — reaching the goal
      // early doesn't end it, since every extra match past the goal still
      // adds to the score (and the XP the player earns from it).
      if (outOfMoves) {
        finishedRef.current = true
        setMessage(reachedGoal ? 'Goal reached!' : 'Out of moves.')
        onFinish({ score: scoreRef.current, passed: reachedGoal, bountyFlags: bountyFlagsRef.current })
      } else {
        const comboText = combo > 1 ? `Chain of ${combo}! ` : ''
        const goalText = reachedGoal ? 'Goal reached! Keep going for bonus score! ' : ''
        setMessage(`${comboText}${goalText}${DEFAULT_MESSAGE}`)
      }

      busyRef.current = false
    },
    [
      applyTiles,
      dropAndSettle,
      resolveHazardEjections,
      goalScore,
      scoreMultiplier,
      onBountyProgress,
      onFinish,
      onMovesChange,
      onScoreChange,
      rows,
      cols,
    ],
  )

  const handlePointerDown = useCallback(
    (tileId: number) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (busyRef.current || finishedRef.current) return
      event.preventDefault()
      dragTileIdRef.current = tileId
      hoverTileIdRef.current = tileId
      setDragTileId(tileId)
      setHoverTileId(tileId)
      setDragPos({ x: event.clientX, y: event.clientY })
    },
    [],
  )

  useEffect(() => {
    if (dragTileId === null) return

    const handleMove = (event: PointerEvent) => {
      setDragPos({ x: event.clientX, y: event.clientY })
      const cell = cellFromPoint(event.clientX, event.clientY)
      const id = cell ? tileIdAt(tilesRef.current, cell.row, cell.col) : null
      hoverTileIdRef.current = id
      setHoverTileId(id)
    }

    const handleUp = () => {
      const a = dragTileIdRef.current
      const b = hoverTileIdRef.current

      dragTileIdRef.current = null
      hoverTileIdRef.current = null
      setDragTileId(null)
      setHoverTileId(null)
      setDragPos(null)

      if (a !== null && b !== null && a !== b) {
        void attemptSwap(a, b)
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [dragTileId, attemptSwap, cellFromPoint])

  const draggedTile = dragTileId !== null ? tiles.find((t) => t.id === dragTileId) : undefined

  return (
    <div className="game">
      <p className="message">{message}</p>
      <div
        className="board"
        ref={boardRef}
        role="grid"
        aria-label="Match 3 board"
        style={
          {
            '--cell-size': `${cellSize}px`,
            width: cellSize * cols,
            height: cellSize * rows,
          } as React.CSSProperties
        }
      >
        {cellSize > 0 &&
          tiles.map((tile) => {
            const isDragging = dragTileId === tile.id
            const isHoverTarget =
              dragTileId !== null && hoverTileId === tile.id && hoverTileId !== dragTileId
            const isInvalid = invalidPair?.includes(tile.id) ?? false
            const isMatched = matchedIds.has(tile.id)
            const isHazard = tile.type === 'hazard'
            const isGlassHazard = tile.type === 'glassHazard'
            const isArrow = tile.type === 'arrow'

            return (
              <div
                key={tile.id}
                data-tile-id={tile.id}
                className="tile"
                style={{
                  transform: `translate(${tile.col * cellSize}px, ${tile.row * cellSize}px)`,
                }}
                onPointerDown={handlePointerDown(tile.id)}
              >
                <div
                  className={[
                    'tile-box',
                    isDragging ? 'tile-box--dragging' : '',
                    isHoverTarget ? 'tile-box--hover' : '',
                    isInvalid ? 'tile-box--invalid' : '',
                    isMatched ? 'tile-box--matched' : '',
                    isHazard ? 'tile-box--hazard' : '',
                    isGlassHazard ? 'tile-box--glass-hazard' : '',
                    isArrow ? 'tile-box--arrow' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <Icon type={tile.type} seed={tile.id} />
                  {isGlassHazard && (tile.cracks ?? 0) > 0 && (
                    <svg className={`glass-crack glass-crack--${tile.cracks}`} viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 3 L10.5 9 L14 10.5 L11 21" />
                      {(tile.cracks ?? 0) >= 2 && <path d="M4 7 L10.5 9 M14 10.5 L20 14" />}
                    </svg>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      {draggedTile && dragPos && (
        <div
          className="dragged-icon"
          style={{ left: dragPos.x, top: dragPos.y, width: cellSize, height: cellSize }}
          aria-hidden="true"
        >
          <Icon type={draggedTile.type} />
        </div>
      )}

      {ejectingHazards.map((eject) => (
        <div
          key={eject.key}
          className="hazard-eject"
          style={{ left: eject.x, top: eject.y, width: cellSize, height: cellSize }}
          aria-hidden="true"
        >
          <Icon type={eject.type} />
        </div>
      ))}
    </div>
  )
}
