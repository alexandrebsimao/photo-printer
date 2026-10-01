import { create } from 'zustand'
import type { Photo, PhotoPlacement, Project, SheetConfig } from '../types/domain'
import { buildMaxRectsLayout } from '../utils/layout'

const defaultSheet: SheetConfig = {
  format: 'A4',
  widthMm: 210,
  heightMm: 297,
  orientation: 'portrait',
  margins: { topMm: 5, rightMm: 5, bottomMm: 5, leftMm: 5 },
  gapMm: 3,
  dpi: 300
  ,cropMarks: { mode: 'none', thicknessMm: 0.2, offsetMm: 2 }
}

interface ImportedPhoto {
  id: string
  path: string
  filename: string
  originalWidth: number
  originalHeight: number
  thumbnailDataUrl: string
  previewDataUrl?: string
}

interface AppState {
  activeTool: 'select' | 'add'
  photos: Photo[]
  placements: PhotoPlacement[]
  pageCount: number
  layoutWarnings: string[]
  sheet: SheetConfig
  selectedPhotoId: string | null
  previewZoom: number
  projectId: string
  projectName: string
  projectPath: string | null
  createdAt: string
  updatedAt: string
  addImportedPhotos: (photos: ImportedPhoto[]) => void
  removePhoto: (photoId: string) => void
  updatePhoto: (photoId: string, patch: Partial<Photo>) => void
  setPhotoPreview: (photoId: string, previewDataUrl: string) => void
  setSheet: (patch: Partial<SheetConfig>) => void
  autoLayout: () => void
  addPage: () => void
  removePage: (pageIndex: number) => void
  insertPhotoOnPage: (photoId: string, pageIndex: number) => boolean
  removePlacement: (placementId: string) => void
  updatePlacement: (placementId: string, patch: Partial<PhotoPlacement>) => void
  setPlacementPosition: (placementId: string, xMm: number, yMm: number) => void
  previewPlacementPosition: (placementId: string, xMm: number, yMm: number) => void
  previewPlacementSize: (placementId: string, patch: Partial<Pick<PhotoPlacement, 'xMm' | 'yMm' | 'widthMm' | 'heightMm'>>) => void
  commitPlacementChange: (placementId: string, before: PhotoPlacement) => void
  rotatePlacement: (placementId: string) => void
  movePlacementToSheet: (placementId: string, sheetIndex: number) => void
  getProject: () => Project
  loadProject: (project: Project, projectPath?: string) => void
  setProjectName: (projectName: string) => void
  setProjectPath: (projectPath: string | null) => void
  undoStack: DocumentSnapshot[]
  redoStack: DocumentSnapshot[]
  undo: () => void
  redo: () => void
  setActiveTool: (activeTool: AppState['activeTool']) => void
  selectPhoto: (selectedPhotoId: string | null) => void
  setPreviewZoom: (previewZoom: number) => void
}

type DocumentSnapshot = Pick<AppState, 'photos' | 'placements' | 'pageCount' | 'layoutWarnings' | 'sheet' | 'projectName' | 'updatedAt'>

