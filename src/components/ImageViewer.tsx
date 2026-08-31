import { useEffect, useRef, useState } from 'react'
import type { CellImage } from '../lib/types'

type Props = {
  cellId: string
  image: CellImage
  aspect: number // w/h of the cell
  onApply: (cellId: string, offsetX: number, offsetY: number, zoom: number) => void
  onReplace: (cellId: string, file: File) => void
  onClose: () => void
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function ImageViewer({ cellId, image, aspect, onApply, onReplace, onClose }: Props) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(image.zoom ?? 1)
  const [off, setOff] = useState({ x: image.offsetX ?? 0, y: image.offsetY ?? 0 })
  const [box, setBox] = useState({ w: 560, h: 560 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchRef = useRef<{ startDist: number; startZoom: number; startOff: { x: number; y: number } } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // load natural dims
  useEffect(() => {
    let cancelled = false
    setNat(null)
    const img = new Image()
    img.onload = () => {
      if (!cancelled) setNat({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.onerror = () => {
      if (!cancelled) setNat({ w: 1000, h: 1000 })
    }
    img.src = image.url
    return () => {
      cancelled = true
    }
  }, [image.url])

  // sync local crop state when image prop changes (e.g. after Replace)
  useEffect(() => {
    setZoom(image.zoom ?? 1)
    setOff({ x: image.offsetX ?? 0, y: image.offsetY ?? 0 })
  }, [image.url, image.zoom, image.offsetX, image.offsetY])

  // compute box that fits viewport with aspect
  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const maxW = Math.min(vw * 0.88, 880)
      const maxH = vh * 0.62
      let w = Math.min(maxW, maxH * aspect)
      // also limit by maxH
      if (w / aspect > maxH) w = maxH * aspect
      const h = w / aspect
      setBox({ w: Math.round(w), h: Math.round(h) })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [aspect])

  // coverScale for current box
  const coverScale = nat ? Math.max(box.w / nat.w, box.h / nat.h) : 1
  const scale = coverScale * zoom
  const sw = box.w / scale
  const sh = box.h / scale
  const maxSx = nat ? Math.max(0, nat.w - sw) : 0
  const maxSy = nat ? Math.max(0, nat.h - sh) : 0
  const sx = nat ? maxSx / 2 + off.x * maxSx : 0
  const sy = nat ? maxSy / 2 + off.y * maxSy : 0
  const imgW = nat ? nat.w * scale : box.w
  const imgH = nat ? nat.h * scale : box.h
  const imgLeft = nat ? -sx * scale : 0
  const imgTop = nat ? -sy * scale : 0
  const canPanX = maxSx > 1
  const canPanY = maxSy > 1

  // pointer handlers: drag pan + 2-finger pinch
  const onPointerDown = (e: React.PointerEvent) => {
    const el = wrapRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 1) {
      dragRef.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y }
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values())
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const dist = Math.hypot(dx, dy)
      pinchRef.current = { startDist: dist, startZoom: zoom, startOff: { ...off } }
      dragRef.current = null
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // pinch
    if (pointersRef.current.size === 2 && pinchRef.current && nat) {
      const pts = Array.from(pointersRef.current.values())
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const dist = Math.hypot(dx, dy)
      const factor = dist / pinchRef.current.startDist
      const nz = clamp(pinchRef.current.startZoom * factor, 1, 8)
      setZoom(nz)
      // keep pan at pinch center? we keep startOff for stability
      return
    }

    if (!dragRef.current || !nat) return
    const dxPx = e.clientX - dragRef.current.sx
    const dyPx = e.clientY - dragRef.current.sy
    // map screen delta to offset via overflow
    // overflow in screen px = imgW - box.w
    const overflowX = imgW - box.w
    const overflowY = imgH - box.h
    let nx = dragRef.current.ox
    let ny = dragRef.current.oy
    if (overflowX > 1 && maxSx > 0) {
      const deltaOffX = -(dxPx / overflowX) // drag right -> offset left
      // scale: moving by full overflow corresponds to full offset range (1.0)
      nx = dragRef.current.ox + deltaOffX
    }
    if (overflowY > 1 && maxSy > 0) {
      const deltaOffY = -(dyPx / overflowY)
      ny = dragRef.current.oy + deltaOffY
    }
    setOff({ x: clamp(nx, -0.5, 0.5), y: clamp(ny, -0.5, 0.5) })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId)
    try {
      wrapRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // pointer capture may already be released
    }
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) dragRef.current = null
    if (pointersRef.current.size === 1) {
      // remaining pointer becomes new drag origin
      const remaining = Array.from(pointersRef.current.values())[0]
      dragRef.current = { sx: remaining.x, sy: remaining.y, ox: off.x, oy: off.y }
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    setZoom(z => clamp(z * factor, 1, 8))
  }

  const handleDone = () => {
    onApply(cellId, off.x, off.y, zoom)
    onClose()
  }

  const handleReplacePick = (f: File | null) => {
    if (!f) return
    // keep viewer open, show new image cropped fresh
    onReplace(cellId, f)
    if (fileRef.current) fileRef.current.value = ''
  }

  // close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#1A1A18]/75 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      {/* card - bottom sheet on mobile, centered on desktop */}
      <div
        className="relative flex max-h-[86dvh] w-full flex-col items-center overflow-auto rounded-t-[20px] border border-white/20 bg-[#FFFBF5] shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:max-h-none sm:max-w-[920px] sm:overflow-visible sm:rounded-[20px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="mt-2 h-1 w-9 shrink-0 rounded-full bg-[#E8E5DE] sm:hidden" />
        {/* header */}
        <div className="flex w-full items-center justify-between px-5 py-4 sm:px-6">
          <p className="text-[11px] font-mono tracking-[0.14em] text-[#6B6B63]">EDIT CROP</p>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-[#E8E5DE] bg-white text-[#6B6B63] hover:text-[#2D2E26]"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* image stage */}
        <div className="flex w-full justify-center px-4 sm:px-8 pb-2">
          <div
            ref={wrapRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
            className="relative overflow-hidden rounded-xl bg-[#F4F1EA] ring-1 ring-[#E8E5DE] touch-none select-none"
            style={{ width: box.w, height: box.h, cursor: canPanX || canPanY ? 'grab' : 'default' }}
          >
            <img
              src={image.url}
              alt={image.name || 'Photo preview'}
              draggable={false}
              onLoad={e => {
                const t = e.currentTarget
                if (!nat) setNat({ w: t.naturalWidth, h: t.naturalHeight })
              }}
              className="absolute max-w-none select-none pointer-events-none"
              style={{ left: imgLeft, top: imgTop, width: imgW, height: imgH }}
            />
            {/* subtle border */}
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-black/5" />
          </div>
        </div>

        <p className="px-4 pb-3 pt-2 text-center text-[11px] font-mono tracking-wide text-[#6B6B63]">
          Drag to pan · pinch or scroll to zoom
        </p>

        {/* actions */}
        <div className="flex w-full items-center justify-between gap-3 border-t border-[#E8E5DE] bg-white px-4 pt-4 sm:px-6 rounded-b-[20px]" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E8E5DE] bg-white px-4 py-2 text-[13px] font-semibold text-[#2D2E26] hover:bg-[#FFFBF5]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Replace image
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleReplacePick(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setZoom(1)
                setOff({ x: 0, y: 0 })
              }}
              className="rounded-full border border-[#E8E5DE] bg-white px-4 py-2 text-[13px] font-medium text-[#6B6B63] hover:bg-[#FFFBF5]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="rounded-full bg-[#2D2E26] px-6 py-2 text-[13px] font-semibold text-white hover:bg-black"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
