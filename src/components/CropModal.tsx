import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import type { CropMode, CropOffset } from '../lib/image-processing';
import type { Orientation } from './SettingsPanel';

interface CropModalProps {
  imageUrl: string;
  cropMode: CropMode;
  cropOffset: CropOffset;
  orientation: Orientation;
  onSave: (cropMode: CropMode, cropOffset: CropOffset) => void;
  onClose: () => void;
}

export const CropModal: React.FC<CropModalProps> = ({
  imageUrl,
  cropMode: initialCropMode,
  cropOffset: initialCropOffset,
  orientation,
  onSave,
  onClose,
}) => {
  const [cropMode, setCropMode] = useState<CropMode>(initialCropMode);
  const [cropOffset, setCropOffset] = useState<CropOffset>(initialCropOffset);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const targetWidth = orientation === 'portrait' ? 1200 : 1600;
  const targetHeight = orientation === 'portrait' ? 1600 : 1200;
  const aspectRatio = targetWidth / targetHeight;

  // Preview dimensions
  const previewHeight = 400;
  const previewWidth = previewHeight * aspectRatio;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (cropMode === 'fill') {
      setIsDragging(true);
      e.preventDefault();
    }
  }, [cropMode]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate offset from center (-1 to 1)
    const offsetX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
    const offsetY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));

    setCropOffset({ x: -offsetX, y: -offsetY });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleReset = () => {
    setCropOffset({ x: 0, y: 0 });
  };

  const handleSave = () => {
    onSave(cropMode, cropOffset);
  };

  // Calculate image position for preview
  const getImageStyle = (): React.CSSProperties => {
    if (!imageRef.current) return {};

    const imgAspect = imageRef.current.naturalWidth / imageRef.current.naturalHeight;

    if (cropMode === 'fit') {
      // Fit: show entire image with letterboxing
      return {
        objectFit: 'contain',
        width: '100%',
        height: '100%',
      };
    } else {
      // Fill: cover entire area, allow panning
      let width: string, height: string;

      if (imgAspect > aspectRatio) {
        // Image is wider - fit to height
        height = '100%';
        width = 'auto';
      } else {
        // Image is taller - fit to width
        width = '100%';
        height = 'auto';
      }

      // Calculate transform based on offset
      const translateX = cropOffset.x * 50; // percentage
      const translateY = cropOffset.y * 50;

      return {
        objectFit: 'cover',
        width,
        height,
        transform: `translate(${translateX}%, ${translateY}%)`,
        cursor: 'move',
      };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Adjust Crop</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setCropMode('fit')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                cropMode === 'fit'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Fit (Letterbox)
            </button>
            <button
              onClick={() => setCropMode('fill')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                cropMode === 'fill'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Fill (Crop)
            </button>
          </div>

          {/* Preview */}
          <div
            ref={containerRef}
            className="relative mx-auto bg-white overflow-hidden rounded-lg"
            style={{
              width: previewWidth,
              height: previewHeight,
            }}
            onMouseDown={handleMouseDown}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Crop preview"
              className="absolute inset-0 m-auto"
              style={getImageStyle()}
              draggable={false}
            />
            {cropMode === 'fill' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-xs text-slate-600 bg-white/80 px-2 py-1 rounded">
                  Drag to adjust position
                </p>
              </div>
            )}
          </div>

          {/* Info */}
          <p className="text-sm text-slate-400 text-center">
            {cropMode === 'fit'
              ? 'Entire image visible, may have borders'
              : 'Image fills frame, edges may be cropped'}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 transition-colors"
            >
              <Check className="w-4 h-4" />
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
