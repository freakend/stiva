import { useEffect, useMemo, useRef, useState } from 'react'
import { useCollageState } from './hooks/useCollageState'
import { RATIOS } from './lib/ratios'
import { Select } from './components/Select'
import { Cell } from './components/Cell'
import { Toast } from './components/Toast'
import { ImageViewer } from './components/ImageViewer'
import { exportPNG, dimensionsLabel } from './lib/export'

const MAX_BYTES = 10 * 1024 * 1024
const PHOTO_OPTIONS = [1, 2, 3, 4, 6] as const

function RatioMini({ label, size = 26 }: { label: string; size?: number }) {
  const [w, h] = label.split(':').map(Number)
  if (!w || !h) return null
  const max = Math.max(w, h)
  const scale = 20 / max
  const rw = w * scale
  const rh = h * scale
  const x = (size - rw) / 2
  const y = (size - rh) / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" className="shrink-0">
      <rect x={x} y={y} width={rw} height={rh} rx={1.5} stroke="currentColor" strokeWidth={1.5} />
    </svg>
  )
}

export default function App() {
  const {
    ratio,
    ratioId,
    setRatioId,
    count,
    setCount,
    gap,
    setGap,
    bgColor,
    orientation,
    setOrientation,
    cells,
    setCellImage,
    fillCells,
    replaceCells,
    updateCellTransform,
    swapCells,
    clearCell,
    clearAll,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCollageState()

  const [toast, setToast] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [activeControl, setActiveControl] = useState<'ratio' | 'photos' | 'orientation' | 'gap' | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const globalAddRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const dimLabel = useMemo(() => dimensionsLabel(ratio), [ratio])
  const allFilled = cells.length > 0 && cells.every(c => !!c.image)

  // --- PWA: update available + purge & hard refresh ---
  const [swWaiting, setSwWaiting] = useState<ServiceWorker | null>(null)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const [isPurging, setIsPurging] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // jangan aktifin PWA logic di dev, biar nggak ganggu HMR
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    if (isLocal) {
      // purge SW nyangkut di dev biar nggak dino lagi
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
      if ('caches' in window) caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
      return
    }
    let refreshing = false
    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // check for waiting SW immediately
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) {
        setSwWaiting(reg.waiting)
        setShowUpdateBanner(true)
      }
    })

    // listen for new SW
    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            setSwWaiting(sw)
            setShowUpdateBanner(true)
          }
        })
      })
    })

    // also handle registration from index.html
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg?.waiting) {
          setSwWaiting(reg.waiting)
          setShowUpdateBanner(true)
        }
      })
    })

    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])

  const handlePWAUpdate = () => {
    if (swWaiting) {
      swWaiting.postMessage({ type: 'SKIP_WAITING' })
    } else {
      // fallback: just hard reload
      window.location.reload()
    }
  }

  const handlePurgeHardRefresh = async () => {
    setIsPurging(true)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg?.active) reg.active.postMessage({ type: 'PURGE_AND_RELOAD' })
        if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    } catch {
      // non-fatal: purge failures still fall through to reload
    }
    // single clean reload; caches are empty so fresh assets come from network
    window.location.reload()
  }

  // Lightroom-style picker: Escape dismiss + focus first control when opened
  useEffect(() => {
    if (!activeControl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveControl(null)
    }
    document.addEventListener('keydown', onKey)
    // move focus into picker for a11y
    requestAnimationFrame(() => {
      const el = pickerRef.current?.querySelector<HTMLElement>('button, input')
      el?.focus()
    })
    return () => document.removeEventListener('keydown', onKey)
  }, [activeControl])

  const handleToolbarTap = (id: 'ratio' | 'photos' | 'orientation' | 'gap') => {
    setActiveControl(prev => (prev === id ? null : id))
  }

  const handlePick = (cellId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      setToast('Please select an image file.')
      return
    }
    if (file.size > MAX_BYTES) {
      setToast(`Max 10MB per image. "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB.`)
      return
    }
    const prev = cells.find(c => c.id === cellId)?.image?.url
    if (prev) URL.revokeObjectURL(prev)
    const url = URL.createObjectURL(file)
    setCellImage(cellId, { url, name: file.name, size: file.size })
  }

  const handleAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    const valid: File[] = []
    for (const f of list) {
      if (!f.type.startsWith('image/')) continue
      if (f.size > MAX_BYTES) {
        setToast(`Max 10MB per image. "${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)}MB.`)
        continue
      }
      valid.push(f)
    }
    if (valid.length === 0) {
      if (globalAddRef.current) globalAddRef.current.value = ''
      return
    }
    const empties = cells.filter(c => !c.image).length
    const allFilled = empties === 0
    if (allFilled) {
      // Replace mode: replace all cells in order, leave empty if fewer picked
      cells.forEach(c => {
        if (c.image?.url) URL.revokeObjectURL(c.image.url)
      })
      const toUse = valid.slice(0, cells.length)
      if (valid.length > cells.length) {
        setToast(`Grid has ${cells.length} cells. Using first ${cells.length} of ${valid.length} photos.`)
      }
      const images = toUse.map(f => ({ url: URL.createObjectURL(f), name: f.name, size: f.size }))
      replaceCells(images)
    } else {
      if (valid.length > empties) {
        setToast(`Grid has ${empties} empty cells. Adding first ${empties} of ${valid.length} photos.`)
      }
      const toAdd = valid.slice(0, empties)
      const images = toAdd.map(f => ({ url: URL.createObjectURL(f), name: f.name, size: f.size }))
      fillCells(images)
    }
    if (globalAddRef.current) globalAddRef.current.value = ''
  }

  const handleClear = (id: string) => {
    const prev = cells.find(c => c.id === id)?.image?.url
    if (prev) URL.revokeObjectURL(prev)
    clearCell(id)
    if (focusedId === id) setFocusedId(null)
  }

  const handleClearAll = () => {
    cells.forEach(c => {
      if (c.image?.url) URL.revokeObjectURL(c.image.url)
    })
    clearAll()
    setFocusedId(null)
  }

  const handleExport = async () => {
    if (cells.every(c => !c.image)) {
      setToast('Add at least one photo before exporting.')
      return
    }
    setExporting(true)
    try {
      const blob = await exportPNG(cells, ratio, bgColor, gap)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stiva-${ratio.label.replace(':', '-')}-${count}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      setToast('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const focusedCell = focusedId ? (cells.find(c => c.id === focusedId) ?? null) : null
  const focusedAspect = focusedCell ? (focusedCell.rect.w * ratio.w) / (focusedCell.rect.h * ratio.h) : 1

  return (
    <div className="min-h-full bg-[#F4F1EA] text-[#2D2E26]">
      <div className="h-[1px] w-full bg-[#E8E5DE]" />

      <div className="flex h-[calc(100dvh-1px)] min-h-[calc(100dvh-1px)] w-full flex-col overflow-hidden lg:h-[calc(100vh-1px)] lg:flex-row">
        {/* SIDEBAR (desktop only) */}
        <aside className="hidden lg:flex w-full max-w-[360px] shrink-0 flex-col overflow-hidden border-r border-[#E8E5DE] bg-[#FFFBF5] max-lg:max-w-[340px]">
          <div className="flex flex-1 flex-col overflow-auto min-h-0 lg:overflow-hidden">
            {/* header */}
            <div className="shrink-0 px-6 pb-4 pt-[19px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[28px] font-bold tracking-[-0.03em]">stiva</span>
                    <span className="text-[11px] font-mono tracking-widest text-[#6B6B63]">v1.0</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-[1.5] text-[#6B6B63]">
                    Put together pictures to collage.
                    <br />
                    All processing stays in your browser.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col space-y-4 overflow-visible px-4 pb-6 min-h-0 lg:overflow-visible">
              {/* CANVAS */}
              <section className="rounded-2xl border border-[#E8E5DE] bg-white p-4">
                <h2 className="text-[11px] font-semibold tracking-[0.14em] text-[#6B6B63]">CANVAS</h2>

                <div className="mt-3 space-y-3">
                  <div>
                    <div className="mb-1.5 flex items-baseline gap-1.5">
                      <label className="text-[12px] font-medium text-[#6B6B63]">Ratio</label>
                      <span className="text-[11px] font-mono text-[#6B6B63]">
                        ({ratio.label} · {dimLabel} export)
                      </span>
                    </div>
                    <Select
                      value={ratioId}
                      onChange={v => setRatioId(v as typeof ratioId)}
                      options={RATIOS.map(r => ({ value: r.id, label: r.label }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-[#6B6B63]">Photos</label>
                    <div className="flex rounded-full bg-[#EDE9E0] p-1 gap-1">
                      {PHOTO_OPTIONS.map(n => {
                        const active = n === count
                        return (
                          <button
                            key={n}
                            onClick={() => setCount(n as typeof count)}
                            className={[
                              'flex-1 rounded-full px-2 py-[7px] text-[13px] font-semibold leading-none transition-all',
                              active ? 'bg-[#2D2E26] text-white shadow-sm' : 'text-[#6B6B63] hover:text-[#2D2E26]',
                            ].join(' ')}
                          >
                            {n}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-[#6B6B63]">Orientation</label>
                    <div className="flex rounded-full bg-[#EDE9E0] p-1 gap-1">
                      {(['portrait', 'landscape'] as const).map(o => {
                        const active = o === orientation
                        return (
                          <button
                            key={o}
                            onClick={() => setOrientation(o)}
                            className={[
                              'flex-1 capitalize rounded-full px-2 py-[7px] text-[13px] font-semibold leading-none transition-all',
                              active ? 'bg-[#2D2E26] text-white shadow-sm' : 'text-[#6B6B63] hover:text-[#2D2E26]',
                            ].join(' ')}
                          >
                            {o}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-[12px] font-medium text-[#6B6B63]">Gap</label>
                      <span className="text-[11px] font-mono text-[#6B6B63]">{gap}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={2}
                      value={gap}
                      onChange={e => setGap(Number(e.target.value))}
                      className="h-1 w-full appearance-none rounded-full bg-[#EDE9E0] accent-[#2D2E26]"
                    />
                    <div className="mt-1 flex justify-between text-[11px] font-mono text-[#6B6B63]">
                      <span>0</span>
                      <span>24</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* EXPORT */}
              <section className="rounded-2xl border border-[#E8E5DE] bg-white p-4">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#2D2E26] px-4 py-3 text-[14px] font-semibold text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {exporting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Exporting…
                    </>
                  ) : (
                    <>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M12 5v14M5 12l7 7 7-7" />
                        <path d="M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" opacity=".9" />
                      </svg>
                      Download PNG
                    </>
                  )}
                </button>
                <p className="mt-2 text-center text-[11px] text-[#6B6B63]">
                  Everything is processed locally in your browser
                </p>
              </section>

              {/* ABOUT */}
              <section className="rounded-2xl border border-[#E8E5DE] bg-[#FFFBF5] px-4 pt-4 pb-2 flex flex-1 flex-col min-h-0 overflow-hidden">
                <h2 className="text-[11px] font-semibold tracking-[0.14em] text-[#6B6B63] shrink-0">ABOUT</h2>
                <div className="mt-2 flex-1 min-h-0 overflow-auto pr-1 sidebar-scroll">
                  <p className="text-[12.5px] leading-relaxed text-[#6B6B63]">
                    <span className="font-semibold text-[#2D2E26]">Stiva</span> from Greek{' '}
                    <span className="font-mono text-[#2D2E26]">στοιβάζω</span> (<em>stoivazō</em>): to pile up, pack
                    together, arrange neatly.
                  </p>
                  <p className="mt-2 text-[11px] font-mono text-[#6B6B63]">
                    stoicheō · στοιχήσω, ἐστοίχησα: “to align, to compile together”
                  </p>
                </div>
              </section>
            </div>
          </div>
        </aside>

        {/* MAIN CANVAS AREA */}
        <main className="relative flex min-w-0 flex-1 flex-col bg-[#F4F1EA] min-h-0">
          {/* top toolbar. Desktop: Add image + undo/redo. Mobile: undo/redo only (add/delete moved to bottom, color picker removed) */}
          <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
            <button
              onClick={() => globalAddRef.current?.click()}
              className="hidden lg:flex h-9 items-center justify-center gap-1.5 rounded-full border border-[#E8E5DE] bg-white px-4 text-[12px] font-semibold text-[#2D2E26] shadow-sm hover:bg-[#FFFBF5] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add image
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleClearAll}
                className="hidden lg:grid h-9 w-9 place-items-center rounded-full border border-[#E8E5DE] bg-white text-[#2D2E26] shadow-sm hover:bg-[#FFFBF5] hover:text-red-600 transition-colors"
                title="Clear all"
                aria-label="Clear all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
              <button
                onClick={undo}
                disabled={!canUndo}
                className="grid h-9 w-9 place-items-center rounded-full border border-[#E8E5DE] bg-white text-[#2D2E26] shadow-sm hover:bg-[#FFFBF5] disabled:opacity-40 disabled:cursor-not-allowed"
                title="Undo"
                aria-label="Undo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M9 9H5V5" />
                  <path d="M5 9a8 8 0 015.66-2.34A8 8 0 0119 14" />
                  <path d="M15 15l-3 3-3-3" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="grid h-9 w-9 place-items-center rounded-full border border-[#E8E5DE] bg-white text-[#2D2E26] shadow-sm hover:bg-[#FFFBF5] disabled:opacity-40 disabled:cursor-not-allowed"
                title="Redo"
                aria-label="Redo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M15 9h4V5" />
                  <path d="M19 9a8 8 0 00-5.66-2.34A8 8 0 005 14" />
                  <path d="M9 15l3 3 3-3" />
                </svg>
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="grid lg:hidden h-9 w-9 place-items-center rounded-full bg-[#2D2E26] text-white shadow-sm hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
                title="Download PNG"
                aria-label="Download PNG"
              >
                {exporting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                    <path d="M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" opacity=".9" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* canvas viewport */}
          <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center p-3 sm:p-6 lg:p-8 overflow-auto sm:overflow-hidden">
            <div
              className="relative shrink-0 overflow-hidden rounded-[18px] border border-[#E8E5DE] bg-white shadow-[0_8px_40px_rgba(45,46,38,0.08)]"
              style={{
                aspectRatio: `${ratio.w} / ${ratio.h}`,
                background: bgColor,
                width: `min(100%, 860px, calc(62dvh * ${ratio.w} / ${ratio.h}), calc(78vh * ${ratio.w} / ${ratio.h}), calc(760px * ${ratio.w} / ${ratio.h}))`,
                height: 'auto',
                maxHeight: 'min(62dvh, 78vh, 760px)',
                maxWidth: '100%',
              }}
            >
              {/* subtle inner hairline */}
              <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-black/[0.04] ring-inset" />

              {/* grid */}
              <div className="absolute inset-0">
                {cells.map(c => {
                  const isTop = c.rect.y === 0
                  const isLeft = c.rect.x === 0
                  const isRight = Math.abs(c.rect.x + c.rect.w - 1) < 0.001
                  const isBottom = Math.abs(c.rect.y + c.rect.h - 1) < 0.001
                  return (
                    <div
                      key={c.id}
                      className="absolute overflow-hidden"
                      style={{
                        left: `${c.rect.x * 100}%`,
                        top: `${c.rect.y * 100}%`,
                        width: `${c.rect.w * 100}%`,
                        height: `${c.rect.h * 100}%`,
                        borderTopLeftRadius: isTop && isLeft ? 18 : 0,
                        borderTopRightRadius: isTop && isRight ? 18 : 0,
                        borderBottomLeftRadius: isBottom && isLeft ? 18 : 0,
                        borderBottomRightRadius: isBottom && isRight ? 18 : 0,
                      }}
                    >
                      <Cell
                        cell={c}
                        gap={gap}
                        onFocus={id => setFocusedId(id)}
                        onSwap={swapCells}
                        onClear={handleClear}
                        onPick={handlePick}
                        onAddClick={c.image ? undefined : () => globalAddRef.current?.click()}
                        draggable={cells.some(x => !!x.image)}
                        isTop={isTop}
                        isLeft={isLeft}
                        isRight={isRight}
                        isBottom={isBottom}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Replace (kanan bawah canvas, hanya saat fully filled, desktop only) */}
              {allFilled && (
                <button
                  onClick={() => globalAddRef.current?.click()}
                  className="absolute bottom-3 right-3 z-10 hidden h-8 min-w-[72px] place-items-center rounded-[12px] border-2 border-[#2D2E26] bg-white px-4 text-[12px] font-semibold text-[#2D2E26] shadow-[0_4px_16px_rgba(45,46,38,0.12)] hover:bg-[#FFFBF5] transition-colors lg:grid"
                  title="Replace photos"
                  aria-label="Replace photos"
                >
                  Replace
                </button>
              )}
            </div>
          </div>

          {/* bottom bar (desktop only, mobile uses sheet) */}
          <div className="hidden lg:flex items-center justify-between gap-4 px-6 pb-6">
            <p className="text-[11px] font-mono tracking-wide text-[#6B6B63]">
              Click photo to crop · Drag to swap · <span className="text-[#6B6B63]">Export keeps your crop</span>
            </p>
            <p className="shrink-0 text-[11px] font-mono tracking-wide text-[#6B6B63]">
              made with love by{' '}
              <a
                href="https://imbe.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2D2E26] hover:underline"
              >
                Imbe
              </a>
            </p>
          </div>

          {/* hidden global file input */}
          <input
            ref={globalAddRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleAddFiles(e.target.files)}
          />
        </main>

        {/* MOBILE: Lightroom-style bottom sheet (MOBILE ONLY) */}
        <div className="lg:hidden relative shrink-0 border-t border-[#E8E5DE] bg-[#FFFBF5] shadow-[0_-8px_24px_rgba(45,46,38,0.06)]">
          {/* Backdrop: tap outside picker to dismiss (covers canvas, not toolbar) */}
          {activeControl && (
            <button
              aria-label="Close picker"
              onClick={() => setActiveControl(null)}
              className="fixed inset-0 z-10 bg-transparent lg:hidden"
              style={{ bottom: 96 }}
              tabIndex={-1}
            />
          )}

          {/* Picker: slides up above toolbar, overlaps canvas slightly, does NOT shift layout */}
          <div
            ref={pickerRef}
            id={activeControl ? `picker-${activeControl}` : undefined}
            role="region"
            aria-label={activeControl ? `${activeControl} picker` : undefined}
            className={[
              'absolute bottom-full left-0 right-0 z-20 bg-[#FFFBF5] border-t border-[#E8E5DE] rounded-t-2xl shadow-[0_-12px_32px_rgba(45,46,38,0.14)] px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]',
              'transition-all will-change-transform',
              activeControl
                ? 'translate-y-0 opacity-100 pointer-events-auto'
                : 'translate-y-3 opacity-0 pointer-events-none',
            ].join(' ')}
            style={{
              transitionDuration: activeControl ? '200ms' : '150ms',
              transitionTimingFunction: activeControl ? 'cubic-bezier(0.16,1,0.3,1)' : 'cubic-bezier(0.4,0,1,1)',
            }}
          >
            {activeControl === 'ratio' && (
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold tracking-[0.12em] text-[#6B6B63] uppercase">Ratio</span>
                  <span className="text-[11px] font-mono text-[#6B6B63]">
                    {ratio.label} · {dimLabel}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 no-scrollbar">
                  {RATIOS.map(r => {
                    const active = r.id === ratioId
                    return (
                      <button
                        key={r.id}
                        autoFocus={active}
                        onClick={() => setRatioId(r.id)}
                        className={[
                          'flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-3 py-2.5 transition-all',
                          active
                            ? 'border-[#2D2E26] bg-[#2D2E26] text-white shadow-sm'
                            : 'border-[#E8E5DE] bg-white text-[#2D2E26]',
                        ].join(' ')}
                      >
                        <RatioMini label={r.label} />
                        <span className="text-[11px] font-semibold leading-none">{r.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {activeControl === 'photos' && (
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold tracking-[0.12em] text-[#6B6B63] uppercase">Photos</span>
                  <span className="text-[11px] font-mono text-[#6B6B63]">{count} photos</span>
                </div>
                <div className="flex rounded-full bg-[#EDE9E0] p-1 gap-1">
                  {PHOTO_OPTIONS.map(n => {
                    const active = n === count
                    return (
                      <button
                        key={n}
                        autoFocus={active}
                        onClick={() => setCount(n as typeof count)}
                        className={[
                          'flex-1 rounded-full px-2 py-[10px] text-[13px] font-semibold leading-none transition-all',
                          active ? 'bg-[#2D2E26] text-white shadow-sm' : 'text-[#6B6B63] hover:text-[#2D2E26]',
                        ].join(' ')}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {activeControl === 'orientation' && (
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold tracking-[0.12em] text-[#6B6B63] uppercase">
                    Orientation
                  </span>
                  <span className="text-[11px] font-mono text-[#6B6B63] capitalize">{orientation}</span>
                </div>
                <div className="flex rounded-full bg-[#EDE9E0] p-1 gap-1">
                  {(['portrait', 'landscape'] as const).map(o => {
                    const active = o === orientation
                    return (
                      <button
                        key={o}
                        autoFocus={active}
                        onClick={() => setOrientation(o)}
                        className={[
                          'flex-1 rounded-full px-2 py-[10px] text-[13px] font-semibold leading-none capitalize transition-all',
                          active ? 'bg-[#2D2E26] text-white shadow-sm' : 'text-[#6B6B63] hover:text-[#2D2E26]',
                        ].join(' ')}
                      >
                        {o}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {activeControl === 'gap' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-[0.12em] text-[#6B6B63] uppercase">Gap</span>
                  <span className="text-[11px] font-mono text-[#6B6B63]">{gap}px</span>
                </div>
                <input
                  autoFocus
                  type="range"
                  min={0}
                  max={24}
                  step={2}
                  value={gap}
                  onChange={e => setGap(Number(e.target.value))}
                  className="h-1 w-full appearance-none rounded-full bg-[#EDE9E0] accent-[#2D2E26]"
                />
                <div className="mt-1.5 flex justify-between text-[10px] font-mono text-[#6B6B63]">
                  <span>0</span>
                  <span>24</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom toolbar: semua seragam, icon di atas, title di bawah, tanpa card, ukuran icon konsisten */}
          <div className="relative z-30 flex items-stretch justify-between gap-1 overflow-x-auto bg-[#FFFBF5] px-2 pt-2 no-scrollbar" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            {[
              {
                kind: 'action' as const,
                id: 'add' as const,
                label: allFilled ? 'Replace' : 'Add',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                ),
                action: () => globalAddRef.current?.click(),
              },
              {
                kind: 'picker' as const,
                id: 'ratio' as const,
                label: 'Ratio',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                  </svg>
                ),
              },
              {
                kind: 'picker' as const,
                id: 'photos' as const,
                label: 'Photos',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="1.6" />
                    <path d="M21 15l-4-4-7 7" />
                  </svg>
                ),
              },
              {
                kind: 'picker' as const,
                id: 'orientation' as const,
                label: 'Orient',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M8 3v18M8 4l-2 2M8 4l2 2M16 3v18M16 20l-2-2M16 20l2-2" />
                  </svg>
                ),
              },
              {
                kind: 'picker' as const,
                id: 'gap' as const,
                label: 'Gap',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M3 12h18" />
                    <circle cx="12" cy="12" r="2.2" />
                  </svg>
                ),
              },
              {
                kind: 'action' as const,
                id: 'delete' as const,
                label: 'Delete',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                ),
                action: handleClearAll,
                danger: true,
              },
            ].map(btn => {
              if (btn.kind === 'action') {
                return (
                  <button
                    key={btn.id}
                    onClick={btn.action}
                    className={[
                      'flex flex-1 flex-col items-center justify-center gap-1.5 min-w-[64px] py-1.5 transition-colors',
                      btn.danger ? 'text-[#2D2E26] hover:text-red-600' : 'text-[#2D2E26] hover:text-[#2D2E26]',
                    ].join(' ')}
                    title={btn.label}
                    aria-label={btn.label}
                  >
                    <span
                      className={[
                        'grid h-[50px] w-[50px] place-items-center rounded-xl border transition-colors',
                        btn.danger
                          ? 'bg-white border-[#E8E5DE] text-[#2D2E26] hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                          : 'bg-white border-[#E8E5DE] text-[#2D2E26] hover:bg-[#FFFBF5] hover:border-[#D8D5CC]',
                      ].join(' ')}
                    >
                      {btn.icon}
                    </span>
                    <span className="text-[10px] font-semibold leading-none tracking-wide">{btn.label}</span>
                  </button>
                )
              }
              const isActive = activeControl === btn.id
              return (
                <button
                  key={btn.id}
                  onClick={() => handleToolbarTap(btn.id)}
                  aria-expanded={isActive}
                  aria-controls={`picker-${btn.id}`}
                  className="flex flex-1 flex-col items-center justify-center gap-1.5 min-w-[64px] py-1.5 transition-colors"
                >
                  <span
                    className={[
                      'grid h-[50px] w-[50px] place-items-center rounded-xl border transition-colors',
                      isActive
                        ? 'bg-[#2D2E26] border-[#2D2E26] text-white shadow-sm'
                        : 'bg-white border-[#E8E5DE] text-[#2D2E26] hover:bg-[#FFFBF5] hover:border-[#D8D5CC]',
                    ].join(' ')}
                  >
                    {btn.icon}
                  </span>
                  <span
                    className={[
                      'text-[10px] font-semibold leading-none tracking-wide',
                      isActive ? 'text-[#2D2E26]' : 'text-[#6B6B63]',
                    ].join(' ')}
                  >
                    {btn.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`.no-scrollbar::-webkit-scrollbar{ display:none; } .no-scrollbar{ scrollbar-width: none; }`}</style>

      {infoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/30" onClick={() => setInfoOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-[#FFFBF5] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[13px] font-bold text-[#2D2E26]">How it works</h2>
              <button
                onClick={() => setInfoOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-full text-[#6B6B63] hover:bg-[#EDE9E0] hover:text-[#2D2E26]"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#6B6B63]">
              Tap a photo to crop and adjust, or drag photos to swap their places.
              <br />
              Your crop and arrangement are kept when you export.
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-[#6B6B63]">
              Everything is processed locally in your browser. No photo ever leaves this device (max 10MB each).
            </p>
            <p className="mt-4 text-[11px] font-mono text-[#6B6B63]">
              made with love by{' '}
              <a
                href="https://imbe.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2D2E26] hover:underline"
              >
                Imbe
              </a>
            </p>
            <button
              onClick={handlePurgeHardRefresh}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-[#E8E5DE] bg-white px-3 py-2 text-[11px] font-medium text-[#6B6B63] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M3 12a9 9 0 1 0 2.64 -6.36" />
                <path d="M3 3v6h6" />
              </svg>
              Purge cache & hard refresh
            </button>
            <p className="mt-1 text-center text-[10px] font-mono text-[#6B6B63]">use if page stuck after update</p>
          </div>
        </div>
      )}

      {/* PWA: update available, button confirmation to purge old build + hard refresh */}
      {showUpdateBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 lg:left-auto lg:right-6 lg:max-w-[380px] animate-[fadeIn_200ms_ease]">
          <div className="rounded-2xl border border-[#E8E5DE] bg-[#FFFBF5] p-4 shadow-[0_16px_40px_rgba(45,46,38,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2D2E26] text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 5v7M12 19h.01" />
                  <path d="M12 3a9 9 0 0 1 9 9c0 4  -3 7 -9 9 -6 -2 -9 -5 -9 -9 a9 9 0 0 1 9 -9Z" opacity="0" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-semibold text-[#2D2E26]">Update available</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-[#6B6B63]">
                  A new build is ready. Purge old cache and hard refresh to apply the changes. Your photos stay local.
                  Nothing is uploaded.
                </p>
              </div>
              <button
                onClick={() => setShowUpdateBanner(false)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#6B6B63] hover:bg-[#EDE9E0] hover:text-[#2D2E26]"
                aria-label="Dismiss"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handlePWAUpdate}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#2D2E26] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-black transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 12a9 9 0 1 1 -2.64 -6.36" />
                  <path d="M21 3v6h-6" />
                  <path d="M12 7v6l3 3" />
                </svg>
                Update now
              </button>
              <button
                onClick={handlePurgeHardRefresh}
                disabled={isPurging}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-[#2D2E26] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#2D2E26] hover:bg-[#FFFBF5] disabled:opacity-50 transition-colors"
              >
                {isPurging ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2D2E26]/30 border-t-[#2D2E26]" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 12a9 9 0 1 0 2.64 -6.36" />
                    <path d="M3 3v6h6" />
                    <path d="M12 7v5h5" />
                  </svg>
                )}
                Purge & hard refresh
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] font-mono text-[#6B6B63]">
              Old build will be purged from cache. Hard refresh loads the new one
            </p>
          </div>
        </div>
      )}

      {focusedCell?.image && (
        <ImageViewer
          cellId={focusedCell.id}
          image={focusedCell.image}
          aspect={focusedAspect}
          onApply={(id, ox, oy, z) => updateCellTransform(id, ox, oy, z)}
          onReplace={handlePick}
          onClose={() => setFocusedId(null)}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
