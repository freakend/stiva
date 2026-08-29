import type { Ratio, RatioId } from './types'

export const RATIOS: Ratio[] = [
  { id: '1:1', label: '1:1', w: 1, h: 1 },
  { id: '4:3', label: '4:3', w: 4, h: 3 },
  { id: '3:4', label: '3:4', w: 3, h: 4 },
  { id: '16:9', label: '16:9', w: 16, h: 9 },
  { id: '9:16', label: '9:16', w: 9, h: 16 },
  { id: '3:2', label: '3:2', w: 3, h: 2 },
  { id: '2:3', label: '2:3', w: 2, h: 3 },
  { id: '4:5', label: '4:5', w: 4, h: 5 },
  { id: '5:4', label: '5:4', w: 5, h: 4 },
]

export const RATIO_MAP: Record<RatioId, Ratio> = Object.fromEntries(RATIOS.map(r => [r.id, r])) as Record<
  RatioId,
  Ratio
>

export function effectiveRatio(ratio: Ratio, orientation: 'portrait' | 'landscape') {
  // keep 1:1 unchanged
  if (ratio.w === ratio.h) return ratio
  const isLandscape = ratio.w > ratio.h
  if (orientation === 'landscape' && !isLandscape) return { ...ratio, w: ratio.h, h: ratio.w }
  if (orientation === 'portrait' && isLandscape) return { ...ratio, w: ratio.h, h: ratio.w }
  return ratio
}
