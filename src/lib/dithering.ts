// E-ink color palettes
// NeoFrame ESP32 palette from einkapp.com - matches device firmware
export const COLOR_PALETTES = {
  'spectra-6': {
    name: 'E-ink Spectra 6 (NeoFrame)',
    // Colors from NeoFrame ESP32 firmware - 6 colors only
    colors: [
      [0, 0, 0],         // Black
      [255, 255, 255],   // White
      [255, 255, 0],     // Yellow
      [255, 0, 0],       // Red
      [41, 204, 20],     // Green (#29CC14 - specific to this display)
      [0, 0, 255],       // Blue
    ],
  },
  'spectra-6-ideal': {
    name: 'Spectra 6 (Ideal RGB)',
    // Ideal/theoretical colors
    colors: [
      [0, 0, 0],         // Black
      [255, 255, 255],   // White
      [255, 255, 0],     // Yellow
      [255, 0, 0],       // Red
      [0, 255, 0],       // Green (pure)
      [0, 0, 255],       // Blue
    ],
  },
  'spectra-6-calibrated': {
    name: 'Spectra 6 (Calibrated)',
    // Measured display output values (muted)
    colors: [
      [0, 0, 0],         // Black
      [255, 255, 255],   // White
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
  '4-gray': {
    name: '4 Gray Levels',
    colors: [
      [0, 0, 0],
      [85, 85, 85],
      [170, 170, 170],
      [255, 255, 255],
    ],
  },
} as const

export type PaletteKey = keyof typeof COLOR_PALETTES
export type DitheringAlgorithm = 'floyd-steinberg' | 'atkinson' | 'stucki' | 'jarvis'

// RGB to LAB conversion for better color matching
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // RGB to XYZ
  let rr = r / 255
  let gg = g / 255
  let bb = b / 255

  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92

  rr *= 100
  gg *= 100
  bb *= 100

  const x = rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375
  const y = rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750
  const z = rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041

  // XYZ to LAB
  let xx = x / 95.047
  let yy = y / 100.000
  let zz = z / 108.883

  xx = xx > 0.008856 ? Math.pow(xx, 1/3) : (7.787 * xx) + 16/116
  yy = yy > 0.008856 ? Math.pow(yy, 1/3) : (7.787 * yy) + 16/116
  zz = zz > 0.008856 ? Math.pow(zz, 1/3) : (7.787 * zz) + 16/116

  const L = (116 * yy) - 16
  const a = 500 * (xx - yy)
  const bVal = 200 * (yy - zz)

  return [L, a, bVal]
}

// LAB color distance (perceptually more accurate)
function labDistance(lab1: [number, number, number], lab2: [number, number, number]): number {
  const dL = lab1[0] - lab2[0]
  const da = lab1[1] - lab2[1]
  const db = lab1[2] - lab2[2]
  return Math.sqrt(dL * dL + da * da + db * db)
}

// Find nearest color in palette using LAB color space
function findNearestColor(r: number, g: number, b: number, palette: number[][], paletteLab: [number, number, number][]): number[] {
  // Special handling for blue (matches NeoFrame behavior)
  if (r < 50 && g < 150 && b > 100) {
    // Find the blue color in palette
    for (const color of palette) {
      if (color[2] > 200 && color[0] < 50 && color[1] < 50) {
        return color
      }
    }
  }

  const inputLab = rgbToLab(r, g, b)
  let minDistance = Infinity
  let nearestIdx = 0

  for (let i = 0; i < paletteLab.length; i++) {
    const distance = labDistance(inputLab, paletteLab[i])
    if (distance < minDistance) {
      minDistance = distance
      nearestIdx = i
    }
  }

  return palette[nearestIdx]
}

// Precompute LAB values for palette
function computePaletteLab(palette: number[][]): [number, number, number][] {
  return palette.map(c => rgbToLab(c[0], c[1], c[2]))
}

// Apply contrast adjustment
function applyContrast(data: Uint8ClampedArray, contrast: number): void {
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128))
    data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128))
    data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128))
  }
}

// Floyd-Steinberg dithering with strength parameter
function floydSteinberg(imageData: ImageData, palette: number[][], strength: number): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height
  const paletteLab = computePaletteLab(palette)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      const oldR = data[idx]
      const oldG = data[idx + 1]
      const oldB = data[idx + 2]

      const [newR, newG, newB] = findNearestColor(oldR, oldG, oldB, palette, paletteLab)

      data[idx] = newR
      data[idx + 1] = newG
      data[idx + 2] = newB

      const errR = (oldR - newR) * strength
      const errG = (oldG - newG) * strength
      const errB = (oldB - newB) * strength

      // Distribute error: 7/16 right, 3/16 bottom-left, 5/16 bottom, 1/16 bottom-right
      if (x + 1 < width) {
        const i = idx + 4
        data[i] = Math.min(255, Math.max(0, data[i] + errR * 7 / 16))
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + errG * 7 / 16))
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + errB * 7 / 16))
      }
      if (y + 1 < height) {
        if (x > 0) {
          const i = ((y + 1) * width + (x - 1)) * 4
          data[i] = Math.min(255, Math.max(0, data[i] + errR * 3 / 16))
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + errG * 3 / 16))
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + errB * 3 / 16))
        }
        {
          const i = ((y + 1) * width + x) * 4
          data[i] = Math.min(255, Math.max(0, data[i] + errR * 5 / 16))
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + errG * 5 / 16))
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + errB * 5 / 16))
        }
        if (x + 1 < width) {
          const i = ((y + 1) * width + (x + 1)) * 4
          data[i] = Math.min(255, Math.max(0, data[i] + errR * 1 / 16))
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + errG * 1 / 16))
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + errB * 1 / 16))
        }
      }
    }
  }

  return new ImageData(data, width, height)
}

