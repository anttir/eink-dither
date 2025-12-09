import React, { useCallback, useState } from 'react';
import { Upload, Image } from 'lucide-react';

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );

      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((file) =>
        file.type.startsWith('image/')
      );

      if (files.length > 0) {
        onFilesSelected(files);
      }

      // Reset input value to allow selecting the same file again
      e.target.value = '';
    },
    [onFilesSelected]
  );

  const handleClick = () => {
    document.getElementById('file-input')?.click();
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center
        w-full h-64 px-6 py-12
        border-2 border-dashed rounded-2xl
        cursor-pointer transition-all duration-300 ease-in-out
        ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800/70'
        }
      `}
    >
      <input
        id="file-input"
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
      />

      <div
        className={`
          flex flex-col items-center transition-all duration-300
          ${isDragging ? 'scale-110' : 'scale-100'}
        `}
      >
        <div
          className={`
            mb-4 p-4 rounded-full transition-colors duration-300
            ${
              isDragging
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-gray-700/50 text-gray-400'
            }
          `}
        >
          {isDragging ? (
            <Upload className="w-12 h-12 animate-bounce" />
          ) : (
            <Image className="w-12 h-12" />
          )}
        </div>

        <p className="text-lg font-medium text-gray-200 mb-2">
          {isDragging ? 'Drop images here' : 'Drop images here or click to browse'}
        </p>
        <p className="text-sm text-gray-500">
          Supports PNG, JPG, WebP and other image formats
        </p>
      </div>

      {/* Decorative corners */}
      <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-gray-600 rounded-tl-lg opacity-50" />
      <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-gray-600 rounded-tr-lg opacity-50" />
      <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-gray-600 rounded-bl-lg opacity-50" />
      <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-gray-600 rounded-br-lg opacity-50" />
    </div>
  );
};
