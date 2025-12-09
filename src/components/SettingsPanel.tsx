import React from 'react';
import { Settings, Palette, Wand2 } from 'lucide-react';

export type DitherAlgorithm =
  | 'floyd-steinberg'
  | 'atkinson'
  | 'error-diffusion'
  | 'blue-noise';

export type ColorPalette =
  | 'spectra-6'
  | 'black-white'
  | 'grayscale'
  | 'red-black-white';

interface SettingsPanelProps {
  algorithm: DitherAlgorithm;
  palette: ColorPalette;
  onAlgorithmChange: (algorithm: DitherAlgorithm) => void;
  onPaletteChange: (palette: ColorPalette) => void;
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
    value: 'error-diffusion',
    label: 'Error Diffusion',
    description: 'General error diffusion method',
  },
  {
    value: 'blue-noise',
    label: 'Blue Noise',
    description: 'Produces smooth, organic patterns',
  },
];

const palettes: { value: ColorPalette; label: string; colors: string[] }[] = [
  {
    value: 'spectra-6',
    label: 'E-ink Spectra 6 Color',
    colors: ['#000000', '#FFFFFF', '#FF0000', '#FFFF00', '#FFA500', '#00FF00'],
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
  onAlgorithmChange,
  onPaletteChange,
}) => {
  return (
    <div className="w-full bg-gray-800/50 rounded-2xl border border-gray-700/50 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700/50 bg-gray-800/80">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-medium text-gray-200">Dithering Settings</h3>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Algorithm Selection */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider">
            <Wand2 className="w-4 h-4 text-blue-400" />
            Algorithm
          </label>
          <select
            value={algorithm}
            onChange={(e) => onAlgorithmChange(e.target.value as DitherAlgorithm)}
            className="
              w-full px-4 py-3 rounded-xl
              bg-gray-900/50 border border-gray-700/50
              text-gray-200 text-base
              focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
              cursor-pointer transition-all duration-200
              hover:border-gray-600
            "
          >
            {algorithms.map((algo) => (
              <option key={algo.value} value={algo.value}>
                {algo.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 px-1">
            {algorithms.find((a) => a.value === algorithm)?.description}
          </p>
        </div>

        {/* Palette Selection */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider">
            <Palette className="w-4 h-4 text-blue-400" />
            Color Palette
          </label>
          <select
            value={palette}
            onChange={(e) => onPaletteChange(e.target.value as ColorPalette)}
            className="
              w-full px-4 py-3 rounded-xl
              bg-gray-900/50 border border-gray-700/50
              text-gray-200 text-base
              focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
              cursor-pointer transition-all duration-200
              hover:border-gray-600
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
                  className="w-8 h-8 rounded-lg border-2 border-gray-700/50 shadow-md"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-300/90 leading-relaxed">
            <span className="font-semibold">Tip:</span> Different algorithms produce
            varying visual effects. Experiment to find the best match for your e-ink
            display.
          </p>
        </div>
      </div>
    </div>
  );
};
