import React from 'react';
import { Loader2, FileImage } from 'lucide-react';

interface ImagePreviewProps {
  originalUrl: string;
  ditheredUrl: string | null;
  filename: string;
  isProcessing: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  originalUrl,
  ditheredUrl,
  filename,
  isProcessing,
}) => {
  return (
    <div className="w-full bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-700/50 shadow-xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700/50 bg-gray-800/80">
        <div className="flex items-center gap-3">
          <FileImage className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-medium text-gray-200 truncate">{filename}</h3>
        </div>
      </div>

      {/* Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Original Image */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Original
          </h4>
          <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-900/50 border border-gray-700/50">
            <img
              src={originalUrl}
              alt="Original"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Dithered Image */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Dithered
          </h4>
          <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-900/50 border border-gray-700/50">
            {isProcessing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-sm text-gray-400">Processing image...</p>
              </div>
            ) : ditheredUrl ? (
              <img
                src={ditheredUrl}
                alt="Dithered"
                className="w-full h-full object-contain animate-fadeIn"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                  <FileImage className="w-8 h-8 text-gray-600" />
                </div>
                <p className="text-sm text-gray-500">Waiting for processing...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Download Button (only shown when dithered image is ready) */}
      {ditheredUrl && !isProcessing && (
        <div className="px-6 pb-6">
          <a
            href={ditheredUrl}
            download={`dithered-${filename}`}
            className="
              w-full inline-flex items-center justify-center gap-2
              px-6 py-3 rounded-xl
              bg-blue-600 hover:bg-blue-700
              text-white font-medium
              transition-all duration-200
              hover:scale-[1.02] active:scale-[0.98]
              shadow-lg hover:shadow-xl
            "
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download Dithered Image
          </a>
        </div>
      )}
    </div>
  );
};
