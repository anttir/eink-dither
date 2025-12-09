import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { Download, Loader2, ImageIcon, Trash2 } from 'lucide-react'
import { FileDropZone } from '../components/FileDropZone'
import { ImagePreview } from '../components/ImagePreview'
import { SettingsPanel, type DitherAlgorithm, type ColorPalette } from '../components/SettingsPanel'
import { Header } from '../components/Header'
import { useGooglePhotos } from '../hooks/useGooglePhotos'
import { applyDithering, type DitheringAlgorithm, type PaletteKey } from '../lib/dithering'
import { scaleImage } from '../lib/image-processing'
import { downloadImage, downloadAllAsZip, canvasToBlob, blobToDataUrl } from '../lib/download'
import { getPhotoUrl, type Photo } from '../lib/google-photos'

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
  const [showGooglePhotos, setShowGooglePhotos] = useState(false)

  const {
    isSignedIn,
    isLoading: isGoogleLoading,
    photos,
    signIn,
    signOut,
    loadPhotos,
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

  const handleGooglePhotoSelect = useCallback(
    (photo: Photo) => {
      const imageData: ProcessedImage = {
        id: `google-${photo.id}`,
        filename: photo.filename || 'google-photo.jpg',
        originalUrl: getPhotoUrl(photo, 2000, 2000),
        ditheredUrl: null,
        ditheredBlob: null,
        isProcessing: true,
        error: null,
      }

      setImages((prev) => [...prev, imageData])
      setShowGooglePhotos(false)

      // Process the image
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
      img.crossOrigin = 'anonymous'
      img.src = imageData.originalUrl
    },
    [processImage]
  )

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

            {isSignedIn && (
              <button
                onClick={() => {
                  setShowGooglePhotos(true)
                  if (photos.length === 0) {
                    loadPhotos()
                  }
                }}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-5 h-5" />
                Google Photos
              </button>
            )}

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

      {/* Google Photos Modal */}
      {showGooglePhotos && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Select from Google Photos</h2>
              <button
                onClick={() => setShowGooglePhotos(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isGoogleLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              ) : photos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No photos found. Try loading your photos.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => handleGooglePhotoSelect(photo)}
                      className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-cyan-400 transition-all"
                    >
                      <img
                        src={getPhotoUrl(photo, 400, 400)}
                        alt={photo.filename || 'Photo'}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
