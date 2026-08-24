# ESP32-133C02 hardware budget

Research for [issue #8](https://github.com/anttir/eink-dither/issues/8) on map [#6](https://github.com/anttir/eink-dither/issues/6) — does the GooDisplay ESP32-133C02 board have the resources for a custom firmware doing SD carousel + WiFi admin UI + QR compositing?

Answered 2026-08-24. Every claim is tagged **VERIFIED** (with the source it came from) or **INFERRED**. Anything neither is stated as **unknown**.

## Summary

- **PSRAM is fitted and it is octal (OPI) — so ≥ 8 MB. VERIFIED.** Two independent vendor build artifacts require it at boot. The 960,000-byte 1600×1200 4bpp framebuffer fits in PSRAM with room to spare. **QR compositing is not blocked.**
- The MCU is an **ESP32-S3**, not a plain ESP32 — 512 KB internal SRAM. **VERIFIED.** Everything published in prose (product page, manual, resellers) says only "ESP32"; the chip identity comes from the vendor's own build output.
- **Flash is ≥ 16 MB. VERIFIED-by-requirement**, because GooDisplay's own USB firmware partition table reserves 15.79 MiB. Serving an admin UI is a non-issue: the stock WiFi firmware embeds its entire 34 KB single-page admin UI in the app image and the whole app is only ~1.96 MB.
- **SD card is SPI, not SDMMC** — CS/MOSI/MISO/SCK on IO15/IO3/IO5/IO8, on a bus separate from the display. **VERIFIED** from the official specification. Bus ceiling ~2.5 MB/s; the SD bus will not be the bottleneck for a ~1 MB HTTP upload.
- **The board already has three user buttons** — SW2/SW3/SW4 on IO12/IO13/IO14, active-high. **VERIFIED.** No free GPIO is needed for the QR button.
- **GooDisplay's ESP-IDF source is public and downloadable without registration**, as is a fuller 23-page specification that the linked 16-page manual does not contain. **VERIFIED.**

Nothing found blocks the design. Two cautions are in [Implications](#implications-for-the-firmware-design).

## Sources used

Ranked by trust. Primary sources first.

| Source | URL |
|---|---|
| GooDisplay product page | <https://www.good-display.com/product/574.html> |
| **ESP32-133C02 Specification, rev 23 pages** (the good one) | <https://www.good-display.com/companyfile/2021.html> → `https://v4.cecdn.yun300.cn/100001_1909185148/EN-ESP32-133C02.pdf` |
| ESP32-133C02-X instruction manual, rev 1.0, 16 pages | <https://ecksteinimg.de/Photo/GD02009/EN-ESP32-133C02.pdf> |
| Schematic for ESP32-133C02 | <https://www.good-display.com/companyfile/2036.html> |
| GDEP133C02-ESP32 ESP-IDF code example (47.7 MB zip, ships a full `build/` tree) | <https://www.good-display.com/companyfile/2046.html> |
| ESP32-133C02_USB sample code | <https://www.good-display.com/companyfile/2100.html> |
| Stock SD firmware image `sd.bin` | <https://www.good-display.com/companyfile/2048.html> |
| Stock WiFi firmware image `wifi.bin` | <https://www.good-display.com/companyfile/2047.html> |
| Espressif ESP32-S3-WROOM-1/1U datasheet v1.8 | <https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf> |
| ESP-IDF SD SPI host driver docs | <https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/sdspi_host.html> |
| ESP-IDF external RAM guide | <https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/external-ram.html> |

**Method note.** The GooDisplay download pages hide the file behind `javascript:;`. The real endpoint is `https://www.good-display.com/comp/xcompanyFile/downloadNew.do?appId=24&fid=<fid>&id=<pageId>`, which 302s to a `v4.cecdn.yun300.cn` URL that requires a `good-display.com` Referer header. Analysis below was done by reading the downloaded artifacts (text extraction, zip listing, ESP image header/partition-table parsing, `strings`). Nothing was executed.

**Documentation warning.** The prose documentation for this board is thin and partly wrong. The 3.7 MB specification on GooDisplay's site is a *newer, longer revision* (23 pages) than the 16-page manual linked from our README, and it is the only document that carries the pin tables. The published schematic covers only the e-paper power/driver section and stops at a 12-pin header labelled "Control Signals are connected to the MCU" — **there is no published MCU-side schematic**. The authoritative facts below therefore come from the vendor's shipped build artifacts, which are more reliable than their prose.

## 1. ESP32 variant and internal SRAM

**The chip is an ESP32-S3. VERIFIED.** Three independent confirmations:

- The code example's `sdkconfig` (`GDEP133C02/sdkconfig`):
  ```
  CONFIG_IDF_TARGET="esp32s3"
  CONFIG_IDF_TARGET_ESP32S3=y
  CONFIG_IDF_FIRMWARE_CHIP_ID=0x0009
  ```
- The same archive's shipped `build/` tree contains `project_elf_src_esp32s3.c.obj` and `bootloader_flash_config_esp32s3.c.obj`.
- Both stock firmware images (`sd.bin`, `wifi.bin`) carry chip ID `0x0009` = ESP32-S3 in their ESP image headers, and their Arduino FQBN string reads `esp32:esp32:esp32s3:…`.

This matters: every piece of GooDisplay prose — the product page, both manual revisions, and the buy-lcd/buyepaper reseller listings — says only "ESP32", with no S-suffix. Anyone planning against "ESP32 classic" would plan against the wrong chip.

**Internal SRAM: 512 KB, plus 384 KB ROM and 16 KB RTC SRAM. VERIFIED** from the Espressif ESP32-S3-WROOM-1/1U datasheet v1.8, feature list: "384 KB ROM / 512 KB SRAM / 16 KB SRAM in RTC".

Usable heap is materially less than 512 KB once the WiFi stack, lwIP and `esp_http_server` are running — **the exact free-heap figure is unknown** and must be measured on the device. This is exactly why the PSRAM answer matters.

**Module part number: unknown.** No document names it, and the published schematic omits the MCU. **INFERRED: ESP32-S3-WROOM-1-N16R8** (or the `-1U` shielded equivalent), because:

- `CONFIG_ESPTOOLPY_FLASHMODE_DIO` + `CONFIG_ESPTOOLPY_FLASHSIZE_16MB` ⇒ a 16 MB *Quad* SPI flash. This rules out ESP32-S3-WROOM-2, which uses Octal flash and would need `CONFIG_ESPTOOLPY_OCT_FLASH`.
- `CONFIG_SPIRAM_MODE_OCT=y` ⇒ Octal PSRAM. In the WROOM-1 ordering table, only the `R8` (8 MB) and `R16V` (16 MB) variants are Octal.
- No board pin in the range IO26–IO37 is used for anything, consistent with in-package flash + octal PSRAM consuming them.

`ESP32-S3-WROOM-1-N16R16V` fits the same evidence and would give 16 MB of PSRAM. Either way ≥ 8 MB, which is all the design needs.

## 2. PSRAM — the load-bearing answer

**PSRAM is fitted, in Octal (OPI) mode, therefore ≥ 8 MB. VERIFIED.**

Three pieces of evidence, two of them from artifacts that would not boot if PSRAM were absent:

1. **The ESP-IDF reference `sdkconfig`** ships with PSRAM mandatory:
   ```
   CONFIG_ESP32S3_SPIRAM_SUPPORT=y
   CONFIG_SPIRAM=y
   CONFIG_SPIRAM_MODE_OCT=y
   CONFIG_SPIRAM_TYPE_AUTO=y
   CONFIG_SPIRAM_SIZE=-1
   CONFIG_SPIRAM_SPEED_80M=y
   CONFIG_SPIRAM_BOOT_INIT=y
   CONFIG_SPIRAM_USE_MALLOC=y
   CONFIG_SPIRAM_CLK_IO=30
   CONFIG_SPIRAM_CS_IO=26
   # CONFIG_SPIRAM_IGNORE_NOTFOUND is not set
   ```
   `SPIRAM_BOOT_INIT=y` with `SPIRAM_IGNORE_NOTFOUND` **not** set means the firmware aborts at boot if PSRAM is missing. GooDisplay ship this as the working reference build for the board.

2. **The stock `-SD` and `-WIFI` firmware images** both embed the Arduino FQBN they were built with, verbatim:
   ```
   esp32:esp32:esp32s3:UploadSpeed=921600,USBMode=hwcdc,CDCOnBoot=default,MSCOnBoot=default,
   DFUOnBoot=default,UploadMode=default,CPUFreq=240,FlashMode=qio,FlashSize=4M,
   PartitionScheme=huge_app,DebugLevel=none,PSRAM=opi,LoopCore=1,EventsCore=1,…
   ```
   `PSRAM=opi` — octal PSRAM, explicitly enabled. Both images also contain the strings `PSRAM enabled but initialization failed. Bailing out.` and `octal_psram`.

3. **The SD carousel firmware allocates from it.** `sd.bin` contains the log strings, in program order:
   `Starting SPI initialization...` → `SPI initialization completed` → `Starting SD card initialization...` → `/sd` → `PSRAM initialization failed!` → `Memory allocation failed!` → `/images.bin`. The vendor's own carousel already depends on a large PSRAM allocation to hold a frame.

**Exact size: unknown from documentation.** `CONFIG_SPIRAM_SIZE=-1` / `SPIRAM_TYPE_AUTO` means runtime auto-detection, and Arduino's `PSRAM=opi` names the mode, not the capacity. Per the Espressif WROOM-1 ordering table, Octal SPI PSRAM ships as **8 MB (`R8`) or 16 MB (`R16V`)**. **INFERRED 8 MB** as the overwhelmingly more common and cheaper part.

**Budget arithmetic.** 1600 × 1200 = 1,920,000 pixels; at 4 bpp = **960,000 bytes (937.5 KiB)** for a full frame, 480,000 bytes per driver IC half. The USB sample code corroborates the halving with the comment `Write CS0 image date 480000 bytes`, and the flash image slots in the vendor partition table are `0xEB000` = 962,560 bytes each — sized to hold exactly one such frame.

937.5 KiB does **not** fit in 512 KB of internal SRAM. It fits in 8 MB of PSRAM roughly eight times over. There is room for a full framebuffer, a scratch copy for QR compositing, and a streaming upload buffer simultaneously.

**How to settle the size definitively** (2 minutes with the board attached, no code):

- `esptool.py --port COMx flash_id` prints the detected flash chip and size.
- `idf.py monitor` at boot prints the PSRAM line, e.g. `spiram: Found 8MB SPI RAM device`, and Arduino's boot banner prints `Embedded PSRAM : …` (that format string is present in both stock images).
- In code: `heap_caps_get_total_size(MALLOC_CAP_SPIRAM)`.

## 3. Flash size and the admin-UI budget

**Flash is ≥ 16 MB. VERIFIED-by-requirement.**

`GDEP133C02/partitions_example.csv` — the partition table GooDisplay ship with both the reference demo and the USB firmware — is:

```
nvs,        data, nvs,      0x9000,  0x6000,
phy_init,   data, phy,      0xf000,  0x1000,
factory,    app,  factory,  0x10000, 0x1F0000,
os_par,     data, ,,0x1000,
wf_data,    data,,,0x4000,
image1..image15, data,,, 0xEB000 each
```

Fifteen image slots × `0xEB000` = 14,438,400 bytes, on top of a 1.94 MB app. Total requirement **`0xFCA000` = 16,556,032 bytes = 15.79 MiB**, and `CONFIG_ESPTOOLPY_FLASHSIZE_16MB=y`. This is not a config default — the `-USB` firmware genuinely stores fifteen images (`Image1`…`Image15` in the PC tool, per the manual) and physically cannot do so on less. Combined with the Quad-SPI-DIO flash mode, this points at a 16 MB part.

**Do not be misled by the stock Arduino builds.** `sd.bin` and `wifi.bin` both declare `FlashSize=4M` in their FQBN and carry a 4 MB Arduino `huge_app` layout (`nvs` 20 KB / `otadata` 8 KB / `app0` 3 MB / `spiffs` 896 KB / `coredump` 64 KB). That is the Arduino IDE default, not a statement about the physical part — a 4 MB-configured image runs fine on a 16 MB chip, just wasting 12 MB. Confirm with `esptool.py flash_id`.

**How much is left for a served admin UI: effectively all of it.** Measured from the artifacts:

| Measurement | Value | Source |
|---|---|---|
| Stock WiFi firmware app image (WiFi + `esp_http_server` + EPD driver + embedded UI) | **~1.96 MB** (data ends at `0x20066F` in a 3 MB `app0`) | `wifi.bin` |
| Its entire admin UI, one self-contained HTML page with inline CSS + JS | **34,207 bytes** | `wifi.bin`, `<!DOCTYPE html>`…`</html>` at `0x1057F` |
| Where it lives | **compiled into the app image**, not SPIFFS — the 896 KB `spiffs` partition in the shipped images is entirely erased (`0xFF`) | `wifi.bin` |
| Stock SD carousel firmware app image | ~425 KB | `sd.bin` |

An ESP-IDF build with WiFi + HTTP server + SD + display driver should land in the same ~1–2 MB range. On 16 MB flash you can afford **two 3 MB OTA app slots, an NVS partition, and a 1–2 MB LittleFS for the UI, and still leave ~6 MB spare**. A modern bundled SPA of a few hundred KB is not a constraint here. Embedding the UI directly (as GooDisplay do, via `EMBED_FILES`) is also viable and avoids a filesystem entirely.

**Caveat:** if `flash_id` comes back 4 MB, this changes. 3 MB app + 896 KB filesystem is the whole chip, and dual-slot OTA plus a large UI would not fit. Check before designing OTA in.

## 4. SD card interface

**SPI, 1-bit, on a bus separate from the display. VERIFIED** from §3.2 of the 23-page specification, quoted verbatim:

> An SD card slot is reserved on the development board. Users can expand the storage space of the development board via a memory card. The pin definitions are as follows:
> SD CS------IO15; SD MOSI------IO3; SD MISO------IO5; SD SCK------IO8

| Signal | GPIO |
|---|---|
| SD CS | IO15 |
| SD MOSI | IO3 |
| SD MISO | IO5 |
| SD SCK | IO8 |

Not SDMMC. The ESP32-S3 *has* an SDMMC host, but this board does not wire the card to it — SD SCK is IO8, and none of the SDMMC-capable slot pin groups are used. The `SDMMC_CLK`/`SDMMC_CMD`/`SDMMC_D0..D3` strings visible in `sd.bin` are a red herring: they sit inside the arduino-esp32 `periman` peripheral-name table alongside `I2C_MASTER_SDA`, `USB_DM`, `PPP_MODEM_TX` etc., and are present whether or not SDMMC is used.

**Throughput.** Per the ESP-IDF SD SPI host docs: *"SD over SPI does not support speeds above `SDMMC_FREQ_DEFAULT` due to the limitations of the SPI driver"*, and only integer fractions of the 40 MHz clock are usable — so **20 MHz, 1 bit wide**. That is a **2.5 MB/s bus ceiling**, i.e. ~0.4 s of pure bus time for a 960 KB frame. Real sustained throughput after FATFS overhead and card behaviour is **unknown from documentation and must be measured**; ESP32 SD-SPI writes in practice usually land well below the ceiling.

For the design that number is comfortable either way: a ~1 MB upload over 2.4 GHz WiFi through `esp_http_server` will be dominated by the network and the HTTP layer, not by the SD bus. Compare: an SDMMC 4-bit host at 40 MHz would be ~20× faster on paper, but it is not available on this board and it is not the constraint.

Because SD SCK (IO8) and EPD SCK (IO9) are different pins, the card and the panel sit on **two different SPI hosts** (the S3 has SPI2 and SPI3). Card access and display refresh do not contend for a bus.

**Note on on-card format.** The vendor's current SD firmware does **not** read `image0.bmp`/`image1.bmp` as our README says. `sd.bin` reads a single packed container: the strings are `/images.bin`, `open images.bin failed`, `invalid images.bin header`, `Frames: `, `IntervalMs: `. The 23-page spec matches — it directs users to `https://www.e-paper-display.com/bmp.html`, set a "Frame Interval (ms)", and *"Click to download the BIN file of the images and copy it to the SD card"*. The `imageN.bmp` scheme in the 16-page manual is the older revision. This does not constrain a custom firmware (which defines its own layout) but it does mean the README note about `image00.bmp` vs `image0.bmp` is chasing a scheme the current firmware no longer uses.

## 5. Free GPIO and user buttons

**The board already has three user-pressable buttons beyond RESET/BOOT. VERIFIED** from §3.1 of the 23-page specification, quoted verbatim:

> Four function buttons (SW2, SW3, SW4) are reserved on the development board. All three buttons are triggered by a high level. The pin definitions are as follows:
> SW2------IO12; SW3------IO13; SW4------IO14

(The "four/three" mismatch is the vendor's typo; three are listed.)

| Button | GPIO | Notes |
|---|---|---|
| SW2 | IO12 | active-high |
| SW3 | IO13 | active-high |
| SW4 | IO14 | active-high; stock WiFi firmware uses a 5-second hold on SW4 as the WiFi-config factory reset |

**This closes the question for the QR button — no free GPIO is required, and no soldering.** IO12/13/14 are ordinary GPIO on the ESP32-S3 (they are not strapping pins, unlike GPIO12/15 on the classic ESP32). Active-high means: configure with an internal pull-down and read for a high level.

Whether an `SW1` exists and whether it is RESET is **unknown** — not documented. **INFERRED** from the numbering starting at SW2 that SW1 is the reset button.

### Full pin map assembled from primary sources

| GPIO | Function | Source |
|---|---|---|
| IO2 | EPD_DC | spec §3.3 |
| IO3 | SD MOSI | spec §3.2 — **also a strapping pin** (JTAG source select) |
| IO5 | SD MISO | spec §3.2 |
| IO6 | EPD_RST | spec §3.3 + `pindefine.h` |
| IO7 | EPD_BUSY (input) | spec §3.3 + `pindefine.h` |
| IO8 | SD SCK | spec §3.2 |
| IO9 | EPD_SCK | spec §3.3 + `pindefine.h` |
| IO12 / IO13 / IO14 | SW2 / SW3 / SW4 | spec §3.1 |
| IO15 | SD CS | spec §3.2 |
| IO17 | EPD_CS_S (sub half) | spec §3.3 + `pindefine.h` |
| IO18 | EPD_CS_M (main half) | spec §3.3 + `pindefine.h` |
| IO19 / IO20 | USB D− / D+ | ESP32-S3 fixed function |
| IO38 / IO39 / IO40 / IO41 | EPD QSPI data D3 / D2 / D1 / D0 | `pindefine.h` |
| IO43 / IO44 | UART0 TXD / RXD | ESP32-S3 default console |
| IO45 | LOAD_SW (panel power enable) | `pindefine.h` — **also a strapping pin** (VDD_SPI voltage) |
| IO26, IO30 | PSRAM CS, PSRAM CLK | `sdkconfig` |
| IO35 / IO36 / IO37 | reserved by in-package Octal PSRAM, unusable | Espressif WROOM-1 datasheet, note b |
| IO27–IO32 | in-package Quad SPI flash, not brought out on WROOM-1 | Espressif WROOM-1 datasheet |

The spec's §3.3 calls IO41/IO40 "EPD_MOSI"/"EPD_MISO"; the code example makes clear these are QSPI data lines D0/D1 with D2/D3 on IO39/IO38. **Trust the code.** Also note §3.3 lists `EPD_DC = IO2` but the shipped `pindefine.h` never defines or uses a DC pin — the EL133UF1 QSPI protocol carries command/data framing in-band. Whether IO2 is actually wired is **unknown**; treat it as possibly free but verify before using.

**Remaining GPIO that are exposed on a WROOM-1 module and unclaimed by any documented board function: IO0 (BOOT strapping), IO1, IO4, IO10, IO11, IO16, IO21, IO42, IO46 (strapping), IO47, IO48** — roughly eleven pins. **But whether any of these are physically broken out to a header on the ESP32-133C02 PCB is unknown**, because the published schematic stops at the e-paper section and there is no header pinout in any document. Physical inspection of the board, or a continuity check against the module pads, would settle it. Given SW2/SW3/SW4 exist, the design does not need this answered.

## 6. Availability of GooDisplay / stock firmware source

**Partially — and more than expected. VERIFIED.**

| Artifact | Available? | What it is |
|---|---|---|
| **`GDEP133C02-ESP32 code example`** (47.7 MB zip) | **Yes**, free, no registration | Complete ESP-IDF project for the `-4` demo variant: `main/GDEP133C02.c/.h` (full EL133UF1 command set, init sequence, dual-CS handling, `writeEpdImage`, `partialWindowUpdate*`), `main/comm.c` (GPIO/SPI init), `main/usbcdc.c`, `pindefine.h`, `partitions_example.csv`, `sdkconfig`, and a **complete `build/` tree** including `.elf`, `.map` and the resolved sdkconfig. This is the single most valuable starting point — it is where the chip identity, PSRAM config and flash layout in this document came from. |
| **`ESP32-133C02_USB Sample Code`** (75 KB zip) | **Yes**, free | Smaller, cleaner ESP-IDF project. Headers are marked *"Copyright: E Ink Holdings Inc."* and the driver is named `EL133UF1` — this is the **E Ink reference design for the 13.3" control board**, which GooDisplay's board derives from. Includes `readICTemperature()`. |
| `-SD` firmware (`sd.bin`) | **Binary only** | 4 MB merged image. Arduino-ESP32 core 3.3.0 / ESP-IDF v5.5, built 2025-07-22. No source. |
| `-WIFI` firmware (`wifi.bin`) | **Binary only** | Same toolchain. Contains the 34 KB admin page and `esp_http_server`. No source. |
| Schematic | Yes, but **MCU section omitted** | Single page, e-paper power/driver only |
| GitHub | **No.** No GooDisplay/E Ink repository for this board was found. | |
| Upstream ESP-IDF | The example expects `$IDF_PATH/examples/example/peripherals/spi_master/lcd_EPD_OK` and `.../usb/tusb_serial_device` as `EXTRA_COMPONENT_DIRS` — these are **not** in upstream ESP-IDF and are not shipped in the zip. | |

GooDisplay state the limit plainly in the spec's closing note:

> The official website only provides the most basic image refresh programs. Functions such as SD card, WiFi and USB communication need to be developed by yourself or contact our sales for relevant technical support.

**Practical read:** the hard part — the EL133UF1 dual-controller init sequence and image-write protocol, which is not documented anywhere else — is available as working ESP-IDF C source under a permissive-looking (but unstated) licence. The easy parts (SD, WiFi, HTTP) are ours to write and are standard ESP-IDF. That is a good trade.

**Licence: unknown.** Neither archive contains a LICENSE file. Headers carry `Copyright : E Ink Holdings Inc.` with no grant. If this repo ever publishes derived firmware, the licence needs clarifying with GooDisplay.

## Open / unverifiable

Ordered by how much they matter.

1. **Exact PSRAM size (8 MB vs 16 MB)** — unknown from docs. Doesn't change the answer (≥ 8 MB either way); settle with `heap_caps_get_total_size(MALLOC_CAP_SPIRAM)` or the boot log.
2. **Exact physical flash size** — ≥ 16 MB is required by the vendor's own USB partition table, but no document states the part. Settle with `esptool.py flash_id`. **This one does matter** if OTA is wanted.
3. **Module part number** — no document names it and the MCU schematic is unpublished. Settle by reading the shield can on the board (`ESP32-S3-WROOM-1-N16R8` or similar) or with `esptool.py chip_id` + `flash_id`.
4. **Which GPIO are physically broken out to headers** — unknown; no header pinout published, MCU schematic unavailable. Only matters if more than three buttons are needed.
5. **Free heap in internal SRAM with WiFi + HTTP server running** — unknown; must be measured.
6. **Real sustained SD-SPI throughput** — unknown; the 2.5 MB/s figure is the bus ceiling, not a measurement.
7. **Whether IO2 (EPD_DC) is actually wired** — the spec lists it, the shipped code never uses it.
8. **Whether the Type-C and USB-A ports share the single ESP32-S3 USB peripheral (IO19/20)** or the Type-C goes through a separate UART bridge — unknown, and not resolvable without the MCU schematic. Low impact.
9. **`SW1`** — presumed RESET, undocumented.
10. **Licence of the vendor example source** — unstated.
11. **QR generation in stock firmware** — the 23-page spec describes scanning *"the QR code on the image displayed on the EPD"* for the `-3` v1 AP mode, but no QR-encoder strings or symbols appear in the `wifi.bin` build examined. Either it is a different build, or the QR is a pre-rendered static bitmap. Unresolved — but irrelevant, since we would generate our own.

## Implications for the firmware design

**Nothing found blocks the wanted design.** Feature by feature:

- **QR compositing** — the reason this ticket existed. Green. Hold the full 960,000-byte 4 bpp frame in PSRAM, draw the QR into it, split at the 800-pixel boundary, push the two halves to CS_M/CS_S, one full refresh. Note that the vendor's example *streams* image data to the panel in small chunks straight from flash and never holds a full frame — that is an optimisation for a chip without PSRAM, and we do not need to copy it.
- **WiFi admin UI** — green, and cheaper than expected. The stock firmware's entire admin UI is a 34 KB self-contained HTML page compiled into the app image. On ≥ 16 MB flash there is no meaningful budget pressure; use `EMBED_FILES` or a LittleFS partition, whichever is nicer to develop against.
- **AP-then-client onboarding** (map decision) — already proven on this exact hardware. The stock `-WIFI` "Version 2" firmware creates an `EPAPER-SETUP` AP, takes SSID/password/URL/wake-interval through a form, saves them, and thereafter joins the user's 2.4 GHz network. It also uses a **5-second hold on SW4** as the credential reset. Both are worth copying, including the reset gesture.
- **SD carousel** — green. SPI at 20 MHz is ample for a carousel that refreshes at most every 180 s.
- **~1 MB HTTP upload to SD** (an open item on the map) — the SD bus is not the constraint; the constraint is buffering. With ≥ 8 MB PSRAM you can stage the whole upload in RAM if you want to, which removes the awkward part of the problem. Chunked streaming straight to the card is still preferable.
- **Thumbnails** (an open item on the map) — PSRAM makes on-device downscaling feasible rather than forcing thumbnail generation onto the host app. Worth revisiting when that ticket is charted.
- **OTA** (an open item on the map) — **gated on confirming physical flash size.** Two 3 MB app slots fit comfortably on 16 MB and not at all on 4 MB alongside a UI filesystem. Run `esptool.py flash_id` before committing to OTA in the spec.

Two cautions for whoever writes the firmware:

- **IO45 is a strapping pin used as an output.** GPIO45 sets VDD_SPI voltage on the ESP32-S3 (default weak pull-down = 3.3 V), and this board drives it as `LOAD_SW`, the panel power enable. It is sampled only at reset, so driving it high at runtime is fine — but never leave it asserted across a reset, or the flash will be powered at the wrong voltage and the chip will not boot. IO3 (SD MOSI) is also a strapping pin (JTAG source select) with the same caveat.
- **JTAG is not available on the pin header.** IO39/IO40/IO41 are MTCK/MTDO/MTDI on the ESP32-S3 and are consumed by the EPD QSPI bus. Debugging will be over USB-Serial-JTAG or plain UART0 (IO43/IO44).

One naming note for the map: the current spec renames the firmware variants from `-1/-2/-3/-4` to **`ESP32-133C02-USB` / `-SD` / `-WIFI` / `-CH`**. Same four functions, newer labels.
