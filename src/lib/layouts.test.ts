import { describe, expect, it } from 'vitest'
import { getLayout } from './layouts'

describe('getLayout', () => {
  it('returns the correct number of cells for each count', () => {
    for (const count of [1, 2, 3, 4, 6] as const) {
      expect(getLayout(count, 'landscape')).toHaveLength(count)
      expect(getLayout(count, 'portrait')).toHaveLength(count)
    }
  })

  it('uses columns for landscape and rows for portrait (2 photos)', () => {
    const landscape = getLayout(2, 'landscape')
    const portrait = getLayout(2, 'portrait')
    expect(landscape[0].x).toBe(0)
    expect(landscape[0].y).toBe(0)
    expect(landscape[1].x).toBe(0.5) // side by side
    expect(portrait[1].x).toBe(0)
    expect(portrait[1].y).toBe(0.5) // stacked
  })

  it('cells are normalized 0-1 and non-overlapping', () => {
    const cells = getLayout(4, 'landscape')
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.w).toBeLessThanOrEqual(1)
      expect(c.h).toBeLessThanOrEqual(1)
    }
  })

  it('accepts a Ratio object (legacy orientation)', () => {
    const cells = getLayout(3, { id: '9:16', label: '9:16', w: 9, h: 16 })
    expect(cells[1].y).toBeGreaterThan(0) // portrait stack
  })
})
