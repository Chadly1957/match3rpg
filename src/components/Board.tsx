import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { areAdjacent, createInitialGrid, hasMatchAt, swap } from '../game/board'
import { GRID_SIZE, type IconType } from '../game/types'

const SWAP_BACK_DELAY_MS = 350
const MATCH_HIGHLIGHT_MS = 600

function matchedLineIndexes(grid: IconType[], index: number): number[] {
  const row = Math.floor(index / GRID_SIZE)
  const col = index % GRID_SIZE
  const rowStart = row * GRID_SIZE
  const matched: number[] = []

  if (
    grid[rowStart] === grid[rowStart + 1] &&
    grid[rowStart + 1] === grid[rowStart + 2]
  ) {
    matched.push(rowStart, rowStart + 1, rowStart + 2)
  }

  if (
    grid[col] === grid[col + GRID_SIZE] &&
    grid[col + GRID_SIZE] === grid[col + GRID_SIZE * 2]
  ) {
    matched.push(col, col + GRID_SIZE, col + GRID_SIZE * 2)
  }

  return matched
}

export default function Board() {
  const [grid, setGrid] = useState<IconType[]>(() => createInitialGrid())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [invalidPair, setInvalidPair] = useState<[number, number] | null>(null)
  const [matchedCells, setMatchedCells] = useState<number[]>([])
  const [message, setMessage] = useState('Drag an icon onto a neighbor to swap it.')

  const busyRef = useRef(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const attemptSwap = useCallback(
    (a: number, b: number) => {
      const swapped = swap(grid, a, b)
      const matchAtA = hasMatchAt(swapped, a)
      const matchAtB = hasMatchAt(swapped, b)

      setGrid(swapped)
      busyRef.current = true

      if (matchAtA || matchAtB) {
        const matched = new Set<number>([
          ...matchedLineIndexes(swapped, a),
          ...matchedLineIndexes(swapped, b),
        ])

        setMatchedCells(Array.from(matched))
        setMessage('Match found!')
        window.setTimeout(() => {
          setMatchedCells([])
          setMessage('Drag an icon onto a neighbor to swap it.')
          busyRef.current = false
        }, MATCH_HIGHLIGHT_MS)
      } else {
        setInvalidPair([a, b])
        setMessage('No match — swapping back.')
        window.setTimeout(() => {
          setGrid((current) => swap(current, a, b))
          setInvalidPair(null)
          setMessage('Drag an icon onto a neighbor to swap it.')
          busyRef.current = false
        }, SWAP_BACK_DELAY_MS)
      }
    },
    [grid],
  )

  const handlePointerDown = useCallback(
    (index: number) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (busyRef.current) return
      event.preventDefault()
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

      const el = document.elementFromPoint(event.clientX, event.clientY)
      const cell = el?.closest<HTMLElement>('[data-cell-index]')
      setHoverIndex(cell ? Number(cell.dataset.cellIndex) : null)
    }

    const handleUp = () => {
      setDragIndex((currentDrag) => {
        setHoverIndex((currentHover) => {
          if (
            currentDrag !== null &&
            currentHover !== null &&
            currentHover !== currentDrag &&
            areAdjacent(currentDrag, currentHover)
          ) {
            attemptSwap(currentDrag, currentHover)
          }
          return null
        })
        return null
      })
      setDragPos(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [dragIndex, attemptSwap])

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
