import { useEffect, useRef, useState } from 'react'

function RatioPreview({ label, size = 28, stroke = 1.6 }: { label: string; size?: number; stroke?: number }) {
  const [w, h] = label.split(':').map(Number)
  if (!w || !h) return null
  const max = Math.max(w, h)
  const scale = 18 / max
  const rw = w * scale
  const rh = h * scale
  const x = (size - rw) / 2
  const y = (size - rh) / 2
  // use viewBox 28x28 for extra padding
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" className="shrink-0">
      <rect x={x} y={y} width={rw} height={rh} rx={2.5} ry={2.5} stroke="currentColor" strokeWidth={stroke} />
    </svg>
  )
}

export function Select({
  value,
  onChange,
  options,
  dropUp,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  dropUp?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 rounded-full border border-[#E8E5DE] bg-white px-3 py-2 pr-9 text-left text-[14px] font-medium text-[#2D2E26] outline-none hover:border-[#D8D5CC] focus:border-[#2D2E26] focus:ring-1 focus:ring-[#2D2E26]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F4F1EA] shrink-0">
          <RatioPreview label={selected.label} size={20} stroke={1.4} />
        </span>
        <span className="flex-1">{selected.label}</span>
        <span
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9A93] transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          className={[
            'absolute left-0 right-0 z-30 rounded-2xl border border-[#E8E5DE] bg-white p-1.5 shadow-[0_12px_32px_rgba(45,46,38,0.14)]',
            dropUp ? 'bottom-full mb-2' : 'top-full mt-2',
          ].join(' ')}
        >
          <div className="max-h-[260px] overflow-auto py-1" role="listbox">
            {options.map(o => {
              const active = o.value === value
              return (
                <button
                  key={o.value}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors',
                    active ? 'bg-[#2D2E26] text-white' : 'text-[#2D2E26] hover:bg-[#F4F1EA]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'grid h-7 w-7 place-items-center rounded-full shrink-0',
                      active ? 'bg-white/15 text-white' : 'bg-[#F4F1EA] text-[#2D2E26]',
                    ].join(' ')}
                  >
                    <RatioPreview label={o.label} size={20} stroke={1.4} />
                  </span>
                  <span className="font-medium">{o.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
