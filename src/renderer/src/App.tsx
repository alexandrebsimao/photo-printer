import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react'
import { useAppStore } from './stores/app.store'
import type { Photo, PhotoPlacement } from './types/domain'
import { clampPhotoSizeMm, loadCustomPresets, mmToUnit, printPresets, saveCustomPresets, unitToMm, type PhysicalUnit, type PrintPresetOption } from './utils/print-presets'

function photoCount(photos: Photo[]) {
  return photos.reduce((total, photo) => total + photo.quantity, 0)
}

function cropBackgroundSize(photo: Photo, frameWidthMm: number, frameHeightMm: number, fitMode: Photo['fitMode'], zoom: number) {
  if (fitMode === 'contain') return 'contain'
  const frameRatio = Math.max(0.001, frameWidthMm / frameHeightMm)
  const sourceRatio = Math.max(0.001, photo.originalWidth / photo.originalHeight)
  const widthScale = sourceRatio > frameRatio ? sourceRatio / frameRatio : 1
  const heightScale = sourceRatio < frameRatio ? frameRatio / sourceRatio : 1
  return `${widthScale * Math.max(1, zoom) * 100}% ${heightScale * Math.max(1, zoom) * 100}%`
}

type PlacementInteraction = {
  id: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  before: PhotoPlacement
}

