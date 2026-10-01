import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc/index'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f5f4f1',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Arquivo', submenu: [{ label: 'Imprimir', accelerator: 'CmdOrCtrl+P', click: () => mainWindow?.webContents.send('menu:print') }, { role: 'quit' }] }]))
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.on('app:quit', () => app.quit())
