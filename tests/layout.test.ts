import { describe, expect, it } from 'vitest'
import { useAppStore } from '../src/renderer/src/stores/app.store'
import { buildMaxRectsLayout, buildShelfLayout } from '../src/renderer/src/utils/layout'

describe('shelf layout', () => {
  it('creates copies without overlap and keeps them inside the printable area', () => {
    useAppStore.setState({
      photos: [{
        id: 'photo-1', path: '/tmp/photo.jpg', filename: 'photo.jpg', originalWidth: 1000, originalHeight: 1000,
        widthMm: 50, heightMm: 50, quantity: 20, crop: { zoom: 1, offsetX: 0, offsetY: 0 }, rotation: 0, fitMode: 'cover'
      }],
      placements: [],
      pageCount: 1
    })
    useAppStore.getState().autoLayout()

    const { placements, sheet } = useAppStore.getState()
    expect(placements).toHaveLength(20)

    for (const placement of placements) {
      const pageWidth = sheet.orientation === 'portrait' ? sheet.widthMm : sheet.heightMm
      const pageHeight = sheet.orientation === 'portrait' ? sheet.heightMm : sheet.widthMm
      expect(placement.xMm).toBeGreaterThanOrEqual(sheet.margins.leftMm)
      expect(placement.yMm).toBeGreaterThanOrEqual(sheet.margins.topMm)
      expect(placement.xMm + placement.widthMm).toBeLessThanOrEqual(pageWidth - sheet.margins.rightMm)
      expect(placement.yMm + placement.heightMm).toBeLessThanOrEqual(pageHeight - sheet.margins.bottomMm)
    }

    for (let index = 0; index < placements.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < placements.length; otherIndex += 1) {
        const first = placements[index]
        const second = placements[otherIndex]
        if (first.sheetIndex !== second.sheetIndex) continue
        const overlaps = first.xMm < second.xMm + second.widthMm && first.xMm + first.widthMm > second.xMm && first.yMm < second.yMm + second.heightMm && first.yMm + first.heightMm > second.yMm
        expect(overlaps).toBe(false)
      }
    }
  })

  it('does not add the same imported path twice', () => {
    useAppStore.setState({ photos: [], placements: [], pageCount: 1 })
    useAppStore.getState().addImportedPhotos([
      { id: 'one', path: '/tmp/same.jpg', filename: 'same.jpg', originalWidth: 100, originalHeight: 100, thumbnailDataUrl: 'data:image/jpeg;base64,' },
      { id: 'two', path: '/tmp/same.jpg', filename: 'same.jpg', originalWidth: 100, originalHeight: 100, thumbnailDataUrl: 'data:image/jpeg;base64,' }
    ])
    expect(useAppStore.getState().photos).toHaveLength(1)
  })

  it('uses the source orientation for the initial physical frame', () => {
    useAppStore.setState({ photos: [], placements: [], pageCount: 1, undoStack: [], redoStack: [] })
    useAppStore.getState().addImportedPhotos([
      { id: 'landscape', path: '/tmp/landscape.jpg', filename: 'landscape.jpg', originalWidth: 1600, originalHeight: 900, thumbnailDataUrl: 'data:image/jpeg;base64,' }
    ])
    const photo = useAppStore.getState().photos[0]
    expect(photo.widthMm).toBe(150)
    expect(photo.heightMm).toBe(100)
    expect(useAppStore.getState().placements).toHaveLength(0)
    expect(useAppStore.getState().insertPhotoOnPage('landscape', 0)).toBe(true)
    expect(useAppStore.getState().placements[0]).toMatchObject({ widthMm: 150, heightMm: 100, sheetIndex: 0 })
  })

  it('keeps imported photos in the library until they are inserted on a page', () => {
    useAppStore.setState({ photos: [], placements: [], pageCount: 1, undoStack: [], redoStack: [] })
    useAppStore.getState().addImportedPhotos([
      { id: 'manual', path: '/tmp/manual.jpg', filename: 'manual.jpg', originalWidth: 100, originalHeight: 100, thumbnailDataUrl: 'data:image/jpeg;base64,' }
    ])

    expect(useAppStore.getState().placements).toHaveLength(0)
    useAppStore.getState().addPage()
    expect(useAppStore.getState().pageCount).toBe(2)
    expect(useAppStore.getState().insertPhotoOnPage('manual', 1)).toBe(true)
    expect(useAppStore.getState().placements[0].sheetIndex).toBe(1)
    const placementId = useAppStore.getState().placements[0].id
    useAppStore.getState().removePlacement(placementId)
    expect(useAppStore.getState().placements).toHaveLength(0)
  })

  it('does not auto-place photos when their settings or the sheet change', () => {
    useAppStore.setState({ photos: [], placements: [], pageCount: 1, undoStack: [], redoStack: [] })
    useAppStore.getState().addImportedPhotos([
      { id: 'settings', path: '/tmp/settings.jpg', filename: 'settings.jpg', originalWidth: 100, originalHeight: 100, thumbnailDataUrl: 'data:image/jpeg;base64,' }
    ])

    useAppStore.getState().updatePhoto('settings', { widthMm: 80, heightMm: 80, quantity: 4 })
    useAppStore.getState().setSheet({ orientation: 'landscape' })
    expect(useAppStore.getState().placements).toHaveLength(0)
  })

  it('uses the resized placement as the template for the next copy', () => {
    useAppStore.setState({ photos: [], placements: [], pageCount: 1, undoStack: [], redoStack: [] })
    useAppStore.getState().addImportedPhotos([
      { id: 'resized', path: '/tmp/resized.jpg', filename: 'resized.jpg', originalWidth: 100, originalHeight: 100, thumbnailDataUrl: 'data:image/jpeg;base64,' }
    ])
    expect(useAppStore.getState().insertPhotoOnPage('resized', 0)).toBe(true)
    const firstPlacement = useAppStore.getState().placements[0]
    useAppStore.getState().updatePlacement(firstPlacement.id, { widthMm: 40, heightMm: 40 })
    expect(useAppStore.getState().insertPhotoOnPage('resized', 0)).toBe(true)
    expect(useAppStore.getState().placements[1]).toMatchObject({ widthMm: 40, heightMm: 40 })
  })

  it('updates existing placements when the photo orientation changes', () => {
    useAppStore.setState({ photos: [], placements: [], pageCount: 1, undoStack: [], redoStack: [] })
    useAppStore.getState().addImportedPhotos([
      { id: 'rotate-existing', path: '/tmp/rotate-existing.jpg', filename: 'rotate-existing.jpg', originalWidth: 100, originalHeight: 100, thumbnailDataUrl: 'data:image/jpeg;base64,' }
    ])
    expect(useAppStore.getState().insertPhotoOnPage('rotate-existing', 0)).toBe(true)
    useAppStore.getState().updatePhoto('rotate-existing', { rotation: 90 })
    expect(useAppStore.getState().placements[0].rotation).toBe(90)
  })

  it('undoes and redoes document changes', () => {
    useAppStore.setState({ photos: [], placements: [], pageCount: 1, undoStack: [], redoStack: [] })
    const store = useAppStore.getState()
    store.addImportedPhotos([{ id: 'history', path: '/tmp/history.jpg', filename: 'history.jpg', originalWidth: 100, originalHeight: 100, thumbnailDataUrl: 'data:image/jpeg;base64,' }])
    expect(useAppStore.getState().photos).toHaveLength(1)
    useAppStore.getState().undo()
    expect(useAppStore.getState().photos).toHaveLength(0)
    useAppStore.getState().redo()
    expect(useAppStore.getState().photos).toHaveLength(1)
  })

  it('keeps MaxRects no worse than shelf for a mixed-size set', () => {
    const photos = [
      { id: 'wide', path: '/tmp/wide.jpg', filename: 'wide.jpg', originalWidth: 100, originalHeight: 50, widthMm: 90, heightMm: 40, quantity: 3, crop: { zoom: 1, offsetX: 0, offsetY: 0 }, rotation: 0, fitMode: 'cover' as const },
      { id: 'square', path: '/tmp/square.jpg', filename: 'square.jpg', originalWidth: 100, originalHeight: 100, widthMm: 50, heightMm: 50, quantity: 6, crop: { zoom: 1, offsetX: 0, offsetY: 0 }, rotation: 0, fitMode: 'cover' as const }
    ]
    const sheet = useAppStore.getState().sheet
    const shelf = buildShelfLayout(photos, sheet)
    const maxRects = buildMaxRectsLayout(photos, sheet)
    const shelfPages = Math.max(-1, ...shelf.placements.map((placement) => placement.sheetIndex))
    const maxRectsPages = Math.max(-1, ...maxRects.placements.map((placement) => placement.sheetIndex))
    expect(maxRectsPages).toBeLessThanOrEqual(shelfPages)
  })
})
