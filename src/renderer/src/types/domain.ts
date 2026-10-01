export type FitMode = 'cover' | 'contain'
export type SheetFormat = 'A4' | 'A3' | 'A5' | 'LETTER' | 'CUSTOM'
export type Orientation = 'portrait' | 'landscape'
export type CropMarkMode = 'none' | 'corners' | 'full' | 'dashed'

export interface CropConfig {
  zoom: number
  offsetX: number
  offsetY: number
  flipX?: boolean
  flipY?: boolean
}

export interface Photo {
  id: string
  path: string
  filename: string
  originalWidth: number
  originalHeight: number
  widthMm: number
  heightMm: number
  quantity: number
  crop: CropConfig
  rotation: number
  fitMode: FitMode
  thumbnailDataUrl?: string
  previewDataUrl?: string
}

export interface Margins {
  topMm: number
  rightMm: number
  bottomMm: number
  leftMm: number
}

export interface SheetConfig {
  format: SheetFormat
  widthMm: number
  heightMm: number
  orientation: Orientation
  margins: Margins
  gapMm: number
  dpi: number
  cropMarks: {
    mode: CropMarkMode
    thicknessMm: number
    offsetMm: number
  }
}

export interface PhotoPlacement {
  id: string
  photoId: string
  sheetIndex: number
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  rotation: number
}

export interface PrintPreset {
  id: string
  name: string
  widthMm: number
  heightMm: number
  defaultQuantity?: number
}

export interface Project {
  version?: 1
  id: string
  name: string
  photos: Photo[]
  sheet: SheetConfig
  placements: PhotoPlacement[]
  pageCount?: number
  createdAt: string
  updatedAt: string
}
