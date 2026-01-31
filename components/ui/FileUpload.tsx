"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  file: File;
  id: string;
  name: string;
  size: number;
}

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  onFilesChange?: (files: UploadedFile[]) => void;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  className?: string;
}

export function FileUpload({
  onUpload,
  onFilesChange,
  accept = ".pdf",
  maxSize = 10 * 1024 * 1024, // 10MB
  multiple = false,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
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

      const newFile: UploadedFile = {
        file: selectedFile,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: selectedFile.name,
        size: selectedFile.size,
      };

      if (multiple) {
        const updatedFiles = [...files, newFile];
        setFiles(updatedFiles);
        onFilesChange?.(updatedFiles);
      } else {
        setFiles([newFile]);
        onFilesChange?.([newFile]);
      }

      setLoading(true);

      try {
        await onUpload(selectedFile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload file");
        // Remove the file on error
        if (multiple) {
          const updatedFiles = files.filter(f => f.id !== newFile.id);
          setFiles(updatedFiles);
          onFilesChange?.(updatedFiles);
        } else {
          setFiles([]);
          onFilesChange?.([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [onUpload, maxSize, multiple, files, onFilesChange]
  );

  const handleMultipleFiles = useCallback(
    async (fileList: FileList) => {
      for (const file of Array.from(fileList)) {
        await handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (multiple) {
        handleMultipleFiles(e.dataTransfer.files);
      } else {
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
          handleFile(droppedFile);
        }
      }
    },
    [handleFile, handleMultipleFiles, multiple]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;

      if (multiple) {
        handleMultipleFiles(e.target.files);
      } else {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
          handleFile(selectedFile);
        }
      }
      // Reset input value to allow selecting the same file again
      e.target.value = "";
    },
    [handleFile, handleMultipleFiles, multiple]
  );

  const removeFile = useCallback((id: string) => {
    const updatedFiles = files.filter(f => f.id !== id);
    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles);
    setError(null);
  }, [files, onFilesChange]);

  const clearAllFiles = useCallback(() => {
    setFiles([]);
    onFilesChange?.([]);
    setError(null);
  }, [onFilesChange]);

  const hasFiles = files.length > 0;

  return (
    <div className={cn("relative", className)}>
      {hasFiles ? (
        <div className="min-h-[200px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
          {/* File list */}
          <div className="space-y-2 mb-3">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <FileText className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {f.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(f.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => removeFile(f.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add more files (if multiple) or replace file */}
          <label
            className={cn(
              "flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
              "border-gray-300 hover:border-indigo-500 dark:border-gray-600 dark:hover:border-indigo-500",
              "text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
            )}
          >
            <input
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={handleChange}
              className="hidden"
            />
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">
              {multiple ? "Add more files" : "Replace file"}
            </span>
          </label>

          {/* Clear all button (if multiple files) */}
          {multiple && files.length > 1 && (
            <button
              onClick={clearAllFiles}
              className="mt-2 text-xs text-gray-500 hover:text-red-500 transition-colors"
            >
              Clear all files
            </button>
          )}
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
            "flex flex-col items-center justify-center h-[200px] border-2 border-dashed rounded-lg cursor-pointer transition-colors",
            isDragging
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
              : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-800"
          )}
        >
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleChange}
            className="hidden"
          />
          <Upload className={cn("w-10 h-10 mb-3", isDragging ? "text-indigo-500" : "text-gray-400")} />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500 mt-1">
            PDF files only (max 10MB){multiple && " • Multiple files supported"}
          </p>
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
