import type { Photo, PhotoPlacement, SheetConfig } from '../types/domain'

interface Rect { x: number; y: number; width: number; height: number }
interface LayoutResult { placements: PhotoPlacement[]; warnings: string[] }

function pageSize(sheet: SheetConfig) {
  return sheet.orientation === 'portrait'
    ? { width: sheet.widthMm, height: sheet.heightMm }
    : { width: sheet.heightMm, height: sheet.widthMm }
}

function expandedPhotos(photos: Photo[]) {
  return photos.flatMap((photo) => Array.from({ length: Math.max(0, photo.quantity) }, (_, copy) => ({ photo, copy })))
}

function fits(rect: Rect, width: number, height: number) {
  return width <= rect.width + 0.0001 && height <= rect.height + 0.0001
}

function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function addPlacement(placements: PhotoPlacement[], photo: Photo, copy: number, sheetIndex: number, rect: Rect, rotation: number) {
  placements.push({ id: `${photo.id}-${copy}-${sheetIndex}`, photoId: photo.id, sheetIndex, xMm: rect.x, yMm: rect.y, widthMm: rect.width, heightMm: rect.height, rotation })
}

export function buildShelfLayout(photos: Photo[], sheet: SheetConfig): LayoutResult {
  const size = pageSize(sheet)
  const left = sheet.margins.leftMm
  const top = sheet.margins.topMm
  const right = size.width - sheet.margins.rightMm
  const bottom = size.height - sheet.margins.bottomMm
  const placements: PhotoPlacement[] = []
  const warnings: string[] = []
  let x = left
  let y = top
  let rowHeight = 0
  let sheetIndex = 0

  for (const { photo, copy } of expandedPhotos(photos)) {
    const options = [{ width: photo.widthMm, height: photo.heightMm, rotation: photo.rotation }, { width: photo.heightMm, height: photo.widthMm, rotation: photo.rotation + 90 }]
    const option = options.find((candidate) => candidate.width <= right - left && candidate.height <= bottom - top)
    if (!option) {
      warnings.push(`${photo.filename}: tamanho maior que a área útil da folha.`)
      continue
    }
    if (x > left && x + option.width > right) { x = left; y += rowHeight + sheet.gapMm; rowHeight = 0 }
    if (y > top && y + option.height > bottom) { sheetIndex += 1; x = left; y = top; rowHeight = 0 }
    if (x + option.width > right || y + option.height > bottom) {
      sheetIndex += 1; x = left; y = top; rowHeight = 0
    }
    addPlacement(placements, photo, copy, sheetIndex, { x, y, width: option.width, height: option.height }, option.rotation)
    x += option.width + sheet.gapMm
    rowHeight = Math.max(rowHeight, option.height)
  }
  return { placements, warnings }
}

export function buildMaxRectsLayout(photos: Photo[], sheet: SheetConfig): LayoutResult {
  const size = pageSize(sheet)
  const printable: Rect = { x: sheet.margins.leftMm, y: sheet.margins.topMm, width: size.width - sheet.margins.leftMm - sheet.margins.rightMm, height: size.height - sheet.margins.topMm - sheet.margins.bottomMm }
  const placements: PhotoPlacement[] = []
  const warnings: string[] = []
  const pages: Rect[][] = []
  const items = expandedPhotos(photos).sort((a, b) => (b.photo.widthMm * b.photo.heightMm) - (a.photo.widthMm * a.photo.heightMm))

  const createPage = () => { pages.push([{ ...printable }]); return pages.length - 1 }
  for (const { photo, copy } of items) {
    let best: { pageIndex: number; freeIndex: number; width: number; height: number; rotation: number; short: number; long: number } | null = null
    const options = [{ width: photo.widthMm, height: photo.heightMm, rotation: photo.rotation }, { width: photo.heightMm, height: photo.widthMm, rotation: photo.rotation + 90 }]
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      pages[pageIndex].forEach((free, freeIndex) => options.forEach((option) => {
        const reservedWidth = option.width + sheet.gapMm
        const reservedHeight = option.height + sheet.gapMm
        if (!fits(free, reservedWidth, reservedHeight)) return
        const leftoverHorizontal = free.width - reservedWidth
        const leftoverVertical = free.height - reservedHeight
        const short = Math.min(leftoverHorizontal, leftoverVertical)
        const long = Math.max(leftoverHorizontal, leftoverVertical)
        if (!best || short < best.short || (short === best.short && long < best.long)) best = { pageIndex, freeIndex, ...option, short, long }
      }))
    }
    if (!best) {
      if (photo.widthMm > printable.width && photo.heightMm > printable.height && photo.heightMm > printable.width && photo.widthMm > printable.height) {
        warnings.push(`${photo.filename}: tamanho maior que a área útil da folha.`)
        continue
      }
      const pageIndex = createPage()
      const free = pages[pageIndex][0]
      const option = options.find((candidate) => fits(free, candidate.width + sheet.gapMm, candidate.height + sheet.gapMm))
      if (!option) { warnings.push(`${photo.filename}: não foi possível posicionar a cópia.`); continue }
      best = { pageIndex, freeIndex: 0, ...option, short: 0, long: 0 }
    }

    const freeRects = pages[best.pageIndex]
    const free = freeRects[best.freeIndex]
    const placed: Rect = { x: free.x, y: free.y, width: best.width, height: best.height }
    const reserved: Rect = { ...placed, width: best.width + sheet.gapMm, height: best.height + sheet.gapMm }
    const nextFree: Rect[] = []
    for (const current of freeRects) {
      if (!intersects(current, reserved)) { nextFree.push(current); continue }
      if (reserved.x > current.x) nextFree.push({ x: current.x, y: current.y, width: reserved.x - current.x, height: current.height })
      if (reserved.x + reserved.width < current.x + current.width) nextFree.push({ x: reserved.x + reserved.width, y: current.y, width: current.x + current.width - reserved.x - reserved.width, height: current.height })
      if (reserved.y > current.y) nextFree.push({ x: current.x, y: current.y, width: current.width, height: reserved.y - current.y })
      if (reserved.y + reserved.height < current.y + current.height) nextFree.push({ x: current.x, y: reserved.y + reserved.height, width: current.width, height: current.y + current.height - reserved.y - reserved.height })
    }
    pages[best.pageIndex] = nextFree.filter((rect, index, all) => rect.width > 0 && rect.height > 0 && !all.some((other, otherIndex) => index !== otherIndex && other.x <= rect.x && other.y <= rect.y && other.x + other.width >= rect.x + rect.width && other.y + other.height >= rect.y + rect.height))
    addPlacement(placements, photo, copy, best.pageIndex, placed, best.rotation)
  }
  return { placements, warnings }
}
