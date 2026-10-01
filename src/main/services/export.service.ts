import { writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { isSupportedImage } from './image.service'

const mmToPt = (mm: number) => (mm / 25.4) * 72
const mmToPx = (mm: number, dpi: number) => Math.max(1, Math.ceil((mm / 25.4) * dpi))

export interface PdfExportPayload {
  sheet: {
    widthMm: number
    heightMm: number
    orientation: 'portrait' | 'landscape'
    dpi: number
    cropMarks?: { mode: 'none' | 'corners' | 'full' | 'dashed'; thicknessMm: number; offsetMm: number }
  }
  photos: Array<{
    id: string
    path: string
    crop: { zoom: number; offsetX: number; offsetY: number; flipX?: boolean; flipY?: boolean }
    rotation: number
    fitMode: 'cover' | 'contain'
  }>
  placements: Array<{
    photoId: string
    sheetIndex: number
    xMm: number
    yMm: number
    widthMm: number
    heightMm: number
    rotation: number
  }>
}

function pageDimensions(payload: PdfExportPayload) {
  return payload.sheet.orientation === 'portrait'
    ? { widthMm: payload.sheet.widthMm, heightMm: payload.sheet.heightMm }
    : { widthMm: payload.sheet.heightMm, heightMm: payload.sheet.widthMm }
}

function drawCropMarks(page: import('pdf-lib').PDFPage, placement: PdfExportPayload['placements'][number], payload: PdfExportPayload, pageHeightPt: number) {
  const marks = payload.sheet.cropMarks
  if (!marks || marks.mode === 'none') return
  const x = mmToPt(placement.xMm)
  const y = pageHeightPt - mmToPt(placement.yMm + placement.heightMm)
  const width = mmToPt(placement.widthMm)
  const height = mmToPt(placement.heightMm)
  const offset = mmToPt(marks.offsetMm)
  const thickness = mmToPt(marks.thicknessMm)
  const line = (start: { x: number; y: number }, end: { x: number; y: number }, dashed = false) => page.drawLine({ start, end, thickness, color: undefined, dashArray: dashed ? [mmToPt(2), mmToPt(1)] : undefined })
  if (marks.mode === 'full' || marks.mode === 'dashed') {
    line({ x: x - offset, y }, { x: x + width + offset, y }, marks.mode === 'dashed')
    line({ x: x - offset, y: y + height }, { x: x + width + offset, y: y + height }, marks.mode === 'dashed')
    line({ x, y: y - offset }, { x, y: y + height + offset }, marks.mode === 'dashed')
    line({ x: x + width, y: y - offset }, { x: x + width, y: y + height + offset }, marks.mode === 'dashed')
    return
  }
  const length = mmToPt(3)
  line({ x: x - offset - length, y }, { x: x - offset, y })
  line({ x: x - offset, y: y - length }, { x: x - offset, y })
  line({ x: x + width + offset, y }, { x: x + width + offset + length, y })
  line({ x: x + width + offset, y: y - length }, { x: x + width + offset, y })
  line({ x: x - offset - length, y: y + height }, { x: x - offset, y: y + height })
  line({ x: x - offset, y: y + height }, { x: x - offset, y: y + height + length })
  line({ x: x + width + offset, y: y + height }, { x: x + width + offset + length, y: y + height })
  line({ x: x + width + offset, y: y + height }, { x: x + width + offset, y: y + height + length })
}

export async function processPlacement(photo: PdfExportPayload['photos'][number], placement: PdfExportPayload['placements'][number], dpi: number) {
  const targetWidth = mmToPx(placement.widthMm, dpi)
  const targetHeight = mmToPx(placement.heightMm, dpi)
  const zoom = Math.max(1, photo.crop.zoom || 1)
  const metadata = await sharp(photo.path).metadata()
  if (!metadata.width || !metadata.height) throw new Error('Não foi possível ler as dimensões da imagem.')
  let sourceWidth = metadata.width
  let sourceHeight = metadata.height
  if (metadata.orientation !== undefined && metadata.orientation >= 5) [sourceWidth, sourceHeight] = [sourceHeight, sourceWidth]
  if (Math.abs(placement.rotation) % 180 === 90) [sourceWidth, sourceHeight] = [sourceHeight, sourceWidth]
  let image = sharp(photo.path).rotate()
  if (placement.rotation % 360 !== 0) image = image.rotate(placement.rotation)

  if (photo.fitMode === 'contain') {
    image = image.resize({ width: targetWidth, height: targetHeight, fit: 'contain', background: '#ffffff' })
  } else {
    const targetRatio = targetWidth / targetHeight
    const sourceRatio = sourceWidth / sourceHeight
    let cropWidth = sourceWidth
    let cropHeight = sourceHeight
    if (sourceRatio > targetRatio) cropWidth = sourceHeight * targetRatio
    else cropHeight = sourceWidth / targetRatio
    cropWidth = Math.max(1, Math.min(sourceWidth, Math.round(cropWidth / zoom)))
    cropHeight = Math.max(1, Math.min(sourceHeight, Math.round(cropHeight / zoom)))
    const maxLeft = Math.max(0, sourceWidth - cropWidth)
    const maxTop = Math.max(0, sourceHeight - cropHeight)
    const left = Math.round(Math.min(maxLeft, Math.max(0, maxLeft * (0.5 + (photo.crop.offsetX || 0) / 2))))
    const top = Math.round(Math.min(maxTop, Math.max(0, maxTop * (0.5 + (photo.crop.offsetY || 0) / 2))))
    image = image.extract({ left, top, width: cropWidth, height: cropHeight }).resize({ width: targetWidth, height: targetHeight, fit: 'fill' })
  }
  if (photo.crop.flipX) image = image.flop()
  if (photo.crop.flipY) image = image.flip()
  return image.png().toBuffer()
}

export interface RasterExportPayload extends PdfExportPayload {
  quality?: number
}

export function validateExportPayload(value: unknown): PdfExportPayload {
  if (!value || typeof value !== 'object') throw new Error('Payload de exportação inválido.')
  const payload = value as Partial<PdfExportPayload>
  const sheet = payload.sheet
  if (!sheet || typeof sheet !== 'object' || !Number.isFinite(sheet.widthMm) || !Number.isFinite(sheet.heightMm) || sheet.widthMm <= 0 || sheet.heightMm <= 0 || !Number.isFinite(sheet.dpi) || sheet.dpi <= 0) throw new Error('Configuração de folha inválida.')
  if (!Array.isArray(payload.photos) || payload.photos.length > 1000 || !Array.isArray(payload.placements) || payload.placements.length > 10000) throw new Error('Dados de exportação fora dos limites.')
  for (const photo of payload.photos) {
    if (!photo || typeof photo !== 'object' || typeof photo.id !== 'string' || typeof photo.path !== 'string' || !path.isAbsolute(photo.path) || !isSupportedImage(photo.path)) throw new Error('Caminho de imagem inválido.')
  }
  for (const placement of payload.placements) {
    if (!placement || typeof placement !== 'object' || typeof placement.photoId !== 'string' || !Number.isFinite(placement.xMm) || !Number.isFinite(placement.yMm) || !Number.isFinite(placement.widthMm) || !Number.isFinite(placement.heightMm) || placement.widthMm <= 0 || placement.heightMm <= 0 || placement.sheetIndex < 0) throw new Error('Placement inválido.')
  }
  return payload as PdfExportPayload
}

function cropMarksSvg(payload: RasterExportPayload, placements: RasterExportPayload['placements'], sheetIndex: number) {
  const marks = payload.sheet.cropMarks
  if (!marks || marks.mode === 'none') return null
  const dimensions = pageDimensions(payload)
  const width = mmToPx(dimensions.widthMm, payload.sheet.dpi)
  const height = mmToPx(dimensions.heightMm, payload.sheet.dpi)
  const scale = payload.sheet.dpi / 25.4
  const lines: string[] = []
  const line = (x1: number, y1: number, x2: number, y2: number, dashed = false) => lines.push(`<line x1="${x1}" y1="${height - y1}" x2="${x2}" y2="${height - y2}" stroke="#777" stroke-width="${marks.thicknessMm * scale}"${dashed ? ' stroke-dasharray="2 1"' : ''}/>`)
  for (const placement of placements.filter((item) => item.sheetIndex === sheetIndex)) {
    const x = placement.xMm * scale
    const y = placement.yMm * scale
    const w = placement.widthMm * scale
    const h = placement.heightMm * scale
    const offset = marks.offsetMm * scale
    if (marks.mode === 'full' || marks.mode === 'dashed') {
      line(x - offset, placement.yMm * scale, x + w + offset, placement.yMm * scale, marks.mode === 'dashed')
      line(x - offset, (placement.yMm + placement.heightMm) * scale, x + w + offset, (placement.yMm + placement.heightMm) * scale, marks.mode === 'dashed')
      line(placement.xMm * scale, y - offset, placement.xMm * scale, y + h + offset, marks.mode === 'dashed')
      line((placement.xMm + placement.widthMm) * scale, y - offset, (placement.xMm + placement.widthMm) * scale, y + h + offset, marks.mode === 'dashed')
    } else {
      const length = 3 * scale
      line(x - offset - length, placement.yMm * scale, x - offset, placement.yMm * scale)
      line(x - offset, placement.yMm * scale - length, x - offset, placement.yMm * scale)
      line(x + w + offset, placement.yMm * scale, x + w + offset + length, placement.yMm * scale)
      line(x + w + offset, placement.yMm * scale - length, x + w + offset, placement.yMm * scale)
      line(x - offset - length, (placement.yMm + placement.heightMm) * scale, x - offset, (placement.yMm + placement.heightMm) * scale)
      line(x - offset, (placement.yMm + placement.heightMm) * scale, x - offset, (placement.yMm + placement.heightMm) * scale + length)
      line(x + w + offset, (placement.yMm + placement.heightMm) * scale, x + w + offset + length, (placement.yMm + placement.heightMm) * scale)
      line(x + w + offset, (placement.yMm + placement.heightMm) * scale, x + w + offset, (placement.yMm + placement.heightMm) * scale + length)
    }
  }
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines.join('')}</svg>`)
}

export async function createRasterBuffer(payload: RasterExportPayload, sheetIndex: number, format: 'png' | 'jpeg') {
  const dimensions = pageDimensions(payload)
  const width = mmToPx(dimensions.widthMm, payload.sheet.dpi)
  const height = mmToPx(dimensions.heightMm, payload.sheet.dpi)
  const photoMap = new Map(payload.photos.map((photo) => [photo.id, photo]))
  const composites: sharp.OverlayOptions[] = []
  for (const placement of payload.placements.filter((item) => item.sheetIndex === sheetIndex)) {
    const photo = photoMap.get(placement.photoId)
    if (!photo) continue
    composites.push({ input: await processPlacement(photo, placement, payload.sheet.dpi), left: mmToPx(placement.xMm, payload.sheet.dpi), top: mmToPx(placement.yMm, payload.sheet.dpi) })
  }
  const marks = cropMarksSvg(payload, payload.placements, sheetIndex)
  if (marks) composites.push({ input: marks, left: 0, top: 0 })
  let image = sharp({ create: { width, height, channels: 4, background: '#ffffff' } }).composite(composites)
  if (format === 'jpeg') image = image.jpeg({ quality: Math.min(100, Math.max(1, payload.quality ?? 92)) })
  else image = image.png()
  return image.toBuffer()
}

export async function exportRaster(payload: RasterExportPayload, outputPath: string, format: 'png' | 'jpeg') {
  const pageCount = Math.max(1, ...payload.placements.map((placement) => placement.sheetIndex + 1))
  for (let index = 0; index < pageCount; index += 1) {
    const buffer = await createRasterBuffer(payload, index, format)
    const pagePath = pageCount === 1 ? outputPath : outputPath.replace(/\.(png|jpe?g)$/i, `-${index + 1}.$1`)
    await writeFile(pagePath, buffer)
  }
  return { outputPath, pageCount }
}

export async function createPdfBuffer(payload: PdfExportPayload) {
  const pdf = await PDFDocument.create()
  const dimensions = pageDimensions(payload)
  const pageWidthPt = mmToPt(dimensions.widthMm)
  const pageHeightPt = mmToPt(dimensions.heightMm)
  const pageCount = Math.max(1, ...payload.placements.map((placement) => placement.sheetIndex + 1))
  const photoMap = new Map(payload.photos.map((photo) => [photo.id, photo]))

  for (let sheetIndex = 0; sheetIndex < pageCount; sheetIndex += 1) {
    const page = pdf.addPage([pageWidthPt, pageHeightPt])
    const pagePlacements = payload.placements.filter((placement) => placement.sheetIndex === sheetIndex)
    for (const placement of pagePlacements) {
      const photo = photoMap.get(placement.photoId)
      if (!photo) continue
      const imageBytes = await processPlacement(photo, placement, payload.sheet.dpi)
      const image = await pdf.embedPng(imageBytes)
      page.drawImage(image, {
        x: mmToPt(placement.xMm),
        y: pageHeightPt - mmToPt(placement.yMm + placement.heightMm),
        width: mmToPt(placement.widthMm),
        height: mmToPt(placement.heightMm)
      })
      drawCropMarks(page, placement, payload, pageHeightPt)
    }
  }
  return pdf.save()
}

export async function exportPdf(payload: PdfExportPayload, outputPath: string) {
  const buffer = await createPdfBuffer(payload)
  await writeFile(outputPath, buffer)
  return { outputPath, pageCount: Math.max(1, ...payload.placements.map((placement) => placement.sheetIndex + 1)) }
}
