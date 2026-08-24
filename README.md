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

## Connecting the device

Target hardware is a GooDisplay **ESP32-133C02** driver board with a 13.3" **GDEP133C02** E Ink Spectra 6 panel (1600×1200), sold as **NeoFrame** via einkapp.com.

### Ports and the switch

| Control | What it is | Used for |
|---|---|---|
| **USB Type-C** | Power in + program download | Wall adapter or Li-ion battery; firmware flashing |
| **USB Type-A** | "USB communication interface" | Image upload from a PC, with a **dual-male USB-A ↔ USB-A** cable |
| **microSD slot** | Offline image store | `image0.bmp`, `image1.bmp`, … (card not included) |
| **Slide switch** | Power ON/OFF | The board's only switch — must be **ON** |

E-paper holds the last image indefinitely with the power off. That is the panel working correctly, not a fault.

### Firmware variants — check this first

The board ships with **one** of four firmwares, and each supports exactly one update method. Switching method means re-flashing.

| Variant | Behaviour |
|---|---|
| `-1` | Image update over USB from `Spectra 6_Image_Tool.exe` |
| `-2` | Reads `imageN.bmp` from the SD card, advances roughly every 2 min |
| `-3` | Creates a `NeoFrame` WiFi access point; images pushed from a web page |
| `-4` | Fixed demo images (colour bars, test patterns) |

If USB or WiFi appears dead, confirm the variant before debugging anything else.

### Direct USB connection (variant -1)

1. Connect the panel to the board and power the board via **Type-C** (adapter or battery).
2. Slide the power switch to **ON**.
3. Connect the board's **USB-A** port to a PC USB-A port using a **dual-male USB-A cable**. This is a separate port from the Type-C one — Type-C is power/flashing only.
4. Install and launch GooDisplay's `Spectra 6_Image_Tool.exe`, click **Connect**.
   - Success shows `WF00KWR` on the device. If nothing appears, check the COM port in Device Manager.
5. Select **13.3**, click **Flash**.
6. Click **LOAD**, pick a pre-dithered 1200×1600 image (this app's output), choose a slot `Image1`–`Image15`, click **WRITE**.
7. Click **Send To EPD**. The panel refreshes.

### WiFi from a laptop or phone (variant -3)

1. **Open the control page first**, while still on your normal network: <http://www.einkapp.com/esp32-133c02.html>. The board's access point has no internet, so the page cannot be loaded after joining it. Bookmark it.
2. Power the board via Type-C or battery and switch **ON**. It starts an access point.
3. Join WiFi **`NeoFrame`**, password **`123456789`**.
   - Windows and Android warn "no internet access" and offer to switch networks — choose **Stay connected**, or the upload will fail.
4. In the page: set **Colors Mode = Six Colors**, choose a dithering algorithm, upload the image, press **Send to Frame**.

The page posts to the board at the **ESP32 IP address** in its form. To use images dithered by *this* app instead of the page's own dithering, feed it an already-dithered BMP.

### SD card (variant -2)

Copy this app's BMP output to a microSD card as `image0.bmp`, `image1.bmp`, …, insert it, and switch the board on.

> **Note:** this app names files `image00.bmp` / `image01.bmp`, while the board manual documents `image0.bmp` / `image1.bmp`. Verify against your firmware before assuming the carousel picks them up.

### Panel constraints

Relevant to any custom firmware written for this board:

- Minimum **180 s** between refreshes, and at least one full refresh every 24 h.
- Never leave the panel powered and idle — put it to sleep or power it off, or the film layer degrades irreversibly.
- After entering sleep the controller ignores image data until re-initialised.
- Two driver ICs, one per screen half (CS pins **M** and **S**). Image data must be split into two halves or the display comes out misaligned.

Source: [ESP32-133C02-X instruction manual (GooDisplay)](https://ecksteinimg.de/Photo/GD02009/EN-ESP32-133C02.pdf), [product page](https://www.good-display.com/product/574.html).

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
   - `https://anttir.github.io` (for production)
6. **Authorized redirect URIs** - click ADD URI:
   - `http://localhost:5173/` (note the trailing slash!)
   - `https://anttir.github.io/eink-dither/`
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
