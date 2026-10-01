import { cmToMm, inchToMm } from './units'

export type PhysicalUnit = 'mm' | 'cm' | 'in'

export interface PrintPresetOption {
  id: string
  name: string
  category: 'Fotografia' | 'Scrapbook' | 'Personalizado'
  widthMm: number
  heightMm: number
  defaultQuantity?: number
}

const photoSizes: Array<[string, number, number]> = [
  ['3 × 4 cm', 3, 4], ['5 × 7 cm', 5, 7], ['7 × 10 cm', 7, 10], ['9 × 13 cm', 9, 13],
  ['10 × 15 cm', 10, 15], ['13 × 18 cm', 13, 18], ['15 × 21 cm', 15, 21], ['20 × 25 cm', 20, 25], ['20 × 30 cm', 20, 30]
]

const scrapbookSizes: Array<[string, number]> = [
  ['5 × 5 cm', 5], ['7 × 7 cm', 7], ['10 × 10 cm', 10], ['12 × 12 cm', 12], ['15 × 15 cm', 15], ['20 × 20 cm', 20]
]

export const printPresets: PrintPresetOption[] = [
  ...photoSizes.map(([name, width, height], index) => ({ id: `photo-${index}`, name, category: 'Fotografia' as const, widthMm: cmToMm(width), heightMm: cmToMm(height) })),
  ...scrapbookSizes.map(([name, size], index) => ({ id: `scrapbook-${index}`, name, category: 'Scrapbook' as const, widthMm: cmToMm(size), heightMm: cmToMm(size) }))
]

export const MIN_PHOTO_SIZE_MM = 1
export const MAX_PHOTO_SIZE_MM = 1000

const customPresetStorageKey = 'photo-printer.custom-presets.v1'

export function loadCustomPresets(): PrintPresetOption[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(customPresetStorageKey) ?? '[]') as PrintPresetOption[]
    return Array.isArray(parsed) ? parsed.filter((preset) => preset.category === 'Personalizado') : []
  } catch {
    return []
  }
}

export function saveCustomPresets(presets: PrintPresetOption[]) {
  try { localStorage.setItem(customPresetStorageKey, JSON.stringify(presets)) } catch { /* storage can be unavailable in tests or restricted sessions */ }
}

export function mmToUnit(mm: number, unit: PhysicalUnit) {
  if (unit === 'cm') return mm / 10
  if (unit === 'in') return mm / 25.4
  return mm
}

export function unitToMm(value: number, unit: PhysicalUnit) {
  if (unit === 'cm') return cmToMm(value)
  if (unit === 'in') return inchToMm(value)
  return value
}

export function clampPhotoSizeMm(value: number) {
  return Math.min(MAX_PHOTO_SIZE_MM, Math.max(MIN_PHOTO_SIZE_MM, value))
}
