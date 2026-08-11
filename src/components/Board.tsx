import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { collapseAndRefill, createInitialGrid, findMatches, swap } from '../game/board'
import { GRID_SIZE, type IconType } from '../game/types'

const SWAP_BACK_DELAY_MS = 350
const MATCH_HIGHLIGHT_MS = 500
const CASCADE_PAUSE_MS = 200

const DEFAULT_MESSAGE = 'Drag an icon onto another to swap it.'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function Board() {
  const [grid, setGrid] = useState<IconType[]>(() => createInitialGrid())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [invalidPair, setInvalidPair] = useState<[number, number] | null>(null)
  const [matchedCells, setMatchedCells] = useState<number[]>([])
  const [message, setMessage] = useState(DEFAULT_MESSAGE)

  // The grid the game logic reads. Kept in a ref alongside the state so
  // event handlers and the async cascade loop always see the live value
  // without stale-closure hazards.
  const gridRef = useRef(grid)

  // Drag state lives in refs so pointerup can act on it directly — calling
  // game logic from inside setState updaters is unsafe (React can invoke
  // updaters more than once, which double-fired swaps and corrupted the
  // board).
  const dragIndexRef = useRef<number | null>(null)
  const hoverIndexRef = useRef<number | null>(null)

  const busyRef = useRef(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const applyGrid = useCallback((next: IconType[]) => {
    gridRef.current = next
    setGrid(next)
  }, [])

  // Resolves a client-space point directly to a grid cell via math against
  // the board's bounding rect, instead of DOM hit-testing. elementFromPoint
  // would miss drops landing in the gap between cells (dead board
  // background between grid cells) and silently fail to register a swap.
  // Dividing the whole board rect into thirds means every pixel maps to a
  // cell — no dead zones.
  const cellFromPoint = useCallback((clientX: number, clientY: number): number | null => {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return null

    const localX = clientX - rect.left
    const localY = clientY - rect.top
    if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) return null

    const col = Math.min(GRID_SIZE - 1, Math.floor((localX / rect.width) * GRID_SIZE))
    const row = Math.min(GRID_SIZE - 1, Math.floor((localY / rect.height) * GRID_SIZE))
    return row * GRID_SIZE + col
  }, [])

  const attemptSwap = useCallback(
    async (a: number, b: number) => {
      if (busyRef.current) return
      busyRef.current = true

      let current = swap(gridRef.current, a, b)
      applyGrid(current)

      let matches = findMatches(current)

      if (matches.size === 0) {
        // Invalid move: shake, then swap back.
        setInvalidPair([a, b])
        setMessage('No match — swapping back.')
        await sleep(SWAP_BACK_DELAY_MS)
        applyGrid(swap(gridRef.current, a, b))
        setInvalidPair(null)
        setMessage(DEFAULT_MESSAGE)
        busyRef.current = false
        return
      }

      // Resolve the match, then keep resolving any cascades the falling
      // icons create. Each loop iteration is one combo in the chain.
      let combo = 0
      while (matches.size > 0) {
        combo += 1
        setMatchedCells(Array.from(matches))
        setMessage(combo === 1 ? 'Match!' : `Combo x${combo}!`)
        await sleep(MATCH_HIGHLIGHT_MS)

        current = collapseAndRefill(current, matches)
        applyGrid(current)
        setMatchedCells([])
        await sleep(CASCADE_PAUSE_MS)

        matches = findMatches(current)
      }

      setMessage(combo > 1 ? `Chain of ${combo}! ${DEFAULT_MESSAGE}` : DEFAULT_MESSAGE)
      busyRef.current = false
    },
    [applyGrid],
  )

  const handlePointerDown = useCallback(
    (index: number) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (busyRef.current) return
      event.preventDefault()
      dragIndexRef.current = index
      hoverIndexRef.current = index
      setDragIndex(index)
      setHoverIndex(index)
      setDragPos({ x: event.clientX, y: event.clientY })
    },
    [],
  )

  useEffect(() => {
    if (dragIndex === null) return

    const handleMove = (event: PointerEvent) => {
      setDragPos({ x: event.clientX, y: event.clientY })
      const cell = cellFromPoint(event.clientX, event.clientY)
      hoverIndexRef.current = cell
      setHoverIndex(cell)
    }

    const handleUp = () => {
      const a = dragIndexRef.current
      const b = hoverIndexRef.current

      dragIndexRef.current = null
      hoverIndexRef.current = null
      setDragIndex(null)
      setHoverIndex(null)
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
  }, [dragIndex, attemptSwap, cellFromPoint])

  const draggedIcon = dragIndex !== null ? grid[dragIndex] : null

  return (
    <div className="game">
      <h1 className="title">Match 3</h1>
      <p className="message">{message}</p>
      <div className="board" ref={boardRef} role="grid" aria-label="Match 3 board">
        {grid.map((icon, index) => {
          const isDragging = dragIndex === index
          const isHoverTarget =
            dragIndex !== null && hoverIndex === index && hoverIndex !== dragIndex
          const isInvalid = invalidPair?.includes(index) ?? false
          const isMatched = matchedCells.includes(index)

          return (
            <div
              key={index}
              data-cell-index={index}
              className={[
                'cell',
                isDragging ? 'cell--dragging' : '',
                isHoverTarget ? 'cell--hover' : '',
                isInvalid ? 'cell--invalid' : '',
                isMatched ? 'cell--matched' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onPointerDown={handlePointerDown(index)}
            >
              <Icon type={icon} />
            </div>
          )
        })}
      </div>

      {draggedIcon && dragPos && (
        <div
          className="dragged-icon"
          style={{ left: dragPos.x, top: dragPos.y }}
          aria-hidden="true"
        >
          <Icon type={draggedIcon} />
        </div>
      )}
    </div>
  )
}
