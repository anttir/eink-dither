# Prior art: FutureSharks e-paper-art-display and epdoptimize

Research for [issue #25](https://github.com/anttir/eink-dither/issues/25). Two halves: what the
image pipeline can teach `src/lib/`, and what the firmware can teach the
[custom NeoFrame firmware map (#6)](https://github.com/anttir/eink-dither/issues/6).

Claims about the two upstream projects are tagged **VERIFIED** (read in their source at the commit
reviewed) or **INFERRED** (reasoning stated). Claims about this repo cite the file.

## Sources

| Tag | Source |
|---|---|
| **[FS]** | [FutureSharks/e-paper-art-display](https://github.com/FutureSharks/e-paper-art-display) — battery ESP32-C6 art frame, Pimoroni Inky Impression 13.3" (**EL133UF1**, 1200×1600 Spectra 6, dual-IC). Arduino firmware + Go tools. MIT, except `tools/imgproc/{palette,tone,dither,preset}.go`, which are Apache-2.0. |
| **[EPD]** | [paperlesspaper/epdoptimize](https://github.com/paperlesspaper/epdoptimize) — the TypeScript browser library **[FS]**'s `tools/imgproc` is a Go port of. Apache-2.0, published on npm as `epdoptimize` (1.3.0 at time of writing). |
| **[REF]**, **[FW]** | As defined in [`gdep133c02-refresh-mechanics.md`](gdep133c02-refresh-mechanics.md): GooDisplay's reference driver, and Frans-Willem's independent hardware notes. |

---

## Summary

- **The biggest gap in this repo is that a palette entry has one colour where it needs two.**
  **[EPD]** dithers against the *measured* ink colour and only emits the *device* primary at export.
  `src/lib/dithering.ts` uses one value for matching, error, preview and export, so it either
  diffuses error against colours the panel cannot show or writes non-device colours into the BMP.
  → [#27](https://github.com/anttir/eink-dither/issues/27)
- **Lightness should be compressed into the panel's real range before dithering**, in CIELAB, with a
  guard that keeps saturated colours from washing out. → [#28](https://github.com/anttir/eink-dither/issues/28)
- **The error-diffusion core has correctness and quality issues** that **[FS]** has already solved:
  per-addition clamping, no serpentine scan, a hard-coded blue override, four copies of the loop.
  → [#29](https://github.com/anttir/eink-dither/issues/29)
- **Named tone presets beat seven independent sliders.** → [#30](https://github.com/anttir/eink-dither/issues/30)
- **A packed 960,000-byte frame in the panel's native order lets firmware stream without decoding.**
  **[FS]** proves the pattern on the sibling EL133UF1. → [#31](https://github.com/anttir/eink-dither/issues/31)
- **[EPD] is TypeScript, so porting from the Go port would be a detour.** Whether to depend on it or
  port it is [#26](https://github.com/anttir/eink-dither/issues/26), and it gates #27–#30.

---

## 1. Image pipeline

### 1.1 Measured colour vs device colour — VERIFIED

**[FS]** `palette.go`, after **[EPD]**: each palette entry has `Color` (calibrated: what the ink
looks like once settled) and `DeviceColor` (the primary the controller is told). Matching and error
diffusion use `Color`; the packed output uses the device code; the preview PNG renders `Color`.
A `-saturation` flag blends between the two (1 = measured, 0 = device).

This repo (`src/lib/dithering.ts`): each palette is a single RGB list, and `applyDithering` returns
those RGB values, which `src/lib/download.ts` writes verbatim into the BMP.

- `spectra-6` (`#29CC14` green, the rest pure primaries) and `spectra-6-ideal` diffuse error against
  colours brighter and more saturated than the panel can show. **INFERRED** effect: posterised,
  over-dark output, and a preview that oversells saturation.
- `spectra-6-calibrated` diffuses against muted values but **exports** them (red `160,32,32`), leaving
  ink selection to whatever nearest-colour mapping the firmware does. Its black and white are still
  `0,0,0` / `255,255,255`, so lightness range is not modelled.

Measured Spectra 6 sets carried by **[FS]** (from **[EPD]**'s `default-palettes.json`):

| role | device code | paperlesspaper | legacy | Boeber | aitjcize |
|---|---|---|---|---|---|
| black | `0x0` | `#1F2226` | `#191E21` | `#1F2226` | `#020202` |
| white | `0x1` | `#B9C7C9` | `#E8E8E8` | `#D6D6D6` | `#BEC8C8` |
| yellow | `0x2` | `#C1BB1E` | `#EFDE44` | `#DBD529` | `#CDCA00` |
| red | `0x3` | `#62201E` | `#B21318` | `#EA4843` | `#871300` |
| blue | `0x5` | `#233F8E` | `#2157BA` | `#416CE1` | `#05409E` |
| green | `0x6` | `#35563A` | `#125F20` | `#067406` | `#27663C` |

The device codes match the GDEP133C02 reference driver
([`gdep133c02-refresh-mechanics.md`](gdep133c02-refresh-mechanics.md) §3). **INFERRED:** the
measurements transfer approximately — same E Ink Spectra 6 film, different module and lighting — but
none was taken on a GDEP133C02. A photo of a colour-patch frame under neutral light would give us our
own set.

### 1.2 Display-range compression — VERIFIED

**[FS]** `tone.go` `applyDynamicRange`, after **[EPD]**:

1. Black and white targets are the darkest and lightest **measured** palette colours, by Rec.709 luma.
2. Each pixel's CIELAB L is mapped from the source range into `[L(black), L(white)]`. Source range is
   0–100 (`display`) or the low/high lightness percentiles of the image (`auto`, default 1 %/99 %).
3. a and b are kept; converted back to sRGB.
4. Saturated pixels get less of the effect (`smoothstep(0.18, 0.68, S) × 0.85`), and if lifting L
   would still drop a saturated pixel's HSV saturation below 72 % of the original, a 5-step binary
   search backs off the amount.

**[FS]**'s README reports this cuts pixels outside the palette's reach from ~19 % to ~14 % on a
typical image.

This repo's pre-processing (`applyPreProcessing` in `src/lib/image-processing.ts`: gamma,
brightness/contrast, saturation, unsharp mask) operates in sRGB with no knowledge of the palette, so
it cannot do this. With the current palettes the stage would be a no-op anyway (black 0, white 255),
which is why it depends on §1.1.

### 1.3 Error-diffusion core — VERIFIED

| | **[FS]** `dither.go` | this repo `dithering.ts` |
|---|---|---|
| Error storage | rolling 3-row `float64` buffer, value clamped to a byte only when matched | added into `Uint8ClampedArray`, clamped on every addition |
| Scan | serpentine optional, kernel mirrored on reverse rows | left-to-right only |
| Kernels | one table: FS, false FS, Atkinson, Jarvis, Stucki, Burkes, Sierra-3/-2/-2-4A, Fan, Shiau-Fan ×2 | four hand-copied functions |
| Matching | `rgb` (what presets are tuned on), `lab` (CIE76), `chroma` (RGB + penalty for spending a colourful pixel on a neutral ink and for hue error), `weighted` | LAB only, plus a blue override |
| Output | palette indices | RGB |
| Tests | mean preserved, no runaway above white, LAB round-trip, palette role coverage, presets resolvable | none |

The blue override in `findNearestColor` (`r < 50 && g < 150 && b > 100` → the palette's pure blue)
bypasses diffusion for a whole region of colour space and only fires on palettes whose blue is
`>200,<50,<50`. **INFERRED:** it causes blue blotches in dark blue/cyan areas and should go.

### 1.4 Presets — VERIFIED

**[EPD]** bundles tone mapping, range compression, kernel and matching mode into named presets;
**[FS]** `preset.go` transcribes them: `balanced` (default), `dynamic`, `vivid`, `soft`, `grayscale`,
`restore`, `posterscan`, plus its own `none`. Upstream warns the numbers are tuned against the
measured palettes and byte-domain arithmetic, so they move together or not at all. The table with
parameters is in [#30](https://github.com/anttir/eink-dither/issues/30).

The tone stage itself (`applyToneMapping`) is exposure in stops → HSL saturation scale → linear
contrast or a two-sided power S-curve (separate shadow and highlight exponents around a midpoint),
all as 256-entry lookup tables. `posterscan` additionally neutralises warm paper, anchors dark
neutrals to black and preserves red ink (`applyPaperNormalization`).

### 1.5 Preview and output — VERIFIED

- **[FS]** writes a lossless paletted PNG preview rendered in measured colours, next to the packed
  frame. This repo already previews as PNG (`src/routes/index.tsx`); what is missing is rendering in
  measured colours, which falls out of §1.1.
- **[FS]**'s `.bin` is the exact SPI stream: CS_M half then CS_S half, 1600 rows × 300 bytes each,
  two pixels per byte, high nibble first, panel colour codes; 960,000 bytes. Same layout as our
  panel per [`gdep133c02-refresh-mechanics.md`](gdep133c02-refresh-mechanics.md) §3.
  → [#31](https://github.com/anttir/eink-dither/issues/31)
- **[FS]** keeps a `manifest.txt` with a fingerprint of every output-affecting setting, so changing
  a flag repacks everything and otherwise only stale images are redone. Relevant if the device's
  storage format ([#6](https://github.com/anttir/eink-dither/issues/6) /
  [#14](https://github.com/anttir/eink-dither/issues/14)) ends up manifest-based.

### 1.6 Not worth taking

- **The Go CLI itself.** It exists because its author wanted no JavaScript; we are a browser app and
  **[EPD]** is already TypeScript.
- **`tools/art-fetcher`** (public-domain portrait paintings from Wikidata/Wikimedia Commons) and
  **`-random-prefix`** shuffle ordering. Nice, not core.
- **Licensing:** porting rather than depending carries Apache-2.0 obligations — a `NOTICE` and
  per-file headers stating changes, as **[FS]** does in `tools/imgproc/NOTICE`.

---

## 2. Firmware (for #6)

**[FS]**'s panel is the EL133UF1 on a Pimoroni HAT, driven from Pimoroni's `inky_el133uf1.py`. Ours
is the GDEP133C02 on GooDisplay's board. Geometry, split and colour codes match; register values are
known to differ between sibling modules (see **[FW]** in
[`gdep133c02-refresh-mechanics.md`](gdep133c02-refresh-mechanics.md)). Everything below is a pattern
to evaluate, not a value to copy.

### 2.1 Architecture — VERIFIED

Wake on an RTC timer (default daily at 05:00 local, set via NTP + TZ) → WiFi → fetch
`manifest.txt` from a static host (raw.githubusercontent.com, optional bearer token, redirects not
followed while a token is set) → take the next name → stream the 960 KB frame straight from HTTPS
into the controllers → drop WiFi → refresh → deep sleep. The carousel position lives in **NVS**, so
it survives deep sleep and power loss. A failed or wrong-length download skips the refresh and leaves
the previous image on the glass.

**INFERRED** relevance: this is a complete, working answer to "battery with deep sleep" in
[#10](https://github.com/anttir/eink-dither/issues/10) and one data point for carousel state in
[#14](https://github.com/anttir/eink-dither/issues/14) — NVS position, not a file on storage. It
pulls rather than accepting uploads, so it sidesteps the admin UI entirely; that is a different
product from the one #6 describes, but a valid fallback.

### 2.2 Streaming without a framebuffer — VERIFIED

`el133_stream_begin(half)` / `el133_stream_write()` / `el133_stream_end()` push bytes as they arrive;
nothing reaches the glass until `el133_refresh()`. An overlay (status line, error text) is painted
into each row **as it streams past** (`el133_stream_overlay`, `patch_row`), so composing text onto an
image needs no 960 KB buffer.

**INFERRED** relevance: the same row-patching technique would composite the QR code onto the current
image ([#6](https://github.com/anttir/eink-dither/issues/6) wanted behaviour) without PSRAM. We have
8 MB PSRAM, so it is not required — but it removes a reason to hold the frame in memory at all.

### 2.3 Hardware lessons — VERIFIED in [FS], applicability INFERRED

- **Softer boost on battery.** Default `BTST_P`/`BTST_N` = `0xE0,0x20`; **[FS]** switches to
  `0xD8,0x18` (values from Soldered's Inkplate library) because the boost converters' power-on draw
  browned out a LiPo. Per **[FW]**'s comparison GooDisplay's reference driver uses `0xE8,0x28`,
  *harder* still (second-hand; confirm against **[REF]** before relying on it). If #10 lands on
  battery, this is the first knob to try against the 641.6 mA typ / 844.5 mA max inrush.
- **~300 ms between D/C low and the opcode**, or the EL133UF1 silently drops the command; init takes
  ~7 s and **[FS]** measures ~35 s per refresh in total. Unverified for GDEP133C02 — the GooDisplay
  reference driver does not do this — but it is a cheap thing to try if commands go missing.
- **BUSY is active-low open-drain**; the internal ~45 kΩ pull-up works, an external 10 kΩ is better.
  A refresh is over only once BUSY has asserted *and* released.
- **Built-in error screen**: a zlib-compressed packed frame compiled into the firmware, shown when
  WiFi, download or battery fail — because by then the network is what has failed. A status line
  carries the URL and one-line reason.
- **Battery reporting** via the MAX17048 fuel gauge. The minimum cell voltage during a refresh is
  sampled in the background, written to NVS as it falls and reported on the next boot.
- SPI clock is a conservative 4 MHz; transfer is a few seconds against a much longer refresh.

---

## Issues raised

| # | Title | Depends on |
|---|---|---|
| [#26](https://github.com/anttir/eink-dither/issues/26) | Spike: adopt the epdoptimize npm package, or port it | — |
| [#27](https://github.com/anttir/eink-dither/issues/27) | Palette entries need measured and device colours | #26 |
| [#28](https://github.com/anttir/eink-dither/issues/28) | Compress lightness into the panel's real range | #27 |
| [#29](https://github.com/anttir/eink-dither/issues/29) | Rewrite the error-diffusion core | #26 |
| [#30](https://github.com/anttir/eink-dither/issues/30) | Tone presets | #27, #28, #29 |
| [#31](https://github.com/anttir/eink-dither/issues/31) | Export a packed 4 bpp frame in native byte order | #27 |

The firmware findings in §2 are inputs to [#10](https://github.com/anttir/eink-dither/issues/10),
[#14](https://github.com/anttir/eink-dither/issues/14) and the map
[#6](https://github.com/anttir/eink-dither/issues/6); no separate issues were raised for them.
