/**
 * Image processing utilities for high-quality scaling and manipulation
 * Implements Lanczos-3 resampling for optimal image quality
 */

/**
 * Lanczos kernel function for high-quality resampling
 * @param x - Input value
 * @param a - Lanczos parameter (typically 3 for Lanczos-3)
 */
function lanczosKernel(x: number, a: number = 3): number {
  if (x === 0) return 1;
  if (x <= -a || x >= a) return 0;

  const pi_x = Math.PI * x;
  return (a * Math.sin(pi_x) * Math.sin(pi_x / a)) / (pi_x * pi_x);
}

/**
 * Apply Lanczos-3 resampling to scale an image
 * @param srcImageData - Source image data
 * @param destWidth - Target width
 * @param destHeight - Target height
 */
function lanczosResample(
  srcImageData: ImageData,
  destWidth: number,
  destHeight: number
): ImageData {
  const srcWidth = srcImageData.width;
  const srcHeight = srcImageData.height;
  const srcData = srcImageData.data;

  const destImageData = new ImageData(destWidth, destHeight);
  const destData = destImageData.data;

  const xRatio = srcWidth / destWidth;
  const yRatio = srcHeight / destHeight;
  const a = 3; // Lanczos-3 parameter

  // Pre-calculate filter weights for performance
  const xWeights: number[][] = [];
  const xIndices: number[][] = [];

  for (let destX = 0; destX < destWidth; destX++) {
    const srcX = (destX + 0.5) * xRatio - 0.5;
    const startX = Math.max(0, Math.floor(srcX) - a + 1);
    const endX = Math.min(srcWidth - 1, Math.floor(srcX) + a);

    const weights: number[] = [];
    const indices: number[] = [];
    let weightSum = 0;

    for (let x = startX; x <= endX; x++) {
      const weight = lanczosKernel(x - srcX, a);
      weights.push(weight);
      indices.push(x);
      weightSum += weight;
    }

    // Normalize weights
    for (let i = 0; i < weights.length; i++) {
      weights[i] /= weightSum;
    }

    xWeights[destX] = weights;
    xIndices[destX] = indices;
  }

  const yWeights: number[][] = [];
  const yIndices: number[][] = [];

  for (let destY = 0; destY < destHeight; destY++) {
    const srcY = (destY + 0.5) * yRatio - 0.5;
    const startY = Math.max(0, Math.floor(srcY) - a + 1);
    const endY = Math.min(srcHeight - 1, Math.floor(srcY) + a);

    const weights: number[] = [];
    const indices: number[] = [];
    let weightSum = 0;

    for (let y = startY; y <= endY; y++) {
      const weight = lanczosKernel(y - srcY, a);
      weights.push(weight);
      indices.push(y);
      weightSum += weight;
    }

    // Normalize weights
    for (let i = 0; i < weights.length; i++) {
      weights[i] /= weightSum;
    }

    yWeights[destY] = weights;
    yIndices[destY] = indices;
  }

  // Apply resampling
  for (let destY = 0; destY < destHeight; destY++) {
    const yW = yWeights[destY];
    const yI = yIndices[destY];

    for (let destX = 0; destX < destWidth; destX++) {
      const xW = xWeights[destX];
      const xI = xIndices[destX];

      let r = 0, g = 0, b = 0, alpha = 0;

      for (let yIdx = 0; yIdx < yI.length; yIdx++) {
        const srcY = yI[yIdx];
        const yWeight = yW[yIdx];

        for (let xIdx = 0; xIdx < xI.length; xIdx++) {
          const srcX = xI[xIdx];
          const xWeight = xW[xIdx];
          const weight = xWeight * yWeight;

          const srcIdx = (srcY * srcWidth + srcX) * 4;
          r += srcData[srcIdx] * weight;
          g += srcData[srcIdx + 1] * weight;
          b += srcData[srcIdx + 2] * weight;
          alpha += srcData[srcIdx + 3] * weight;
        }
      }

      const destIdx = (destY * destWidth + destX) * 4;
      destData[destIdx] = Math.max(0, Math.min(255, Math.round(r)));
      destData[destIdx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      destData[destIdx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      destData[destIdx + 3] = Math.max(0, Math.min(255, Math.round(alpha)));
    }
  }

  return destImageData;
}

/**
 * Calculate dimensions to fit image within target size while maintaining aspect ratio
 */
function calculateFitDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): { width: number; height: number; x: number; y: number } {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  let scaledWidth: number;
  let scaledHeight: number;

  if (sourceRatio > targetRatio) {
    // Image is wider than target - fit to width
    scaledWidth = targetWidth;
    scaledHeight = Math.round(targetWidth / sourceRatio);
  } else {
    // Image is taller than target - fit to height
    scaledHeight = targetHeight;
    scaledWidth = Math.round(targetHeight * sourceRatio);
  }

  // Center the image
  const x = Math.round((targetWidth - scaledWidth) / 2);
  const y = Math.round((targetHeight - scaledHeight) / 2);

  return { width: scaledWidth, height: scaledHeight, x, y };
}

/**
 * Convert HTMLImageElement or ImageBitmap to canvas
 */
export function imageToCanvas(image: HTMLImageElement | ImageBitmap): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  ctx.drawImage(image, 0, 0);
  return canvas;
}

