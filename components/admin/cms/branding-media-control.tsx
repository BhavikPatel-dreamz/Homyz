"use client";

import { useRef, useState } from "react";
import Image from "next/image";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"]);

type UploadedAsset = { url: string; assetId: string };

type BrandingMediaControlProps = {
  label: string;
  description: string;
  value?: string;
  assetId?: string;
  kind: "branding" | "homepage";
  disabled?: boolean;
  onChange: (asset: UploadedAsset) => void;
  onClear: () => void;
};

export function BrandingMediaControl({
  label,
  description,
  value,
  assetId,
  kind,
  disabled = false,
  onChange,
  onClear,
}: BrandingMediaControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("Upload a JPEG, PNG, WebP, AVIF, or SVG image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Images must be 10 MB or smaller.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", label);
      formData.set("altText", label);
      formData.set("kind", kind);
      const response = await fetch("/api/v1/admin/cms/media", { method: "POST", body: formData });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Unable to upload this image.");
      const asset = result?.data || result;
      if (!asset?.url || !asset?.id) throw new Error("The media library did not return an image asset.");
      setUploadedName(file.name);
      onChange({ url: asset.url, assetId: asset.id });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload this image.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !disabled && !isUploading) void upload(file);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900">{label}</p>
          <p className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</p>
        </div>
        {value && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled || isUploading}
            className="shrink-0 text-xs font-medium text-rose-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {value ? (
        <div className="mt-3 flex min-w-0 items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2">
          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-zinc-100">
            <Image src={value} alt={`${label} preview`} fill unoptimized className="object-contain" />
          </div>
          <div className="min-w-0 text-xs text-zinc-500">
            <p className="truncate font-medium text-zinc-700">{uploadedName || value.split("/").pop() || "Selected image"}</p>
            <p className="mt-0.5">{assetId ? "Saved in CMS Media Library" : "Using configured fallback"}</p>
          </div>
        </div>
      ) : null}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !isUploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`mt-3 rounded-lg border border-dashed p-3 text-center transition ${
          isDragging ? "border-zinc-900 bg-zinc-100" : "border-zinc-300 bg-white"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml,.svg"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
          disabled={disabled || isUploading}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="text-xs font-medium text-zinc-900 underline underline-offset-2 disabled:cursor-not-allowed"
        >
          {isUploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </button>
        <p className="mt-1 text-[11px] text-zinc-500">Drag and drop or browse · JPEG, PNG, WebP, AVIF, SVG · max 10 MB</p>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
