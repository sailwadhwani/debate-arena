"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSize?: number;
  className?: string;
}

export function FileUpload({
  onUpload,
  accept = ".pdf",
  maxSize = 10 * 1024 * 1024, // 10MB
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (selectedFile: File) => {
      setError(null);

      // Validate file type
      if (!selectedFile.name.endsWith(".pdf")) {
        setError("Only PDF files are supported");
        return;
      }

      // Validate file size
      if (selectedFile.size > maxSize) {
        setError(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
        return;
      }

      setFile(selectedFile);
      setLoading(true);

      try {
        await onUpload(selectedFile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload file");
      } finally {
        setLoading(false);
      }
    },
    [onUpload, maxSize]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
    },
    [handleFile]
  );

  const clearFile = useCallback(() => {
    setFile(null);
    setError(null);
  }, []);

  return (
    <div className={cn("relative", className)}>
      {file ? (
        <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <FileText className="w-8 h-8 text-indigo-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {file.name}
            </p>
            <p className="text-xs text-gray-500">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            onClick={clearFile}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
            isDragging
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
              : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
          )}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
          />
          <Upload className={cn("w-10 h-10 mb-3", isDragging ? "text-indigo-500" : "text-gray-400")} />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500 mt-1">PDF files only (max 10MB)</p>
        </label>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
