import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Icon from './Icon'
import {
  collapseAndRefill,
  createInitialTiles,
  detectMatchShapes,
  findMatches,
  scoreForMatch,
  swapTiles,
  tileIdAt,
} from '../game/board'
import type { BoardSize, Tile } from '../game/types'

const SWAP_BACK_DELAY_MS = 350
const MATCH_HIGHLIGHT_MS = 500
const FALL_DELAY_MS = 350

const MAX_CELL_PX = 100
const MIN_CELL_PX = 28

const DEFAULT_MESSAGE = 'Drag an icon onto another to swap it.'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

export interface BountyFlags {
  tShape: boolean
  lShape: boolean
  doubleChain: boolean
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
  onScoreChange?: (score: number) => void
  onMovesChange?: (movesLeft: number) => void
  onFinish: (result: BoardResult) => void
}

export default function Board({
  rows,
  cols,
  moveLimit,
  goalScore,
  hazardRate = 0,
  onScoreChange,
  onMovesChange,
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
  const bountyFlagsRef = useRef<BountyFlags>({ tShape: false, lShape: false, doubleChain: false })

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
        combo += 1
        setMatchedIds(matches.ids)
        setMessage(combo === 1 ? 'Match!' : `Combo x${combo}!`)

        const shapes = detectMatchShapes(matches.runs)
        bountyFlagsRef.current.tShape ||= shapes.tShape
        bountyFlagsRef.current.lShape ||= shapes.lShape
        bountyFlagsRef.current.doubleChain ||= combo >= 2

        scoreRef.current += scoreForMatch(matches.runs, combo)
        onScoreChange?.(scoreRef.current)

        await sleep(MATCH_HIGHLIGHT_MS)

        const { spawned, settled } = collapseAndRefill(
          tilesRef.current,
          matches.ids,
          { rows, cols },
          hazardRate,
        )
        // flushSync forces each state update to commit as its own paint —
        // without it React may coalesce the spawn and settle updates into a
        // single commit, and the browser never paints the spawn position,
        // so the CSS transition has nothing to animate from and the fall
        // just snaps straight to its resting place.
        flushSync(() => {
          setMatchedIds(new Set())
          applyTiles(spawned)
        })
        await nextFrame()
        flushSync(() => applyTiles(settled))
        await sleep(FALL_DELAY_MS)

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
    [applyTiles, goalScore, hazardRate, onFinish, onMovesChange, onScoreChange, rows, cols],
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
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <Icon type={tile.type} />
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
    </div>
  )
}
