import React, { useState } from 'react';
import { Settings, Palette, Wand2, ChevronDown, ChevronUp, SlidersHorizontal, Monitor } from 'lucide-react';
import type { ImageFormat } from '../lib/download';

export type DitherAlgorithm =
  | 'floyd-steinberg'
  | 'atkinson'
  | 'stucki'
  | 'jarvis';

export type ColorPalette =
  | 'spectra-6'
  | 'spectra-6-ideal'
  | 'spectra-6-calibrated'
  | 'black-white'
  | 'grayscale'
  | 'red-black-white';

export type Orientation = 'portrait' | 'landscape';

interface SettingsPanelProps {
  algorithm: DitherAlgorithm;
  palette: ColorPalette;
  strength: number;
  contrast: number;
  showOverlay: boolean;
  imageFormat: ImageFormat;
  backgroundColor: string;
  orientation: Orientation;
  onAlgorithmChange: (algorithm: DitherAlgorithm) => void;
  onPaletteChange: (palette: ColorPalette) => void;
  onStrengthChange: (strength: number) => void;
  onContrastChange: (contrast: number) => void;
  onShowOverlayChange: (showOverlay: boolean) => void;
  onImageFormatChange: (format: ImageFormat) => void;
  onBackgroundColorChange: (color: string) => void;
  onOrientationChange: (orientation: Orientation) => void;
}

const algorithms: { value: DitherAlgorithm; label: string; description: string }[] = [
  {
    value: 'floyd-steinberg',
    label: 'Floyd-Steinberg',
    description: 'Classic error diffusion algorithm',
  },
  {
    value: 'atkinson',
    label: 'Atkinson',
    description: 'Creates lighter, more delicate patterns',
  },
  {
    value: 'stucki',
    label: 'Stucki',
    description: 'Smoother gradients, less noise',
  },
  {
    value: 'jarvis',
    label: 'Jarvis-Judice-Ninke',
    description: 'High quality, wider error spread',
  },
];

