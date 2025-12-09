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

Google Photos integration uses Google Photos Picker API. Follow these steps to enable it:

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project selector in the top bar
3. Click **NEW PROJECT**
4. Project name: `eink-dither` (or any name you prefer)
5. Click **CREATE**
6. Wait for the project to be created, then select it as active

### 2. Enable Photos Picker API

1. In the left menu: **APIs & Services** → **Library**
2. Search for: `Photos Picker`
3. Click **Google Photos Picker API**
4. Click the blue **ENABLE** button

### 3. Configure OAuth Consent Screen

1. In the left menu: **APIs & Services** → **OAuth consent screen**
2. Select **External** → **CREATE**
3. Fill in:
   - App name: `E-ink Dither`
   - User support email: your email
   - Developer contact email: your email
4. Click **SAVE AND CONTINUE**
5. On Scopes page: just click **SAVE AND CONTINUE** (no scopes needed)
6. On Test users page: click **SAVE AND CONTINUE**
7. On Summary: click **BACK TO DASHBOARD**

### 4. Create OAuth Client ID

1. In the left menu: **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: `Web application`
4. Name: `E-ink Dither Web`
5. **Authorized JavaScript origins** - click ADD URI:
   - `http://localhost:5173` (for development)
   - `https://yourusername.github.io` (for production)
6. **Authorized redirect URIs** - click ADD URI:
   - `http://localhost:5173`
   - `https://yourusername.github.io/eink-dither/`
7. Click **CREATE**
8. Copy the **Client ID** (long string ending with `.apps.googleusercontent.com`)

### 5. Configure the Application

Create a `.env.local` file in the project root:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

For production deployment, set the environment variable in your CI/CD or create `.env.production`:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### Note on App Verification

While in "Testing" mode, only users added as test users can use Google Photos integration. To allow all users:

1. Go to **OAuth consent screen**
2. Click **PUBLISH APP**
3. Follow Google's verification process (may require privacy policy URL)

## Tech Stack

- TanStack Router
- React
- Tailwind CSS
- Vite
- TypeScript

## License

MIT
