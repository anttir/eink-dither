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

### Hardware

Read off the board itself, except where noted.

| Spec | Value |
|---|---|
| Module | **`ESP32-S3-WROOM-1 MCN16R8`** (marked on the RF shield) |
| MCU | **ESP32-S3** (QFN56) rev v0.2, dual core + LP core, 240 MHz, 40 MHz crystal, 512 KB SRAM — GooDisplay's product page, manuals and resellers all say only "ESP32"; that's wrong |
| PSRAM | **8 MB, octal (OPI), 3.3 V** — the `R8` in the part number |
| Flash | **16 MB**, quad bus (DIO at boot), 3.3 V — the `N16` in the part number |
| SD interface | SPI, not SDMMC — ~2.5 MB/s bus ceiling |
| User buttons | SW2 / SW3 / SW4 — presence confirmed on the board; the IO12 / IO13 / IO14 active-high mapping comes from vendor build artifacts and has **not** been verified electrically |

Vendor Arduino build artifacts declare `FlashSize=4M`. That is an Arduino default, not the part — the flash is 16 MB, which is what makes two 3 MB OTA app slots plus a UI filesystem affordable.

### Ports and the switch

Silkscreen designators are given because the board carries three USB-shaped connectors and it is easy to pick the wrong one.

| Control | Silkscreen | What it is | Used for |
|---|---|---|---|
| **USB Type-C** (bottom centre) | `USB5` | Power in + program download; carries a **CH340** USB-serial bridge | Wall adapter or Li-ion battery; firmware flashing; serial console |
| **USB Type-A** (bottom right) | — | "USB communication interface" | Image upload from a PC, with a **dual-male USB-A ↔ USB-A** cable |
| **microSD slot** | `CARD1` | Offline image store | Numbered BMPs or a packed `images.bin`, depending on firmware — see below (card not included) |
| **Slide switch** | `SW1` | Power ON/OFF | The board's only slide switch — must be **ON** |
| **User buttons** | `SW2` `SW3` `SW4` | Three push-buttons stacked on the left edge (`SW4` topmost) | Free for custom firmware |
| Unidentified connector (right edge) | `USB4` | Adjacent silkscreen reads `battre` — purpose unconfirmed | — |

A breakout header along the right edge exposes the panel bus: `GND, RST, BUSY, CSB_M, CSB_S, D/C/X, SI3, SI2, SI1, SI0, SCL`. `CSB_M` and `CSB_S` are separate chip selects, one per driver IC — the two-halves split shows up on the silkscreen as well as in the manual.

**Driver gotcha on the Type-C port.** The bridge is a **CH340** (`USB\VID_1A86&PID_7523`), not a CP210x. With no driver bound Windows reports problem code 28 and creates **no COM port at all**, so the board looks completely absent rather than misbehaving. Check Device Manager for a `USB Serial` entry with a warning triangle before concluding the hardware is dead. The signed WCH driver may already be in the driver store; binding it takes an elevated `pnputil /add-driver C:\Windows\INF\oem120.inf /install` (substitute the `oemNN.inf` that `pnputil /enum-drivers` reports for `ch341ser.inf`).

E-paper holds the last image indefinitely with the power off. That is the panel working correctly, not a fault — but the stock WiFi firmware overwrites that image on every boot, see variant `-3` below.

### Firmware variants — check this first

The board ships with **one** of four firmwares, and each supports exactly one update method. Switching method means re-flashing.

| Variant | Behaviour |
|---|---|
| `-1` | Image update over USB from `Spectra 6_Image_Tool.exe` |
| `-2` | Reads image data from the SD card, advances roughly every 2 min — on-card format depends on revision, see below |
| `-3` | Creates a `NeoFrame` WiFi access point; images pushed from a web page |
| `-4` | Fixed demo images (colour bars, test patterns) |

The newer 23-page spec renames these `-USB` / `-SD` / `-WIFI` / `-CH` — same four functions, updated labels.

If USB or WiFi appears dead, confirm the variant before debugging anything else. The fastest way to tell is the serial boot log — the app announces itself right after the ROM banner. The unit this project was developed against ships **`-3`**.

### Interrogating the board over USB-C (read-only)

Needs `pyserial` and `esptool`. Nothing here writes to the device.

```bash
python -m serial.tools.list_ports -v    # find the CH340 port
esptool --port COM3 chip-id             # chip, revision, features, MAC
esptool --port COM3 flash-id            # flash manufacturer and size
```

For the boot log, open the port at **115200**, hold DTR low (IO0 high = normal boot, not download mode) and pulse RTS to reset, then capture. Avoid interactive `miniterm` from a script — it will hang.

Back the stock firmware up before writing anything to the board:

```bash
esptool --port COM3 -b 115200 read-flash 0 ALL stock-firmware-backup.bin
```

- GooDisplay publishes no stock firmware binary. That read-out is the **only copy that will ever exist** — take it before your first `write_flash`, and verify it is 16777216 bytes.
- **Don't use `-b 460800`.** The CH340 corrupts the transfer partway through (`Corrupt data, expected 0x1000 bytes but received 0xfe9 bytes`). 115200 is reliable and takes about 25 minutes for 16 MB.
- Keep the backup outside the repo tree.

Two strapping pins are hazards for custom firmware: **IO45** (VDD_SPI voltage select) doubles as the panel power enable and must never be left asserted across a reset, and **IO3** (SD MOSI) is also strapping.

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

The board also **serves its own onboarding page** at `http://192.168.4.1/wifi`, which its boot log advertises. The hosted einkapp.com page is not the only way in.

> **This firmware repaints the panel on every boot.** Startup runs a full refresh with a built-in default image *before* the access point comes up, and it does not restore whatever was displayed previously. Any reset — including the automatic one at the end of every `esptool` invocation — costs you the image on the panel and one refresh out of the 180 s budget.

### SD card (variant -2 / -SD)

On-card format depends on the firmware revision flashed to the board:

- **Older SD firmware** (matching the 16-page manual): individually numbered files, `image0.bmp`, `image1.bmp`, …
- **Newer stock SD firmware**: a single packed **`images.bin`** — all frames plus an interval header, produced by GooDisplay's own [BMP-to-BIN tool](https://www.e-paper-display.com/bmp.html), not raw numbered BMPs.

> **Note:** this app names files `image00.bmp` / `image01.bmp`, matching neither scheme exactly. For numbered-file firmware, rename to `image0.bmp` / `image1.bmp` before copying. For `images.bin` firmware, run the images through GooDisplay's tool instead of copying BMPs directly.

Verify which scheme your board's firmware uses before assuming either works.

### Panel constraints

Relevant to any custom firmware written for this board:

- Minimum **180 s** between refreshes, and at least one full refresh every 24 h.
- Never leave the panel powered and idle — put it to sleep or power it off, or the film layer degrades irreversibly.
- After entering sleep the controller ignores image data until re-initialised.
- Two driver ICs, one per screen half (CS pins **M** and **S**). Image data must be split into two halves or the display comes out misaligned.

Source: [ESP32-133C02-X instruction manual, 16-page (GooDisplay)](https://ecksteinimg.de/Photo/GD02009/EN-ESP32-133C02.pdf), [ESP32-133C02 specification, 23-page — newer revision, only doc with pin tables (GooDisplay)](https://v4.cecdn.yun300.cn/100001_1909185148/EN-ESP32-133C02.pdf), [product page](https://www.good-display.com/product/574.html).

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
