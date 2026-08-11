import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Icon from './Icon'
import { collapseAndRefill, createInitialTiles, findMatches, swapTiles, tileIdAt } from '../game/board'
import { GRID_SIZE, type Tile } from '../game/types'

const SWAP_BACK_DELAY_MS = 350
const MATCH_HIGHLIGHT_MS = 500
const FALL_DELAY_MS = 350

const DEFAULT_MESSAGE = 'Drag an icon onto another to swap it.'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

export default function Board() {
  const [tiles, setTiles] = useState<Tile[]>(() => createInitialTiles())
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

  const busyRef = useRef(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const applyTiles = useCallback((next: Tile[]) => {
    tilesRef.current = next
    setTiles(next)
  }, [])

  useLayoutEffect(() => {
    const el = boardRef.current
    if (!el) return

    const update = () => setCellSize(el.getBoundingClientRect().width / GRID_SIZE)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const cellFromPoint = useCallback(
    (clientX: number, clientY: number): { row: number; col: number } | null => {
      const rect = boardRef.current?.getBoundingClientRect()
      if (!rect) return null

      const localX = clientX - rect.left
      const localY = clientY - rect.top
      if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) return null

      const col = Math.min(GRID_SIZE - 1, Math.floor((localX / rect.width) * GRID_SIZE))
      const row = Math.min(GRID_SIZE - 1, Math.floor((localY / rect.height) * GRID_SIZE))
      return { row, col }
    },
    [],
  )

  const attemptSwap = useCallback(
    async (a: number, b: number) => {
      if (busyRef.current) return
      busyRef.current = true

      applyTiles(swapTiles(tilesRef.current, a, b))

      let matches = findMatches(tilesRef.current)

      if (matches.size === 0) {
        setInvalidPair([a, b])
        setMessage('No match — swapping back.')
        await sleep(SWAP_BACK_DELAY_MS)
        applyTiles(swapTiles(tilesRef.current, a, b))
        setInvalidPair(null)
        setMessage(DEFAULT_MESSAGE)
        busyRef.current = false
        return
      }

      let combo = 0
      while (matches.size > 0) {
        combo += 1
        setMatchedIds(matches)
        setMessage(combo === 1 ? 'Match!' : `Combo x${combo}!`)
        await sleep(MATCH_HIGHLIGHT_MS)

        const { spawned, settled } = collapseAndRefill(tilesRef.current, matches)
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

        matches = findMatches(tilesRef.current)
      }

      setMessage(combo > 1 ? `Chain of ${combo}! ${DEFAULT_MESSAGE}` : DEFAULT_MESSAGE)
      busyRef.current = false
    },
    [applyTiles],
  )

  const handlePointerDown = useCallback(
    (tileId: number) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (busyRef.current) return
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
      <h1 className="title">Match 3</h1>
      <p className="message">{message}</p>
      <div
        className="board"
        ref={boardRef}
        role="grid"
        aria-label="Match 3 board"
        style={{ '--cell-size': `${cellSize}px` } as React.CSSProperties}
      >
        {cellSize > 0 &&
          tiles.map((tile) => {
            const isDragging = dragTileId === tile.id
            const isHoverTarget =
              dragTileId !== null && hoverTileId === tile.id && hoverTileId !== dragTileId
            const isInvalid = invalidPair?.includes(tile.id) ?? false
            const isMatched = matchedIds.has(tile.id)

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
          style={{ left: dragPos.x, top: dragPos.y }}
          aria-hidden="true"
        >
          <Icon type={draggedTile.type} />
        </div>
      )}
    </div>
  )
}
