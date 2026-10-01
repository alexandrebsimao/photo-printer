import { describe, expect, it } from 'vitest'
import { cmToMm, inchToMm, mmToPt, mmToPx, pxToMm } from '../src/renderer/src/utils/units'
import { clampPhotoSizeMm, mmToUnit, printPresets, unitToMm } from '../src/renderer/src/utils/print-presets'

describe('unit conversions', () => {
  it('converts millimeters and pixels using DPI', () => {
    expect(mmToPx(100, 300)).toBeCloseTo(1181.102, 2)
    expect(pxToMm(1181.102, 300)).toBeCloseTo(100, 2)
  })

  it('converts physical units', () => {
    expect(cmToMm(10)).toBe(100)
    expect(inchToMm(1)).toBe(25.4)
    expect(mmToPt(25.4)).toBe(72)
  })

  it('converts photo dimensions between display units and millimeters', () => {
    expect(unitToMm(10, 'cm')).toBe(100)
    expect(mmToUnit(25.4, 'in')).toBe(1)
    expect(clampPhotoSizeMm(0)).toBe(1)
    expect(clampPhotoSizeMm(1200)).toBe(1000)
    expect(printPresets).toHaveLength(15)
  })
})
