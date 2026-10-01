import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  selectImages: () => ipcRenderer.invoke('images:select'),
  importImages: (paths: string[]) => ipcRenderer.invoke('images:import-paths', paths),
  getImagePreview: (filePath: string) => ipcRenderer.invoke('images:preview', filePath),
  exportPdf: (payload: unknown) => ipcRenderer.invoke('export:pdf', payload),
  exportRaster: (payload: unknown, format: 'png' | 'jpeg') => ipcRenderer.invoke('export:raster', payload, format),
  saveProject: (project: unknown, currentPath?: string) => ipcRenderer.invoke('project:save', project, currentPath),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveRecovery: (project: unknown) => ipcRenderer.invoke('project:save-recovery', project),
  loadRecovery: () => ipcRenderer.invoke('project:load-recovery'),
  clearRecovery: () => ipcRenderer.invoke('project:clear-recovery'),
  printProject: (payload: unknown) => ipcRenderer.invoke('print:project', payload),
  onPrintRequest: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('menu:print', listener)
    return () => { ipcRenderer.removeListener('menu:print', listener) }
  },
  quit: () => ipcRenderer.send('app:quit')
}

contextBridge.exposeInMainWorld('photoPrinter', api)

export type PhotoPrinterApi = typeof api
