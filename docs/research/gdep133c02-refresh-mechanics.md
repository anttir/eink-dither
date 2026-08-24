# GDEP133C02 refresh mechanics, dual-IC split, and driver code

Research for [issue #9](https://github.com/anttir/eink-dither/issues/9), under the
[custom NeoFrame firmware map (#6)](https://github.com/anttir/eink-dither/issues/6).

Every claim is tagged **VERIFIED** (source cited) or **INFERRED** (reasoning stated).
Anything that is neither is in *Open / unverifiable*. No number in this document is a guess.

## Primary sources

| Tag | Source |
|---|---|
| **[DS]** | GooDisplay **GDEP133C02 panel datasheet**, 29 pp — <https://v4.cecdn.yun300.cn/100001_1909185148/GDEP133C02.pdf> (linked from the product page below) |
| **[MAN]** | GooDisplay **ESP32-133C02-X driver board manual**, 16 pp, rev 1.0, 2025-06-12 — <https://ecksteinimg.de/Photo/GD02009/EN-ESP32-133C02.pdf> |
| **[REF]** | GooDisplay's **official ESP-IDF reference driver** `GDEP133C02.c` / `.h` (the `133_ReferenceDesign_SampleCode` project). Vendor mirror: <https://github.com/LaskaKit/Testcode_examples/tree/main/Displays/E-Paper/13-30/GDEP133C02_ESP-IDF/main> · original download <https://www.good-display.com/companyfile/1755.html> |
| **[PP559]** | GooDisplay GDEP133C02 product page — <https://www.good-display.com/product/559.html> |
| **[PP574]** | GooDisplay ESP32-133C02 dev-kit page — <https://www.good-display.com/product/574.html> |
| **[WS]** | Waveshare 13.3inch e-Paper HAT+ (E) wiki manual — <https://www.waveshare.com/wiki/13.3inch_e-Paper_HAT+_(E)_Manual> · product page <https://www.waveshare.com/13.3inch-e-paper-hat-plus-e.htm> |
| **[EINK]** | E Ink Spectra 6 brand page — <https://www.eink.com/brand/detail/Spectra6> |
| **[GX]** | GxEPD2 — <https://github.com/ZinggJM/GxEPD2> |
| **[WSC]** | Waveshare's driver source for the equivalent panel, `EPD_13in3e.c/.h` — <https://github.com/waveshareteam/e-Paper/tree/master/E-paper_Separate_Program/13.3inch_e-Paper_E> |
| **[PINK]** | `pink88/Spectra6-GDEP133C02-Custom-Firmware-SD` — an existing third-party custom firmware for **this exact board and panel** — <https://github.com/pink88/Spectra6-GDEP133C02-Custom-Firmware-SD> |
| **[PW]** | `philippwaller/esphome-epaper-spectra6-133` — ESPHome component listing GDEP133C02 as tested, with a board package for the ESP32-133C02 and real hardware partial refresh — <https://github.com/philippwaller/esphome-epaper-spectra6-133> |
| **[FW]** | `Frans-Willem/epd-photoframe` `HARDWARE.md` — independent notes comparing a sibling 1200×1600 Spectra 6 panel against **[REF]** — <https://github.com/Frans-Willem/epd-photoframe/blob/main/HARDWARE.md> |

---

## Summary

- **The "full refresh only" assumption in map #6 is wrong in an important way.** GooDisplay's own
  reference driver implements a **partial-window update** (`PTLW`, command `0x83`) with documented
  coordinate constraints. What Spectra 6 lacks is a *fast/flicker-free* partial mode — a window
  update still runs the same full waveform and still flashes. **[REF] [GX]**
- **A refresh is ~12 s of waveform**, per the datasheet (`Tupdate` typ. 12 s @ 25 °C). The "~30 s"
  folklore comes from **row-pacing delays in the demo code**, not from the panel. **[DS] [REF] [PINK]**
- **The split is left/right.** Native frame 1200 (H) × 1600 (V); IC **M** = left 600 × 1600, IC **S**
  = right 600 × 1600. 4 bpp, two pixels per byte, **300 bytes per row per IC**, 480 000 bytes each,
  960 000 total. Splitting is a per-row byte-range operation. **[MAN] [REF]**
- **180 s is a longevity guideline, not an electrical interlock** — it appears only in prose
  precaution lists, never in any timing table. **[MAN] [WS] [DS]**
- **Prior art exists and is good.** A working ESP-IDF custom firmware for this exact board (SD card,
  deep sleep, buttons, power-rail switching) and an ESPHome component that lists GDEP133C02 as
  tested and implements hardware partial refresh are both public. **GxEPD2 does *not* support this
  panel.** **[PINK] [PW] [GX]**

---

## 1. Does Spectra 6 / E6 support any partial or fast refresh?

**Answer: it supports a partial *window* update, but no fast partial update. The map's "no partial
refresh" note should be corrected; its practical conclusion (one flashing full-waveform refresh per
change) survives.**

### What actually exists — VERIFIED from GooDisplay's own driver

**[REF]** `GDEP133C02.h` defines `#define PTLW 0x83`, `PTLW_ENABLE 0x01`, `PTLW_DISABLE 0x00`, and
declares two public functions:

```c
char partialWindowUpdateWithImageData(unsigned char csx, unsigned char const *imageData,
        unsigned long dataSize, unsigned int xStart, unsigned int yStart,
        unsigned int xPixel, unsigned int yLine, unsigned char displayEnable);
char partialWindowUpdateWithoutImageData(unsigned char csx, unsigned int xStart, unsigned int yStart,
        unsigned int xPixel, unsigned int yLine, unsigned char epdDisplayEnable);
```

`GDEP133C02.c` implements them as: write `CMD66` → write `PTLW` with a 9-byte window descriptor
(`HRST`, `HRED`, `VRST`, `VRED` as big-endian 16-bit pairs, then `PTLW_ENABLE`) → send the window's
image data via `DTM` → call `epdDisplay()` → wait 300 ms → write `PTLW` again with `PTLW_DISABLE`.

**The window constraints are enforced in code and are exact:**

| Rule (verbatim from the source's own comments / checks) | Consequence |
|---|---|
| `HRST = xStart * 2`, and `HRST % 8 != 0` → error `-1` | **`xStart` must be a multiple of 4** |
| `HRED = (xStart + xPixel) * 2 - 1`, and `(HRED - 7) % 8 != 0` → error `-2` | **`xStart + xPixel` must be a multiple of 4** |
| `xStart > 584 \| xPixel > 600` → error `-3` | **window lives inside ONE IC's 600-px-wide half** |
| `HRED - HRST + 1 < 32` → error `-4` | **minimum window width 16 px** |
| `(yStart + yLine) % 2 != 0` → error `-5` | **`yStart + yLine` must be even** |
| `yStart > 1596 \| yLine > 1600` → error `-6` | full 1600-line height available |
| `VRST = yStart / 2`, `VRED = (yStart + yLine)/2 - 1`, `VRED + 1 > 800` → error `-7` | vertical granularity is **2 lines** |
| `csx > 1` → error `-8` | window is addressed to one IC at a time |

- **VERIFIED (cross-check, different vendor's library):** **[GX]**
  `src/epd7c/GxEPD2_730c_GDEP073E01.h` — the 7.3" Spectra 6 panel, same FPL — declares
  `hasPartialUpdate = true`, `usePartialUpdate = true`, **`hasFastPartialUpdate = false`**, and
  `partial_refresh_time = 15000` — **the same value as `full_refresh_time`**. GxEPD2's author
  originally stated that 6/7-colour controllers have *"neither partial window addressing capability,
  nor partial window refresh"* and then reversed it, adding *"partial update support to
  GDEP073E01"* in v1.6.8. Windowed yes; fast/flicker-free no; **no time saved on the waveform**.
- **VERIFIED (third-party implementation on this exact panel):** **[PW]** implements real hardware
  partial refresh and documents the same alignment rules independently — `HRST` a multiple of 8,
  `HRED = 8m+7`, minimum 32 px wide, `HRED + 1 <= 1200`, i.e. confined to one IC's half.
- **VERIFIED, and a trap:** Waveshare's `EPD_13IN3E_DisplayPart()` in **[WSC]** is **not** a hardware
  partial window — it still clocks all 480 000 bytes into each IC, padding the untouched region with
  `0x11` (white). Do not take its existence as evidence of a cheap partial path.

### What does not exist

- **VERIFIED** The string "partial" does not appear anywhere in the 29-page **[DS]** (grepped the
  full extracted text — 0 occurrences). The datasheet contains no command table at all.
- **VERIFIED** **[PP574]** lists "Refresh Mode: **Full Refresh**" for the GDEP133C02 / ESP32-133C02
  combination.
- **VERIFIED** Waveshare's selection table marks their 13.3" Spectra 6 row `Partial Refresh` **blank**
  while the neighbouring 13.3" (K) row is `✓`, and their FAQ says *"Currently, only some black and
  white e-Paper screens support partial refresh."* **[WS]**
- **VERIFIED but marketing-only:** E Ink describe *"a partial image flashing effect, E Ink Sparkle™,
  which enhances the effect of advertising messages through motion"*. **[EINK]**
  **INFERRED:** this is a waveform/signage effect, not a host-addressable API. Nothing in **[DS]** or
  **[REF]** exposes it. Do not plan around it.

### The reconciliation — INFERRED, but well-evidenced

`partialWindowUpdate*` in **[REF]** ends by calling the *same* `epdDisplay()` as a full-frame update
— `PON` → `DRF (0x12, data 0x01)` → `POF` — i.e. the identical refresh waveform. So:

- A window update **still flashes** and, absent measurement, should be assumed to take the **same
  ~12 s waveform time** as a full update.
- What a window update genuinely saves is **image-data transfer**, which (see §2) is the dominant
  *variable* cost in the demo firmwares because of deliberate per-row pacing.
- The vendor-facing "Full Refresh only" label is therefore about *refresh quality modes*
  (no flicker-free fast update), not about *addressable regions*.

---

## 2. Full-refresh duration and temperature dependence

### The waveform itself

- **VERIFIED** **[DS] §8.1 Optical Characteristics**:

  | Symbol | Parameter | Temperature | Typ. | Unit |
  |---|---|---|---|---|
  | `Tupdate` | Update time | 25 °C | **12** | sec |

  Min and Max columns are empty — GooDisplay publish only a typical.
- **VERIFIED** Waveshare publish **19 s** "full refresh time" for *their* 13.3" Spectra 6 HAT+ (E),
  with the caveat *"The refresh time is based on experimental test data... There will be a flickering
  effect during the global refresh process, which is a normal phenomenon."* **[WS]**
  Different vendor's module on the same FPL — corroboration of magnitude, not a GDEP133C02 spec.
- **VERIFIED (independent cross-check)** **[GX]** for the 7.3" Spectra 6 GDEP073E01:
  `full_refresh_time = 15000; // ms, e.g. 12468000us` — i.e. a **measured 12.47 s**, budgeted at 15 s.
  Also `power_on_time = 200; // ms, e.g. 172000us` and `power_off_time = 150; // ms, e.g. 145000us`.

  **INFERRED:** three independent numbers (12 s datasheet, 12.47 s measured on the sibling panel,
  19 s Waveshare's budget) put the waveform at **12–19 s**. Budget 15 s, verify against `BUSY_N`.

### Where "~30 s" comes from — this is the useful finding

**The panel is not slow; the reference code is deliberately paced.**

- **VERIFIED** **[REF]** `pic_display_test()` sends the frame row by row with
  `vTaskDelay(pdMS_TO_TICKS(1));  // Delay 1ms to avoid hardware overload` after **every** row, for
  1600 rows × 2 ICs. **INFERRED:** that is ~3.2 s of pure pacing on top of the waveform.
- **VERIFIED** **[PINK]** `main/config.h` goes much further on battery:
  ```c
  #define EPD_PRECHARGE_DELAY_MS  500   // Delay before starting the EPD image transfer
  #define EPD_ROW_DELAY_MS        8     // Per-row pacing. Increase to reduce peak current demand.
  #define EPD_SECTION_GAP_MS      250   // Delay between first and second panel section transfer.
  ```
  **INFERRED:** 1600 rows × 8 ms × 2 sections = **25.6 s of pacing**, + 0.5 s precharge + 0.25 s gap,
  before the ~12 s waveform even starts — a ~38 s total. That is where the folklore number lives.
- **VERIFIED** the reason for the pacing, from **[PINK]**'s README: *"Current Peak Reduction:
  Implements row delay pacing (`EPD_ROW_DELAY_MS`) and section gap delays (`EPD_SECTION_GAP_MS`)
  during SPI transfer to reduce peak current spikes on battery supply"*, and *"SD Card Bus
  Protection: Temporarily pauses SD card logging and file access during the high-current e-paper
  refresh phase to avoid simultaneous SPI power surges."*
- **Raw link time is small but not free, and "QSPI" is mostly aspirational.** **VERIFIED:** every
  working third-party driver examined runs the panel on **ordinary single-line SPI** — **[PW]**'s
  ESP-IDF bus config sets `data2_io_num = -1; data3_io_num = -1; quadwp_io_num = -1;
  quadhd_io_num = -1`, never sets `SPI_TRANS_MODE_DIO/QIO`, and clocks at **10 MHz**;
  `rkaramandi/esphome-seeed-ee02` reports **2 MHz** because *"higher rates were unreliable"*;
  **[WSC]** writes byte-at-a-time. **INFERRED:** 960 000 bytes costs **~0.8 s at 10 MHz** and
  **~4 s at 2 MHz**. **[PINK]**'s `pindefine.h` does wire all four data lines on the ESP32-133C02,
  so quad mode may be available on this board — but do not budget for quad-lane throughput until
  it is demonstrated.
- **INFERRED** Pacing is nonetheless a power-integrity choice, not a bandwidth limit. A
  mains-powered frame with adequate bulk capacitance can use a much smaller row delay than
  **[PINK]**'s 8 ms — but the value must be found empirically, because **[DS] §6.2** documents
  inrush of **641.6 mA typ / 844.5 mA max** with the booster on.

**Correct the map: the ~30 s figure is a firmware artefact. The panel's own number is ~12 s.**

### Temperature

- **VERIFIED** The panel has a digital temperature sensor on dedicated I²C pins `TSCL`/`TSDA`, and
  **[DS] §5** lists *"Communicating with digital temperature sensor"* among the conditions that hold
  `BUSY_N` low. **INFERRED:** standard E Ink arrangement — the controller reads panel temperature and
  selects a temperature-compensated waveform, so update time is inherently temperature-dependent.
- **VERIFIED** **[DS] §6.1**: operating `TOPR: 0 to +50 °C`; storage `TSTG: -25 to +50 °C`.
  Waveshare state a narrower `0 ~ 40 °C` operating for their module. **[WS]**
- **VERIFIED** **[WS]** cold-weather note: *"Refresh at low temperatures may cause a color cast, and
  it is necessary to stand still at 25 °C for 6 hours before refreshing."* Note this warns of
  **colour cast**, not a longer refresh.
- **UNVERIFIED — do not put a number on this.** No source gives a refresh-time-versus-temperature
  curve, a cold `Tupdate`, or any statement that a refresh *takes longer* when cold. `Tupdate` is
  specified at 25 °C only.
- **VERIFIED** **[DS]** caveat: *"The listed electrical/optical characteristics are only guaranteed
  under the controller & waveform provided by E Ink."*

---

## 3. The dual-driver-IC split — exact geometry and byte layout

### The manual's text and figure — VERIFIED

**[MAN] §6**, verbatim:

> *"As shown in the figure, each IC controls half of the screen. Two CS (chip select) pins are used
> to control the corresponding areas: M (main) and S (sub). Except for the CS pins, all other control
> pins are shared."*
>
> *"In addition to shared commands (such as initialization and refresh commands used in example
> programs), only one CS pin is allowed to be pulled low at a time."*
>
> *"When transmitting image data, please note that the screen displays content in landscape
> orientation (along the X-axis). After reaching the end of one area, the display continues to the
> next line. Therefore, the image must be split into two separate images and transmitted separately
> for each region. Failing to do so will result in a misaligned display."*

The accompanying diagram (page 14 of **[MAN]**, extracted from the PDF and read directly) is:

```
      |<---------------- 1200 ---------------->|
      +-------------------+-------------------+   ---
      |  X (0~599)  ->    |  X (0~599)  ->    |    ^
      |  Y (0~1599)       |  Y (0~1599)       |    |
      |        |          |        |          |    |
      |        v          |        v          |  1600
      |                   |                   |    |
      |        M          |        S          |    |
      |     (main)        |      (sub)        |    v
      +-------------------+-------------------+   ---
```

**The seam is vertical. The split is LEFT / RIGHT, not top / bottom.**

- **M (main)** = left half, **600 × 1600**, local coords `X 0..599`, `Y 0..1599`.
- **S (sub)** = right half, **600 × 1600**, local coords `X 0..599`, `Y 0..1599`.
- Each IC has **its own origin**: S's `X = 0` is the panel's centre line, not its left edge.

### Confirmed by the reference driver — VERIFIED

**[REF]** `GDEP133C02.c`:

```c
#define EPD_WIDTH        1200    // Total display width (pixels)
#define EPD_HEIGHT       1600    // Display height (pixels)
#define FIRST_PACK_SIZE  480000  // First data packet size (bytes)
#define TOTAL_IMAGE_SIZE 960000  // Total image data size (bytes)

Width  = EPD_WIDTH / 2;   //  600
Width1 = Width / 2;       //  300
Height = EPD_HEIGHT;      // 1600

// first section (main)
setPinCs(0, 0);  writeEpdCommand(DTM);
for (i = 0; i < Height; i++) writeEpdData(num + i * Width,          Width1);
// second section (secondary)
setPinCs(1, 0);  writeEpdCommand(DTM);
for (i = 0; i < Height; i++) writeEpdData(num + i * Width + Width1, Width1);
```

(`draw_checkerboard()` in the same file asserts `Width == 600 && Width1 == 300 && Height == 1600`.)

Reading the arithmetic — note GooDisplay's variable names and comments are misleading, the numbers
are not:

- **Row stride in the host framebuffer = 600 bytes** = 1200 px at 4 bpp.
- **M receives bytes `[row*600 .. row*600+300)`** — the left 600 pixels of that row.
- **S receives bytes `[row*600+300 .. row*600+600)`** — the right 600 pixels of that row.
- **300 bytes per row per IC × 1600 rows = 480 000 bytes per IC; 960 000 bytes total (937.5 KiB).**
- **INFERRED:** splitting is therefore a pure per-row byte-range operation. No re-ordering, no
  transposition, no separate buffer needed — you can stream both halves straight out of one
  full-frame buffer, or straight off the SD card with a 600-byte row stride.

**VERIFIED independently** by **[FW]**, which reached the same conclusions from **[REF]**:
*"1200x1600 Spectra 6 image data, packed as two pixels per byte… Two chip selects for two panel
controllers… Image data split into left and right controller halves."*

### Bit packing and colour codes — VERIFIED

**[REF]** `GDEP133C02.h`:

```c
#define BLACK   0x00
#define WHITE   0x11
#define YELLOW  0x22
#define RED     0x33
#define BLUE    0x55
#define GREEN   0x66
```

These are *byte* constants holding the same code in both nibbles (used with `memset` for solid
fills), so the **per-pixel 4-bit codes** are:

| Colour | Nibble |
|---|---|
| Black | `0x0` |
| White | `0x1` |
| Yellow | `0x2` |
| Red | `0x3` |
| Blue | `0x5` |
| Green | `0x6` |

(`0x4` and `0x7` are unused. **UNVERIFIED** what they do — no command table exists to say.)

- **VERIFIED** packing order, from `draw_checkerboard()` in **[REF]**:
  `num[new_index] = (color1 << 4) | color2;` — **high nibble = the earlier pixel in X, low nibble =
  the next pixel**, two pixels per byte, X-major within a row.
- **VERIFIED** **[PINK]** `config.h` states the same: `#define IMAGE_SIZE (SCREEN_WIDTH * SCREEN_HEIGHT / 2)`
  with the comment *"Image size in bytes (1200x1600, 4 bits per pixel)"*.

### Why each IC is configured as 1200 × 800 — VERIFIED, and it explains the odd coordinates

`initEPD()` in **[REF]** programs `TRES` (`0x61`) with `{0x04, 0xB0, 0x03, 0x20}` = **1200 × 800**,
to *both* ICs — apparently contradicting a 600 × 1600 half. **[WSC]** does exactly the same. The
explanation is in the panel's TFT structure: **[DS] §5.3 "Panel Scan Directions"** labels the
horizontal axis **S2400** and the vertical axis **G800** — **2400 source lines × 800 gate lines =
1 920 000 = 1200 × 1600**. It is a dual-gate / half-source TFT: two image rows share one gate line
and each pixel column has two source lines. Each IC therefore owns **1200 sources × 800 gates**,
which maps to a **600 × 1600** patch of visible glass.

The reference driver's own partial-window maths encodes the mapping:

```c
HRST = xStart * 2;               // "The range is 0 ~ 1199"
VRST = yStart / 2;               // "The range is 0 ~ 799"
```

**INFERRED:** the host never needs to think about this except when computing partial-window
coordinates, where it is the direct cause of the 4-px X granularity and 2-line Y granularity in §1.

*(The `S2400`/`G800` axis labels come from an image-only page of an encrypted PDF, reported by a
sub-investigation that extracted it; the mechanism is independently corroborated by `TRES`, the
`HRST`/`VRST` ranges, and the 600 × 1600-per-IC comment in **[WSC]**'s header.)*

### Interface and pins — VERIFIED

- **[PP559]** lists the interface as **QSPI**; **[DS] §6.3.1.1** documents `BS0`/`BS1` selecting
  3-wire SPI / 4-wire SPI / standard 4-wire SPI / QSPI (default: standard 4-wire SPI).
- **[PINK]** `main/pindefine.h` gives the ESP32-133C02 board's actual wiring — this is a
  third-party file for this exact board, so treat it as strong but not vendor-authoritative:
  ```c
  #define SPI_CS0 18   // M (main)     #define SPI_Data0 41
  #define SPI_CS1 17   // S (sub)      #define SPI_Data1 40
  #define SPI_CLK 9                    #define SPI_Data2 39
  #define EPD_BUSY 7                   #define SPI_Data3 38
  #define EPD_RST  6
  #define LOAD_SW  45  // display power-rail load switch
  #define SW2_PIN 12 / SW3_PIN 13 / SW4_PIN 14  // onboard tactile switches (RTC GPIOs)
  ```
  Four data lines confirm the board runs the panel in **QSPI**. `SPI_CS0` maps to `csx = 0` (M) and
  `SPI_CS1` to `csx = 1` (S) via **[REF]**'s `const unsigned char spiCsPin[2] = { SPI_CS0, SPI_CS1 };`.
- **VERIFIED (panel side)** **[DS] §5.2 Pin Assignment** confirms the dual-IC wiring on the 60-pin
  FPC: `27 CSB_M` *"Serial communication chip select.(Master)"*, `58 CSB_S` *"…(Slave)"*, plus
  separate `1 VCOMBD_M` / `36 VCOMBD_S`. Everything else is shared: `24 RES#`, `25 BUSY_N`,
  `26 D/C#`, `28 SCL`, `29-32 SI0..SI3`.
- **VERIFIED, and it contradicts the manual slightly:** **[REF]**'s `epdDisplayColor()` and
  `epdDisplayColorBar()` pull **both** CS lines low and broadcast one `DTM` stream to both ICs, for
  uniform fills. **[MAN]** says *"only one CS pin is allowed to be pulled low at a time"* except for
  shared commands. **INFERRED:** broadcasting identical data to both ICs is safe and is what the
  vendor does; it is only *distinct* per-half image data that must be sent one CS at a time.
  This is a cheap fast path for "blank the screen to white".

### Three traps that produce a panel that inits, ACKs, refreshes — and shows garbage

1. **`BUSY_N` is LOW = busy.** **VERIFIED** **[DS] §5**: *"BUSY_N = "0"：Driver is busy, data/VCOM is
   transforming. BUSY_N = "1"：Non-busy. Host side can send command/data to driver."* **[REF]**'s
   `checkBusyHigh()` is `while(!(getGpioLevel(EPD_BUSY)));`. This is **inverted versus most small
   e-paper panels**, where BUSY high means busy.
2. **The power and booster registers go to the MASTER ONLY.** **VERIFIED** — in **[REF]**'s
   `initEPD()`, `AN_TM`, `PWR`, `EN_BUF`, `BTST_P`, `BOOST_VDDP_EN`, `BTST_N`, `BUCK_BOOST_VDDN` and
   `TFT_VCOM_POWER` are all written under `setPinCs(0, GPIO_LOW)` (M only), while `CMD66`, `PSR`,
   `CDI`, `TCON`, `AGID`, `PWS`, `CCSET` and `TRES` go to both. **[WSC]** does the same.
   **INFERRED:** the master runs the shared DC/DC and supplies `VCOMBD_S` to the slave.
   Broadcasting the power registers to both is a plausible route to a subtly wrong display.
3. **Single-CS drivers fail silently.** `rkaramandi/esphome-seeed-ee02` states the failure mode
   precisely: the panel *"is internally two side-by-side controllers … Single-CS ESPHome drivers
   send data down one CS only: the panel ACKs the SPI and completes a refresh, but nothing usable
   lands on the glass."*

---

## 4. Sleep / wake sequence and re-initialisation cost

### What the documents say

- **VERIFIED** **[DS] §6.2 notes**: *"Issue the command `0x07` with data `0xA5` to let EPD enter deep
  sleep mode."*
- **VERIFIED** **[MAN] §7 Precautions item (4)**, verbatim:
  > *"Once the screen enters sleep mode, it will ignore any incoming image data. Reinitialization is
  > required to resume normal operation."*

  Corroborated by **[WS]**: *"After the screen enters sleep mode, the image data sent will be
  ignored, and it can only be refreshed normally after re-initialization."*
- **INFERRED, and it matters:** the failure is **silent** — data is discarded, not rejected. `BUSY_N`
  stays idle-high, the SPI bytes clock in and vanish, and there is no error to detect. Firmware must
  model "initialised / asleep" as explicit state it owns.
- **VERIFIED (from driver code) the exit path is a hardware reset, not a command.** **[GX]** gates
  the reset sequence on the hibernating flag, which is the same rule for the Spectra 6 family:
  ```cpp
  void GxEPD2_730c_GDEP073E01::_InitDisplay() {
    if ((_rst >= 0) && (_hibernating || _initial_write)) {
      digitalWrite(_rst, HIGH); delay(50);   // needs a little longer
      digitalWrite(_rst, LOW);  delay(20);
      digitalWrite(_rst, HIGH); delay(10);   // 6ms measured
      _initial_write = false; _hibernating = false; _power_is_on = false;
    } ...
  ```
  and `hibernate()` sets `_init_display_done = false`, so the **entire** register sequence is
  replayed — not just the reset. **[WSC]**'s example never sends anything after `Sleep()`; it drops
  the rail instead.
  **UNVERIFIED:** **[DS]** documents only the *entry* command (`0x07`/`0xA5`), never the exit path.
  "Only a hardware reset revives it" is consistent across every driver examined and with the
  UC81xx family this command set descends from, but no GDEP133C02 document states it.

### What the reference driver actually does — VERIFIED, and it is *not* `0x07`

- **VERIFIED** `0x07` / `0xA5` **appear nowhere** in **[REF]** (`GDEP133C02.c` and `.h` grepped;
  the only `0x07` is a byte inside `EN_BUF_V`). GooDisplay's own driver defines no deep-sleep command.
- **VERIFIED** Instead, every refresh in **[REF]** ends with power-off:
  ```c
  void epdDisplay(void) {
      setPinCsAll(GPIO_LOW); writeEpdCommand(PON);            checkBusyHigh(); setPinCsAll(GPIO_HIGH);
      setPinCsAll(GPIO_LOW); delayms(30);
                             writeEpd(DRF, DRF_V, 1);          checkBusyHigh(); setPinCsAll(GPIO_HIGH);
      setPinCsAll(GPIO_LOW); writeEpd(POF, POF_V, 1);          checkBusyHigh(); setPinCsAll(GPIO_HIGH);
  }
  ```
  `PON` = `0x04`, `DRF` = `0x12` (data `0x01`), `POF` = `0x02`. **So the idle state after every
  refresh is POF (powered down), reached automatically — the "never leave it powered" rule is
  satisfied by the vendor's own refresh routine.**
- **VERIFIED, going further** — **[PINK]** cuts the display's power rail entirely rather than trusting
  any panel command: `main/sleep.c` drives `LOAD_SW` low, then `gpio_hold_en(LOAD_SW)` +
  `gpio_deep_sleep_hold_en()` before `esp_deep_sleep_start()`, so the rail cannot float back on
  during ESP32 deep sleep. Its `config.h` sets `SLEEP_DURATION_MINUTES 1440` — a 24-hour wake,
  matching the 24 h refresh rule exactly.

### Re-initialisation cost

- **VERIFIED (structure)** `initEPD()` in **[REF]** is: hardware reset (`RST` low 20 ms, high 20 ms)
  → `checkBusyHigh()` → **15 register writes** (`AN_TM`, `CMD66`, `PSR`, `CDI`, `TCON`, `AGID`, `PWS`,
  `CCSET`, `TRES`, `PWR`, `EN_BUF`, `BTST_P`, `BOOST_VDDP_EN`, `BTST_N`, `BUCK_BOOST_VDDN`,
  `TFT_VCOM_POWER`), each a few bytes. The only explicit delays are the two 20 ms reset delays.
- **VERIFIED (nearest measured analogue)** **[GX]** for the 7.3" Spectra 6:
  `power_on_time = 200; // ms, e.g. 172000us` and `power_off_time = 150; // ms, e.g. 145000us`.
- **VERIFIED (Waveshare's reset is longer)** **[WSC]**'s `EPD_13IN3E_Reset()` is five RST
  transitions at 30 ms each ≈ **150 ms**, versus **[REF]**'s 20 ms + 20 ms.
- **INFERRED** Re-init therefore costs roughly:

  | Step | Cost |
  |---|---|
  | Hardware reset | 40 ms (**[REF]**) – 150 ms (**[WSC]**) |
  | `checkBusyHigh()` after reset | ~20–50 ms |
  | 15–16 register writes, ~50 bytes total | sub-millisecond |
  | **Total re-init** | **≈ 60–200 ms** |
  | `PON` → busy | ~200 ms |

  i.e. **about 1–2 % of one refresh cycle.** Combined with 0.70 µA deep sleep vs 6.58 µA standby
  (**[DS] §6.2**), there is no scenario where skipping the re-init is worth it. What you must never
  do is skip the *reset* and jump straight to `DTM` — that is the silent-no-op path.
- **UNVERIFIED** No primary source states a re-initialisation *time* for GDEP133C02. The numbers
  above are read off driver code and its measured-value comments. **Measure on the board before
  putting a number in the firmware spec.**

### Currents worth designing for — VERIFIED, **[DS] §6.2** (VDD 3.3 V, 25 °C, typicals)

| Symbol | Parameter | Typ. | Max. |
|---|---|---|---|
| `IMDS` | Module deep sleep current | 0.70 µA | — |
| `IMSTB` | Module stand-by current | 6.58 µA | — |
| `PSTBY` | Standby power dissipation | 0.876 µW | — |
| `IMOPR` | Module operating current (typ. loading) | 45.5 mA | 58.1 mA |
| `IMOPR` | Module operating current (high loading) | 355.2 mA | 511.5 mA |
| `INC` | Inrush current, booster on | 641.6 mA | 844.5 mA |
| `IPC` | Driving peak current | 622.4–700.8 mA | 871.2–987.4 mA |
| — | Operation power dissipation | 150.2 mW typ / 1172.2 mW high-loading typ | 1688.0 mW |

(Waveshare quote `<0.01 µA` standby for the raw display, conflicting with the datasheet's 0.70 µA —
prefer **[DS]**. The DC table in the extracted PDF text is column-mangled; the values above are
GooDisplay's, but re-read the original PDF before relying on any single row.)

**INFERRED:** a refresh can pull close to an amp in inrush. This is exactly why **[REF]** and
**[PINK]** pace the row transfers. The power design must survive the peak even though average draw
is microamps.

---

## 5. What the manufacturer's rules mean for an all-day photo frame

### The rules, verbatim, and where each actually comes from

**[MAN] §7 Precautions** — GooDisplay, for this exact board + panel:

> *"1) Do not leave the screen powered on for a long time without refreshing. When the screen is not
> being refreshed, it should be set to sleep mode or powered off. Prolonged exposure to high voltage
> can damage the film layer of the screen and may cause irreversible failure."*
>
> *"2) When using the e-paper display, it is recommended to have a minimum refresh interval of 180
> seconds, and to perform at least one full refresh every 24 hours."*
>
> *"3) If the e-paper display will not be used for an extended period, it should be refreshed to a
> white screen before storage."*

**[DS] §13 Precautions item (5)** — the panel datasheet, and note what it does *not* say:

> *"If the EPD Panel / Module is not refreshed every 24 hours, a phenomena known as 'Ghosting' or
> 'Image Sticking' may occur. It is recommended to refreshed the ESL / EPD Tag every 24 hours in use
> case. It is recommended that customer ships or stores the ESL / EPD Tag with a completely white
> image to avoid this issue"*

**[WS]** carries the same two rules almost word for word, so this is industry-wide e-paper guidance
rather than a GooDisplay quirk.

### Is 180 s a hard electrical limit, or a longevity guideline?

**A longevity guideline. INFERRED, but on solid grounds:**

- **VERIFIED** The figure appears **only in prose precaution lists** — **[MAN] §7(2)** and the
  equivalent **[WS]** text — worded *"it is recommended"*.
- **VERIFIED** `180` occurs **zero times** in the entire 29-page **[DS]** (grepped). It is in no
  timing table: not in §6.3 Panel AC Characteristics (which covers only SPI bus timing and `BUSY_N`
  setup times), not in the absolute maximum ratings, and there is no `t`-prefixed symbol for it.
- **VERIFIED** Waveshare's FAQ scopes it across their whole catalogue with the parenthetical
  *"(Except for products that support partial refresh function)"* — a device-lifetime rule, not a
  per-panel interlock.
- **VERIFIED** Nothing in **[REF]** enforces or even mentions an inter-refresh interval.
- **INFERRED** Therefore nothing in the hardware blocks a refresh at t+15 s, and no source claims an
  immediate failure. The cost of violating it is cumulative film wear, **unquantified by any vendor**.

**This does not make it safe to ignore.** Because nobody quantifies the damage, the honest position
is: **enforce 180 s as a firmware budget, and allow deliberate, rate-limited exceptions rather than
routine ones.**

### The 24-hour rule

- **VERIFIED** Its stated purpose is **ghosting / image sticking** (**[DS] §13(5)**) — an
  image-quality mechanism, not a safety one.
- **INFERRED** A carousel that advances every few minutes satisfies it automatically. It only bites
  in degenerate states: carousel paused, every image excluded, a crash-loop, or a frame left on one
  photo. Cheap insurance: *"if no refresh in 24 h, refresh anyway"* — which is exactly what **[PINK]**
  does with `SLEEP_DURATION_MINUTES 1440`.

### "Never leave powered and idle"

- **VERIFIED** rule and mechanism: high voltage on the film → irreversible failure. **[MAN] §7(1)**
- **INFERRED, and this is the key design consequence:** "powered" means *the panel's driver left in an
  active, high-voltage state* — **not** *the ESP32 has power*. The remedy is already built into
  **[REF]**: `epdDisplay()` ends with `POF`. An always-on photo frame is fine provided the firmware
  keeps the invariant **"the panel is powered only during the seconds it is being refreshed"** —
  ESP32 awake serving HTTP, panel at POF (or rail cut via `LOAD_SW`) the rest of the time.
  This is a firmware invariant, not a power-architecture decision, and it does **not** force the
  battery/deep-sleep power model on you.

### Realistic lifetime refresh count

- **VERIFIED: unknown.** Neither **[DS]** nor **[EINK]** publishes any lifetime, endurance, or
  refresh-count figure for Spectra 6 or GDEP133C02. The full datasheet text contains no "lifetime",
  "endurance", or cycle-count entry.
- **VERIFIED but weak:** Waveshare's generic, all-products FAQ: *"What is the number of refresh
  times/lifespan of the e-Paper screen? … Ideally, with normal use, it can be refreshed 1,000,000
  times (1 million times)."* **[WS]** Not attributed to Spectra 6, hedged with "ideally", covers
  their whole catalogue. **Do not treat it as a GDEP133C02 spec.**
- **INFERRED, order-of-magnitude sanity only:** at the 180 s floor for 12 h/day that is ~240
  refreshes/day ≈ 87 600/year — ~11 years against the unverified 1 M figure. At a 15-minute carousel
  interval, ~48/day ≈ 17 500/year. **The carousel interval is not lifetime-constrained at any sane
  setting** — but this rests on a number no vendor stands behind for this panel.

---

## 6. Existing driver code for this panel's dual-IC split

### Supports GDEP133C02 specifically

| Repo / source | Notes |
|---|---|
| **GooDisplay `133_ReferenceDesign_SampleCode`** — <https://www.good-display.com/companyfile/1755.html>; browsable mirror at `LaskaKit/Testcode_examples` → `Displays/E-Paper/13-30/GDEP133C02_ESP-IDF/` | **This IS the panel's vendor driver.** ESP-IDF, ESP32-S3. `initEPD`, `epdDisplay`, `pic_display_test` (the left/right split loop), `epdDisplayColor`, `epdDisplayColorBar`, `writeEpdImage`, `checkDriverICStatus` (reads `0xF2` per IC), and both `partialWindowUpdate*` functions. **Start here.** Good Display's own download links 403 to non-browser clients; the LaskaKit mirror does not. |
| **[PW]** `philippwaller/esphome-epaper-spectra6-133` | **Lists GDEP133C02 as tested and ships a board package for the ESP32-133C02.** ESPHome external component (`platform: epaper_spectra6_133`), ESP-IDF + PSRAM, `set_cs0_pin` / `set_cs1_pin` manual chip selects, `ROW_BYTES = EPD_WIDTH/2`, `HALF_ROW_BYTES = ROW_BYTES/2` (*"Number of packed framebuffer bytes handled by one driver IC per row"*), and **real hardware partial refresh with the alignment rules spelled out**. Best-engineered implementation found. |
| **[PINK]** `pink88/Spectra6-GDEP133C02-Custom-Firmware-SD` | **Closest existing prior art to map #6.** ESP-IDF v5.x, ESP32-S3 + PSRAM, SD-card rotation with `COUNTS.JSON` weighted selection, `LOAD_SW` power-rail control, brownout recovery, row pacing, NVS counters, SD logging, **button wake on SW2/SW3/SW4 (RTC GPIOs)**. Derived from the GooDisplay SD-variant sample. Last pushed 2026-08-22. |
| `pink88/Spectra6-Image-Ditherer` | Host-side ditherer (same problem space as this repo) that vendors the GooDisplay ESP-IDF project under `Documentation/`. |
| `dandwhelan/esp32-spectra-e6-13inch`, `lvntruong/Eink-GDEP133C02`, `arkottke/esp32-frame`, `bojinda/Esp32-Epaper-Frame`, `CHaerem/Glance`, `amane-uehara/20250316-epaper-GDEP133C02-1200x1600`, `dsackr/ESP32-S3-ePaper-13.3E6` | Independent ESP32 projects, all carrying the same vendor `GDEP133C02.c/.h`. Worked examples; none is a maintained library. |

### Same panel family, different board

| Repo / source | Notes |
|---|---|
| **[WSC]** Waveshare `waveshareteam/e-Paper` → `13.3inch_e-Paper_E` | **Effectively the same panel.** Four ports (RPi C, RPi Python, ESP32, Arduino R4). Header states `// M/S 控制区域 600*1600`, `EPD_13IN3E_WIDTH 1200`, `EPD_13IN3E_HEIGHT 1600`; `EPD_13IN3E_CS_ALL()` drives `EPD_CS_M_PIN` and `EPD_CS_S_PIN` together; identical register map, identical colour nibbles, `0x07`/`0xA5` sleep. **The clearest readable reference implementation.** Port by remapping the CS pins. (ESP32 port pins: `CS_M 15`, `CS_S 2`, `SCK 13`, `MOSI 14`, `RST 26`, `DC 27`, `BUSY 25`, `PWR 33`.) |
| `rkaramandi/esphome-seeed-ee02` | Same panel on a Seeed XIAO EE02 board. Its README is the best plain-English statement of the single-CS failure mode. Documents `600 bytes/row, two 300-byte halves: [master 300][slave 300]`, BUSY LOW = busy, PSRAM required, SPI at 2 MHz. |
| `SolderedElectronics/Inkplate-Arduino-library` → `src/boards/Inkplate13SPECTRA/` | Same panel, board-locked (`#ifdef ARDUINO_INKPLATE13SPECTRA`). Clean abstraction worth stealing: `enum eSpectraChipID { eChipIdMaster = 1, eChipIdSlave = 2, eChipIdBoth = eChipIdMaster \| eChipIdSlave };`. Pins `CS_M 42` / `CS_S 39`. |
| `LaskaKit/laskakit_epaper` → `laskakit_INKPLATE13SPECTRA.hpp` | Thin wrapper over Soldered's library. **Trap:** their `laskakit_GDEP133UT3.hpp` is the *parallel mono* 13.3", a different part. |
| **[FW]** `Frans-Willem/epd-photoframe` | Rust firmware for Seeed reTerminal E1004 (**T133A01**, 1200×1600 Spectra 6, dual-controller). `HARDWARE.md` is the best *independent* write-up of the driver model, and is explicitly cautious: *"Treat GDEP133C02 as a related command-family reference unless panel markings, vendor confirmation, or a full pinout/mechanical match proves that it is the same module."* Lists concrete divergences: GooDisplay `CDI = 0xF7` vs their `0x37`; booster `0xE8,0x28` vs `0xE0,0x20`; different `AN_TM` bytes. |

### Does NOT support it

| Repo / source | Why |
|---|---|
| **[GX]** GxEPD2 | Enumerated all 505 paths on `master` and `work_in_progress`. The only 13.3" classes are `GxEPD2_1330_GDEM133T91` (mono, 960×680, SSD1677) and `GxEPD2_1330c_GDEM133Z91` (3-colour). No `GDEP133C02` in the panel enum, no `epd6c/` directory, zero repo issues mentioning it. **No dual-CS support in the panel architecture either** — the sole multi-CS precedent is the four-controller `GxEPD2_1248c`. Still valuable for *timings* (§2), the Spectra 6 command set and colour nibbles via `GxEPD2_730c_GDEP073E01`, and as a template if someone writes the class. |
| `epdiy` | **Architecturally impossible.** Its 13.3" entry `ED133UT2` (`.width = 1600, .height = 1200, .bus_width = 8`) is a **parallel grayscale** panel — the resolution match is a trap. Output layer is `output_i2s/` + `output_lcd/`; there is no SPI transport at all. Zero hits for "Spectra"/"133C02"/"E6". |
| ESP-IDF component registry | No `esp_lcd_ebook`; nothing matching GDEP133C02 / Spectra 6 / 13.3". `solderedelectronics/inkplate` there is the parallel mono board, not 13 SPECTRA. |
| ESPHome core `waveshare_epaper` | Only 13.3" model is `WAVESHARE_EPAPER_13_3_IN_K` (960×680 mono SSD1677). Its only multi-colour base is the 7-colour ACeP. |

**Bottom line:** there is **no general-purpose library** for this panel — everyone forks GooDisplay's
`GDEP133C02.c/.h`. For a new ESP-IDF firmware take **[REF]** as the display driver, **[WSC]** as the
readable second opinion, **[PW]** as the partial-refresh reference, and **[PINK]** as the application
architecture.

---

## Open / unverifiable

Genuinely unknown from public documentation. Do not let any of these become an assumed number.

1. **How long a partial-window update actually takes.** It calls the same `DRF` waveform, and **[GX]**
   sets `partial_refresh_time == full_refresh_time` for the sibling panel, so it is very likely the
   same ~12 s. But nobody measures it on GDEP133C02. **This is the single most valuable thing to
   measure on real hardware — it decides the QR feature's latency.**
2. **Re-initialisation time after sleep/POF for GDEP133C02.** Structure is known, timing is not.
   The 7.3" sibling's measured 172 ms power-on is the closest analogue. **[GX]**
3. **A refresh-time-versus-temperature relationship.** `Tupdate` is specified at 25 °C only. No
   vendor publishes a cold figure or a curve.
4. **Panel lifetime / refresh-count endurance.** Unpublished by both E Ink and GooDisplay. The
   1 000 000 figure is Waveshare's catalogue-wide "ideally".
5. **The minimum safe inter-refresh interval as a physical quantity.** 180 s is a recommendation with
   no stated failure mode, no derating curve, and no consequence quantified anywhere.
6. **A full command table for the panel.** **[DS]** has none. Every opcode in this document comes
   from **[REF]**, not from a register spec. `0x04`/`0x07` nibble codes are unused and undocumented.
7. **The exact byte layout expected for partial-window image data.** **[REF]** passes an opaque
   buffer to `spiTransmitLargeData(DTM, ...)`. `xPixel/2` bytes per row × `yLine` rows is the obvious
   reading, but it is not stated and not asserted in code.
8. **Whether GDEP133C02 exposes E Ink Sparkle™** in any form. One marketing sentence, no mechanism.
9. **Whether scan direction is host-selectable.** **[DS] §5.3** is an image-only page in an
   encrypted PDF, and the visible labelling (`S2400` / `G800`, origin top-left, FPC at bottom)
   describes the fixed structure rather than a settable option. **[MAN]** precaution (5) hints
   otherwise: *"If the image data appears incorrectly on the screen, check whether the image
   resolution is set properly. Try switching the width and height settings and test again."*
10. **Official confirmation of the board's pin map.** The pin numbers in §3 come from **[PINK]**, a
    third-party firmware, not from a GooDisplay schematic. GooDisplay do publish an
    "ESP32-133C02 Schematic" from **[PP574]**, but their download endpoint 403s to non-browser
    clients — **fetch it manually before trusting any pin number.**
11. **Whether the ESP32-133C02 can actually run the panel in quad mode.** The board wires four data
    lines, but every driver examined uses single-line SPI, and the one that documents a rate settled
    on 2 MHz for reliability. Throughput assumptions should be measured, not derived.
12. **Exit from deep sleep.** Universally implemented as a hardware reset; never documented as such
    for this panel. See §4.

---

## Implications for the firmware design

### Correct these two entries in map #6

- ~~"Full refresh only, roughly 30 s. No partial refresh"~~ → **"Windowed partial update exists
  (`PTLW`, per-IC, 4-px X / 2-line Y granularity, confined to one 600-px half). No *fast* partial
  update — every update runs the full ~12 s flashing waveform. The ~30 s figure is demo-code row
  pacing, not the panel."**
- ~~"180 s minimum between refreshes"~~ → keep the number, but record it as **a vendor longevity
  recommendation with no stated failure mode**, not an electrical limit. It is a policy the firmware
  chooses to enforce.

### The display driver's shape

- **The `RefreshBudget` is a real domain concept and it owns two clocks:** time-since-last-refresh
  (180 s floor) and time-since-any-refresh (24 h ceiling). Carousel ticks, QR presses, and admin
  changes all pass through it.
- **`initialised | asleep` must be explicit firmware state.** Sending data while asleep fails
  silently — there is no error to observe. **[MAN]**
- **Invariant: the panel is powered only while refreshing.** `epdDisplay()` already ends in `POF`;
  the firmware must not add a path that leaves the panel powered. This satisfies the "never idle
  powered" rule **without** committing to a battery/deep-sleep power model — which unblocks the
  power-model ticket in map #6 rather than being blocked by it.
- **Row pacing is a tunable, not a constant.** **[PINK]**'s 8 ms/row is a battery brownout mitigation
  costing 25.6 s. **[REF]**'s 1 ms/row costs 3.2 s. A mains-powered frame should tune this down and
  measure — it is the largest controllable component of user-visible latency.
- **The split needs no buffer gymnastics.** Stream row `i`'s bytes `[i*600, i*600+300)` to CS0 and
  `[i*600+300, i*600+600)` to CS1. A 1200×1600 4bpp frame is 937.5 KiB — too big for ESP32-S3
  internal RAM, but **[PINK]** shows PSRAM works, and streaming per-row from SD avoids buffering the
  frame at all.
- **Fast path for blanking:** pull both CS low and broadcast a solid-colour `DTM` stream, as
  **[REF]**'s `epdDisplayColor()` does. Useful for the "white screen before storage" rule.

### The QR-overlay feature — what constrains it

**This is the part of map #6 most affected by these findings.**

1. **Latency is ~13–20 s minimum, and the user will watch the screen flash.** There is no
   flicker-free option — `hasFastPartialUpdate = false` on this FPL, and `partial_refresh_time ==
   full_refresh_time`. Whatever the UI, the button press cannot produce a quick, quiet QR.
   Budget: re-init (~0.2 s) + data transfer (0.8–4 s at 10/2 MHz, plus whatever row pacing you keep)
   + `PON` (~0.2 s) + waveform (~12–15 s).
   **Design the UX around this: acknowledge the press with an LED or a sound, not with the screen.**
2. **A window update is the right mechanism and it changes the cost structure.** Compositing the QR
   and pushing a *whole* 937.5 KiB frame pays the full transfer + pacing cost twice (once for QR,
   once to restore). A `PTLW` window around the QR transfers a few KB, so the transfer term nearly
   vanishes and latency collapses to the waveform alone. **The waveform does not shrink** — expect
   ~12–15 s regardless. **[PW]** already implements this path against this panel; read it rather
   than deriving the window handling from scratch.
3. **Geometry constraint on where the QR may go.** A window must satisfy `xStart ≤ 584`,
   `xPixel ≤ 600`, `xStart` and `xStart+xPixel` multiples of 4, width ≥ 16 px, `yStart+yLine` even,
   **and lie within a single IC's 600-px half.** A QR straddling the centre line needs *two* window
   setups (`epdDisplayEnable = 0` for the first IC, `= 1` for the second) — workable, but
   **placing the QR wholly inside one half is materially simpler.** A corner overlay is the natural
   choice.
4. **`PTLW` must be disabled afterwards.** **[REF]** writes `PTLW_DISABLE` to *both* ICs after every
   window update. Forgetting this leaves the panel in windowed mode and the next full refresh is
   wrong. Make it a `defer`-style guarantee in the driver, not a caller responsibility.
5. **Two refreshes in quick succession DO violate the 180 s guideline** — if "restore" means
   "revert immediately when the user walks away". Design around it:
   - **Recommended:** the QR is shown, and the *restore is scheduled for ≥ 180 s after the QR
     refresh*. The admin session naturally lasts longer than three minutes anyway.
   - The QR press itself must also respect 180 s since the last **carousel** tick — so a press
     landing just after a carousel advance either waits, or spends the frame's exception budget.
   - **Do not** implement "press to show QR, press again to hide". That is a user-triggerable
     unbounded refresh rate. Make hiding a timer expiry, or gate it behind the same budget.
   - **INFERRED:** occasional violations are very unlikely to matter (no vendor quantifies harm), but
     a design that *routinely* refreshes every 15 s does. The budget should permit, say, one
     deliberate exception per hour and hard-floor everything else.
6. **Suspend the carousel while the QR is up.** Otherwise the carousel's next tick both fights the
   QR for the screen and burns the refresh budget.
7. **The restore is a full-frame refresh** (the QR window must be repainted with photo content, and
   the underlying photo is still what the carousel wants). Cheapest correct restore: full-frame
   update of the current photo — pay the pacing cost once, on a timer, unattended.

### Prior art to read before writing a line

- **[REF]** — the vendor driver. Non-negotiable starting point.
- **[PINK]** — has already solved SD image rotation, deep sleep, **button wake on the onboard
  SW2/SW3/SW4 switches** (directly relevant to the QR button in map #6), brownout survival, and NVS
  counters on this exact board. Map #6's firmware differs mainly in being always-on with WiFi and an
  admin UI rather than battery-and-deep-sleep — but the display driver, pin map, power-rail
  handling, and SD layout are directly reusable.
- **[PW]** — the partial-refresh implementation, with the alignment rules already encoded.
- **[WSC]** — the most readable version of the same driver, useful when **[REF]**'s comments mislead.
- **[FW]** `HARDWARE.md` — read it for the discipline: it is explicit about which facts are
  cross-panel guesses.