export const useAppStore = create<AppState>((set, get) => {
  const snapshot = (state: AppState): DocumentSnapshot => ({ photos: state.photos, placements: state.placements, pageCount: state.pageCount, layoutWarnings: state.layoutWarnings, sheet: state.sheet, projectName: state.projectName, updatedAt: state.updatedAt })
  const pageSize = (sheet: SheetConfig) => sheet.orientation === 'portrait'
    ? { width: sheet.widthMm, height: sheet.heightMm }
    : { width: sheet.heightMm, height: sheet.widthMm }
  const constrainPlacement = (state: AppState, placement: PhotoPlacement, patch: Partial<PhotoPlacement>) => {
    const size = pageSize(state.sheet)
    const widthMm = Math.max(5, Math.min(size.width - state.sheet.margins.leftMm - state.sheet.margins.rightMm, patch.widthMm ?? placement.widthMm))
    const heightMm = Math.max(5, Math.min(size.height - state.sheet.margins.topMm - state.sheet.margins.bottomMm, patch.heightMm ?? placement.heightMm))
    const xMm = Math.max(state.sheet.margins.leftMm, Math.min(size.width - state.sheet.margins.rightMm - widthMm, patch.xMm ?? placement.xMm))
    const yMm = Math.max(state.sheet.margins.topMm, Math.min(size.height - state.sheet.margins.bottomMm - heightMm, patch.yMm ?? placement.yMm))
    return { ...placement, ...patch, xMm, yMm, widthMm, heightMm }
  }
  const snapPosition = (state: AppState, placement: PhotoPlacement, xMm: number, yMm: number) => {
    const size = pageSize(state.sheet)
    const left = state.sheet.margins.leftMm
    const top = state.sheet.margins.topMm
    const right = size.width - state.sheet.margins.rightMm - placement.widthMm
    const bottom = size.height - state.sheet.margins.bottomMm - placement.heightMm
    const samePage = state.placements.filter((item) => item.sheetIndex === placement.sheetIndex && item.id !== placement.id)
    const snap = (value: number, candidates: number[]) => candidates.find((candidate) => Math.abs(candidate - value) <= 2) ?? value
    const xCandidates = [left, right, ...samePage.flatMap((item) => [item.xMm, item.xMm + item.widthMm, item.xMm + (item.widthMm - placement.widthMm) / 2])]
    const yCandidates = [top, bottom, ...samePage.flatMap((item) => [item.yMm, item.yMm + item.heightMm, item.yMm + (item.heightMm - placement.heightMm) / 2])]
    return constrainPlacement(state, placement, { xMm: Math.max(left, Math.min(right, snap(xMm, xCandidates))), yMm: Math.max(top, Math.min(bottom, snap(yMm, yCandidates))) })
  }
  const defaultPhotoSize = (width: number, height: number) => {
    if (width > height * 1.05) return { widthMm: 150, heightMm: 100 }
    if (height > width * 1.05) return { widthMm: 100, heightMm: 150 }
    return { widthMm: 100, heightMm: 100 }
  }
  const recordChange = (updater: (state: AppState) => Partial<AppState>) => {
    const before = snapshot(get())
    set((state) => ({ ...updater(state), undoStack: [...state.undoStack, before].slice(-100), redoStack: [], updatedAt: new Date().toISOString() }))
  }
  return ({
  activeTool: 'select',
  photos: [],
  placements: [],
  pageCount: 1,
  layoutWarnings: [],
  sheet: defaultSheet,
  selectedPhotoId: null,
  previewZoom: 1,
  projectId: globalThis.crypto.randomUUID(),
  projectName: 'Meu projeto',
  projectPath: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  undoStack: [],
  redoStack: [],
  undo: () => {
    const state = get()
    const previous = state.undoStack.at(-1)
    if (!previous) return
    set({ ...previous, undoStack: state.undoStack.slice(0, -1), redoStack: [...state.redoStack, snapshot(state)].slice(-100) })
  },
  redo: () => {
    const state = get()
    const next = state.redoStack.at(-1)
    if (!next) return
    set({ ...next, redoStack: state.redoStack.slice(0, -1), undoStack: [...state.undoStack, snapshot(state)].slice(-100) })
  },
  addImportedPhotos: (importedPhotos) => {
    recordChange((state) => ({
      photos: [
        ...state.photos,
        ...importedPhotos
          .filter((photo, index, candidates) => (
            !state.photos.some((existing) => existing.path === photo.path) &&
            candidates.findIndex((candidate) => candidate.path === photo.path) === index
          ))
          .map((photo) => ({
          ...photo,
          ...defaultPhotoSize(photo.originalWidth, photo.originalHeight),
          quantity: 1,
          crop: { zoom: 1, offsetX: 0, offsetY: 0 },
          rotation: 0,
          fitMode: 'contain' as const
          }))
      ]
    }))
  },
  removePhoto: (photoId) => {
    recordChange((state) => ({
      photos: state.photos.filter((photo) => photo.id !== photoId),
      placements: state.placements.filter((placement) => placement.photoId !== photoId),
      selectedPhotoId: state.selectedPhotoId === photoId ? null : state.selectedPhotoId
    }))
  },
  updatePhoto: (photoId, patch) => {
    recordChange((state) => {
      const currentPhoto = state.photos.find((photo) => photo.id === photoId)
      if (!currentPhoto) return {}
      const nextPhoto = { ...currentPhoto, ...patch }
      const rotationDelta = patch.rotation === undefined ? 0 : patch.rotation - currentPhoto.rotation
      const sizeChanged = patch.widthMm !== undefined || patch.heightMm !== undefined
      return {
        photos: state.photos.map((photo) => photo.id === photoId ? nextPhoto : photo),
        placements: state.placements.map((placement) => {
          if (placement.photoId !== photoId) return placement
          const resized = sizeChanged ? constrainPlacement(state, placement, { widthMm: nextPhoto.widthMm, heightMm: nextPhoto.heightMm }) : placement
          return rotationDelta === 0 ? resized : { ...resized, rotation: (resized.rotation + rotationDelta + 360) % 360 }
        })
      }
    })
  },
  setPhotoPreview: (photoId, previewDataUrl) => set((state) => ({ photos: state.photos.map((photo) => photo.id === photoId ? { ...photo, previewDataUrl } : photo) })),
  setSheet: (patch) => {
    recordChange((state) => ({ sheet: { ...state.sheet, ...patch } }))
  },
  autoLayout: () => {
    const { photos, sheet } = get()
    const result = buildMaxRectsLayout(photos, sheet)
    set({ placements: result.placements, pageCount: Math.max(1, ...result.placements.map((placement) => placement.sheetIndex + 1)), layoutWarnings: result.warnings })
  },
  addPage: () => recordChange((state) => ({ pageCount: state.pageCount + 1 })),
  removePage: (pageIndex) => {
    const state = get()
    if (state.pageCount <= 1 || pageIndex < 0 || pageIndex >= state.pageCount) return
    recordChange(() => ({
      pageCount: state.pageCount - 1,
      placements: state.placements
        .filter((placement) => placement.sheetIndex !== pageIndex)
        .map((placement) => placement.sheetIndex > pageIndex ? { ...placement, sheetIndex: placement.sheetIndex - 1 } : placement)
    }))
  },
  insertPhotoOnPage: (photoId, pageIndex) => {
    const state = get()
    const photo = state.photos.find((item) => item.id === photoId)
    if (!photo || pageIndex < 0 || pageIndex >= state.pageCount) return false
    const size = pageSize(state.sheet)
    const left = state.sheet.margins.leftMm
    const top = state.sheet.margins.topMm
    const right = size.width - state.sheet.margins.rightMm
    const bottom = size.height - state.sheet.margins.bottomMm
    const occupied = state.placements.filter((placement) => placement.sheetIndex === pageIndex)
    const template = [...occupied].reverse().find((placement) => placement.photoId === photoId)
    const source = template
      ? { widthMm: template.widthMm, heightMm: template.heightMm, rotation: template.rotation }
      : { widthMm: photo.widthMm, heightMm: photo.heightMm, rotation: photo.rotation }
    const candidates = [source, { widthMm: source.heightMm, heightMm: source.widthMm, rotation: source.rotation + 90 }]
    const overlaps = (xMm: number, yMm: number, widthMm: number, heightMm: number) => occupied.some((placement) => xMm < placement.xMm + placement.widthMm + state.sheet.gapMm && xMm + widthMm + state.sheet.gapMm > placement.xMm && yMm < placement.yMm + placement.heightMm + state.sheet.gapMm && yMm + heightMm + state.sheet.gapMm > placement.yMm)
    for (const candidate of candidates) {
      if (candidate.widthMm > right - left || candidate.heightMm > bottom - top) continue
      const clampPosition = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
      const xPositions = new Set<number>([left, right - candidate.widthMm])
      const yPositions = new Set<number>([top, bottom - candidate.heightMm])
      for (const placement of occupied) {
        xPositions.add(clampPosition(placement.xMm + placement.widthMm + state.sheet.gapMm, left, right - candidate.widthMm))
        xPositions.add(clampPosition(placement.xMm - candidate.widthMm - state.sheet.gapMm, left, right - candidate.widthMm))
        yPositions.add(clampPosition(placement.yMm + placement.heightMm + state.sheet.gapMm, top, bottom - candidate.heightMm))
        yPositions.add(clampPosition(placement.yMm - candidate.heightMm - state.sheet.gapMm, top, bottom - candidate.heightMm))
      }
      for (const yMm of [...yPositions].sort((first, second) => first - second)) {
        for (const xMm of [...xPositions].sort((first, second) => first - second)) {
          if (overlaps(xMm, yMm, candidate.widthMm, candidate.heightMm)) continue
          recordChange(() => ({ placements: [...state.placements, { id: globalThis.crypto.randomUUID(), photoId, sheetIndex: pageIndex, xMm, yMm, widthMm: candidate.widthMm, heightMm: candidate.heightMm, rotation: candidate.rotation }] }))
          return true
        }
      }
    }
    return false
  },
  removePlacement: (placementId) => recordChange((state) => ({ placements: state.placements.filter((placement) => placement.id !== placementId) })),
  updatePlacement: (placementId, patch) => recordChange((state) => ({ placements: state.placements.map((placement) => placement.id === placementId ? constrainPlacement(state, placement, patch) : placement) })),
  setPlacementPosition: (placementId, xMm, yMm) => {
    const state = get()
    const placement = state.placements.find((item) => item.id === placementId)
    if (!placement) return
    const next = snapPosition(state, placement, xMm, yMm)
    recordChange(() => ({ placements: state.placements.map((item) => item.id === placementId ? next : item) }))
  },
  previewPlacementPosition: (placementId, xMm, yMm) => {
    const state = get()
    const placement = state.placements.find((item) => item.id === placementId)
    if (!placement) return
    const next = snapPosition(state, placement, xMm, yMm)
    set({ placements: state.placements.map((item) => item.id === placementId ? next : item) })
  },
  previewPlacementSize: (placementId, patch) => {
    const state = get()
    set({ placements: state.placements.map((placement) => placement.id === placementId ? constrainPlacement(state, placement, patch) : placement) })
  },
  commitPlacementChange: (placementId, before) => {
    const state = get()
    const current = state.placements.find((placement) => placement.id === placementId)
    if (!current || JSON.stringify(current) === JSON.stringify(before)) return
    const beforePlacements = state.placements.map((placement) => placement.id === placementId ? before : placement)
    set({ undoStack: [...state.undoStack, snapshot({ ...state, placements: beforePlacements })].slice(-100), redoStack: [], updatedAt: new Date().toISOString() })
  },
  rotatePlacement: (placementId) => recordChange((state) => ({ placements: state.placements.map((placement) => placement.id === placementId ? constrainPlacement(state, placement, { rotation: (placement.rotation + 90) % 360, widthMm: placement.heightMm, heightMm: placement.widthMm }) : placement) })),
  movePlacementToSheet: (placementId, sheetIndex) => recordChange((state) => ({ placements: state.placements.map((placement) => placement.id === placementId ? { ...placement, sheetIndex: Math.max(0, Math.min(state.pageCount - 1, sheetIndex)) } : placement) })),
  getProject: () => {
    const state = get()
    return { version: 1, id: state.projectId, name: state.projectName, photos: state.photos, sheet: state.sheet, placements: state.placements, pageCount: state.pageCount, createdAt: state.createdAt, updatedAt: state.updatedAt }
  },
  loadProject: (project, projectPath?: string | null) => {
    const migratedSheet: SheetConfig = { ...defaultSheet, ...project.sheet, margins: { ...defaultSheet.margins, ...project.sheet.margins }, cropMarks: { ...defaultSheet.cropMarks, ...project.sheet.cropMarks } }
    const migratedPhotoIds = new Set<string>()
    const photos = project.photos.map((photo) => {
      const defaultSize = defaultPhotoSize(photo.originalWidth, photo.originalHeight)
      if (photo.widthMm === 100 && photo.heightMm === 150 && (defaultSize.widthMm !== photo.widthMm || defaultSize.heightMm !== photo.heightMm)) {
        migratedPhotoIds.add(photo.id)
        return { ...photo, ...defaultSize }
      }
      return photo
    })
    const placements = project.placements.map((placement) => migratedPhotoIds.has(placement.photoId) && placement.widthMm === 100 && placement.heightMm === 150
      ? { ...placement, widthMm: 150, heightMm: 100 }
      : placement)
    const placementPageCount = Math.max(0, ...placements.map((placement) => placement.sheetIndex + 1))
    set({ projectId: project.id, projectName: project.name, projectPath: projectPath ?? null, photos, sheet: migratedSheet, placements, pageCount: Math.max(1, project.pageCount ?? 1, placementPageCount), layoutWarnings: [], selectedPhotoId: null, createdAt: project.createdAt, updatedAt: project.updatedAt, undoStack: [], redoStack: [] })
  },
  setProjectName: (projectName) => recordChange(() => ({ projectName })),
  setProjectPath: (projectPath) => set({ projectPath }),
  setActiveTool: (activeTool) => set({ activeTool }),
  selectPhoto: (selectedPhotoId) => set({ selectedPhotoId }),
  setPreviewZoom: (previewZoom) => set({ previewZoom: Math.max(0.5, Math.min(2, previewZoom)) })
  })
})
