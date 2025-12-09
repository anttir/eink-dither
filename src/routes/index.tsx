import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { Download, Loader2, ImageIcon, Trash2 } from 'lucide-react'
import { FileDropZone } from '../components/FileDropZone'
import { ImagePreview } from '../components/ImagePreview'
import { SettingsPanel, type DitherAlgorithm, type ColorPalette } from '../components/SettingsPanel'
import { Header } from '../components/Header'
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

  const {
    isSignedIn,
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

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const newImages: ProcessedImage[] = files.map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        filename: file.name,
        originalUrl: URL.createObjectURL(file),
        ditheredUrl: null,
        ditheredBlob: null,
        isProcessing: true,
        error: null,
      }))

      setImages((prev) => [...prev, ...newImages])

      // Process each image
      newImages.forEach((imageData) => {
        const img = new Image()
        img.onload = () => {
          processImage(img, imageData.id)
        }
        img.onerror = () => {
          setImages((prev) =>
            prev.map((img) =>
              img.id === imageData.id
                ? { ...img, isProcessing: false, error: 'Failed to load image' }
                : img
            )
          )
        }
        img.src = imageData.originalUrl
      })
    },
    [processImage]
  )

  const handleGooglePhotosClick = useCallback(async () => {
    const selectedItems = await openPicker()

    if (selectedItems.length === 0) return

    // Process each selected photo
    selectedItems.forEach((item: PickerMediaItem) => {
      const baseUrl = item.mediaFile?.baseUrl || item.baseUrl
      const filename = item.mediaFile?.filename || 'google-photo.jpg'

      const imageData: ProcessedImage = {
        id: `google-${item.id}-${Date.now()}`,
        filename,
        originalUrl: getPhotoUrl(baseUrl, { width: 2000, height: 2000 }),
        ditheredUrl: null,
        ditheredBlob: null,
        isProcessing: true,
        error: null,
      }

      setImages((prev) => [...prev, imageData])

      // Process the image
      const img = new Image()
      img.onload = () => {
        processImage(img, imageData.id)
      }
      img.onerror = () => {
        setImages((prev) =>
          prev.map((img) =>
            img.id === imageData.id
              ? { ...img, isProcessing: false, error: 'Failed to load image from Google Photos' }
              : img
          )
        )
      }
      img.crossOrigin = 'anonymous'
      img.src = imageData.originalUrl
    })
  }, [openPicker, processImage])

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />

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

            {/* Google Photos section */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Google Photos</h3>

              {isGoogleLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                </div>
              ) : isSignedIn ? (
                <div className="space-y-2">
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
                        <ImageIcon className="w-5 h-5" />
                        Select Photos
                      </>
                    )}
                  </button>
                  <button
                    onClick={signOut}
                    className="w-full px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={signIn}
                  className="w-full px-4 py-3 bg-white hover:bg-gray-100 text-gray-800 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </button>
              )}

              {googleError && (
                <p className="mt-2 text-sm text-red-400">{googleError}</p>
              )}
            </div>

            {processedCount > 1 && (
              <button
                onClick={handleDownloadAll}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download All ({processedCount})
              </button>
            )}

            {images.length > 0 && (
              <button
                onClick={handleClearAll}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Clear All
              </button>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            <FileDropZone onFilesSelected={handleFilesSelected} />

            {images.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {images.map((image) => (
                  <div key={image.id} className="relative">
                    <ImagePreview
                      originalUrl={image.originalUrl}
                      ditheredUrl={image.ditheredUrl}
                      filename={image.filename}
                      isProcessing={image.isProcessing}
                      error={image.error}
                      onDownload={() => handleDownloadSingle(image)}
                    />
                    <button
                      onClick={() => handleRemoveImage(image.id)}
                      className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
