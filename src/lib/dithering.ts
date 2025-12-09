// E-ink color palettes
// Spectra 6 actual pigment colors (measured values are more muted than ideal RGB)
export const COLOR_PALETTES = {
  'spectra-6': {
    name: 'E-ink Spectra 6 Color',
    colors: [
      [0, 0, 0],       // Black
      [255, 255, 255], // White
      [0, 255, 255],   // Cyan
      [255, 0, 255],   // Magenta
      [255, 255, 0],   // Yellow
      [255, 0, 0],     // Red
      [0, 128, 0],     // Green (darker, closer to actual pigment)
      [0, 0, 255],     // Blue
    ],
  },
  'spectra-6-accurate': {
    name: 'Spectra 6 (Calibrated)',
    // More accurate colors based on actual display measurements
    colors: [
      [0, 0, 0],         // Black
      [255, 255, 255],   // White
      [0, 200, 200],     // Cyan (muted)
      [200, 50, 200],    // Magenta (muted)
      [240, 224, 80],    // Yellow (#f0e050)
      [160, 32, 32],     // Red (#a02020)
      [96, 128, 80],     // Green (#608050)
      [80, 128, 184],    // Blue (#5080b8)
    ],
  },
  'bw': {
    name: 'Black & White',
    colors: [
      [0, 0, 0],
      [255, 255, 255],
    ],
  },
  '3-color': {
    name: 'Three Colors (BWR)',
    colors: [
      [0, 0, 0],
      [255, 255, 255],
      [255, 0, 0],
    ],
  },
  '4-color': {
    name: 'Four Colors (BWRY)',
    colors: [
      [0, 0, 0],
      [255, 255, 255],
      [255, 0, 0],
      [255, 255, 0],
    ],
  },
  '4-gray': {
    name: '4 Gray Levels',
    colors: [
      [0, 0, 0],
      [85, 85, 85],
      [170, 170, 170],
      [255, 255, 255],
    ],
  },
  '16-gray': {
    name: '16 Gray Levels',
    colors: Array.from({ length: 16 }, (_, i) => {
      const v = Math.round((i / 15) * 255)
      return [v, v, v]
    }),
  },
} as const

export type PaletteKey = keyof typeof COLOR_PALETTES
export type DitheringAlgorithm = 'floyd-steinberg' | 'atkinson' | 'error-diffusion' | 'blue-noise'

// Calculate color distance (Euclidean in RGB space)
function colorDistance(c1: number[], c2: number[]): number {
  const dr = c1[0] - c2[0]
  const dg = c1[1] - c2[1]
  const db = c1[2] - c2[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

// Find nearest color in palette
function findNearestColor(r: number, g: number, b: number, palette: number[][]): number[] {
  let minDist = Infinity
  let nearest = palette[0]

  for (const color of palette) {
    const dist = colorDistance([r, g, b], color)
    if (dist < minDist) {
      minDist = dist
      nearest = color
    }
  }

  return nearest
}

// Floyd-Steinberg dithering
function floydSteinberg(imageData: ImageData, palette: number[][]): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      const oldR = data[idx]
      const oldG = data[idx + 1]
      const oldB = data[idx + 2]

      const [newR, newG, newB] = findNearestColor(oldR, oldG, oldB, palette)

      data[idx] = newR
      data[idx + 1] = newG
      data[idx + 2] = newB

      const errR = oldR - newR
      const errG = oldG - newG
      const errB = oldB - newB

      // Distribute error: 7/16 right, 3/16 bottom-left, 5/16 bottom, 1/16 bottom-right
      if (x + 1 < width) {
        const i = idx + 4
        data[i] = Math.round(data[i] + errR * 7 / 16)
        data[i + 1] = Math.round(data[i + 1] + errG * 7 / 16)
        data[i + 2] = Math.round(data[i + 2] + errB * 7 / 16)
      }
      if (y + 1 < height) {
        if (x > 0) {
          const i = ((y + 1) * width + (x - 1)) * 4
          data[i] = Math.round(data[i] + errR * 3 / 16)
          data[i + 1] = Math.round(data[i + 1] + errG * 3 / 16)
          data[i + 2] = Math.round(data[i + 2] + errB * 3 / 16)
        }
        {
          const i = ((y + 1) * width + x) * 4
          data[i] = Math.round(data[i] + errR * 5 / 16)
          data[i + 1] = Math.round(data[i + 1] + errG * 5 / 16)
          data[i + 2] = Math.round(data[i + 2] + errB * 5 / 16)
        }
        if (x + 1 < width) {
          const i = ((y + 1) * width + (x + 1)) * 4
          data[i] = Math.round(data[i] + errR * 1 / 16)
          data[i + 1] = Math.round(data[i + 1] + errG * 1 / 16)
          data[i + 2] = Math.round(data[i + 2] + errB * 1 / 16)
        }
      }
    }
  }

  return new ImageData(data, width, height)
}

