# E-ink Dither

Convert images to dithered format optimized for e-ink displays like E-ink Spectra 6 color.

## Features

- **Multiple dithering algorithms**: Floyd-Steinberg (default), Atkinson, Error Diffusion, Blue Noise
- **Color palettes**: E-ink Spectra 6 Color, Black & White, Grayscale, Red/Black/White
- **Image scaling**: Automatic Lanczos scaling to 1600x1200 resolution
- **Local file upload**: Drag & drop or click to browse
- **Google Photos integration**: Browse and select images from your Google Photos library
- **Batch processing**: Process multiple images at once
- **Download options**: Individual images or ZIP archive

## Usage

### Without login
1. Drag & drop images or click the upload area
2. Select dithering algorithm and color palette
3. Download processed images

### With Google Photos
1. Click "Sign in with Google"
2. Authorize access to your Google Photos
3. Browse and select images
4. Download processed images

## Development

```bash
pnpm install
pnpm run dev
pnpm run build
```

## Google Photos Setup

To enable Google Photos integration, create a Google Cloud project:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google Photos Library API**
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized origins and redirect URIs
6. Create `.env.local`:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

## Tech Stack

- TanStack Router
- React
- Tailwind CSS
- Vite
- TypeScript

## License

MIT
