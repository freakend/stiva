import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RatioId, PhotoCount, CellData, CellImage, Orientation } from '../lib/types'
import { getLayout } from '../lib/layouts'
import { RATIOS } from '../lib/ratios'

type Snapshot = {
  ratioId: RatioId
  count: PhotoCount
  gap: number
  bgColor: string
  orientation: Orientation
  cells: CellData[]
}

function makeCells(count: PhotoCount, prev?: CellData[], orientation: Orientation = 'landscape'): CellData[] {
  const rects = getLayout(count, orientation)
  return rects.map((rect, i) => {
    const id = `cell-${i}`
    const existing = prev?.find(c => c.id === id)
    return { id, rect, image: existing?.image }
  })
}

export function useCollageState() {
  const [ratioId, setRatioId] = useState<RatioId>('1:1')
  const [count, setCount] = useState<PhotoCount>(4)
  const [gap, setGap] = useState<number>(8)
  const [bgColor, setBgColor] = useState<string>('#F4F1EA')
  const [orientation, setOrientation] = useState<Orientation>('landscape')
  const [cells, setCells] = useState<CellData[]>(() => makeCells(4, undefined, 'landscape'))

  // history for undo/redo
  const historyRef = useRef<Snapshot[]>([])
  const pointerRef = useRef<number>(-1)
  const isRestoring = useRef(false)

  const ratio = useMemo(() => {
    return RATIOS.find(x => x.id === ratioId) ?? RATIOS[0]
  }, [ratioId])

  // keep orientation in sync with ratio (portrait ratios default to portrait layout)
  useEffect(() => {
    if (ratio.w === ratio.h) return
    const next: Orientation = ratio.h > ratio.w ? 'portrait' : 'landscape'
    setOrientation(prev => (prev === next ? prev : next))
  }, [ratio])

  const pushHistory = useCallback((snap: Snapshot) => {
    if (isRestoring.current) return
    const h = historyRef.current
    const ptr = pointerRef.current
    // truncate forward
    h.splice(ptr + 1)
    h.push(structuredClone(snap))
    // cap 40
    if (h.length > 40) h.shift()
    pointerRef.current = h.length - 1
  }, [])

  // initialize history
  useEffect(() => {
    if (historyRef.current.length === 0) {
      pushHistory({ ratioId, count, gap, bgColor, orientation, cells })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // when count changes, rebuild cells preserving images where possible
  const setCountWrapped = useCallback(
    (next: PhotoCount) => {
      setCells(prev => {
        const nextCells = makeCells(next, prev, orientation)
        return nextCells
      })
      setCount(next)
    },
    [orientation],
  )

  // rebuild cells when count or orientation changes, preserve images
  useEffect(() => {
    setCells(prev => {
      const rects = getLayout(count, orientation)
      if (
        prev.length === rects.length &&
        prev.every(
          (c, i) =>
            c.rect.x === rects[i].x && c.rect.y === rects[i].y && c.rect.w === rects[i].w && c.rect.h === rects[i].h,
        )
      )
        return prev
      return makeCells(count, prev, orientation)
    })
  }, [count, orientation])

  // autosave history on relevant changes (debounced lightly)
  useEffect(() => {
    const snap: Snapshot = { ratioId, count, gap, bgColor, orientation, cells }
    // avoid pushing duplicate
    const last = historyRef.current[pointerRef.current]
    if (
      last &&
      JSON.stringify(last.cells.map(c => c.image?.url)) === JSON.stringify(snap.cells.map(c => c.image?.url)) &&
      last.ratioId === snap.ratioId &&
      last.count === snap.count &&
      last.gap === snap.gap &&
      last.bgColor === snap.bgColor &&
      last.orientation === snap.orientation
    )
      return
    pushHistory(snap)
  }, [ratioId, count, gap, bgColor, orientation, cells, pushHistory])

  const canUndo = pointerRef.current > 0
  const canRedo = pointerRef.current < historyRef.current.length - 1

  const applySnapshot = useCallback((s: Snapshot) => {
    isRestoring.current = true
    setRatioId(s.ratioId)
    setCount(s.count)
    setGap(s.gap)
    setBgColor(s.bgColor)
    setOrientation(s.orientation)
    setCells(s.cells.map(c => ({ ...c, rect: { ...c.rect }, image: c.image ? { ...c.image } : undefined })))
    // release flag next tick
    setTimeout(() => {
      isRestoring.current = false
    }, 0)
  }, [])

  const undo = useCallback(() => {
    if (pointerRef.current <= 0) return
    pointerRef.current -= 1
    const s = historyRef.current[pointerRef.current]
    applySnapshot(s)
  }, [applySnapshot])

  const redo = useCallback(() => {
    if (pointerRef.current >= historyRef.current.length - 1) return
    pointerRef.current += 1
    const s = historyRef.current[pointerRef.current]
    applySnapshot(s)
  }, [applySnapshot])

  const setCellImage = useCallback((cellId: string, image: CellImage | undefined) => {
    setCells(prev =>
      prev.map(c =>
        c.id === cellId ? { ...c, image: image ? { offsetX: 0, offsetY: 0, zoom: 1, ...image } : undefined } : c,
      ),
    )
  }, [])

  const updateCellTransform = useCallback((cellId: string, offsetX: number, offsetY: number, zoom: number) => {
    const z = Math.max(1, Math.min(8, zoom))
    const ox = Math.max(-0.5, Math.min(0.5, offsetX))
    const oy = Math.max(-0.5, Math.min(0.5, offsetY))
    setCells(prev =>
      prev.map(c =>
        c.id === cellId && c.image ? { ...c, image: { ...c.image, offsetX: ox, offsetY: oy, zoom: z } } : c,
      ),
    )
  }, [])

  const fillCells = useCallback((images: CellImage[]) => {
    if (images.length === 0) return
    setCells(prev => {
      let i = 0
      return prev.map(c => {
        if (c.image || i >= images.length) return c
        const img = images[i++]
        return { ...c, image: { offsetX: 0, offsetY: 0, zoom: 1, ...img } }
      })
    })
  }, [])

  const replaceCells = useCallback((images: CellImage[]) => {
    setCells(prev =>
      prev.map((c, i) => {
        if (i < images.length) {
          const img = images[i]
          return { ...c, image: { offsetX: 0, offsetY: 0, zoom: 1, ...img } }
        }
        return { ...c, image: undefined }
      }),
    )
  }, [])

  const swapCells = useCallback((aId: string, bId: string) => {
    if (aId === bId) return
    setCells(prev => {
      const aIdx = prev.findIndex(c => c.id === aId)
      const bIdx = prev.findIndex(c => c.id === bId)
      if (aIdx === -1 || bIdx === -1) return prev
      const next = [...prev]
      const tmp = next[aIdx].image
      next[aIdx] = { ...next[aIdx], image: next[bIdx].image }
      next[bIdx] = { ...next[bIdx], image: tmp }
      return next
    })
  }, [])

  const clearCell = useCallback((cellId: string) => {
    setCells(prev => prev.map(c => (c.id === cellId ? { ...c, image: undefined } : c)))
  }, [])

  const clearAll = useCallback(() => {
    setCells(prev => prev.map(c => ({ ...c, image: undefined })))
  }, [])

  return {
    ratio,
    ratioId,
    setRatioId,
    count,
    setCount: setCountWrapped,
    gap,
    setGap,
    bgColor,
    setBgColor,
    orientation,
    setOrientation,
    cells,
    setCellImage,
    updateCellTransform,
    fillCells,
    replaceCells,
    swapCells,
    clearCell,
    clearAll,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
