import { describe, expect, it } from 'vitest'
import { buildMaxRectsLayout } from '../src/renderer/src/utils/layout'

describe('layout performance budget', () => {
  it('handles a 500-photo library without invalid placements', () => {
    const photos = Array.from({ length: 500 }, (_, index) => ({
      id: `photo-${index}`,
      path: `/tmp/photo-${index}.jpg`,
      filename: `photo-${index}.jpg`,
      originalWidth: 3000,
      originalHeight: 2000,
      widthMm: 50,
      heightMm: 35,
      quantity: 1,
      crop: { zoom: 1, offsetX: 0, offsetY: 0 },
      rotation: 0,
      fitMode: 'cover' as const
    }))
    const result = buildMaxRectsLayout(photos, {
      format: 'A4',
      widthMm: 210,
      heightMm: 297,
      orientation: 'portrait',
      margins: { topMm: 5, rightMm: 5, bottomMm: 5, leftMm: 5 },
      gapMm: 3,
      dpi: 300,
      cropMarks: { mode: 'none', thicknessMm: 0.2, offsetMm: 2 }
    })
    expect(result.placements).toHaveLength(500)
    expect(result.warnings).toHaveLength(0)
    expect(result.placements.every((placement) => placement.xMm >= 5 && placement.yMm >= 5)).toBe(true)
  })
})
