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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const targetWidth = orientation === 'portrait' ? 1200 : 1600;
  const targetHeight = orientation === 'portrait' ? 1600 : 1200;
  const aspectRatio = targetWidth / targetHeight;

  // Preview area dimensions
  const maxPreviewWidth = 500;
  const maxPreviewHeight = 500;

  // Calculate preview dimensions to fit in max area while maintaining target aspect ratio
  let previewWidth: number;
  let previewHeight: number;

  if (aspectRatio > maxPreviewWidth / maxPreviewHeight) {
    previewWidth = maxPreviewWidth;
    previewHeight = maxPreviewWidth / aspectRatio;
  } else {
    previewHeight = maxPreviewHeight;
    previewWidth = maxPreviewHeight * aspectRatio;
  }

  // Calculate how the image fits in preview
  const getImageLayout = useCallback(() => {
    if (!imageDimensions.width || !imageDimensions.height) {
      return { width: 0, height: 0, x: 0, y: 0, maxOffsetX: 0, maxOffsetY: 0 };
    }

    const imgRatio = imageDimensions.width / imageDimensions.height;

    let imgWidth: number;
    let imgHeight: number;

    if (cropMode === 'fill') {
      // Fill: image covers entire preview area
      if (imgRatio > aspectRatio) {
        // Image is wider - fit to height
        imgHeight = previewHeight;
        imgWidth = previewHeight * imgRatio;
      } else {
        // Image is taller - fit to width
        imgWidth = previewWidth;
        imgHeight = previewWidth / imgRatio;
      }
    } else {
      // Fit: entire image visible
      if (imgRatio > aspectRatio) {
        imgWidth = previewWidth;
        imgHeight = previewWidth / imgRatio;
      } else {
        imgHeight = previewHeight;
        imgWidth = previewHeight * imgRatio;
      }
    }

    const maxOffsetX = Math.max(0, (imgWidth - previewWidth) / 2);
    const maxOffsetY = Math.max(0, (imgHeight - previewHeight) / 2);

    // Position based on offset
    const x = (previewWidth - imgWidth) / 2 - cropOffset.x * maxOffsetX;
    const y = (previewHeight - imgHeight) / 2 - cropOffset.y * maxOffsetY;

    return { width: imgWidth, height: imgHeight, x, y, maxOffsetX, maxOffsetY };
  }, [imageDimensions, cropMode, aspectRatio, previewWidth, previewHeight, cropOffset]);

  const layout = getImageLayout();

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (cropMode !== 'fill') return;

    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: cropOffset.x,
      offsetY: cropOffset.y,
    };
  }, [cropMode, cropOffset]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const layout = getImageLayout();
    if (layout.maxOffsetX === 0 && layout.maxOffsetY === 0) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    // Convert pixel delta to offset (-1 to 1)
    const newOffsetX = layout.maxOffsetX > 0
      ? Math.max(-1, Math.min(1, dragStartRef.current.offsetX - deltaX / layout.maxOffsetX))
      : 0;
    const newOffsetY = layout.maxOffsetY > 0
      ? Math.max(-1, Math.min(1, dragStartRef.current.offsetY - deltaY / layout.maxOffsetY))
      : 0;

    setCropOffset({ x: newOffsetX, y: newOffsetY });
  }, [isDragging, getImageLayout]);

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

  const canDrag = cropMode === 'fill' && (layout.maxOffsetX > 0 || layout.maxOffsetY > 0);

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
              onClick={() => {
                setCropMode('fit');
                setCropOffset({ x: 0, y: 0 });
              }}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                cropMode === 'fit'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Fit (show all)
            </button>
            <button
              onClick={() => setCropMode('fill')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                cropMode === 'fill'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Fill (crop edges)
            </button>
          </div>

          {/* Preview - WYSIWYG style */}
          <div className="flex justify-center">
            <div
              ref={containerRef}
              className={`relative overflow-hidden rounded-lg border-2 ${
                canDrag ? 'cursor-move border-cyan-500' : 'border-slate-600'
              }`}
              style={{
                width: previewWidth,
                height: previewHeight,
                backgroundColor: '#FFFFFF',
              }}
              onMouseDown={handleMouseDown}
            >
              {/* The image - positioned behind the frame */}
              <img
                src={imageUrl}
                alt="Crop preview"
                onLoad={handleImageLoad}
                className="absolute select-none"
                style={{
                  width: layout.width,
                  height: layout.height,
                  left: layout.x,
                  top: layout.y,
                }}
                draggable={false}
              />

              {/* Drag hint overlay */}
              {canDrag && !isDragging && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                  <div className="bg-black/60 text-white text-sm px-3 py-1.5 rounded-lg">
                    Drag image to adjust
                  </div>
                </div>
              )}

              {/* Frame border overlay to show the crop area */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: 'inset 0 0 0 2px rgba(6, 182, 212, 0.5)',
                }}
              />
            </div>
          </div>

          {/* Info */}
          <div className="text-center space-y-1">
            <p className="text-sm text-slate-400">
              {cropMode === 'fit'
                ? 'Entire image visible, may have white borders'
                : 'Image fills frame, drag to choose visible area'}
            </p>
            <p className="text-xs text-slate-500">
              Output: {targetWidth}×{targetHeight}px ({orientation})
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={handleReset}
            disabled={cropOffset.x === 0 && cropOffset.y === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
