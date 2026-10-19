"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";

type ItemState = "SELECTED" | "VALIDATING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "CANCELLED";
type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  clientValid: boolean;
  state: ItemState;
  progress: number;
  error?: string;
  sessionId?: string;
  assetId?: string;
};

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_SIZE = 5;

function errorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && data.error && typeof data.error === "object" && "message" in data.error && typeof data.error.message === "string") return data.error.message;
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") return data.error;
  return fallback;
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(data, "Upload request failed."));
  return data;
}

function uploadFileWithProgress(url: string, file: File, onProgress: (percent: number) => void, register: (xhr: XMLHttpRequest) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Network interruption during upload."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled.", "AbortError"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(errorMessage(xhr.response, "Image transfer failed.")));
    };
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export function TravelMediaUploadModal({
  onClose,
  onCompleted,
}: {
  onClose: () => void;
  onCompleted?: (assetIds: string[]) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previewUrls = useRef<string[]>([]);
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const cancelled = useRef(new Set<string>());

  useEffect(() => () => {
    requests.current.forEach((request) => request.abort());
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const patchItem = (id: string, changes: Partial<UploadItem>) => {
    setItems((previous) => previous.map((item) => item.id === id ? { ...item, ...changes } : item));
  };

  const selectFiles = (fileList: FileList | File[]) => {
    const remainingSlots = Math.max(0, MAX_BATCH_SIZE - items.length);
    const candidates = Array.from(fileList).slice(0, remainingSlots);
    if (fileList.length > remainingSlots) {
      setNotice(`You can select up to ${MAX_BATCH_SIZE} images in one upload.`);
    } else {
      setNotice(null);
    }
    const accepted: UploadItem[] = [];
    for (const file of candidates) {
      const id = crypto.randomUUID();
      const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
      const compatibleExtension = (file.type === "image/jpeg" && [".jpg", ".jpeg"].includes(extension)) ||
        (file.type === "image/png" && extension === ".png") ||
        (file.type === "image/webp" && extension === ".webp") ||
        (file.type === "image/avif" && extension === ".avif");
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);
      const clientValid = ACCEPTED_TYPES.has(file.type) && compatibleExtension && file.size > 0 && file.size <= MAX_FILE_SIZE;
      accepted.push({
        id,
        file,
        previewUrl,
        clientValid,
        state: clientValid ? "SELECTED" : "FAILED",
        progress: 0,
        error: clientValid
          ? undefined
          : "Choose a JPEG, PNG, WebP, or AVIF image up to 10 MB.",
      });
    }
    setItems((previous) => [...previous, ...accepted]);
  };

  const removeItem = (item: UploadItem) => {
    if (["VALIDATING", "UPLOADING", "PROCESSING"].includes(item.state)) {
      void cancelItem(item);
      return;
    }
    URL.revokeObjectURL(item.previewUrl);
    previewUrls.current = previewUrls.current.filter((url) => url !== item.previewUrl);
    setItems((previous) => previous.filter((candidate) => candidate.id !== item.id));
    setNotice(null);
  };

  const cancelItem = async (item: UploadItem) => {
    cancelled.current.add(item.id);
    requests.current.get(item.id)?.abort();
    requests.current.delete(item.id);
    if (item.sessionId) await jsonRequest(`/api/v1/travel-media/uploads/${item.sessionId}/cancel`, { method: "POST" }).catch(() => undefined);
    patchItem(item.id, { state: "CANCELLED", progress: 0, error: undefined });
  };

  const runItem = async (item: UploadItem) => {
    cancelled.current.delete(item.id);
    patchItem(item.id, { state: "VALIDATING", progress: 0, error: undefined, sessionId: undefined, assetId: undefined });
    try {
      const sessionResponse = await jsonRequest("/api/v1/travel-media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: item.file.name, mimeType: item.file.type, size: item.file.size, mediaType: "TRAVEL_PHOTO" }),
      });
      const upload = sessionResponse.upload as { id: string; assetId: string; uploadUrl: string };
      if (cancelled.current.has(item.id)) throw new DOMException("Upload cancelled.", "AbortError");
      patchItem(item.id, { state: "UPLOADING", sessionId: upload.id, assetId: upload.assetId });
      await uploadFileWithProgress(upload.uploadUrl, item.file, (progress) => patchItem(item.id, { progress }), (xhr) => requests.current.set(item.id, xhr));
      requests.current.delete(item.id);
      if (cancelled.current.has(item.id)) throw new DOMException("Upload cancelled.", "AbortError");
      patchItem(item.id, { state: "PROCESSING", progress: 100 });
      await jsonRequest(`/api/v1/travel-media/uploads/${upload.id}/finalize`, { method: "POST" });

      for (let pollAttempt = 0; pollAttempt < 160; pollAttempt += 1) {
        if (cancelled.current.has(item.id)) throw new DOMException("Upload cancelled.", "AbortError");
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        const stateResponse = await jsonRequest(`/api/v1/travel-media/uploads/${upload.id}`);
        const current = stateResponse.upload as { status: ItemState; failureReason?: string | null };
        if (current.status === "READY") {
          patchItem(item.id, { state: "READY", progress: 100 });
          return upload.assetId;
        }
        if (current.status === "FAILED" || current.status === "CANCELLED") {
          throw new Error(current.failureReason || "Image processing did not finish.");
        }
      }
      throw new Error("Image processing is taking longer than expected. You can safely check again later.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        patchItem(item.id, { state: "CANCELLED", progress: 0, error: undefined });
        return undefined;
      }
      patchItem(item.id, { state: "FAILED", error: error instanceof Error ? error.message : "Upload failed." });
      return undefined;
    }
  };

  const startUploads = async () => {
    const pending = items.filter(
      (item) => item.clientValid && (item.state === "SELECTED" || item.state === "FAILED"),
    );
    if (!pending.length) return;
    const completed: string[] = [];
    let next = 0;
    const worker = async () => {
      while (next < pending.length) {
        const item = pending[next++];
        const assetId = await runItem(item);
        if (assetId) completed.push(assetId);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, pending.length) }, worker));
    if (completed.length === pending.length) onCompleted?.(completed);
  };

  const active = items.some((item) => ["VALIDATING", "UPLOADING", "PROCESSING"].includes(item.state));
  const readyCount = items.filter((item) => item.state === "READY").length;
  const uploadableItems = items.filter(
    (item) => item.clientValid && (item.state === "SELECTED" || item.state === "FAILED"),
  );
  const hasProcessing = items.some((item) => item.state === "PROCESSING");
  const transferredBytes = items.reduce((total, item) => {
    const percentage = item.state === "READY" ? 100 : item.state === "PROCESSING" ? 99 : item.progress;
    return total + item.file.size * (percentage / 100);
  }, 0);
  const totalBytes = items.reduce((total, item) => total + item.file.size, 0);
  const overallProgress = totalBytes ? Math.round((transferredBytes / totalBytes) * 100) : 0;
  const errors = items.filter((item) => item.error);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !active) onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ));
        if (!focusable.length) {
          event.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onClose]);

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="travel-upload-title"
        className="w-full max-w-[340px] rounded-[20px] bg-white p-5 text-zinc-950 shadow-xl outline-none sm:p-6"
      >
        <div className="relative mb-4 text-center">
          <button
            type="button"
            aria-label="Close upload dialog"
            onClick={onClose}
            disabled={active}
            className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full text-xl font-light leading-none text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
          >
            ×
          </button>
          <h2 id="travel-upload-title" className="mx-auto max-w-[220px] text-[17px] font-semibold leading-snug">
            Upload up to 5 images per trip
          </h2>
          <p className="mt-1 text-[11px] text-zinc-500">Private drafts — attach them to a trip later.</p>
        </div>

        <div
          role="button"
          tabIndex={active ? -1 : 0}
          aria-label={items.length ? "Add more photos" : "Choose travel photos"}
          onClick={() => {
            if (!active && items.length < MAX_BATCH_SIZE) inputRef.current?.click();
          }}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !active && items.length < MAX_BATCH_SIZE) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!active) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (!active) selectFiles(event.dataTransfer.files);
          }}
          className={`flex min-h-[154px] items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition ${
            isDragging ? "border-amber-500 bg-amber-50" : "border-zinc-300 bg-white"
          } ${!active && items.length < MAX_BATCH_SIZE ? "cursor-pointer hover:border-zinc-400" : ""}`}
        >
          {active ? (
            <div className="flex flex-col items-center gap-3" aria-live="polite">
              <div
                className="flex size-[68px] items-center justify-center rounded-full"
                style={{ background: `conic-gradient(#eab308 ${Math.max(1, overallProgress) * 3.6}deg, #FDE7B2 0deg)` }}
              >
                <span className="flex size-[56px] items-center justify-center rounded-full bg-[#FDE7B2] text-sm font-semibold">
                  {Math.max(1, overallProgress)}%
                </span>
              </div>
              <p className="text-xs text-zinc-600">{hasProcessing ? "Processing images…" : "Uploading images…"}</p>
            </div>
          ) : items.length ? (
            <div className="grid grid-cols-3 gap-2" aria-label={`${items.length} selected images`}>
              {items.map((item) => (
                <div key={item.id} className="group relative size-14 overflow-hidden rounded-lg bg-zinc-100">
                  <Image src={item.previewUrl} alt={item.file.name} fill unoptimized className="object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeItem(item);
                    }}
                    className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-[10px] leading-none text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  >
                    ×
                  </button>
                  {item.state === "FAILED" && <span className="absolute inset-x-0 bottom-0 bg-rose-600/80 px-1 py-0.5 text-[8px] font-semibold text-white">Error</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="mb-3 flex size-14 items-center justify-center rounded-full border border-[#b89750] bg-[#FDE29B] text-zinc-800">
                <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path d="M12 16V4m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="text-sm font-medium text-zinc-800">Drop files here</p>
            </div>
          )}
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => {
              if (event.target.files) selectFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {(notice || errors.length > 0) && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-center text-[11px] text-rose-700" aria-live="polite">
            {notice || errors[0]?.error}
          </div>
        )}

        <div className="mt-5">
          {active ? (
            <button
              type="button"
              onClick={() => void Promise.all(items.filter((item) => ["VALIDATING", "UPLOADING", "PROCESSING"].includes(item.state)).map(cancelItem)).then(onClose)}
              className="w-full rounded-full border border-zinc-400 bg-white py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Cancel
            </button>
          ) : uploadableItems.length ? (
            <button
              type="button"
              onClick={() => void startUploads()}
              className="w-full rounded-full border border-zinc-400 bg-white py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              {errors.length ? "Retry upload" : "Upload"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full border border-zinc-400 bg-white py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              {readyCount ? "Done" : "Cancel"}
            </button>
          )}
        </div>
      </section>
    </ModalOverlay>
  );
}
