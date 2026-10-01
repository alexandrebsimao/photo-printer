import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/renderer/src/App'

describe('workspace UI', () => {
  beforeEach(() => {
    window.photoPrinter = {
      getAppInfo: vi.fn().mockResolvedValue({ name: 'Photo Printer', version: '0.1.0', platform: 'test' }),
      selectImages: vi.fn().mockResolvedValue({ photos: [], errors: [] }),
      importImages: vi.fn().mockResolvedValue({ photos: [], errors: [] }),
      getImagePreview: vi.fn().mockResolvedValue({ previewDataUrl: '' }),
      exportPdf: vi.fn(),
      exportRaster: vi.fn(),
      saveProject: vi.fn(),
      openProject: vi.fn().mockResolvedValue({ canceled: true }),
      saveRecovery: vi.fn(),
      loadRecovery: vi.fn().mockResolvedValue(null),
      clearRecovery: vi.fn(),
      printProject: vi.fn(),
      onPrintRequest: vi.fn().mockReturnValue(() => undefined),
      quit: vi.fn()
    }
  })

  it('renders the main desktop workspace', async () => {
    render(<App />)
    expect(screen.getByText('Biblioteca')).toBeInTheDocument()
    expect(screen.getByText('Página')).toBeInTheDocument()
    expect(screen.getByText('Foto')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma foto importada')).toBeInTheDocument()
  })
})
