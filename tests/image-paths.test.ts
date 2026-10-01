import { describe, expect, it } from 'vitest'
import { classifyImagePaths, filterSupportedImagePaths } from '../src/main/services/image.service'

describe('drag-and-drop image path validation', () => {
  it('keeps only absolute supported image paths and removes duplicates', () => {
    expect(filterSupportedImagePaths([
      '/tmp/photo.jpg',
      '/tmp/photo.jpg',
      '/tmp/photo.PNG',
      'relative/photo.webp',
      '/tmp/document.pdf',
      42
    ])).toEqual(['/tmp/photo.jpg', '/tmp/photo.PNG'])
  })

  it('rejects malformed IPC payloads', () => {
    expect(filterSupportedImagePaths(null)).toEqual([])
    expect(filterSupportedImagePaths({ paths: ['/tmp/photo.jpg'] })).toEqual([])
  })

  it('reports rejected absolute paths separately', () => {
    expect(classifyImagePaths(['/tmp/photo.jpg', '/tmp/file.pdf']).rejectedPaths).toEqual(['/tmp/file.pdf'])
  })
})