/**
 * Convert canvas to Blob
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/png'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, type);
  });
}

/**
 * Scale image to target dimensions using high-quality Lanczos-3 resampling
 * Maintains aspect ratio and centers the image on a colored background
 *
 * @param image - Source image (HTMLImageElement or ImageBitmap)
 * @param targetWidth - Target width (default: 1600)
 * @param targetHeight - Target height (default: 1200)
 * @param backgroundColor - Background color for letterboxing (default: '#FFFFFF')
 * @returns Promise resolving to ImageData with scaled image
 */
export async function scaleImage(
  image: HTMLImageElement | ImageBitmap,
  targetWidth: number = 1600,
  targetHeight: number = 1200,
  backgroundColor: string = '#FFFFFF'
): Promise<ImageData> {
  const sourceWidth = image.width;
  const sourceHeight = image.height;

  // If image is already the target size, just convert and return
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    const canvas = imageToCanvas(image);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    return ctx.getImageData(0, 0, targetWidth, targetHeight);
  }

  // Calculate fitted dimensions
  const { width: scaledWidth, height: scaledHeight, x, y } = calculateFitDimensions(
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight
  );

  // Create source canvas and get image data
  const sourceCanvas = imageToCanvas(image);
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) {
    throw new Error('Failed to get source 2D context');
  }
  const sourceImageData = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);

  // Apply Lanczos resampling if downscaling significantly
  // For small scale differences or upscaling, use browser's built-in high-quality scaling
  const scaleFactor = Math.min(scaledWidth / sourceWidth, scaledHeight / sourceHeight);
  let scaledImageData: ImageData;

  if (scaleFactor < 0.9) {
    // Use Lanczos-3 for high-quality downscaling
    scaledImageData = lanczosResample(sourceImageData, scaledWidth, scaledHeight);
  } else {
    // Use browser's built-in high-quality scaling for upscaling or minor scaling
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      throw new Error('Failed to get temporary 2D context');
    }

    // Use highest quality settings
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(image, 0, 0, scaledWidth, scaledHeight);
    scaledImageData = tempCtx.getImageData(0, 0, scaledWidth, scaledHeight);
  }

  // Create final canvas with white background
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) {
    throw new Error('Failed to get final 2D context');
  }

  // Fill with background color
  finalCtx.fillStyle = backgroundColor;
  finalCtx.fillRect(0, 0, targetWidth, targetHeight);

  // Place scaled image centered
  finalCtx.putImageData(scaledImageData, x, y);

  return finalCtx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Scale image and return as canvas for further processing
 *
 * @param image - Source image (HTMLImageElement or ImageBitmap)
 * @param targetWidth - Target width (default: 1600)
 * @param targetHeight - Target height (default: 1200)
 * @returns Promise resolving to HTMLCanvasElement with scaled image
 */
export async function scaleImageToCanvas(
  image: HTMLImageElement | ImageBitmap,
  targetWidth: number = 1600,
  targetHeight: number = 1200
): Promise<HTMLCanvasElement> {
  const imageData = await scaleImage(image, targetWidth, targetHeight);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