// Atkinson dithering
function atkinson(imageData: ImageData, palette: number[][], strength: number): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height
  const paletteLab = computePaletteLab(palette)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      const oldR = data[idx]
      const oldG = data[idx + 1]
      const oldB = data[idx + 2]

      const [newR, newG, newB] = findNearestColor(oldR, oldG, oldB, palette, paletteLab)

      data[idx] = newR
      data[idx + 1] = newG
      data[idx + 2] = newB

      // Atkinson uses 1/8 for each neighbor (only distributes 6/8 of error)
      const errR = (oldR - newR) * strength / 8
      const errG = (oldG - newG) * strength / 8
      const errB = (oldB - newB) * strength / 8

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
          data[i] = Math.min(255, Math.max(0, data[i] + errR))
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + errG))
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + errB))
        }
      }
    }
  }

  return new ImageData(data, width, height)
}

// Stucki dithering - smoother gradients
function stucki(imageData: ImageData, palette: number[][], strength: number): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height
  const paletteLab = computePaletteLab(palette)
  const divisor = 42

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      const oldR = data[idx]
      const oldG = data[idx + 1]
      const oldB = data[idx + 2]

      const [newR, newG, newB] = findNearestColor(oldR, oldG, oldB, palette, paletteLab)

      data[idx] = newR
      data[idx + 1] = newG
      data[idx + 2] = newB

      const errR = (oldR - newR) * strength
      const errG = (oldG - newG) * strength
      const errB = (oldB - newB) * strength

      // Stucki error distribution pattern
      const diffuse = (dx: number, dy: number, weight: number) => {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const i = (ny * width + nx) * 4
          data[i] = Math.min(255, Math.max(0, data[i] + errR * weight / divisor))
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + errG * weight / divisor))
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + errB * weight / divisor))
        }
      }

      // Row 0: right
      diffuse(1, 0, 8)
      diffuse(2, 0, 4)
      // Row 1
      diffuse(-2, 1, 2)
      diffuse(-1, 1, 4)
      diffuse(0, 1, 8)
      diffuse(1, 1, 4)
      diffuse(2, 1, 2)
      // Row 2
      diffuse(-2, 2, 1)
      diffuse(-1, 2, 2)
      diffuse(0, 2, 4)
      diffuse(1, 2, 2)
      diffuse(2, 2, 1)
    }
  }

  return new ImageData(data, width, height)
}

// Jarvis-Judice-Ninke dithering - high quality
function jarvis(imageData: ImageData, palette: number[][], strength: number): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height
  const paletteLab = computePaletteLab(palette)
  const divisor = 48

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      const oldR = data[idx]
      const oldG = data[idx + 1]
      const oldB = data[idx + 2]

      const [newR, newG, newB] = findNearestColor(oldR, oldG, oldB, palette, paletteLab)

      data[idx] = newR
      data[idx + 1] = newG
      data[idx + 2] = newB

      const errR = (oldR - newR) * strength
      const errG = (oldG - newG) * strength
      const errB = (oldB - newB) * strength

      const diffuse = (dx: number, dy: number, weight: number) => {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const i = (ny * width + nx) * 4
          data[i] = Math.min(255, Math.max(0, data[i] + errR * weight / divisor))
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + errG * weight / divisor))
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + errB * weight / divisor))
        }
      }

      // Row 0: right
      diffuse(1, 0, 7)
      diffuse(2, 0, 5)
      // Row 1
      diffuse(-2, 1, 3)
      diffuse(-1, 1, 5)
      diffuse(0, 1, 7)
      diffuse(1, 1, 5)
      diffuse(2, 1, 3)
      // Row 2
      diffuse(-2, 2, 1)
      diffuse(-1, 2, 3)
      diffuse(0, 2, 5)
      diffuse(1, 2, 3)
      diffuse(2, 2, 1)
    }
  }

  return new ImageData(data, width, height)
}

// Main dithering function
export function applyDithering(
  imageData: ImageData,
  algorithm: DitheringAlgorithm,
  paletteKey: PaletteKey,
  strength: number = 1.0,
  contrast: number = 1.0
): ImageData {
  const palette = COLOR_PALETTES[paletteKey].colors as unknown as number[][]

  // Create a copy of the image data
  const data = new Uint8ClampedArray(imageData.data)

  // Apply contrast if not default
  if (contrast !== 1.0) {
    applyContrast(data, contrast - 1)
  }

  const processedImageData = new ImageData(data, imageData.width, imageData.height)

  switch (algorithm) {
    case 'floyd-steinberg':
      return floydSteinberg(processedImageData, palette, strength)
    case 'atkinson':
      return atkinson(processedImageData, palette, strength)
    case 'stucki':
      return stucki(processedImageData, palette, strength)
    case 'jarvis':
      return jarvis(processedImageData, palette, strength)
    default:
      return floydSteinberg(processedImageData, palette, strength)
  }
}
