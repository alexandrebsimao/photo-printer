import type { PhotoPrinterApi } from '../../preload'

declare global {
  interface Window {
    photoPrinter: PhotoPrinterApi
  }
}

export {}
