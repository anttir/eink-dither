import JSZip from 'jszip';

/**
 * Triggers a browser download for a blob with the specified filename
 * @param blob - The blob to download
 * @param filename - The name for the downloaded file
 */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Adds a suffix to a filename while preserving the extension
 * @param filename - Original filename
 * @param suffix - Suffix to add (default: '_dithered')
 * @param defaultExtension - Default extension if none exists (default: '.png')
 * @returns Filename with suffix added before extension
 */
export function addFilenameSuffix(
  filename: string,
  suffix: string = '_dithered',
  defaultExtension: string = '.png'
): string {
  const lastDotIndex = filename.lastIndexOf('.');

  if (lastDotIndex === -1 || lastDotIndex === 0) {
    // No extension found or filename starts with dot
    return `${filename}${suffix}${defaultExtension}`;
  }

  const name = filename.substring(0, lastDotIndex);
  const extension = filename.substring(lastDotIndex);

  return `${name}${suffix}${extension}`;
}

/**
 * Creates a ZIP file containing multiple images and triggers download
 * @param images - Array of objects containing blob and filename
 * @param zipFilename - Name for the ZIP file (default: 'dithered_images.zip')
 */
export async function downloadAllAsZip(
  images: Array<{ blob: Blob; filename: string }>,
  zipFilename: string = 'dithered_images.zip'
): Promise<void> {
  if (images.length === 0) {
    throw new Error('No images to download');
  }

  const zip = new JSZip();

  // Add all images to the ZIP
  for (const { blob, filename } of images) {
    zip.file(filename, blob);
  }

  // Generate the ZIP file
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  // Trigger download
  downloadImage(zipBlob, zipFilename);
}

/**
 * Converts a Blob to a data URL for preview purposes
 * @param blob - The blob to convert
 * @returns Promise that resolves to a data URL string
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };

    reader.onerror = () => {
      reject(new Error('FileReader error: ' + reader.error?.message));
    };

    reader.readAsDataURL(blob);
  });
}

/**
 * Creates a blob from a canvas element
 * @param canvas - The canvas element
 * @param mimeType - MIME type for the image (default: 'image/png')
 * @param quality - Image quality for lossy formats (0-1, default: 0.92)
 * @returns Promise that resolves to a Blob
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string = 'image/png',
  quality: number = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Downloads an image directly from a canvas element
 * @param canvas - The canvas element
 * @param filename - The name for the downloaded file
 * @param mimeType - MIME type for the image (default: 'image/png')
 * @param quality - Image quality for lossy formats (0-1, default: 0.92)
 */
export async function downloadCanvasImage(
  canvas: HTMLCanvasElement,
  filename: string,
  mimeType: string = 'image/png',
  quality: number = 0.92
): Promise<void> {
  const blob = await canvasToBlob(canvas, mimeType, quality);
  downloadImage(blob, filename);
}
