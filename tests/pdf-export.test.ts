import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createPdfBuffer } from '../src/main/services/export.service'

describe('PDF export', () => {
  it('creates an A4 page with physical dimensions', async () => {
    const bytes = await createPdfBuffer({
      sheet: { widthMm: 210, heightMm: 297, orientation: 'portrait', dpi: 300 },
      photos: [],
      placements: []
    })
    const pdf = await PDFDocument.load(bytes)
    const page = pdf.getPage(0)
    expect(page.getWidth()).toBeCloseTo(595.276, 2)
    expect(page.getHeight()).toBeCloseTo(841.89, 2)
  })
})
