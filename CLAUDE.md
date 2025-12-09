# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install    # Install dependencies
pnpm dev        # Start dev server on port 5173
pnpm build      # Production build to dist/
pnpm test       # Run tests with vitest
```

## Architecture

This is a React SPA for converting images to dithered formats optimized for e-ink displays (specifically NeoFrame ESP32 with Spectra 6 color displays).

### Core Processing Pipeline

1. **Image Input**: Local file upload or Google Photos Picker API
2. **Scaling**: `src/lib/image-processing.ts` - Lanczos-3 resampling to 1600x1200, centered with letterboxing
3. **Dithering**: `src/lib/dithering.ts` - Error diffusion algorithms (Floyd-Steinberg, Atkinson, Stucki, Jarvis) with LAB color space matching
4. **Export**: `src/lib/download.ts` - 24-bit BMP generation for SD card compatibility, ZIP for batch download

### Key Technical Details

- Color palettes defined in `dithering.ts` use specific RGB values from NeoFrame firmware
- Color matching uses RGB→LAB conversion for perceptual accuracy
- BMP files use `image00.bmp`, `image01.bmp` naming for SD card compatibility
- Negative height in BMP header enables top-down pixel storage

### Project Structure

- `src/routes/index.tsx` - Main app component with all UI state and image processing orchestration
- `src/lib/` - Pure functions for image processing, dithering algorithms, download utilities
- `src/hooks/useGooglePhotos.ts` - Google OAuth and Photos Picker integration
- `src/components/` - Reusable UI components (FileDropZone, SettingsPanel, ImagePreview)

### Tech Stack

- TanStack Router (file-based routing with `@tanstack/router-plugin`)
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- TypeScript with strict mode
- Vite with tsconfig paths (`@/*` → `./src/*`)

### Environment Variables

- `VITE_GOOGLE_CLIENT_ID` - Required for Google Photos integration
- `VITE_BASE_PATH` - Base path for deployment (defaults to `/`)
