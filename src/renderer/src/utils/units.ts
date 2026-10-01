export const mmToPx = (mm: number, dpi: number): number => (mm / 25.4) * dpi
export const pxToMm = (px: number, dpi: number): number => (px / dpi) * 25.4
export const mmToPt = (mm: number): number => (mm / 25.4) * 72
export const cmToMm = (cm: number): number => cm * 10
export const inchToMm = (inches: number): number => inches * 25.4