const palettes: { value: ColorPalette; label: string; colors: string[] }[] = [
  {
    value: 'spectra-6',
    label: 'Spectra 6 (NeoFrame)',
    colors: ['#000000', '#FFFFFF', '#FFFF00', '#FF0000', '#29CC14', '#0000FF'],
  },
  {
    value: 'spectra-6-ideal',
    label: 'Spectra 6 (Ideal)',
    colors: ['#000000', '#FFFFFF', '#FFFF00', '#FF0000', '#00FF00', '#0000FF'],
  },
  {
    value: 'spectra-6-calibrated',
    label: 'Spectra 6 (Calibrated)',
    colors: ['#000000', '#FFFFFF', '#F0E050', '#A02020', '#608050', '#5080B8'],
  },
  {
    value: 'black-white',
    label: 'Black & White',
    colors: ['#000000', '#FFFFFF'],
  },
  {
    value: 'grayscale',
    label: 'Grayscale',
    colors: ['#000000', '#555555', '#AAAAAA', '#FFFFFF'],
  },
  {
    value: 'red-black-white',
    label: 'Red, Black & White',
    colors: ['#000000', '#FFFFFF', '#FF0000'],
  },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  algorithm,
  palette,
  strength,
  contrast,
  showOverlay,
  imageFormat,
  backgroundColor,
  orientation,
  onAlgorithmChange,
  onPaletteChange,
  onStrengthChange,
  onContrastChange,
  onShowOverlayChange,
  onImageFormatChange,
  onBackgroundColorChange,
  onOrientationChange,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="w-full bg-slate-800/50 rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/80">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-medium text-slate-200">Dithering Settings</h3>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Algorithm Selection */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
            <Wand2 className="w-4 h-4 text-cyan-400" />
            Algorithm
          </label>
          <select
            value={algorithm}
            onChange={(e) => onAlgorithmChange(e.target.value as DitherAlgorithm)}
            className="
              w-full px-4 py-3 rounded-xl
              bg-slate-900/50 border border-slate-700/50
              text-slate-200 text-base
              focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
              cursor-pointer transition-all duration-200
              hover:border-slate-600
            "
          >
            {algorithms.map((algo) => (
              <option key={algo.value} value={algo.value}>
                {algo.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-slate-500 px-1">
            {algorithms.find((a) => a.value === algorithm)?.description}
          </p>
        </div>

        {/* Palette Selection */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
            <Palette className="w-4 h-4 text-cyan-400" />
            Color Palette
          </label>
          <select
            value={palette}
            onChange={(e) => onPaletteChange(e.target.value as ColorPalette)}
            className="
              w-full px-4 py-3 rounded-xl
              bg-slate-900/50 border border-slate-700/50
              text-slate-200 text-base
              focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
              cursor-pointer transition-all duration-200
              hover:border-slate-600
            "
          >
            {palettes.map((pal) => (
              <option key={pal.value} value={pal.value}>
                {pal.label}
              </option>
            ))}
          </select>

          {/* Color Preview */}
          <div className="flex items-center gap-2 px-1">
            {palettes
              .find((p) => p.value === palette)
              ?.colors.map((color, index) => (
                <div
                  key={index}
                  className="w-8 h-8 rounded-lg border-2 border-slate-700/50 shadow-md"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
          </div>
        </div>

        {/* Orientation Selection */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
            <Monitor className="w-4 h-4 text-cyan-400" />
            Display Orientation
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => onOrientationChange('portrait')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                orientation === 'portrait'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'bg-slate-900/50 text-slate-300 border border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <div className={`w-4 h-6 border-2 rounded-sm ${orientation === 'portrait' ? 'border-white' : 'border-slate-400'}`} />
              Portrait
            </button>
            <button
              onClick={() => onOrientationChange('landscape')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                orientation === 'landscape'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'bg-slate-900/50 text-slate-300 border border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <div className={`w-6 h-4 border-2 rounded-sm ${orientation === 'landscape' ? 'border-white' : 'border-slate-400'}`} />
              Landscape
            </button>
          </div>
          <p className="text-sm text-slate-500 px-1">
            {orientation === 'portrait' ? '1200×1600 pixels' : '1600×1200 pixels'}
          </p>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/30 border border-slate-700/50 hover:border-slate-600 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            Advanced Settings
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Advanced Settings Content */}
        {showAdvanced && (
          <div className="space-y-4 p-4 rounded-xl bg-slate-900/30 border border-slate-700/50">
            {/* Dither Strength */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">
                  Dither Strength
                </label>
                <span className="text-sm text-slate-400">{strength.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={strength}
                onChange={(e) => onStrengthChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <p className="text-xs text-slate-500">
                Controls how much error is diffused. Lower = less dithering, Higher = more dithering.
              </p>
            </div>

            {/* Contrast */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">
                  Contrast
                </label>
                <span className="text-sm text-slate-400">{contrast.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={contrast}
                onChange={(e) => onContrastChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <p className="text-xs text-slate-500">
                Adjust image contrast before dithering.
              </p>
            </div>

            {/* Image Format */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Download Format
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => onImageFormatChange('bmp')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    imageFormat === 'bmp'
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  BMP (24-bit)
                </button>
                <button
                  onClick={() => onImageFormatChange('png')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    imageFormat === 'png'
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  PNG
                </button>
              </div>
              <p className="text-xs text-slate-500">
                BMP is recommended for e-ink displays.
              </p>
            </div>

            {/* Settings Overlay */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="text-sm font-medium text-slate-300">
                  Show Settings Overlay
                </label>
                <p className="text-xs text-slate-500">
                  Display settings text on processed images for comparison.
                </p>
              </div>
              <button
                onClick={() => onShowOverlayChange(!showOverlay)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showOverlay ? 'bg-cyan-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showOverlay ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Background Color */}
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium text-slate-300">
                Background Color
              </label>
              <p className="text-xs text-slate-500">
                Fill color for images that don't cover the full canvas.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => onBackgroundColorChange(e.target.value)}
                  className="w-10 h-10 rounded-lg border-2 border-slate-600 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => onBackgroundColorChange(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 text-sm font-mono"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <p className="text-sm text-cyan-300/90 leading-relaxed">
            <span className="font-semibold">NeoFrame:</span> Use "Spectra 6 (NeoFrame)" palette for best compatibility with ESP32 devices from einkapp.com.
          </p>
        </div>
      </div>
    </div>
  );
};
