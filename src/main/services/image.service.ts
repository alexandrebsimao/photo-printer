import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const thumbnailCache = new Map<string, { mtimeMs: number; photo: ImportedPhoto }>()
const previewCache = new Map<string, { mtimeMs: number; dataUrl: string }>()

export interface ImportedPhoto {
  id: string
  path: string
  filename: string
  originalWidth: number
  originalHeight: number
  thumbnailDataUrl: string
  previewDataUrl?: string
}

export interface ImageImportResult {
  photos: ImportedPhoto[]
  errors: string[]
}

export function isSupportedImage(filePath: string) {
  return supportedExtensions.has(path.extname(filePath).toLowerCase())
}

export function filterSupportedImagePaths(value: unknown): string[] {
  return classifyImagePaths(value).acceptedPaths
}

export function classifyImagePaths(value: unknown) {
  if (!Array.isArray(value)) return { acceptedPaths: [], rejectedPaths: [] }

  const candidates = value.filter((candidate): candidate is string => typeof candidate === 'string' && path.isAbsolute(candidate))
  const acceptedPaths = [...new Set(candidates.filter(isSupportedImage))].slice(0, 500)
  const acceptedSet = new Set(acceptedPaths)
  const rejectedPaths = [...new Set(candidates.filter((candidate) => !acceptedSet.has(candidate)))]
  return { acceptedPaths, rejectedPaths }
}

export async function createPreviewDataUrl(filePath: string) {
  if (!isSupportedImage(filePath)) throw new Error(`Unsupported image format: ${path.extname(filePath)}`)
  const fileStat = await stat(filePath)
  const cached = previewCache.get(filePath)
  if (cached && cached.mtimeMs === fileStat.mtimeMs) return cached.dataUrl
  const preview = await sharp(filePath)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer()
  const dataUrl = `data:image/jpeg;base64,${preview.toString('base64')}`
  previewCache.set(filePath, { mtimeMs: fileStat.mtimeMs, dataUrl })
  return dataUrl
}

export async function inspectImage(filePath: string): Promise<ImportedPhoto> {
  if (!isSupportedImage(filePath)) {
    throw new Error(`Unsupported image format: ${path.extname(filePath)}`)
  }

  const fileStat = await stat(filePath)
  const cached = thumbnailCache.get(filePath)
  if (cached && cached.mtimeMs === fileStat.mtimeMs) return cached.photo

  const image = sharp(filePath, { failOn: 'error' })
  const metadata = await image.metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read dimensions for ${path.basename(filePath)}`)
  }

  const isRotatedByExif = metadata.orientation !== undefined && metadata.orientation >= 5
  const width = isRotatedByExif ? metadata.height : metadata.width
  const height = isRotatedByExif ? metadata.width : metadata.height
  const [thumbnail, previewDataUrl] = await Promise.all([
    sharp(filePath)
      .rotate()
      .resize({ width: 180, height: 180, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer(),
    createPreviewDataUrl(filePath)
  ])

  const photo = {
    id: randomUUID(),
    path: filePath,
    filename: path.basename(filePath),
    originalWidth: width,
    originalHeight: height,
    thumbnailDataUrl: `data:image/jpeg;base64,${thumbnail.toString('base64')}`,
    previewDataUrl
  }
  thumbnailCache.set(filePath, { mtimeMs: fileStat.mtimeMs, photo })
  return photo
}

export async function inspectImages(filePaths: string[]): Promise<ImageImportResult> {
  const results: ImportedPhoto[] = []
  const errors: string[] = []
  for (const filePath of filePaths) {
    try {
      results.push(await inspectImage(filePath))
    } catch (error) {
      console.warn('Skipping image:', filePath, error)
      errors.push(`${path.basename(filePath)} não pôde ser importado.`)
    }
  }
  return { photos: results, errors }
}