export default function App() {
  const photos = useAppStore((state) => state.photos)
  const placements = useAppStore((state) => state.placements)
  const pageCount = useAppStore((state) => state.pageCount)
  const layoutWarnings = useAppStore((state) => state.layoutWarnings)
  const sheet = useAppStore((state) => state.sheet)
  const selectedPhotoId = useAppStore((state) => state.selectedPhotoId)
  const previewZoom = useAppStore((state) => state.previewZoom)
  const addImportedPhotos = useAppStore((state) => state.addImportedPhotos)
  const removePhoto = useAppStore((state) => state.removePhoto)
  const updatePhoto = useAppStore((state) => state.updatePhoto)
  const setPhotoPreview = useAppStore((state) => state.setPhotoPreview)
  const setSheet = useAppStore((state) => state.setSheet)
  const addPage = useAppStore((state) => state.addPage)
  const removePage = useAppStore((state) => state.removePage)
  const insertPhotoOnPage = useAppStore((state) => state.insertPhotoOnPage)
  const selectPhoto = useAppStore((state) => state.selectPhoto)
  const setPreviewZoom = useAppStore((state) => state.setPreviewZoom)
  const undo = useAppStore((state) => state.undo)
  const redo = useAppStore((state) => state.redo)
  const projectPath = useAppStore((state) => state.projectPath)
  const projectName = useAppStore((state) => state.projectName)
  const getProject = useAppStore((state) => state.getProject)
  const loadProject = useAppStore((state) => state.loadProject)
  const setProjectPath = useAppStore((state) => state.setProjectPath)
  const updatePlacement = useAppStore((state) => state.updatePlacement)
  const previewPlacementPosition = useAppStore((state) => state.previewPlacementPosition)
  const previewPlacementSize = useAppStore((state) => state.previewPlacementSize)
  const commitPlacementChange = useAppStore((state) => state.commitPlacementChange)
  const rotatePlacement = useAppStore((state) => state.rotatePlacement)
  const movePlacementToSheet = useAppStore((state) => state.movePlacementToSheet)
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [photoUnit, setPhotoUnit] = useState<PhysicalUnit>('cm')
  const [currentPage, setCurrentPage] = useState(0)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [jpegQuality, setJpegQuality] = useState(92)
  const [projectStatus, setProjectStatus] = useState<string | null>(null)
  const [customPresets, setCustomPresets] = useState<PrintPresetOption[]>(loadCustomPresets)
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null)
  const [draggingPlacement, setDraggingPlacement] = useState<PlacementInteraction | null>(null)
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const paperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.photoPrinter.loadRecovery().then((recovery) => {
      if (recovery && confirm('Encontramos uma sessão recuperável. Deseja restaurá-la?')) loadProject(recovery)
    })
  }, [loadProject])

  useEffect(() => {
    let cancelled = false
    const missingPreviews = photos.filter((photo) => !photo.previewDataUrl && photo.path).slice(0, 4)
    if (missingPreviews.length === 0) return () => { cancelled = true }
    void Promise.all(missingPreviews.map(async (photo) => {
      try {
        const result = await window.photoPrinter.getImagePreview(photo.path)
        if (!cancelled && result?.previewDataUrl) setPhotoPreview(photo.id, result.previewDataUrl)
      } catch {
        // A imagem pode ter sido movida ou removida desde que o projeto foi salvo.
      }
    }))
    return () => { cancelled = true }
  }, [photos, setPhotoPreview])

  useEffect(() => {
    if (photos.length === 0 && placements.length === 0 && pageCount <= 1) return
    const timeout = window.setTimeout(() => { void window.photoPrinter.saveRecovery(getProject()) }, 2000)
    return () => window.clearTimeout(timeout)
  }, [photos, placements, pageCount, sheet, getProject])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [redo, undo])

  useEffect(() => { saveCustomPresets(customPresets) }, [customPresets])

  const currentPageCount = pageCount
  const pageWidth = sheet.orientation === 'portrait' ? sheet.widthMm : sheet.heightMm
  const pageHeight = sheet.orientation === 'portrait' ? sheet.heightMm : sheet.widthMm
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId)
  const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId && placement.sheetIndex === currentPage) ?? placements.find((placement) => placement.photoId === selectedPhotoId && placement.sheetIndex === currentPage)
  const editingPhoto = photos.find((photo) => photo.id === editingPhotoId)
  const activePlacement = draggingPlacement ? placements.find((placement) => placement.id === draggingPlacement.id) : null

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(0, currentPageCount - 1)))
  }, [currentPageCount])

  function handlePlacementPointerDown(event: PointerEvent<HTMLDivElement>, placement: PhotoPlacement, photoId: string) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    selectPhoto(photoId)
    setSelectedPlacementId(placement.id)
    setDraggingPlacement({ id: placement.id, mode: 'move', startX: event.clientX, startY: event.clientY, before: placement })
  }

  function handleResizePointerDown(event: PointerEvent<HTMLDivElement>, placement: PhotoPlacement, photoId: string) {
    event.preventDefault()
    event.stopPropagation()
    const placementElement = event.currentTarget.parentElement
    placementElement?.setPointerCapture(event.pointerId)
    selectPhoto(photoId)
    setSelectedPlacementId(placement.id)
    setDraggingPlacement({ id: placement.id, mode: 'resize', startX: event.clientX, startY: event.clientY, before: placement })
  }

  function handlePlacementPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingPlacement || !paperRef.current) return
    const rect = paperRef.current.getBoundingClientRect()
    const mmPerPixelX = pageWidth / rect.width
    const mmPerPixelY = pageHeight / rect.height
    const deltaX = (event.clientX - draggingPlacement.startX) * mmPerPixelX
    const deltaY = (event.clientY - draggingPlacement.startY) * mmPerPixelY
    if (draggingPlacement.mode === 'move') {
      previewPlacementPosition(draggingPlacement.id, draggingPlacement.before.xMm + deltaX, draggingPlacement.before.yMm + deltaY)
    } else {
      const before = draggingPlacement.before
      const aspectRatio = before.widthMm / before.heightMm
      const requestedWidthScale = (before.widthMm + deltaX) / before.widthMm
      const requestedHeightScale = (before.heightMm + deltaY) / before.heightMm
      const minimumScale = Math.max(5 / before.widthMm, 5 / before.heightMm)
      const availableWidth = pageWidth - sheet.margins.rightMm - before.xMm
      const availableHeight = pageHeight - sheet.margins.bottomMm - before.yMm
      const maximumScale = Math.min(availableWidth / before.widthMm, availableHeight / before.heightMm)
      const scale = Math.max(minimumScale, Math.min(maximumScale, Math.max(requestedWidthScale, requestedHeightScale)))
      previewPlacementSize(draggingPlacement.id, {
        widthMm: Math.max(5, before.widthMm * scale),
        heightMm: Math.max(5, (before.widthMm * scale) / aspectRatio)
      })
    }
  }

  function finishPlacementDrag(event: PointerEvent<HTMLDivElement>) {
    if (draggingPlacement) {
      commitPlacementChange(draggingPlacement.id, draggingPlacement.before)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDraggingPlacement(null)
  }

  function insertPhoto(photoId: string) {
    if (insertPhotoOnPage(photoId, currentPage)) {
      selectPhoto(photoId)
      setSelectedPlacementId(null)
      setProjectStatus(`Foto inserida na página ${currentPage + 1}`)
    } else {
      setProjectStatus('Não há espaço livre nesta página. Insira uma nova página.')
    }
  }

  async function exportPdfFile() {
    setExportStatus('Gerando PDF…')
    try {
      const result = await window.photoPrinter.exportPdf({ sheet, photos, placements })
      setExportStatus('canceled' in result && result.canceled ? null : 'PDF exportado')
    } catch {
      setExportStatus('Falha ao exportar PDF')
    }
  }

  async function exportRasterFile(format: 'png' | 'jpeg') {
    setExportStatus(`Gerando ${format.toUpperCase()}…`)
    try {
      const result = await window.photoPrinter.exportRaster({ sheet, photos, placements, quality: jpegQuality }, format)
      setExportStatus('canceled' in result && result.canceled ? null : `${format.toUpperCase()} exportado`)
    } catch {
      setExportStatus(`Falha ao exportar ${format.toUpperCase()}`)
    }
  }

  const printProjectFile = useCallback(async () => {
    try {
      await window.photoPrinter.printProject({ sheet, photos, placements })
      setProjectStatus('PDF aberto para impressão')
      window.alert('Na janela de impressão, use escala 100% / tamanho real e desative “Ajustar à página”.')
    } catch {
      setProjectStatus('Falha ao preparar impressão')
    }
  }, [photos, placements, sheet])

  useEffect(() => window.photoPrinter.onPrintRequest(() => { void printProjectFile() }), [printProjectFile])

  async function saveProjectFile() {
    setProjectStatus('Salvando…')
    try {
      const result = await window.photoPrinter.saveProject(getProject(), projectPath ?? undefined)
      if ('filePath' in result && result.filePath) setProjectPath(result.filePath)
      setProjectStatus('Projeto salvo')
    } catch {
      setProjectStatus('Falha ao salvar')
    }
  }

  async function openProjectFile() {
    try {
      const result = await window.photoPrinter.openProject()
      if (!result.canceled && result.project) { loadProject(result.project, result.filePath); setCurrentPage(0); setProjectStatus(result.missingPaths?.length ? `${result.missingPaths.length} imagem(ns) não encontrada(s)` : 'Projeto aberto') }
    } catch {
      setProjectStatus('Projeto inválido')
    }
  }

  async function importPhotos() {
    setIsImporting(true)
    setImportErrors([])
    try {
      const result = await window.photoPrinter.selectImages()
      addImportedPhotos(result.photos)
      setImportErrors(result.errors)
    } catch {
      setImportErrors(['Não foi possível abrir os arquivos selecionados.'])
    } finally {
      setIsImporting(false)
    }
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((filePath): filePath is string => Boolean(filePath))
    if (paths.length === 0) return

    setIsImporting(true)
    setImportErrors([])
    try {
      const result = await window.photoPrinter.importImages(paths)
      addImportedPhotos(result.photos)
      setImportErrors(result.errors)
    } catch {
      setImportErrors(['Não foi possível importar os arquivos soltos.'])
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <main className="flex h-screen min-h-[700px] flex-col overflow-hidden bg-paper text-ink">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-panel px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-lg font-semibold text-white">P</div>
          <div><h1 className="font-display text-lg font-semibold tracking-tight">Photo Printer</h1><p className="text-[11px] uppercase tracking-[0.18em] text-stone-400">Print studio</p></div>
        </div>
        <div className="flex items-center gap-2 text-sm text-stone-500"><span className="mr-2 max-w-[150px] truncate">{projectStatus ?? exportStatus ?? projectName}</span><button onClick={() => void openProjectFile()} className="rounded-lg border border-stone-200 px-3 py-2 font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50">Abrir</button><button onClick={() => void saveProjectFile()} className="rounded-lg border border-stone-200 px-3 py-2 font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50">Salvar</button><button onClick={() => void printProjectFile()} disabled={photos.length === 0} className="rounded-lg border border-stone-200 px-3 py-2 font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">Imprimir</button><button onClick={() => void exportPdfFile()} disabled={photos.length === 0 || Boolean(exportStatus?.startsWith('Gerando'))} className="rounded-lg border border-stone-200 px-3 py-2 font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">PDF</button><button onClick={() => void exportRasterFile('png')} disabled={photos.length === 0 || Boolean(exportStatus?.startsWith('Gerando'))} className="rounded-lg border border-stone-200 px-3 py-2 font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">PNG</button><button onClick={() => void exportRasterFile('jpeg')} disabled={photos.length === 0 || Boolean(exportStatus?.startsWith('Gerando'))} className="rounded-lg border border-stone-200 px-3 py-2 font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">JPG</button></div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_280px]">
        <aside className="flex min-h-0 flex-col border-r border-stone-200 bg-panel">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4"><div><h2 className="text-sm font-semibold">Biblioteca</h2><p className="mt-1 text-xs text-stone-400">{photos.length} {photos.length === 1 ? 'foto' : 'fotos'} · {photoCount(photos)} cópias</p></div><button onClick={() => void importPhotos()} className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-lg text-white" aria-label="Adicionar fotos">+</button></div>
          <div className={`relative flex-1 overflow-auto p-4 ${isDragging ? 'bg-orange-50' : ''}`} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false) }} onDrop={(event) => void handleDrop(event)}>
            {isDragging && <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-orange-50/90"><div className="text-center"><p className="text-sm font-semibold text-accent">Solte as fotos aqui</p><p className="mt-1 text-xs text-orange-700/70">JPG, JPEG, PNG ou WEBP</p></div></div>}
            {importErrors.length > 0 && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700"><p className="font-semibold">Alguns arquivos não foram importados</p>{importErrors.map((error) => <p key={error}>• {error}</p>)}</div>}
            {photos.length === 0 ? <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-4 text-center"><div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-lg bg-stone-100 text-2xl text-stone-300">⌁</div><p className="text-sm font-medium text-stone-600">Nenhuma foto importada</p><p className="mt-1 text-xs leading-5 text-stone-400">JPG, PNG e WEBP são compatíveis.</p></div> : <div className="space-y-2">{photos.map((photo) => <PhotoCard key={photo.id} photo={photo} selected={photo.id === selectedPhotoId} onSelect={() => { selectPhoto(photo.id); setSelectedPlacementId(null) }} onInsert={() => insertPhoto(photo.id)} onDelete={() => removePhoto(photo.id)} onChangeQuantity={(quantity) => updatePhoto(photo.id, { quantity })} />)}</div>}
          </div>
          <div className="border-t border-stone-200 p-4"><button onClick={() => void importPhotos()} disabled={isImporting} className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c95134] disabled:cursor-wait disabled:opacity-70">{isImporting ? 'Lendo fotos…' : 'Adicionar fotos'}</button></div>
        </aside>

        <section className="flex min-w-0 flex-col bg-[#eceae5]">
          <div className="flex h-14 items-center justify-between border-b border-stone-200/80 px-6"><div className="flex items-center gap-2"><button className="toolbar-button toolbar-button-active">Selecionar</button><button onClick={() => useAppStore.getState().autoLayout()} className="toolbar-button">Organizar automaticamente</button><button onClick={() => { addPage(); setCurrentPage(currentPageCount) }} className="toolbar-button">+ Nova página</button></div><div className="flex items-center gap-2"><button className="page-button" disabled={currentPage === 0} onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}>‹</button><span className="text-xs font-medium text-stone-500">Página {currentPage + 1} de {currentPageCount}</span><button className="page-button" disabled={currentPage >= currentPageCount - 1} onClick={() => setCurrentPage((page) => Math.min(currentPageCount - 1, page + 1))}>›</button><button className="page-button" disabled={currentPageCount <= 1} onClick={() => { removePage(currentPage); setCurrentPage((page) => Math.max(0, page - 1)) }} aria-label="Excluir página">×</button></div></div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-10">
            <div ref={paperRef} key={`${sheet.widthMm}-${sheet.heightMm}-${sheet.orientation}`} className="paper-sheet shadow-paper" style={{ aspectRatio: `${pageWidth} / ${pageHeight}`, transform: `scale(${previewZoom})` }}>
              <div className="absolute inset-[5mm] rounded-[2px] border border-dashed border-stone-200" />
              {placements.filter((placement) => placement.sheetIndex === currentPage).map((placement) => {
                const photo = photos.find((item) => item.id === placement.photoId)
                if (!photo) return null
                const isSelected = selectedPhotoId === photo.id
                const quarterTurn = Math.abs(placement.rotation) % 180 === 90
                return <div
                  key={placement.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Foto ${photo.filename}`}
                  className={`absolute touch-none select-none ${draggingPlacement?.id === placement.id ? 'z-20' : 'z-10'}`}
                  style={{ left: `${(placement.xMm / pageWidth) * 100}%`, top: `${(placement.yMm / pageHeight) * 100}%`, width: `${(placement.widthMm / pageWidth) * 100}%`, height: `${(placement.heightMm / pageHeight) * 100}%` }}
                  onDoubleClick={() => setEditingPhotoId(photo.id)}
                  onPointerDown={(event) => handlePlacementPointerDown(event, placement, photo.id)}
                  onPointerMove={handlePlacementPointerMove}
                  onPointerUp={finishPlacementDrag}
                  onPointerCancel={finishPlacementDrag}
                >
                  <div className={`absolute inset-0 overflow-hidden rounded-[1px] border-2 bg-stone-100 ${isSelected ? 'border-accent shadow-md' : 'border-transparent'} ${draggingPlacement?.id === placement.id ? 'cursor-grabbing opacity-80' : 'cursor-grab'}`}>
                    <div className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: quarterTurn ? `${(placement.heightMm / placement.widthMm) * 100}%` : '100%', height: quarterTurn ? `${(placement.widthMm / placement.heightMm) * 100}%` : '100%', transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)` }}>
                      <div role="img" aria-label={photo.filename} className="h-full w-full bg-center bg-no-repeat transition-transform" style={{ backgroundImage: `url(${photo.previewDataUrl ?? photo.thumbnailDataUrl})`, backgroundSize: cropBackgroundSize(photo, quarterTurn ? placement.heightMm : placement.widthMm, quarterTurn ? placement.widthMm : placement.heightMm, photo.fitMode, photo.crop.zoom), backgroundPosition: `${50 + photo.crop.offsetX * 50}% ${50 + photo.crop.offsetY * 50}%`, backgroundColor: photo.fitMode === 'contain' ? '#ffffff' : '#f5f5f4', transform: `scaleX(${photo.crop.flipX ? -1 : 1}) scaleY(${photo.crop.flipY ? -1 : 1})` }} />
                    </div>
                  </div>
                  <CropMarkOverlay mode={sheet.cropMarks.mode} thickness={sheet.cropMarks.thicknessMm} />
                  {isSelected && <div
                    role="button"
                    tabIndex={-1}
                    aria-label="Redimensionar foto"
                    className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-accent shadow"
                    onPointerDown={(event) => handleResizePointerDown(event, placement, photo.id)}
                  />}
                </div>
              })}
              {draggingPlacement && activePlacement && <div className="pointer-events-none absolute inset-0 z-30"><div className="absolute bottom-0 top-0 border-l border-dashed border-accent/60" style={{ left: `${(activePlacement.xMm / pageWidth) * 100}%` }} /><div className="absolute left-0 right-0 border-t border-dashed border-accent/60" style={{ top: `${(activePlacement.yMm / pageHeight) * 100}%` }} /></div>}
              {layoutWarnings.length > 0 && <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">{layoutWarnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}</div>}
              {photos.length === 0 && <div className="relative z-10 flex h-full items-center justify-center text-center"><div><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-stone-100 text-3xl text-stone-300">+</div><p className="font-display text-lg font-semibold text-stone-500">Sua folha {sheet.format}</p><p className="mt-2 max-w-[220px] text-xs leading-5 text-stone-400">Adicione fotos para começar a montar sua impressão.</p></div></div>}
            </div>
          </div>
          <footer className="flex h-12 items-center justify-center gap-3 border-t border-stone-200/80 bg-[#f0eee9] text-xs text-stone-500"><button onClick={() => setPreviewZoom(previewZoom - 0.1)} className="zoom-button" aria-label="Diminuir zoom">−</button><span className="w-12 text-center font-medium">{Math.round(previewZoom * 100)}%</span><button onClick={() => setPreviewZoom(previewZoom + 0.1)} className="zoom-button" aria-label="Aumentar zoom">+</button></footer>
        </section>

        <aside className="overflow-auto border-l border-stone-200 bg-panel">
          <div className="border-b border-stone-200 px-5 py-4"><h2 className="text-sm font-semibold">Propriedades</h2><p className="mt-1 text-xs text-stone-400">Página, foto, recorte e posição</p></div>
          <div className="space-y-3 p-4">
            <SettingsSection title="Página" description="Papel, orientação, margens e marcas de corte">
              <label className="field-label">Formato<select className="field-control" value={sheet.format} onChange={(event) => { const format = event.target.value as typeof sheet.format; const dimensions = format === 'A4' ? { widthMm: 210, heightMm: 297 } : format === 'A3' ? { widthMm: 297, heightMm: 420 } : format === 'A5' ? { widthMm: 148, heightMm: 210 } : format === 'LETTER' ? { widthMm: 215.9, heightMm: 279.4 } : {}; setSheet({ format, ...dimensions }) }}><option value="A4">A4</option><option value="A3">A3</option><option value="A5">A5</option><option value="LETTER">Letter</option><option value="CUSTOM">Personalizado</option></select></label>
              {sheet.format === 'CUSTOM' && <div className="grid grid-cols-2 gap-2"><label className="field-label">Largura (mm)<input className="field-control" type="number" min="20" step="0.1" value={sheet.widthMm} onChange={(event) => setSheet({ widthMm: Math.max(20, Number(event.target.value) || 20) })} /></label><label className="field-label">Altura (mm)<input className="field-control" type="number" min="20" step="0.1" value={sheet.heightMm} onChange={(event) => setSheet({ heightMm: Math.max(20, Number(event.target.value) || 20) })} /></label></div>}
              <div className="field-label">Orientação<div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => setSheet({ orientation: 'portrait' })} className={`choice-button ${sheet.orientation === 'portrait' ? 'choice-button-active' : ''}`}>Retrato</button><button onClick={() => setSheet({ orientation: 'landscape' })} className={`choice-button ${sheet.orientation === 'landscape' ? 'choice-button-active' : ''}`}>Paisagem</button></div></div>
              <div className="rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-500">Pré-visualização: <strong className="text-stone-700">{pageWidth.toFixed(1)} × {pageHeight.toFixed(1)} mm</strong></div>
              <label className="field-label">DPI<select className="field-control" value={sheet.dpi} onChange={(event) => setSheet({ dpi: Number(event.target.value) })}><option value="150">150</option><option value="200">200</option><option value="300">300</option><option value="600">600</option></select></label>
              <div className="border-t border-stone-200 pt-4"><p className="field-label">Margens</p><div className="mt-2 grid grid-cols-2 gap-2">{(['topMm', 'rightMm', 'bottomMm', 'leftMm'] as const).map((side) => <input key={side} className="field-control" value={`${sheet.margins[side]} mm`} readOnly aria-label={side} />)}</div></div>
              <label className="field-label">Espaçamento<input className="field-control" value={`${sheet.gapMm} mm`} readOnly /></label>
              <div className="border-t border-stone-200 pt-4"><p className="field-label">Linhas de corte da página</p><select className="field-control" value={sheet.cropMarks.mode} onChange={(event) => setSheet({ cropMarks: { ...sheet.cropMarks, mode: event.target.value as typeof sheet.cropMarks.mode } })}><option value="none">Nenhuma</option><option value="corners">Cantos</option><option value="full">Linha completa</option><option value="dashed">Pontilhada</option></select><div className="mt-2 grid grid-cols-2 gap-2"><label className="field-label">Espessura<input className="field-control" type="number" min="0.1" step="0.1" value={sheet.cropMarks.thicknessMm} onChange={(event) => setSheet({ cropMarks: { ...sheet.cropMarks, thicknessMm: Math.max(0.1, Number(event.target.value)) } })} /></label><label className="field-label">Distância<input className="field-control" type="number" min="0" step="0.5" value={sheet.cropMarks.offsetMm} onChange={(event) => setSheet({ cropMarks: { ...sheet.cropMarks, offsetMm: Math.max(0, Number(event.target.value)) } })} /></label></div></div>
            </SettingsSection>
            <SettingsSection title="Foto" description={selectedPhoto ? selectedPhoto.filename : 'Selecione uma foto na biblioteca'}>
              {selectedPhoto ? <PhotoSizePanel photo={selectedPhoto} unit={photoUnit} customPresets={customPresets} onUnitChange={setPhotoUnit} onChange={(patch) => updatePhoto(selectedPhoto.id, patch)} onSavePreset={(preset) => setCustomPresets((current) => [...current.filter((item) => item.name !== preset.name), preset])} onDeletePreset={(presetId) => setCustomPresets((current) => current.filter((item) => item.id !== presetId))} /> : <p className="text-xs leading-5 text-stone-400">Importe e selecione uma foto para definir tamanho físico, orientação e preset.</p>}
            </SettingsSection>
            {selectedPhoto && <SettingsSection title="Recorte" description="Enquadramento, zoom e posição da imagem" defaultOpen={false}><CropPanel photo={selectedPhoto} onOpenCrop={() => setEditingPhotoId(selectedPhoto.id)} onChange={(patch) => updatePhoto(selectedPhoto.id, patch)} /></SettingsSection>}
            {selectedPlacement && <SettingsSection title="Posição" description="Coordenadas, rotação e página da foto" defaultOpen><PlacementPanel placement={selectedPlacement} pageCount={currentPageCount} onRotate={() => rotatePlacement(selectedPlacement.id)} onMove={(sheetIndex) => movePlacementToSheet(selectedPlacement.id, sheetIndex)} onChange={(patch) => updatePlacement(selectedPlacement.id, patch)} onRemove={() => { useAppStore.getState().removePlacement(selectedPlacement.id); setSelectedPlacementId(null); setProjectStatus('Foto removida da página') }} /></SettingsSection>}
            <SettingsSection title="Exportação" description="Qualidade dos arquivos JPEG" defaultOpen={false}><label className="field-label">Qualidade JPEG<input className="field-control" type="number" min="1" max="100" value={jpegQuality} onChange={(event) => setJpegQuality(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} /></label></SettingsSection>
          </div>
        </aside>
      </div>
      {editingPhoto && <CropEditor photo={{ ...editingPhoto, thumbnailDataUrl: editingPhoto.previewDataUrl ?? editingPhoto.thumbnailDataUrl }} onCancel={() => setEditingPhotoId(null)} onSave={(patch) => { updatePhoto(editingPhoto.id, patch); setEditingPhotoId(null) }} />}
    </main>
  )
}

