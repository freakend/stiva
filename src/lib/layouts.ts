import type { CellRect, PhotoCount, Ratio } from './types'

/**
 * Layout templates per count, normalized 0-1 coordinates.
 * Portrait vs landscape variants so a tall canvas stacks vertically.
 */
const LANDSCAPE: Record<PhotoCount, CellRect[]> = {
  1: [{ x: 0, y: 0, w: 1, h: 1 }],
  2: [
    // two columns, suits wide canvas
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ],
  3: [
    // one large top + two bottom
    { x: 0, y: 0, w: 1, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  4: [
    // 2x2
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  6: [
    // 3 cols x 2 rows
    { x: 0, y: 0, w: 1 / 3, h: 0.5 },
    { x: 1 / 3, y: 0, w: 1 / 3, h: 0.5 },
    { x: 2 / 3, y: 0, w: 1 / 3, h: 0.5 },
    { x: 0, y: 0.5, w: 1 / 3, h: 0.5 },
    { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
  ],
}

const PORTRAIT: Record<PhotoCount, CellRect[]> = {
  1: [{ x: 0, y: 0, w: 1, h: 1 }],
  2: [
    // two rows, suits tall canvas
    { x: 0, y: 0, w: 1, h: 0.5 },
    { x: 0, y: 0.5, w: 1, h: 0.5 },
  ],
  3: [
    // three rows
    { x: 0, y: 0, w: 1, h: 1 / 3 },
    { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
    { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
  ],
  4: [
    // 1 col x 4 rows, vertical stack
    { x: 0, y: 0, w: 1, h: 0.25 },
    { x: 0, y: 0.25, w: 1, h: 0.25 },
    { x: 0, y: 0.5, w: 1, h: 0.25 },
    { x: 0, y: 0.75, w: 1, h: 0.25 },
  ],
  6: [
    // 2 cols x 3 rows
    { x: 0, y: 0, w: 0.5, h: 1 / 3 },
    { x: 0.5, y: 0, w: 0.5, h: 1 / 3 },
    { x: 0, y: 1 / 3, w: 0.5, h: 1 / 3 },
    { x: 0.5, y: 1 / 3, w: 0.5, h: 1 / 3 },
    { x: 0, y: 2 / 3, w: 0.5, h: 1 / 3 },
    { x: 0.5, y: 2 / 3, w: 0.5, h: 1 / 3 },
  ],
}

// kept for backwards compat, defaults to landscape
export const LAYOUTS = LANDSCAPE

export function getLayout(
  count: PhotoCount,
  orientation: import('./types').Orientation | Ratio = 'landscape',
): CellRect[] {
  // support both Orientation string and legacy Ratio object
  if (typeof orientation === 'object' && orientation !== null && 'w' in orientation && 'h' in orientation) {
    const r = orientation as Ratio
    const isPortrait = r.h > r.w
    return (isPortrait ? PORTRAIT : LANDSCAPE)[count]
  }
  const isPortrait = orientation === 'portrait'
  return (isPortrait ? PORTRAIT : LANDSCAPE)[count]
}
