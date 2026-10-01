import { app, dialog, ipcMain, shell } from 'electron'
import { isAbsolute, join } from 'node:path'
import { classifyImagePaths, createPreviewDataUrl, inspectImages, isSupportedImage } from '../services/image.service'
import { exportPdf, exportRaster, validateExportPayload } from '../services/export.service'
import { findMissingPhotoPaths, loadProjectFile, saveProjectFile, type ProjectDocument } from '../services/project.service'

export function registerIpcHandlers() {
  ipcMain.handle('app:get-info', () => ({
    name: 'Photo Printer',
    version: process.env.npm_package_version ?? '0.1.0',
    platform: process.platform
  }))

  ipcMain.handle('images:select', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Adicionar fotos',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    })

    if (selection.canceled) return []
    return inspectImages(selection.filePaths)
  })

  ipcMain.handle('images:import-paths', async (_event, paths: unknown) => {
    const { acceptedPaths, rejectedPaths } = classifyImagePaths(paths)
    const result = await inspectImages(acceptedPaths)
    return {
      photos: result.photos,
      errors: [
        ...result.errors,
        ...rejectedPaths.map((filePath) => `${filePath.split(/[\\/]/).pop() ?? 'Arquivo'} não é um formato de imagem suportado.`)
      ]
    }
  })

  ipcMain.handle('images:preview', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !isAbsolute(filePath) || !isSupportedImage(filePath)) throw new Error('Caminho de imagem inválido.')
    return { previewDataUrl: await createPreviewDataUrl(filePath) }
  })

  ipcMain.handle('export:pdf', async (_event, payload: Parameters<typeof exportPdf>[0]) => {
    const destination = await dialog.showSaveDialog({
      title: 'Exportar PDF',
      defaultPath: 'photo-printer.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (destination.canceled || !destination.filePath) return { canceled: true }
    return exportPdf(validateExportPayload(payload), destination.filePath)
  })

  ipcMain.handle('export:raster', async (_event, payload: Parameters<typeof exportRaster>[0], format: 'png' | 'jpeg') => {
    const extension = format === 'png' ? 'png' : 'jpg'
    const destination = await dialog.showSaveDialog({ title: `Exportar ${format.toUpperCase()}`, defaultPath: `photo-printer.${extension}`, filters: [{ name: format.toUpperCase(), extensions: [extension] }] })
    if (destination.canceled || !destination.filePath) return { canceled: true }
    if (format !== 'png' && format !== 'jpeg') throw new Error('Formato de imagem inválido.')
    return exportRaster(validateExportPayload(payload), destination.filePath, format)
  })

  ipcMain.handle('project:save', async (_event, project: ProjectDocument, currentPath?: string) => {
    const destination = currentPath && typeof currentPath === 'string' ? { canceled: false, filePath: currentPath } : await dialog.showSaveDialog({ title: 'Salvar projeto', defaultPath: `${project.name || 'projeto'}.photo-print-project`, filters: [{ name: 'Photo Printer Project', extensions: ['photo-print-project'] }] })
    if (destination.canceled || !destination.filePath) return { canceled: true }
    await saveProjectFile(destination.filePath, project)
    return { canceled: false, filePath: destination.filePath }
  })

  ipcMain.handle('project:open', async () => {
    const selection = await dialog.showOpenDialog({ title: 'Abrir projeto', properties: ['openFile'], filters: [{ name: 'Photo Printer Project', extensions: ['photo-print-project', 'json'] }] })
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true }
    const project = await loadProjectFile(selection.filePaths[0])
    return { canceled: false, filePath: selection.filePaths[0], project, missingPaths: await findMissingPhotoPaths(project) }
  })

  ipcMain.handle('project:save-recovery', async (_event, project: ProjectDocument) => {
    const recoveryPath = join(app.getPath('userData'), 'recovery.photo-print-project')
    await saveProjectFile(recoveryPath, project)
    return recoveryPath
  })

  ipcMain.handle('project:load-recovery', async () => {
    try {
      return await loadProjectFile(join(app.getPath('userData'), 'recovery.photo-print-project'))
    } catch {
      return null
    }
  })

  ipcMain.handle('project:clear-recovery', async () => {
    const recoveryPath = join(app.getPath('userData'), 'recovery.photo-print-project')
    try { const { unlink } = await import('node:fs/promises'); await unlink(recoveryPath) } catch { /* recovery is optional */ }
  })

  ipcMain.handle('print:project', async (_event, payload: Parameters<typeof exportPdf>[0]) => {
    const outputPath = join(app.getPath('temp'), `photo-printer-${Date.now()}.pdf`)
    await exportPdf(validateExportPayload(payload), outputPath)
    const error = await shell.openPath(outputPath)
    if (error) throw new Error(error)
    return outputPath
  })
}