function CropEditor({ photo, onCancel, onSave }: { photo: Photo; onCancel: () => void; onSave: (patch: Partial<Photo>) => void }) {
  const [draft, setDraft] = useState(photo)
  const cropDrag = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)
  const updateCrop = (patch: Partial<Photo['crop']>) => setDraft((current) => ({ ...current, crop: { ...current.crop, ...patch } }))
  const handleCropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (draft.fitMode !== 'cover') setDraft((current) => ({ ...current, fitMode: 'cover' }))
    cropDrag.current = { startX: event.clientX, startY: event.clientY, offsetX: draft.crop.offsetX, offsetY: draft.crop.offsetY }
  }
  const handleCropPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = cropDrag.current
    if (!drag) return
    const rect = event.currentTarget.getBoundingClientRect()
    const deltaX = ((event.clientX - drag.startX) / rect.width) * -2
    const deltaY = ((event.clientY - drag.startY) / rect.height) * -2
    const nextOffsetX = Math.max(-1, Math.min(1, drag.offsetX + deltaX))
    const nextOffsetY = Math.max(-1, Math.min(1, drag.offsetY + deltaY))
    setDraft((current) => ({ ...current, fitMode: 'cover', crop: { ...current.crop, offsetX: nextOffsetX, offsetY: nextOffsetY } }))
  }
  const handleCropPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    cropDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-8"><div className="grid w-full max-w-3xl grid-cols-[1fr_260px] overflow-hidden rounded-2xl bg-panel shadow-2xl"><div className="flex min-h-[460px] items-center justify-center bg-[#e9e6e0] p-10"><div className={`relative w-full max-w-[520px] overflow-hidden ${draft.fitMode === 'contain' ? 'bg-white' : 'bg-black'}`} style={{ aspectRatio: `${Math.max(1, photo.widthMm)} / ${Math.max(1, photo.heightMm)}` }} onPointerDown={handleCropPointerDown} onPointerMove={handleCropPointerMove} onPointerUp={handleCropPointerUp} onPointerCancel={handleCropPointerUp}><div role="img" aria-label={photo.filename} className={`absolute inset-0 bg-center bg-no-repeat transition ${draft.fitMode === 'cover' ? 'cursor-move' : 'cursor-default'}`} style={{ backgroundImage: `url(${photo.thumbnailDataUrl})`, backgroundSize: cropBackgroundSize(photo, photo.widthMm, photo.heightMm, draft.fitMode, draft.crop.zoom), backgroundPosition: `${50 + draft.crop.offsetX * 50}% ${50 + draft.crop.offsetY * 50}%`, transform: `rotate(${draft.rotation}deg) scaleX(${draft.crop.flipX ? -1 : 1}) scaleY(${draft.crop.flipY ? -1 : 1})` }} /><div className="pointer-events-none absolute inset-0 border-2 border-white/80" /><span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[11px] text-white">Arraste para posicionar</span></div></div><div className="space-y-5 border-l border-stone-200 p-5"><div><h2 className="text-sm font-semibold">Recortar e enquadrar</h2><p className="mt-1 truncate text-xs text-stone-400">{photo.filename}</p><p className="mt-1 text-[11px] text-stone-400">Quadro final: {photo.widthMm.toFixed(1)} × {photo.heightMm.toFixed(1)} mm</p></div><div className="grid grid-cols-2 gap-2"><button onClick={() => setDraft((current) => ({ ...current, fitMode: 'cover' }))} className={`choice-button ${draft.fitMode === 'cover' ? 'choice-button-active' : ''}`}>Preencher e recortar</button><button onClick={() => setDraft((current) => ({ ...current, fitMode: 'contain' }))} className={`choice-button ${draft.fitMode === 'contain' ? 'choice-button-active' : ''}`}>Encaixar</button></div><label className="field-label">Zoom<input className="mt-3 w-full accent-accent" type="range" min="1" max="3" step="0.01" value={draft.crop.zoom} onChange={(event) => setDraft((current) => ({ ...current, fitMode: 'cover', crop: { ...current.crop, zoom: Number(event.target.value) } }))} /></label><label className="field-label">Horizontal<input className="mt-3 w-full accent-accent" type="range" min="-1" max="1" step="0.01" value={draft.crop.offsetX} onChange={(event) => setDraft((current) => ({ ...current, fitMode: 'cover', crop: { ...current.crop, offsetX: Number(event.target.value) } }))} /></label><label className="field-label">Vertical<input className="mt-3 w-full accent-accent" type="range" min="-1" max="1" step="0.01" value={draft.crop.offsetY} onChange={(event) => setDraft((current) => ({ ...current, fitMode: 'cover', crop: { ...current.crop, offsetY: Number(event.target.value) } }))} /></label><div className="grid grid-cols-2 gap-2"><button onClick={() => setDraft((current) => ({ ...current, crop: { ...current.crop, zoom: 1, offsetX: 0, offsetY: 0 }, fitMode: 'cover' }))} className="choice-button">Resetar recorte</button><button onClick={() => setDraft((current) => ({ ...current, rotation: (current.rotation + 90) % 360 }))} className="choice-button">Girar 90°</button></div><button onClick={() => updateCrop({ flipX: !draft.crop.flipX })} className="choice-button w-full">Espelhar horizontalmente</button><div className="flex gap-2 border-t border-stone-200 pt-4"><button onClick={onCancel} className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600">Cancelar</button><button onClick={() => onSave({ crop: draft.crop, rotation: draft.rotation, fitMode: draft.fitMode })} className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white">Aplicar recorte</button></div></div></div></div>
}

