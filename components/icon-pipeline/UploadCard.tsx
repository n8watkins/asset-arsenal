"use client";

import { useRef, useState, useCallback } from "react";
import type { SourceImage } from "@/types/icon-pipeline";
import {
  IMAGE_UPLOAD_LIMITS,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/icon/models";
import { getDraggedSourceId } from "@/components/gallery/drag";

export interface UploadCardProps {
  sourceImage: SourceImage | null;
  isUploading: boolean;
  onFileSelected: (file: File) => void;
  onExtract: () => void;
  disabled?: boolean;
  /** Re-run an existing library source dropped from the gallery. */
  onSourceDrop?: (sourceId: string) => void;
}

function validateFile(file: File): string | null {
  if (
    !(IMAGE_UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(
      file.type
    )
  ) {
    return `Unsupported file type "${file.type}". Allowed: PNG, JPEG, WebP.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `File is ${mb} MB — max allowed is ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB.`;
  }
  return null;
}

export default function UploadCard({
  sourceImage,
  isUploading,
  onFileSelected,
  onExtract,
  disabled = false,
  onSourceDrop,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      const err = validateFile(file);
      if (err) {
        setValidationError(err);
        return;
      }
      setValidationError(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so same file can be re-selected
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    // Re-run from the gallery: a stored source was dragged in.
    const droppedSourceId = getDraggedSourceId(e);
    if (droppedSourceId && onSourceDrop) {
      onSourceDrop(droppedSourceId);
      return;
    }
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const isDisabled = disabled || isUploading;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">
      <h2 className="text-zinc-100 text-lg font-semibold">Upload Image</h2>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !isDisabled && inputRef.current?.click()}
        className={[
          "border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 p-8 cursor-pointer transition-colors select-none",
          dragOver
            ? "border-cyan-400 bg-cyan-400/5"
            : "border-zinc-700 hover:border-zinc-500",
          isDisabled ? "opacity-50 pointer-events-none" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {sourceImage && sourceImage.imageUrl ? (
          <>
            {/* Preview */}
            <img
              src={sourceImage.imageUrl}
              alt={sourceImage.fileName ?? "uploaded image"}
              className="max-h-48 rounded-lg object-contain"
            />
            <p className="text-zinc-300 text-sm font-medium truncate max-w-full">
              {sourceImage.fileName ?? "Uploaded image"}
            </p>
            {sourceImage.width && sourceImage.height ? (
              <p className="text-zinc-500 text-xs">
                {sourceImage.width} × {sourceImage.height} px
              </p>
            ) : null}
            <p className="text-zinc-500 text-xs">
              Click or drag to replace
            </p>
          </>
        ) : (
          <>
            <svg
              className="w-10 h-10 text-zinc-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-zinc-400 text-sm text-center">
              Drag &amp; drop an image here, or{" "}
              <span className="text-cyan-400 underline">browse</span>
            </p>
            <p className="text-zinc-600 text-xs">
              PNG, JPEG, WebP — max {IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD_LIMITS.allowedMimeTypes.join(",")}
        className="hidden"
        onChange={onInputChange}
        disabled={isDisabled}
      />

      {/* Validation error */}
      {validationError && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
          {validationError}
        </p>
      )}

      {/* Extract button */}
      <button
        onClick={onExtract}
        disabled={isDisabled || !sourceImage}
        className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold py-2.5 px-5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900 flex items-center justify-center gap-2"
      >
        {isUploading ? (
          <>
            <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />
            Uploading…
          </>
        ) : (
          "Extract Icons"
        )}
      </button>
    </div>
  );
}