// Atkinson dithering - spreads error more evenly
function atkinson(imageData: ImageData, palette: number[][]): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      const oldR = data[idx]
      const oldG = data[idx + 1]
      const oldB = data[idx + 2]

      const [newR, newG, newB] = findNearestColor(oldR, oldG, oldB, palette)

      data[idx] = newR
      data[idx + 1] = newG
      data[idx + 2] = newB

      // Atkinson uses 1/8 for each neighbor (only distributes 6/8 of error)
      const errR = (oldR - newR) / 8
      const errG = (oldG - newG) / 8
      const errB = (oldB - newB) / 8

      const neighbors = [
        [x + 1, y],
        [x + 2, y],
        [x - 1, y + 1],
        [x, y + 1],
        [x + 1, y + 1],
        [x, y + 2],
      ]

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const i = (ny * width + nx) * 4
          data[i] = Math.round(data[i] + errR)
          data[i + 1] = Math.round(data[i + 1] + errG)
          data[i + 2] = Math.round(data[i + 2] + errB)
        }
      }
    }
  }

  return new ImageData(data, width, height)
}

// Simple error diffusion (same as Floyd-Steinberg weights)
function errorDiffusion(imageData: ImageData, palette: number[][]): ImageData {
  return floydSteinberg(imageData, palette)
}

// Blue noise dithering using threshold matrix
function blueNoise(imageData: ImageData, palette: number[][]): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height

  // Generate blue noise pattern (simplified - using random with spatial correlation)
  const noiseSize = 64
  const noise = new Float32Array(noiseSize * noiseSize)

  // Simple blue noise approximation
  for (let i = 0; i < noise.length; i++) {
    noise[i] = Math.random()
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      const noiseIdx = (y % noiseSize) * noiseSize + (x % noiseSize)
      const threshold = (noise[noiseIdx] - 0.5) * 64

      const r = Math.min(255, Math.max(0, data[idx] + threshold))
      const g = Math.min(255, Math.max(0, data[idx + 1] + threshold))
      const b = Math.min(255, Math.max(0, data[idx + 2] + threshold))

      const [newR, newG, newB] = findNearestColor(r, g, b, palette)

      data[idx] = newR
      data[idx + 1] = newG
      data[idx + 2] = newB
    }
  }

  return new ImageData(data, width, height)
}

// Main dithering function
export function applyDithering(
  imageData: ImageData,
  algorithm: DitheringAlgorithm,
  paletteKey: PaletteKey
): ImageData {
  const palette = COLOR_PALETTES[paletteKey].colors as unknown as number[][]

  switch (algorithm) {
    case 'floyd-steinberg':
      return floydSteinberg(imageData, palette)
    case 'atkinson':
      return atkinson(imageData, palette)
    case 'error-diffusion':
      return errorDiffusion(imageData, palette)
    case 'blue-noise':
      return blueNoise(imageData, palette)
    default:
      return floydSteinberg(imageData, palette)
  }
}
