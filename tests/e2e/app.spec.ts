import path from 'node:path'
import { createRequire } from 'node:module'
import { _electron as electron, expect, test } from '@playwright/test'

const electronPath = createRequire(import.meta.url)('electron') as string

test('[electron] opens the desktop workspace', async () => {
  const app = await electron.launch({ executablePath: electronPath, args: [path.resolve('out/main/index.js')] })
  try {
    const window = await app.firstWindow()
    await expect(window.getByText('Biblioteca')).toBeVisible()
    await expect(window.getByText('Configurações da folha')).toBeVisible()
  } finally {
    await app.close()
  }
})
