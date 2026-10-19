"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import type { TravelTripOwnerDto } from "@/lib/validation/travel-trip";

type ItemState =
  | "SELECTED"
  | "VALIDATING"
  | "UPLOADING"
  | "PROCESSING"
  | "READY"
  | "ATTACHED"
  | "FAILED"
  | "CANCELLED";

interface SelectedUploadItem {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  location: string;
  state: ItemState;
  progress: number;
  error?: string;
  sessionId?: string;
  assetId?: string;
}

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PHOTOS_PER_TRIP = 5;

export function TravelPhotoUploadModal({
  initialTripId,
  trips,
  onClose,
  onSuccess,
}: {
  initialTripId?: string;
  trips: TravelTripOwnerDto[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedTripId, setSelectedTripId] = useState<string>(
    initialTripId || trips[0]?.id || "",
  );
  const [items, setItems] = useState<SelectedUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previewUrls = useRef<string[]>([]);
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const cancelled = useRef(new Set<string>());

  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  const currentTripPhotoCount = selectedTrip?.photoCount ?? 0;
  const remainingSlots = Math.max(0, MAX_PHOTOS_PER_TRIP - currentTripPhotoCount);

  useEffect(() => {
    const currentRequests = requests.current;
    const currentPreviewUrls = previewUrls.current;
    return () => {
      currentRequests.forEach((req) => req.abort());
      currentPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const patchItem = (id: string, changes: Partial<SelectedUploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  };

  const handleSelectFiles = (fileList: FileList | File[]) => {
    const newItems: SelectedUploadItem[] = [];
    const files = Array.from(fileList);

    for (const file of files) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        toast.error(`"${file.name}" is not a supported format (JPEG, PNG, WebP, AVIF).`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" exceeds the 10 MB limit.`);
        continue;
      }

      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);

      newItems.push({
        id,
        file,
        previewUrl,
        caption: "",
        location: "",
        state: "SELECTED",
        progress: 0,
      });
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    cancelled.current.add(id);
    requests.current.get(id)?.abort();
    requests.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const uploadSingleItem = async (item: SelectedUploadItem): Promise<string | null> => {
    cancelled.current.delete(item.id);
    patchItem(item.id, { state: "VALIDATING", progress: 0, error: undefined });

    try {
      // 1. Create upload session
      const sessionRes = await fetch("/api/v1/travel-media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileName: item.file.name,
          mimeType: item.file.type,
          size: item.file.size,
          mediaType: "TRAVEL_PHOTO",
        }),
      });

      const sessionData = await sessionRes.json().catch(() => null);
      if (!sessionRes.ok) {
        throw new Error(sessionData?.error?.message || "Failed to initialize upload session.");
      }

      const { id: sessionId, assetId, uploadUrl } = sessionData.upload;
      if (cancelled.current.has(item.id)) throw new DOMException("Cancelled", "AbortError");

      patchItem(item.id, { state: "UPLOADING", sessionId, assetId });

      // 2. Upload file with real XHR progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        requests.current.set(item.id, xhr);
        xhr.open("POST", uploadUrl);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            patchItem(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("File transfer failed."));
        };
        xhr.onerror = () => reject(new Error("Network interruption during upload."));
        xhr.onabort = () => reject(new DOMException("Cancelled", "AbortError"));

        const fd = new FormData();
        fd.append("file", item.file);
        xhr.send(fd);
      });

      requests.current.delete(item.id);
      if (cancelled.current.has(item.id)) throw new DOMException("Cancelled", "AbortError");

      // 3. Finalize upload
      patchItem(item.id, { state: "PROCESSING", progress: 100 });
      await fetch(`/api/v1/travel-media/uploads/${sessionId}/finalize`, {
        method: "POST",
        credentials: "include",
      });

      // 4. Poll for READY
      let ready = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        if (cancelled.current.has(item.id)) throw new DOMException("Cancelled", "AbortError");
        await new Promise((r) => setTimeout(r, 650));
        const checkRes = await fetch(`/api/v1/travel-media/uploads/${sessionId}`, {
          credentials: "include",
        });
        const checkData = await checkRes.json().catch(() => null);
        if (checkData?.upload?.status === "READY") {
          ready = true;
          break;
        }
        if (checkData?.upload?.status === "FAILED") {
          throw new Error("Image processing failed.");
        }
      }

      if (!ready) {
        throw new Error("Processing is taking longer than usual.");
      }

      patchItem(item.id, { state: "READY" });
      return assetId;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        patchItem(item.id, { state: "CANCELLED", progress: 0 });
        return null;
      }
      patchItem(item.id, {
        state: "FAILED",
        error: (err as Error).message || "Upload failed.",
      });
      return null;
    }
  };

  const handleStartUploadAndAttach = async () => {
    if (!selectedTripId) {
      toast.error("Please select a trip album first.");
      return;
    }

    const pendingItems = items.filter((i) => i.state === "SELECTED" || i.state === "FAILED");
    if (pendingItems.length === 0) return;

    if (items.length > remainingSlots) {
      toast.error(
        `This album only has ${remainingSlots} remaining slot${
          remainingSlots === 1 ? "" : "s"
        }. Please remove items before uploading.`,
      );
      return;
    }

    setIsSubmitting(true);

    // Upload files concurrently (max 3 at once)
    const attachedAssetIds: Array<{ assetId: string; item: SelectedUploadItem }> = [];
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < pendingItems.length) {
        const item = pendingItems[nextIndex++];
        const assetId = await uploadSingleItem(item);
        if (assetId) {
          attachedAssetIds.push({ assetId, item });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(3, pendingItems.length) }, worker));

    // Transactionally attach uploaded READY assets to the selected trip
    let attachSuccessCount = 0;
    for (const { assetId, item } of attachedAssetIds) {
      try {
        const attachRes = await fetch(`/api/v1/travel-trips/${selectedTripId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            mediaAssetId: assetId,
            caption: item.caption.trim() || undefined,
            location: item.location.trim() || undefined,
          }),
        });

        if (attachRes.ok) {
          patchItem(item.id, { state: "ATTACHED" });
          attachSuccessCount++;
        } else {
          const body = await attachRes.json().catch(() => null);
          patchItem(item.id, {
            state: "FAILED",
            error: body?.error?.message || "Could not attach to album.",
          });
        }
      } catch {
        patchItem(item.id, { state: "FAILED", error: "Failed to link photo to trip." });
      }
    }

    setIsSubmitting(false);

    if (attachSuccessCount > 0) {
      toast.success(
        `Successfully added ${attachSuccessCount} photo${
          attachSuccessCount === 1 ? "" : "s"
        } to "${selectedTrip?.title || "your album"}".`,
      );
      onSuccess();
      if (attachSuccessCount === pendingItems.length) {
        onClose();
      }
    }
  };

  const isUploading = items.some((i) =>
    ["VALIDATING", "UPLOADING", "PROCESSING"].includes(i.state),
  );
  const exceedsCapacity = items.length > remainingSlots;

  const overallProgress =
    items.length > 0
      ? Math.round(
          items.reduce((sum, item) => sum + (item.progress || 0), 0) / items.length,
        )
      : 0;

  const handleCancelAll = () => {
    requests.current.forEach((xhr) => xhr.abort());
    requests.current.clear();
    onClose();
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isUploading) {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isUploading, onClose]);

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-labelledby="travel-photo-upload-title" className="w-full max-w-[380px] rounded-[20px] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header matching Screenshots 1-3 */}
        <div className="relative mb-5 text-center">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isUploading}
            aria-label="Close modal"
            className="absolute -top-1 right-0 rounded-full p-1 text-zinc-500 hover:text-zinc-800 disabled:opacity-40 cursor-pointer transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 id="travel-photo-upload-title" className="text-base sm:text-[17px] font-medium text-zinc-900 px-6 leading-snug">
            You can upload <span className="font-bold text-zinc-950">up to 5 images</span> per trip
          </h2>
        </div>

        {/* The album selector stays compact so the upload state remains the focus. */}
        {trips.length > 1 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-zinc-600 mb-1 px-1">
              <span>Album:</span>
              <span className="font-semibold text-zinc-800 truncate max-w-[200px]">
                {selectedTrip ? `${selectedTrip.title} (${currentTripPhotoCount}/5)` : "Select album"}
              </span>
            </div>
            <select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              disabled={isUploading}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden disabled:bg-zinc-100"
            >
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title} ({trip.photoCount}/5 photos)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Capacity Warning Banner */}
        {exceedsCapacity && (
          <div className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-center text-xs text-rose-700">
            Selected {items.length} photos exceeds album limit ({remainingSlots} slot{remainingSlots === 1 ? "" : "s"} left).
          </div>
        )}

        {/* Dashed Dropzone matching Screenshots 1, 2, 3 */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!isUploading && items.length === 0) inputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!isUploading && items.length === 0) inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isUploading) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (!isUploading && e.dataTransfer.files) handleSelectFiles(e.dataTransfer.files);
          }}
          className={`relative rounded-xl border border-dashed p-5 text-center transition flex flex-col items-center justify-center min-h-[154px] ${
            isDragging
              ? "border-amber-500 bg-amber-50/60"
              : "border-zinc-300 bg-zinc-50/40 hover:border-zinc-400"
          } ${!isUploading && items.length === 0 ? "cursor-pointer" : ""}`}
        >
          {isUploading ? (
            /* Screenshot 2: Circular percentage progress */
            <div className="flex flex-col items-center justify-center gap-2">
              <div
                className="flex size-16 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(#eab308 ${Math.max(1, Math.min(100, overallProgress)) * 3.6}deg, #FDE7B2 0deg)` }}
              >
                <span className="flex size-[52px] items-center justify-center rounded-full bg-[#FDE7B2] text-sm font-bold text-zinc-900">
                  {Math.max(1, Math.min(100, overallProgress))}%
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium animate-pulse">
                Uploading to your album...
              </p>
            </div>
          ) : items.length > 0 ? (
            /* Screenshot 1: Mini Preview Grid inside dashed dropzone */
            <div className="flex flex-col items-center gap-3">
              <div className="grid grid-cols-3 justify-center gap-2">
                {items.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.id}
                    className="relative size-14 rounded-xl overflow-hidden border-2 border-white shadow-2xs group shrink-0 bg-zinc-100"
                  >
                    <Image
                      src={item.previewUrl}
                      alt={`Selected ${idx + 1}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item.id);
                      }}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition cursor-pointer"
                      title="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {items.length < remainingSlots && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-xs text-amber-700 hover:text-amber-800 font-medium underline underline-offset-2 cursor-pointer"
                >
                  + Add more photos
                </button>
              )}
            </div>
          ) : (
            /* Screenshot 3: Empty State */
            <div className="flex flex-col items-center justify-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-[#FDE7B2] text-zinc-800 shadow-2xs mb-2">
                <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-xs text-zinc-600 font-normal">Drop files here</p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) handleSelectFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Bottom Action Button matching Screenshots 1, 2, 3 */}
        <div className="mt-5">
          {isUploading ? (
            <button
              type="button"
              onClick={handleCancelAll}
              className="w-full py-2.5 rounded-full border border-zinc-300 bg-white text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-50 transition cursor-pointer"
            >
              Cancel
            </button>
          ) : items.length > 0 ? (
            <button
              type="button"
              onClick={handleStartUploadAndAttach}
              disabled={exceedsCapacity || !selectedTripId}
              className="w-full py-2.5 rounded-full border border-zinc-300 bg-white text-xs sm:text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 transition cursor-pointer shadow-2xs"
            >
              Upload
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-full border border-zinc-300 bg-white text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-50 transition cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
