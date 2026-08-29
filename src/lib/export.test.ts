import { describe, expect, it } from 'vitest'
import { dimensionsLabel } from './export'
import { RATIOS } from './ratios'

describe('export dimensions', () => {
  it('labels square as 3000 × 3000px', () => {
    expect(dimensionsLabel({ id: '1:1', label: '1:1', w: 1, h: 1 })).toBe('3000 × 3000px')
  })

  it('labels 16:9 with long edge 3000', () => {
    expect(dimensionsLabel({ id: '16:9', label: '16:9', w: 16, h: 9 })).toBe('3000 × 1688px')
  })

  it('labels 9:16 portrait with long edge 3000', () => {
    expect(dimensionsLabel({ id: '9:16', label: '9:16', w: 9, h: 16 })).toBe('1688 × 3000px')
  })
})

describe('ratios registry', () => {
  it('has exactly 9 unique ratios', () => {
    expect(RATIOS).toHaveLength(9)
    expect(new Set(RATIOS.map(r => r.id)).size).toBe(9)
  })

  it('every ratio has a matching w/h', () => {
    for (const r of RATIOS) {
      const [w, h] = r.label.split(':').map(Number)
      expect(r.w).toBe(w)
      expect(r.h).toBe(h)
    }
  })

  it('contains the common ratios', () => {
    const ids = RATIOS.map(r => r.id)
    expect(ids).toEqual(expect.arrayContaining(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '4:5', '5:4']))
  })
})