function PhotoSizePanel({ photo, unit, customPresets, onUnitChange, onChange, onSavePreset, onDeletePreset }: { photo: Photo; unit: PhysicalUnit; customPresets: PrintPresetOption[]; onUnitChange: (unit: PhysicalUnit) => void; onChange: (patch: Partial<Photo>) => void; onSavePreset: (preset: PrintPresetOption) => void; onDeletePreset: (presetId: string) => void }) {
  const allPresets = [...printPresets, ...customPresets]
  const selectedPreset = allPresets.find((preset) => preset.widthMm === photo.widthMm && preset.heightMm === photo.heightMm)?.id ?? ''
  const isLandscape = photo.widthMm > photo.heightMm
  const setDimension = (key: 'widthMm' | 'heightMm', value: string) => {
    const parsed = Number(value.replace(',', '.'))
    if (Number.isFinite(parsed) && parsed > 0) onChange({ [key]: clampPhotoSizeMm(unitToMm(parsed, unit)) })
  }
  const setOrientation = (landscape: boolean) => {
    const short = Math.min(photo.widthMm, photo.heightMm)
    const long = Math.max(photo.widthMm, photo.heightMm)
    const sourceIsLandscape = photo.originalWidth > photo.originalHeight
    const desiredRotation = photo.originalWidth === photo.originalHeight || landscape === sourceIsLandscape ? 0 : 90
    if (landscape === isLandscape && photo.rotation % 360 === desiredRotation) return
    onChange({
      ...(landscape ? { widthMm: long, heightMm: short } : { widthMm: short, heightMm: long }),
      rotation: desiredRotation
    })
  }

  return <div>
    <div className="flex items-center justify-between"><div><p className="field-label">Tamanho físico da foto</p><p className="mt-1 max-w-[150px] truncate text-xs text-stone-500">{photo.filename}</p></div><select className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs" value={unit} onChange={(event) => onUnitChange(event.target.value as PhysicalUnit)} aria-label="Unidade"><option value="mm">mm</option><option value="cm">cm</option><option value="in">polegadas</option></select></div>
    <label className="field-label mt-4">Preset<select className="field-control" value={selectedPreset} onChange={(event) => { const preset = allPresets.find((item) => item.id === event.target.value); if (preset) onChange({ widthMm: preset.widthMm, heightMm: preset.heightMm, ...(preset.defaultQuantity ? { quantity: preset.defaultQuantity } : {}) }) }}><option value="">Personalizado</option>{(['Fotografia', 'Scrapbook', 'Personalizado'] as const).map((category) => <optgroup key={category} label={category}>{allPresets.filter((preset) => preset.category === category).map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</optgroup>)}</select></label>
    <div className="mt-3 grid grid-cols-2 gap-2"><label className="field-label">Largura<input className="field-control" type="number" min="1" max="1000" step="0.01" value={mmToUnit(photo.widthMm, unit).toFixed(2)} onChange={(event) => setDimension('widthMm', event.target.value)} /></label><label className="field-label">Altura<input className="field-control" type="number" min="1" max="1000" step="0.01" value={mmToUnit(photo.heightMm, unit).toFixed(2)} onChange={(event) => setDimension('heightMm', event.target.value)} /></label></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><button className={`choice-button ${!isLandscape ? 'choice-button-active' : ''}`} onClick={() => setOrientation(false)}>Retrato</button><button className={`choice-button ${isLandscape ? 'choice-button-active' : ''}`} onClick={() => setOrientation(true)}>Paisagem</button></div>
    <p className="mt-2 text-[11px] text-stone-400">A troca gira a foto 90° e mantém o quadro físico.</p>
    <div className="mt-2 flex gap-2"><button className="choice-button flex-1" onClick={() => { const name = prompt('Nome do preset personalizado:'); if (name?.trim()) onSavePreset({ id: `custom-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: name.trim(), category: 'Personalizado', widthMm: photo.widthMm, heightMm: photo.heightMm, defaultQuantity: photo.quantity }) }}>Salvar preset</button>{selectedPreset.startsWith('custom-') && <button className="choice-button text-red-500" onClick={() => onDeletePreset(selectedPreset)}>Excluir</button>}</div>
    <p className="mt-2 text-[11px] text-stone-400">Internamente: {photo.widthMm.toFixed(1)} × {photo.heightMm.toFixed(1)} mm</p>
  </div>
}

function CropPanel({ photo, onOpenCrop, onChange }: { photo: Photo; onOpenCrop: () => void; onChange: (patch: Partial<Photo>) => void }) {
  return <div className="space-y-3"><div className="rounded-lg bg-stone-100 px-3 py-2 text-[11px] leading-4 text-stone-500">O recorte controla qual parte da imagem aparece dentro do tamanho físico. A posição e o zoom não alteram o arquivo original.</div><div className="grid grid-cols-2 gap-2"><button onClick={() => onChange({ fitMode: 'contain', crop: { ...photo.crop, zoom: 1, offsetX: 0, offsetY: 0 } })} className={`choice-button ${photo.fitMode === 'contain' ? 'choice-button-active' : ''}`}>Foto inteira</button><button onClick={() => onChange({ fitMode: 'cover' })} className={`choice-button ${photo.fitMode === 'cover' ? 'choice-button-active' : ''}`}>Preencher</button></div><div className="grid grid-cols-3 gap-2 text-center text-[11px] text-stone-500"><div className="rounded-lg border border-stone-200 bg-white p-2"><span className="block font-semibold text-stone-700">Zoom</span>{photo.crop.zoom.toFixed(2)}×</div><div className="rounded-lg border border-stone-200 bg-white p-2"><span className="block font-semibold text-stone-700">Horizontal</span>{photo.crop.offsetX.toFixed(2)}</div><div className="rounded-lg border border-stone-200 bg-white p-2"><span className="block font-semibold text-stone-700">Vertical</span>{photo.crop.offsetY.toFixed(2)}</div></div><button onClick={onOpenCrop} className="w-full rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-stone-700">Abrir editor de recorte</button></div>
}

function SettingsSection({ title, description, children, defaultOpen = true }: { title: string; description: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return <section className="overflow-hidden rounded-xl border border-stone-200 bg-white"><button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-stone-50" aria-expanded={open}><span><span className="block text-sm font-semibold text-stone-700">{title}</span><span className="mt-0.5 block text-[11px] text-stone-400">{description}</span></span><span className="text-lg leading-none text-stone-400">{open ? '−' : '+'}</span></button>{open && <div className="space-y-4 border-t border-stone-200 p-4">{children}</div>}</section>
}

function PlacementPanel({ placement, pageCount, onRotate, onMove, onChange, onRemove }: { placement: { id: string; sheetIndex: number; xMm: number; yMm: number; widthMm: number; heightMm: number; rotation: number }; pageCount: number; onRotate: () => void; onMove: (sheetIndex: number) => void; onChange: (patch: Partial<typeof placement>) => void; onRemove: () => void }) {
  const aspectRatio = placement.widthMm / placement.heightMm
  const changeWidth = (value: number) => onChange({ widthMm: value, heightMm: value / aspectRatio })
  const changeHeight = (value: number) => onChange({ heightMm: value, widthMm: value * aspectRatio })
  return <div className="border-t border-stone-200 pt-5">
    <div className="flex items-center justify-between"><p className="field-label">Posicionamento manual</p><span className="text-[11px] text-stone-400">{placement.rotation}°</span></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><label className="field-label">X (mm)<input className="field-control" type="number" value={placement.xMm.toFixed(1)} onChange={(event) => onChange({ xMm: Number(event.target.value) })} /></label><label className="field-label">Y (mm)<input className="field-control" type="number" value={placement.yMm.toFixed(1)} onChange={(event) => onChange({ yMm: Number(event.target.value) })} /></label></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><label className="field-label">Largura (mm)<input className="field-control" type="number" min="5" step="0.1" value={placement.widthMm.toFixed(1)} onChange={(event) => changeWidth(Number(event.target.value))} /></label><label className="field-label">Altura (mm)<input className="field-control" type="number" min="5" step="0.1" value={placement.heightMm.toFixed(1)} onChange={(event) => changeHeight(Number(event.target.value))} /></label></div>
    <p className="mt-2 text-[11px] text-stone-400">Proporção bloqueada · arraste a foto para mover e o canto laranja para redimensionar.</p>
    <div className="mt-3 flex gap-2"><button onClick={onRotate} className="choice-button flex-1">Girar 90°</button><select className="choice-button flex-1" value={placement.sheetIndex} onChange={(event) => onMove(Number(event.target.value))}>{Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>Página {index + 1}</option>)}</select></div>
    <button onClick={onRemove} className="mt-3 w-full rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">Remover da página</button>
  </div>
}

function CropMarkOverlay({ mode, thickness }: { mode: 'none' | 'corners' | 'full' | 'dashed'; thickness: number }) {
  if (mode === 'none') return null
  if (mode === 'full' || mode === 'dashed') return <div className={`pointer-events-none absolute -inset-1 ${mode === 'dashed' ? 'border border-dashed' : 'border'} border-stone-400`} style={{ borderWidth: `${Math.max(1, thickness * 2)}px` }} />
  return <div className="pointer-events-none absolute -inset-1"><i className="absolute left-0 top-0 h-2 w-2 border-l border-t border-stone-400" /><i className="absolute right-0 top-0 h-2 w-2 border-r border-t border-stone-400" /><i className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-stone-400" /><i className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-stone-400" /></div>
}

function PhotoCard({ photo, selected, onSelect, onInsert, onDelete, onChangeQuantity }: { photo: Photo; selected: boolean; onSelect: () => void; onInsert: () => void; onDelete: () => void; onChangeQuantity: (quantity: number) => void }) {
  return <div className={`group flex gap-3 rounded-xl border p-2 transition ${selected ? 'border-accent bg-orange-50' : 'border-transparent bg-white hover:border-stone-200'}`}><button onClick={onSelect} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-stone-100"><img loading="lazy" src={photo.thumbnailDataUrl} alt={photo.filename} className="h-full w-full object-cover" /></button><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-stone-700">{photo.filename}</p><p className="mt-1 text-[11px] text-stone-400">{photo.originalWidth} × {photo.originalHeight}px</p><div className="mt-1 flex items-center gap-1"><input className="w-10 rounded border border-stone-200 px-1 py-0.5 text-center text-xs" type="number" min="1" max="999" value={photo.quantity} onChange={(event) => onChangeQuantity(Math.max(1, Number(event.target.value) || 1))} aria-label={`Quantidade de ${photo.filename}`} /><span className="text-[11px] text-stone-400">cópias</span></div><button onClick={onInsert} className="mt-2 w-full rounded-md bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-600 transition hover:bg-orange-100 hover:text-accent">Inserir na página</button></div><button onClick={onDelete} className="self-start px-1 text-sm text-stone-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100" aria-label={`Excluir ${photo.filename}`}>×</button></div>
}
