import type { Ratio } from './types'
import type { CellData } from './types'

const EXPORT_BASE = 3000 // base dimension for export, high-res to preserve original quality

function exportDimensions(ratio: Ratio): { w: number; h: number } {
  if (ratio.w >= ratio.h) {
    const w = EXPORT_BASE
    const h = Math.round((EXPORT_BASE * ratio.h) / ratio.w)
    return { w, h }
  } else {
    const h = EXPORT_BASE
    const w = Math.round((EXPORT_BASE * ratio.w) / ratio.h)
    return { w, h }
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.decoding = 'async'
    // object URLs are same-origin
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('Failed to load image'))
    img.src = url
  })
}

// draw with cover (like object-fit: cover) + pan offset + zoom
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  offsetX = 0,
  offsetY = 0,
  zoom = 1,
) {
  zoom = Math.max(1, zoom)
  const sRatio = img.naturalWidth / img.naturalHeight
  const dRatio = dw / dh
  let sw = img.naturalWidth,
    sh = img.naturalHeight
  if (sRatio > dRatio) {
    sw = sh * dRatio
  } else {
    sh = sw / dRatio
  }
  // apply zoom: shrink source crop
  const swz = sw / zoom
  const shz = sh / zoom
  let sx = (img.naturalWidth - swz) / 2 + offsetX * swz
  let sy = (img.naturalHeight - shz) / 2 + offsetY * shz
  // clamp
  sx = Math.max(0, Math.min(img.naturalWidth - swz, sx))
  sy = Math.max(0, Math.min(img.naturalHeight - shz, sy))
  ctx.drawImage(img, sx, sy, swz, shz, dx, dy, dw, dh)
}

export async function exportPNG(
  cells: CellData[],
  ratio: Ratio,
  bgColor: string,
  gap: number, // gap in px on the export canvas scale (we normalize)
): Promise<Blob> {
  const { w, h } = exportDimensions(ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // bg
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, w, h)

  // gap needs to scale with canvas vs. preview. We used gap as preview gap (px).
  // On export we interpret gap relative to preview size ~ 540. For simplicity, scale by w/540.
  const gapExport = Math.round(gap * (w / 540))

  // pre-load all images
  const loaded: Map<string, HTMLImageElement> = new Map()
  for (const c of cells) {
    if (c.image?.url) {
      try {
        const img = await loadImage(c.image.url)
        loaded.set(c.id, img)
      } catch {
        /* ignore */
      }
    }
  }

  for (const c of cells) {
    const x = Math.round(c.rect.x * w)
    const y = Math.round(c.rect.y * h)
    let cw = Math.round(c.rect.w * w)
    let ch = Math.round(c.rect.h * h)
    // apply gap as inner inset
    const inset = gapExport / 2
    // we render as inset cell with gap gutters: offset by inset, shrink
    // but to keep outer border also gapped, we inset all cells.
    // For shared edges, gap is formed by two half-insets.
    const dx = x + inset
    const dy = y + inset
    cw = Math.max(0, cw - gapExport)
    ch = Math.max(0, ch - gapExport)

    const img = loaded.get(c.id)
    if (img) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(dx, dy, cw, ch)
      ctx.clip()
      drawCover(ctx, img, dx, dy, cw, ch, c.image?.offsetX ?? 0, c.image?.offsetY ?? 0, c.image?.zoom ?? 1)
      ctx.restore()
    } else {
      // empty cell: fill slightly darker bg to show placeholder
      ctx.fillStyle = bgColor === '#F4F1EA' ? '#EDE9E0' : bgColor
      // draw empty with subtle pattern
      ctx.fillRect(dx, dy, cw, ch)
      // dashed hint? we keep it plain for export
    }
  }

  const blob: Blob = await new Promise((res, rej) => {
    canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
  })
  return blob
}

export function dimensionsLabel(ratio: Ratio): string {
  const { w, h } = exportDimensions(ratio)
  return `${w} × ${h}px`
}
