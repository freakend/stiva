import { useEffect } from 'react'

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed top-[68px] left-1/2 z-50 w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 rounded-2xl bg-[#2D2E26] px-5 py-3 text-[13px] font-medium text-white shadow-[0_12px_32px_rgba(0,0,0,0.18)] flex items-center justify-center gap-2 text-center">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">!</span>
      <span className="flex-1">{message}</span>
    </div>
  )
}
