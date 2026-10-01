import { expect, test } from '@playwright/test'

test('opens the renderer workspace', async ({ page }) => {
  await page.addInitScript(() => {
    window.photoPrinter = {
      getAppInfo: async () => ({ name: 'Photo Printer', version: '0.1.0', platform: 'test' }),
      selectImages: async () => ({ photos: [], errors: [] }),
      importImages: async () => ({ photos: [], errors: [] }),
      getImagePreview: async () => ({ previewDataUrl: '' }),
      exportPdf: async () => ({ canceled: true }),
      exportRaster: async () => ({ canceled: true }),
      saveProject: async () => ({ canceled: true }),
      openProject: async () => ({ canceled: true }),
      saveRecovery: async () => undefined,
      loadRecovery: async () => null,
      clearRecovery: async () => undefined,
      printProject: async () => undefined,
      onPrintRequest: () => () => undefined,
      quit: () => undefined
    }
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Página Papel/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Foto Selecione/ })).toBeVisible()
  await expect(page.getByText('Nenhuma foto importada')).toBeVisible()
})
