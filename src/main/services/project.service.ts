import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface ProjectDocument {
  version: 1
  id: string
  name: string
  photos: unknown[]
  sheet: unknown
  placements: unknown[]
  pageCount?: number
  createdAt: string
  updatedAt: string
}

export function validateProjectDocument(value: unknown): ProjectDocument {
  if (!value || typeof value !== 'object') throw new Error('Documento de projeto inválido.')
  const document = value as Partial<ProjectDocument>
  if (document.version !== 1 || typeof document.id !== 'string' || typeof document.name !== 'string' || !Array.isArray(document.photos) || document.photos.length > 1000 || !document.sheet || !Array.isArray(document.placements) || document.placements.length > 10000 || typeof document.createdAt !== 'string' || typeof document.updatedAt !== 'string') throw new Error('Versão de projeto não suportada.')
  return document as ProjectDocument
}

export async function saveProjectFile(filePath: string, project: ProjectDocument) {
  if (!path.isAbsolute(filePath) || !filePath.endsWith('.photo-print-project')) throw new Error('Destino de projeto inválido.')
  await writeFile(filePath, JSON.stringify(validateProjectDocument(project), null, 2), 'utf8')
  return filePath
}

export async function loadProjectFile(filePath: string): Promise<ProjectDocument> {
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
  if (!parsed || typeof parsed !== 'object') throw new Error('Arquivo de projeto inválido.')
  const document = parsed as Partial<ProjectDocument>
  return validateProjectDocument({ ...document, version: 1, name: document.name ?? 'Projeto sem nome', createdAt: document.createdAt ?? new Date().toISOString(), updatedAt: document.updatedAt ?? new Date().toISOString() })
}

export async function findMissingPhotoPaths(project: ProjectDocument) {
  const missing: string[] = []
  for (const photo of project.photos) {
    if (!photo || typeof photo !== 'object' || typeof (photo as { path?: unknown }).path !== 'string') continue
    const filePath = (photo as { path: string }).path
    try { await access(filePath) } catch { missing.push(filePath) }
  }
  return missing
}
