import { useState } from 'react'
import type { CellData } from '../lib/types'

export function Cell({
  cell,
  gap,
  onFocus,
  onSwap,
  onClear,
  onPick,
  onAddClick,
  draggable,
  isTop,
  isLeft,
  isRight,
  isBottom,
}: {
  cell: CellData
  gap: number
  onFocus: (id: string) => void
  onSwap: (a: string, b: string) => void
  onClear: (id: string) => void
  onPick: (id: string, file: File) => void
  onAddClick?: () => void
  draggable: boolean
  isTop?: boolean
  isLeft?: boolean
  isRight?: boolean
  isBottom?: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const ox = cell.image?.offsetX ?? 0
  const oy = cell.image?.offsetY ?? 0
  const zoom = cell.image?.zoom ?? 1
  const rInner = Math.max(0, 18 - gap / 2)

  return (
    <div
      draggable={draggable && !!cell.image}
      onDragStart={e => {
        if (!cell.image) {
          e.preventDefault()
          return
        }
        setIsDragging(true)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', cell.id)
        try {
          e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, 20, 20)
        } catch {
          // drag image is a nice-to-have; some browsers throw without an img element
        }
      }}
      onDragEnd={() => setIsDragging(false)}
      onDragOver={e => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setDragOver(false)
        const sourceId = e.dataTransfer.getData('text/plain')
        if (sourceId && sourceId !== cell.id) onSwap(sourceId, cell.id)
        const file = e.dataTransfer.files?.[0]
        if (file) onPick(cell.id, file)
      }}
      onClick={() => {
        if (isDragging) return
        if (cell.image) onFocus(cell.id)
        else if (onAddClick) onAddClick()
      }}
      onKeyDown={e => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        if (cell.image) onFocus(cell.id)
        else if (onAddClick) onAddClick()
      }}
      role="button"
      tabIndex={0}
      aria-label={cell.image ? 'Edit photo' : 'Add image'}
      style={{ padding: gap / 2 }}
      className={[
        'group relative h-full w-full overflow-hidden bg-white select-none cursor-pointer',
        dragOver ? 'ring-2 ring-[#2D2E26] ring-inset z-10' : '',
        isDragging ? 'opacity-60' : 'opacity-100',
      ].join(' ')}
    >
      <div
        className="relative h-full w-full overflow-hidden bg-[#F4F1EA]"
        style={{
          borderTopLeftRadius: isTop && isLeft ? rInner : 0,
          borderTopRightRadius: isTop && isRight ? rInner : 0,
          borderBottomLeftRadius: isBottom && isLeft ? rInner : 0,
          borderBottomRightRadius: isBottom && isRight ? rInner : 0,
        }}
      >
        {cell.image ? (
          <>
            <img
              src={cell.image.url}
              alt={cell.image.name || 'Collage photo'}
              draggable={false}
              className="h-full w-full pointer-events-none select-none"
              style={{
                objectFit: 'cover',
                objectPosition: `${50 + ox * 100}% ${50 + oy * 100}%`,
                transform: `scale(${zoom})`,
                transformOrigin: 'center',
              }}
            />
            {/* hover hint */}
            <div className="absolute inset-0 bg-[#2D2E26]/0 group-hover:bg-[#2D2E26]/10 transition-colors pointer-events-none" />
            {/* clear button */}
            <button
              onClick={e => {
                e.stopPropagation()
                onClear(cell.id)
              }}
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#2D2E26] text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
              title="Remove"
              aria-label="Remove image"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {/* drag handle hint when not dragging */}
            {!isDragging && (
              <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[#2D2E26] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="9" cy="9" r="1" fill="currentColor" />
                  <circle cx="15" cy="9" r="1" fill="currentColor" />
                  <circle cx="9" cy="15" r="1" fill="currentColor" />
                  <circle cx="15" cy="15" r="1" fill="currentColor" />
                </svg>
              </span>
            )}
            {/* crop button, still accessible even though click now adds */}
            <button
              onClick={e => {
                e.stopPropagation()
                onFocus(cell.id)
              }}
              className="absolute bottom-1.5 left-1/2 -translate-x-1/2 grid h-6 place-items-center rounded-full bg-white/90 px-2 text-[10px] font-semibold tracking-wide text-[#2D2E26] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              title="Crop"
              aria-label="Crop image"
            >
              crop
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              if (onAddClick) onAddClick()
            }}
            className="grid h-full w-full place-items-center p-3 hover:bg-[#EDE9E0]/50 transition-colors cursor-pointer"
            aria-label="Add image"
          >
            <svg
              width="44"
              height="44"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[#C4C0B3] group-hover:text-[#9A9A93] transition-colors"
            >
              <path
                d="M29.4995,12.3739c.7719-.0965,1.5437,.4824,1.5437,1.2543h0l2.5085,23.8312c.0965,.7719-.4824,1.5437-1.2543,1.5437l-23.7347,2.5085c-.7719,.0965-1.5437-.4824-1.5437-1.2543h0l-2.5085-23.7347c-.0965-.7719,.4824-1.5437,1.2543-1.5437l23.7347-2.605Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
              <path
                d="M12.9045,18.9347c-1.7367,.193-3.0874,1.7367-2.8945,3.5699,.193,1.7367,1.7367,3.0874,3.5699,2.8945,1.7367-.193,3.0874-1.7367,2.8945-3.5699s-1.8332-3.0874-3.5699-2.8945h0Zm8.7799,5.596l-4.6312,5.6925c-.193,.193-.4824,.2894-.6754,.0965h0l-1.0613-.8683c-.193-.193-.5789-.0965-.6754,.0965l-5.0171,6.1749c-.193,.193-.193,.5789,.0965,.6754-.0965,.0965,.0965,.0965,.193,.0965l19.9719-2.1226c.2894,0,.4824-.2894,.4824-.5789,0-.0965-.0965-.193-.0965-.2894l-7.8151-9.0694c-.2894-.0965-.5789-.0965-.7719,.0965h0Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
              <path
                d="M16.2814,13.8211l.6754-6.0784c.0965-.7719,.7719-1.3508,1.5437-1.2543l23.7347,2.5085c.7719,.0965,1.3508,.7719,1.2543,1.5437h0l-2.5085,23.7347c0,.6754-.7719,1.2543-1.5437,1.2543l-6.1749-.6754"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
              <path
                d="M32.7799,29.9337l5.3065,.5789c.2894,0,.4824-.193,.5789-.4824,0-.0965,0-.193-.0965-.2894l-5.789-10.5166c-.0965-.193-.4824-.2894-.6754-.193h0l-.3859,.3859"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
