import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { Download, Loader2, Trash2, X, Play, ZoomIn } from 'lucide-react'
import { FileDropZone } from '../components/FileDropZone'
import { SettingsPanel, type DitherAlgorithm, type ColorPalette } from '../components/SettingsPanel'
import { useGooglePhotos, getPhotoUrl, type PickerMediaItem } from '../hooks/useGooglePhotos'
import { applyDithering, type DitheringAlgorithm, type PaletteKey } from '../lib/dithering'
import { scaleImage } from '../lib/image-processing'
import { downloadImage, downloadAllAsZip, canvasToBlob, blobToDataUrl } from '../lib/download'

export const Route = createFileRoute('/')({ component: App })

interface ProcessedImage {
  id: string
  filename: string
  originalUrl: string
  ditheredUrl: string | null
  ditheredBlob: Blob | null
  isProcessing: boolean
  needsProcessing: boolean
  error: string | null
}

const paletteMap: Record<ColorPalette, PaletteKey> = {
  'spectra-6': 'spectra-6',
  'black-white': 'bw',
  'grayscale': '4-gray',
  'red-black-white': '3-color',
}

function App() {
  const [algorithm, setAlgorithm] = useState<DitherAlgorithm>('floyd-steinberg')
  const [palette, setPalette] = useState<ColorPalette>('spectra-6')
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [modalImage, setModalImage] = useState<{ url: string; title: string } | null>(null)
  const [isProcessingAll, setIsProcessingAll] = useState(false)

  const {
    isSignedIn,
    user,
    loading: isGoogleLoading,
    picking: isPickerOpen,
    signIn,
    signOut,
    openPicker,
    error: googleError,
  } = useGooglePhotos()

  const processImage = useCallback(
    async (imageElement: HTMLImageElement, imageId: string) => {
      try {
        setImages((prev) =>
          prev.map((img) =>
            img.id === imageId ? { ...img, isProcessing: true, needsProcessing: false } : img
          )
        )

        // Scale image to 1600x1200
        const scaledCanvas = scaleImage(imageElement, 1600, 1200)

        // Apply dithering
        const paletteKey = paletteMap[palette]
        const ditheredCanvas = applyDithering(
          scaledCanvas,
          algorithm as DitheringAlgorithm,
          paletteKey
        )

        // Convert to blob and data URL
        const blob = await canvasToBlob(ditheredCanvas)
        const dataUrl = await blobToDataUrl(blob)

        setImages((prev) =>
          prev.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  ditheredUrl: dataUrl,
                  ditheredBlob: blob,
                  isProcessing: false,
                  error: null,
                }
              : img
          )
        )
      } catch (error) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === imageId
              ? {
                  ...img,
                  isProcessing: false,
                  error: error instanceof Error ? error.message : 'Processing failed',
                }
              : img
          )
        )
      }
    },
    [algorithm, palette]
  )

  const handleFilesSelected = useCallback((files: File[]) => {
    const newImages: ProcessedImage[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      filename: file.name,
      originalUrl: URL.createObjectURL(file),
      ditheredUrl: null,
      ditheredBlob: null,
      isProcessing: false,
      needsProcessing: true,
      error: null,
    }))

    setImages((prev) => [...prev, ...newImages])
  }, [])

  const handleProcessAll = useCallback(async () => {
    const imagesToProcess = images.filter((img) => img.needsProcessing || (!img.ditheredUrl && !img.isProcessing))
    if (imagesToProcess.length === 0) return

    setIsProcessingAll(true)

    for (const imageData of imagesToProcess) {
      const img = new Image()
      await new Promise<void>((resolve) => {
        img.onload = async () => {
          await processImage(img, imageData.id)
          resolve()
        }
        img.onerror = () => {
          setImages((prev) =>
            prev.map((i) =>
              i.id === imageData.id
                ? { ...i, isProcessing: false, needsProcessing: false, error: 'Failed to load image' }
                : i
            )
          )
          resolve()
        }
        if (imageData.originalUrl.startsWith('http')) {
          img.crossOrigin = 'anonymous'
        }
        img.src = imageData.originalUrl
      })
    }

    setIsProcessingAll(false)
  }, [images, processImage])

  const handleGooglePhotosClick = useCallback(async () => {
    const selectedItems = await openPicker()

    if (selectedItems.length === 0) return

    // Add each selected photo
    selectedItems.forEach((item: PickerMediaItem) => {
      const baseUrl = item.mediaFile?.baseUrl || item.baseUrl
      const filename = item.mediaFile?.filename || 'google-photo.jpg'

      const imageData: ProcessedImage = {
        id: `google-${item.id}-${Date.now()}`,
        filename,
        originalUrl: getPhotoUrl(baseUrl, { width: 2000, height: 2000 }),
        ditheredUrl: null,
        ditheredBlob: null,
        isProcessing: false,
        needsProcessing: true,
        error: null,
      }

      setImages((prev) => [...prev, imageData])
    })
  }, [openPicker])

  const handleDownloadSingle = useCallback((image: ProcessedImage) => {
    if (image.ditheredBlob) {
      downloadImage(image.ditheredBlob, `dithered-${image.filename}`)
    }
  }, [])

  const handleDownloadAll = useCallback(async () => {
    const imagesToDownload = images.filter(
      (img) => img.ditheredBlob && !img.isProcessing && !img.error
    )

    if (imagesToDownload.length === 0) return

    await downloadAllAsZip(
      imagesToDownload.map((img) => ({
        blob: img.ditheredBlob!,
        filename: `dithered-${img.filename}`,
      }))
    )
  }, [images])

  const handleRemoveImage = useCallback((imageId: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === imageId)
      if (image) {
        URL.revokeObjectURL(image.originalUrl)
        if (image.ditheredUrl) {
          URL.revokeObjectURL(image.ditheredUrl)
        }
      }
      return prev.filter((img) => img.id !== imageId)
    })
  }, [])

  const handleClearAll = useCallback(() => {
    images.forEach((image) => {
      URL.revokeObjectURL(image.originalUrl)
      if (image.ditheredUrl) {
        URL.revokeObjectURL(image.ditheredUrl)
      }
    })
    setImages([])
  }, [images])

  const processedCount = images.filter(
    (img) => img.ditheredUrl && !img.isProcessing && !img.error
  ).length

  const pendingCount = images.filter(
    (img) => img.needsProcessing || (!img.ditheredUrl && !img.isProcessing && !img.error)
  ).length

  const anyProcessing = images.some((img) => img.isProcessing)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="w-full bg-slate-900/80 backdrop-blur-sm border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">E-ink Dither</h1>
                <p className="text-xs text-slate-400">Optimize images for e-ink displays</p>
              </div>
            </div>

            {/* Google Auth - only in header */}
            <div className="flex items-center gap-3">
              {isGoogleLoading ? (
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              ) : isSignedIn ? (
                <div className="flex items-center gap-3">
                  {user && (
                    <span className="text-sm text-slate-300 hidden sm:block">{user.name}</span>
                  )}
                  <button
                    onClick={signOut}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={signIn}
                  className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-lg transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <SettingsPanel
              algorithm={algorithm}
              palette={palette}
              onAlgorithmChange={setAlgorithm}
              onPaletteChange={setPalette}
            />

            {/* Google Photos button (only when signed in) */}
            {isSignedIn && (
              <button
                onClick={handleGooglePhotosClick}
                disabled={isPickerOpen}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isPickerOpen ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Selecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                    Google Photos
                  </>
                )}
              </button>
            )}

            {googleError && (
              <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg">{googleError}</p>
            )}

            {/* Process Button */}
            {images.length > 0 && pendingCount > 0 && (
              <button
                onClick={handleProcessAll}
                disabled={anyProcessing || isProcessingAll}
                className="w-full px-4 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-xl transition-all flex items-center justify-center gap-2 font-semibold shadow-lg"
              >
                {anyProcessing || isProcessingAll ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Process {pendingCount} Image{pendingCount !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}

            {/* Download All */}
            {processedCount > 0 && (
              <button
                onClick={handleDownloadAll}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download {processedCount > 1 ? `All (${processedCount})` : 'Image'}
              </button>
            )}

            {/* Clear All */}
            {images.length > 0 && (
              <button
                onClick={handleClearAll}
                className="w-full px-4 py-2 text-slate-400 hover:text-red-400 text-sm transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            <FileDropZone onFilesSelected={handleFilesSelected} />

            {images.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700 group"
                  >
                    {/* Image preview */}
                    <div className="relative aspect-[4/3]">
                      <img
                        src={image.ditheredUrl || image.originalUrl}
                        alt={image.filename}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setModalImage({
                          url: image.ditheredUrl || image.originalUrl,
                          title: image.ditheredUrl ? `Dithered: ${image.filename}` : image.filename
                        })}
                      />

                      {/* Status overlay */}
                      {image.isProcessing && (
                        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                            <p className="text-sm text-slate-300">Processing...</p>
                          </div>
                        </div>
                      )}

                      {image.error && (
                        <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center p-4">
                          <p className="text-sm text-red-200 text-center">{image.error}</p>
                        </div>
                      )}

                      {/* Zoom icon on hover */}
                      {!image.isProcessing && !image.error && (
                        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ZoomIn className="w-8 h-8 text-white" />
                        </div>
                      )}

                      {/* Status badge */}
                      {!image.isProcessing && !image.error && (
                        <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                          image.ditheredUrl
                            ? 'bg-green-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}>
                          {image.ditheredUrl ? 'Done' : 'Pending'}
                        </div>
                      )}

                      {/* Remove button */}
                      <button
                        onClick={() => handleRemoveImage(image.id)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Footer */}
                    <div className="p-3">
                      <p className="text-sm text-slate-300 truncate mb-2">{image.filename}</p>
                      {image.ditheredUrl && (
                        <button
                          onClick={() => handleDownloadSingle(image)}
                          className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setModalImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setModalImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-white text-center mb-4 text-lg">{modalImage.title}</p>
            <img
              src={modalImage.url}
              alt={modalImage.title}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
}
