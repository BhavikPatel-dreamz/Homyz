"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function TravelCoverUploadModal({
  currentCoverUrl,
  onClose,
  onSaved,
}: {
  currentCoverUrl?: string | null;
  onClose: () => void;
  onSaved: (coverUrl: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      xhrRef.current?.abort();
    };
  }, [previewUrl]);

  const handleSelectFile = (selected: File) => {
    setError(null);
    if (!ACCEPTED_TYPES.has(selected.type)) {
      setError("Please choose a valid JPEG, PNG, WebP, or AVIF image.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("Cover image cannot exceed 10 MB.");
      return;
    }
    setFile(selected);
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
  };

  const handleUploadAndSave = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    setStatusText("Preparing cover upload...");

    try {
      // 1. Create upload session for TRAVEL_COVER
      const sessionRes = await fetch("/api/v1/travel-media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          mediaType: "TRAVEL_COVER",
        }),
      });

      const sessionData = await sessionRes.json().catch(() => null);
      if (!sessionRes.ok) {
        throw new Error(sessionData?.error?.message || "Failed to create upload session.");
      }

      const { id: sessionId, assetId, uploadUrl } = sessionData.upload;

      // 2. Upload file with XHR byte progress
      setStatusText("Uploading cover image...");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("POST", uploadUrl);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("Cover file transfer failed."));
        };
        xhr.onerror = () => reject(new Error("Network interruption during upload."));
        xhr.onabort = () => reject(new Error("Upload cancelled."));

        const fd = new FormData();
        fd.append("file", file);
        xhr.send(fd);
      });

      // 3. Finalize upload
      setStatusText("Optimizing cover banner...");
      await fetch(`/api/v1/travel-media/uploads/${sessionId}/finalize`, {
        method: "POST",
        credentials: "include",
      });

      // 4. Poll for READY
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise((r) => setTimeout(r, 600));
        const checkRes = await fetch(`/api/v1/travel-media/uploads/${sessionId}`, {
          credentials: "include",
        });
        const checkData = await checkRes.json().catch(() => null);
        if (checkData?.upload?.status === "READY") {
          ready = true;
          break;
        }
        if (checkData?.upload?.status === "FAILED") {
          throw new Error("Cover image processing failed.");
        }
      }

      if (!ready) {
        throw new Error("Image processing timed out. Please try again.");
      }

      // 5. Set cover on travel profile
      setStatusText("Saving cover banner to profile...");
      const saveRes = await fetch("/api/v1/travel-profiles/me/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mediaAssetId: assetId }),
      });

      if (!saveRes.ok) {
        throw new Error("Could not link cover banner to your profile.");
      }

      toast.success("Profile cover banner updated.");
      onSaved(`/api/v1/travel-media/${assetId}/file`);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to update cover.");
      setUploading(false);
    }
  };

  const handleRemoveCover = async () => {
    setUploading(true);
    try {
      const res = await fetch("/api/v1/travel-profiles/me/cover", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Could not remove cover banner.");
      }
      toast.success("Cover banner removed. Default landscape restored.");
      onSaved(null);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to remove cover.");
      setUploading(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950">Update Profile Cover</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Personalize your travel profile with a wide panoramic banner.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
        )}

        <div className="mt-4 space-y-4">
          {/* Preview box */}
          <div className="relative aspect-3/1 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
            {previewUrl || currentCoverUrl ? (
              <Image
                src={previewUrl || currentCoverUrl!}
                alt="Profile cover preview"
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                No custom cover selected (default landscape active)
              </div>
            )}
          </div>

          {/* Drag & drop upload area */}
          {!uploading && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.[0]) handleSelectFile(e.dataTransfer.files[0]);
              }}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${
                isDragging ? "border-amber-500 bg-amber-50" : "border-zinc-300 bg-zinc-50 hover:border-amber-400"
              }`}
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 mb-2">
                📷
              </div>
              <p className="text-xs font-semibold text-zinc-800">
                {file ? file.name : "Drop wide banner image or click to browse"}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                JPEG, PNG, WebP, or AVIF · Up to 10 MB · Recommended 1200×400px
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleSelectFile(e.target.files[0]);
                }}
              />
            </div>
          )}

          {/* Progress bar */}
          {uploading && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-center space-y-2">
              <p className="text-xs font-semibold text-zinc-900">{statusText}</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full bg-amber-500 transition-all duration-200 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500">{progress}% uploaded</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
          <div>
            {currentCoverUrl && !uploading && (
              <button
                type="button"
                onClick={handleRemoveCover}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
              >
                Reset to default
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUploadAndSave}
              disabled={!file || uploading}
              className="rounded-full bg-[#FCDF9C] px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#F7D37D] disabled:opacity-50 cursor-pointer"
            >
              {uploading ? "Saving..." : "Save Cover Banner"}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

