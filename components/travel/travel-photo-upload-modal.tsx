"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import {
  type TravelPhotoDTO,
  type TravelTripDTO,
  MAX_PHOTOS_PER_TRIP,
} from "@/types/travel";

interface SelectedPhotoItem {
  id: string; // client local id
  file: File;
  previewUrl: string;
  caption: string;
  location: string;
  status: "pending" | "uploading" | "completed" | "failed";
  progressPercent: number;
  errorMessage?: string;
  uploadedPhoto?: TravelPhotoDTO;
}

interface TravelPhotoUploadModalProps {
  onClose: () => void;
  onSuccess: (newPhotos: TravelPhotoDTO[]) => void;
  existingTrips?: TravelTripDTO[];
  initialTripId?: string | null;
  initialDestinationCountry?: string | null;
  replaceTargetPhoto?: TravelPhotoDTO | null;
}

export function TravelPhotoUploadModal({
  onClose,
  onSuccess,
  existingTrips = [],
  initialTripId = null,
  initialDestinationCountry = null,
  replaceTargetPhoto = null,
}: TravelPhotoUploadModalProps) {
  // Step: "dropzone" (Screenshot 3), "preview" (Screenshot 4), "curate" (Screenshot 5), "progress" (Screenshot 2)
  const [step, setStep] = useState<
    "dropzone" | "preview" | "curate" | "progress"
  >("dropzone");
  const [selectedTripId, setSelectedTripId] = useState<string>(
    initialTripId || (initialDestinationCountry ? "__NEW__" : ""),
  );
  const [newTripTitle, setNewTripTitle] = useState<string>("");
  const [newTripCountry, setNewTripCountry] = useState(
    initialDestinationCountry || "",
  );
  const [newTripCity, setNewTripCity] = useState("");
  const [newTripStartDate, setNewTripStartDate] = useState("");
  const [newTripEndDate, setNewTripEndDate] = useState("");
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [trips, setTrips] = useState<TravelTripDTO[]>(existingTrips);

  const [items, setItems] = useState<SelectedPhotoItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [overallPercent, setOverallPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("Uploading...");
  const [isAborted, setIsAborted] = useState(false);
  const [hasFailures, setHasFailures] = useState(false);

  const activeXhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch user trips on mount if not provided
  useEffect(() => {
    if (trips.length === 0) {
      fetch("/api/v1/travel-media/trips")
        .then((res) => res.json())
        .then((data) => {
          if (data.trips) {
            setTrips(data.trips);
            if (
              !selectedTripId &&
              !initialDestinationCountry &&
              data.trips.length > 0
            ) {
              setSelectedTripId(data.trips[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [initialDestinationCountry, trips.length, selectedTripId]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [items]);

  const createNewTrip = async () => {
    if (!newTripTitle.trim()) return;
    setCreatingTrip(true);
    try {
      const res = await fetch("/api/v1/travel-media/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTripTitle.trim(),
          country: newTripCountry.trim() || undefined,
          city: newTripCity.trim() || undefined,
          startDate: newTripStartDate || undefined,
          endDate: newTripEndDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create trip");
      const newTrip = data.trip;
      setTrips((prev) => [newTrip, ...prev]);
      setSelectedTripId(newTrip.id);
      setNewTripTitle("");
      setNewTripCity("");
      setNewTripStartDate("");
      setNewTripEndDate("");
      toast.success(`Created trip "${newTrip.title}"`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create trip");
    } finally {
      setCreatingTrip(false);
    }
  };

  // Determine current trip and capacity
  const selectedTrip =
    selectedTripId && selectedTripId !== "__NEW__"
      ? trips.find((t) => t.id === selectedTripId)
      : null;
  const currentTripPhotoCount = selectedTrip ? selectedTrip.photoCount : 0;
  // If replacing a photo, capacity doesn't decrease
  const allowedSlots = replaceTargetPhoto
    ? 1
    : Math.max(0, MAX_PHOTOS_PER_TRIP - currentTripPhotoCount);

  // Handle Drag & Drop Events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const validateAndAddFiles = (filesList: FileList | File[]) => {
    const rawFiles = Array.from(filesList);
    if (!rawFiles.length) return;

    const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB

    const validFiles: File[] = [];

    for (const file of rawFiles) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!validExtensions.includes(ext)) {
        toast.error(
          `"${file.name}" is not supported. Use JPG, PNG, WebP, or AVIF.`,
        );
        continue;
      }
      if (file.size > maxSizeBytes) {
        toast.error(`"${file.name}" exceeds the 10 MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    if (!validFiles.length) return;

    // Check remaining slots
    const currentSelectedCount = items.length;
    const remainingSlots = allowedSlots - currentSelectedCount;

    if (remainingSlots <= 0) {
      toast.error(
        replaceTargetPhoto
          ? "You can only select 1 photo to replace."
          : `Trip capacity reached. Maximum ${MAX_PHOTOS_PER_TRIP} photos per trip.`,
      );
      return;
    }

    const filesToAdd = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      toast.info(
        `Added ${remainingSlots} photos (capacity limit is 5 photos per trip).`,
      );
    }

    const newItems: SelectedPhotoItem[] = filesToAdd.map((file) => ({
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: "",
      location: initialDestinationCountry || "",
      status: "pending",
      progressPercent: 0,
    }));

    setItems((prev) => [...prev, ...newItems]);
    setStep("preview");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAddFiles(e.target.files);
    }
    // reset input so same file can be selected if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const filtered = prev.filter((i) => i.id !== id);
      if (filtered.length === 0) {
        setStep("dropzone");
      }
      return filtered;
    });
  };

  // Perform genuine byte-level upload using XMLHttpRequest
  const startUpload = async () => {
    if (!items.length) return;
    const targetTripId =
      selectedTripId && selectedTripId !== "__NEW__" ? selectedTripId : null;
    if (!targetTripId && !replaceTargetPhoto) {
      toast.error(
        "Select an existing trip or create a new trip before uploading photos.",
      );
      return;
    }
    setStep("progress");
    setIsAborted(false);
    setHasFailures(false);
    setOverallPercent(0);
    setStatusMessage("Validating and preparing photos...");

    const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
    let cumulativeUploadedBytes = 0;
    const completedPhotos: TravelPhotoDTO[] = [];
    let failureCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === "completed" && item.uploadedPhoto) {
        completedPhotos.push(item.uploadedPhoto);
        cumulativeUploadedBytes += item.file.size;
        continue;
      }

      // Check if user cancelled
      if (isAborted) break;

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: "uploading", progressPercent: 0 }
            : it,
        ),
      );
      setStatusMessage(`Uploading photo ${i + 1} of ${items.length}...`);

      try {
        const uploadedPhoto = await new Promise<TravelPhotoDTO>(
          (resolve, reject) => {
            const xhr = new XMLHttpRequest();
            activeXhrRef.current = xhr;

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const filePercent = Math.round(
                  (event.loaded / event.total) * 100,
                );
                const totalLoadedSoFar = cumulativeUploadedBytes + event.loaded;
                const batchPercent = Math.min(
                  99,
                  Math.round((totalLoadedSoFar / (totalBytes || 1)) * 100),
                );

                setOverallPercent(batchPercent);
                setItems((prev) =>
                  prev.map((it) =>
                    it.id === item.id
                      ? { ...it, progressPercent: filePercent }
                      : it,
                  ),
                );
              }
            };

            xhr.onload = () => {
              activeXhrRef.current = null;
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const res = JSON.parse(xhr.responseText);
                  if (res.photo) {
                    resolve(res.photo);
                  } else {
                    reject(new Error("Upload response missing photo data"));
                  }
                } catch {
                  reject(new Error("Invalid server response"));
                }
              } else {
                let errMsg = "Upload failed";
                try {
                  const errJson = JSON.parse(xhr.responseText);
                  if (errJson.error) errMsg = errJson.error;
                } catch {}
                reject(new Error(errMsg));
              }
            };

            xhr.onerror = () => {
              activeXhrRef.current = null;
              reject(new Error("Network error during file upload"));
            };

            xhr.onabort = () => {
              activeXhrRef.current = null;
              reject(new Error("Upload cancelled by user"));
            };

            const formData = new FormData();
            formData.append("file", item.file);
            if (targetTripId) {
              formData.append("tripId", targetTripId);
            } else if (newTripTitle.trim()) {
              formData.append("tripTitle", newTripTitle.trim());
            }
            if (item.caption.trim())
              formData.append("caption", item.caption.trim());
            if (item.location.trim())
              formData.append("location", item.location.trim());
            if (replaceTargetPhoto)
              formData.append("replacePhotoId", replaceTargetPhoto.id);

            xhr.open("POST", "/api/v1/travel-media/uploads", true);
            xhr.send(formData);
          },
        );

        cumulativeUploadedBytes += item.file.size;
        completedPhotos.push(uploadedPhoto);

        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "completed",
                  progressPercent: 100,
                  uploadedPhoto,
                }
              : it,
          ),
        );
      } catch (err: unknown) {
        if (isAborted) break;
        failureCount++;
        const message = err instanceof Error ? err.message : "Upload error";
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: "failed", errorMessage: message }
              : it,
          ),
        );
      }
    }

    if (failureCount === 0 && !isAborted) {
      setOverallPercent(100);
      setStatusMessage("Photos saved successfully!");
      toast.success(
        replaceTargetPhoto
          ? "Photo replaced successfully!"
          : "Travel photos uploaded successfully!",
      );
      setTimeout(() => {
        onSuccess(completedPhotos);
        onClose();
      }, 600);
    } else {
      setHasFailures(true);
      setStatusMessage(
        "Some uploads failed. You can retry failed files below.",
      );
    }
  };

  const handleCancelUpload = () => {
    setIsAborted(true);
    if (activeXhrRef.current) {
      activeXhrRef.current.abort();
      activeXhrRef.current = null;
    }
    setStep("curate");
    toast.info(
      "Upload paused. Successful photos and metadata have been preserved.",
    );
  };

  const handleRetryFailed = () => {
    startUpload();
  };

  return (
    <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg md:max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-200 text-zinc-900 relative my-auto max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close upload modal"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer z-10"
        >
          ✕
        </button>

        {/* Modal Heading (Matching Screenshots 2–4) */}
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
            You can upload{" "}
            <span className="font-extrabold text-zinc-950">best 5 images</span>{" "}
            of your trip
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            {replaceTargetPhoto
              ? `Replacing photo in "${replaceTargetPhoto.tripTitle || "Travel Trip"}"`
              : "Group your photos into trips (maximum 5 photos per trip)"}
          </p>
        </div>

        {/* Trip Selector / Association Container */}
        {!replaceTargetPhoto && step !== "progress" && (
          <div className="mb-5 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label
                htmlFor="tripSelect"
                className="text-xs font-semibold text-zinc-700"
              >
                Select Trip Association
              </label>
              <span className="text-[11px] font-medium text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                {selectedTrip
                  ? `${selectedTrip.photoCount}/5 photos used (${selectedTrip.remainingCapacity} slots left)`
                  : "New trip: 5 slots available"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                id="tripSelect"
                value={selectedTripId}
                onChange={(e) => {
                  setSelectedTripId(e.target.value);
                }}
                className="w-full text-xs sm:text-sm rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="__NEW__">+ Create new trip</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.photoCount}/5 photos)
                  </option>
                ))}
              </select>

              {selectedTripId === "__NEW__" ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Trip name (required)"
                      value={newTripTitle}
                      onChange={(e) => setNewTripTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createNewTrip()}
                      maxLength={50}
                      className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={createNewTrip}
                      disabled={creatingTrip || !newTripTitle.trim()}
                      className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                    >
                      {creatingTrip ? "Creating..." : "Create"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Country"
                      value={newTripCountry}
                      onChange={(e) => setNewTripCountry(e.target.value)}
                      className="min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      type="text"
                      placeholder="City (optional)"
                      value={newTripCity}
                      onChange={(e) => setNewTripCity(e.target.value)}
                      className="min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      type="date"
                      aria-label="Trip start date"
                      value={newTripStartDate}
                      onChange={(e) => setNewTripStartDate(e.target.value)}
                      className="min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      type="date"
                      aria-label="Trip end date"
                      value={newTripEndDate}
                      onChange={(e) => setNewTripEndDate(e.target.value)}
                      className="min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              ) : (
                !selectedTripId && (
                  <input
                    type="text"
                    placeholder="Enter trip name (e.g. Paris 2026)"
                    value={newTripTitle}
                    onChange={(e) => setNewTripTitle(e.target.value)}
                    maxLength={50}
                    className="w-full text-xs sm:text-sm rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple={!replaceTargetPhoto}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* =======================================================================
            VIEW 1: SCREENSHOT 3 (INITIAL DRAG AND DROP ZONE)
        ======================================================================== */}
        {step === "dropzone" && (
          <div>
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-12 sm:py-16 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer ${
                isDragging
                  ? "border-amber-500 bg-amber-50/70 scale-[0.99]"
                  : "border-zinc-300 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50"
              }`}
            >
              {/* Golden circular upload icon (Figma Screenshot 3) */}
              <div className="w-16 h-16 rounded-full bg-[#FCDF9C] text-zinc-900 flex items-center justify-center mb-3 shadow-2xs">
                <svg
                  className="w-7 h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    d="M12 16V4m0 0l-4 4m4-4l4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <span className="text-sm sm:text-base font-semibold text-zinc-800">
                Drop files here
              </span>
              <span className="text-xs text-zinc-500 mt-1">
                or click to browse from device
              </span>
              <span className="text-[11px] text-zinc-400 mt-3">
                JPG, PNG, WebP, AVIF up to 10 MB each • Max 5 photos per trip
              </span>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-48 py-2.5 rounded-full border border-zinc-300 text-zinc-700 text-sm font-semibold hover:bg-zinc-100 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* =======================================================================
            VIEW 2: SCREENSHOT 4 (PREVIEW GRID WITH 3-TOP 2-BOTTOM / UPLOAD BUTTON)
        ======================================================================== */}
        {step === "preview" && (
          <div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-3 max-w-sm mx-auto">
              {items.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-2xs group"
                >
                  <Image
                    src={item.previewUrl}
                    alt={item.file.name}
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(item.id);
                    }}
                    className="absolute top-1 right-1 size-5 rounded-full bg-black/60 hover:bg-black/80 text-white text-[10px] flex items-center justify-center transition opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {items.length > 3 && (
              <div className="flex justify-center gap-2.5 sm:gap-4 mb-4 max-w-sm mx-auto">
                {items.slice(3, 5).map((item) => (
                  <div
                    key={item.id}
                    className="relative w-[30%] aspect-square rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-2xs group"
                  >
                    <Image
                      src={item.previewUrl}
                      alt={item.file.name}
                      fill
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item.id);
                      }}
                      className="absolute top-1 right-1 size-5 rounded-full bg-black/60 hover:bg-black/80 text-white text-[10px] flex items-center justify-center transition opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setStep("curate")}
                className="w-full sm:w-auto px-6 py-2.5 rounded-full border border-zinc-300 text-zinc-700 text-sm font-semibold hover:bg-zinc-100 transition cursor-pointer"
              >
                Add Captions & Location →
              </button>
              <button
                type="button"
                onClick={startUpload}
                className="w-full sm:w-48 py-2.5 rounded-full bg-zinc-900 hover:bg-black text-white text-sm font-semibold transition cursor-pointer shadow-md"
              >
                Upload {items.length} {items.length === 1 ? "Photo" : "Photos"}
              </button>
            </div>
          </div>
        )}

        {/* =======================================================================
            VIEW 3: SCREENSHOT 5 (LIST CURATION: CAPTION, LOCATION, REMOVE IMAGE)
        ======================================================================== */}
        {step === "curate" && (
          <div>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-start gap-4 p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 transition"
                >
                  {/* Thumbnail */}
                  <div className="relative size-24 sm:size-28 shrink-0 rounded-2xl overflow-hidden bg-zinc-200 border border-zinc-200 shadow-2xs">
                    <Image
                      src={item.previewUrl}
                      alt={item.file.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Inputs */}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      placeholder="Add location (e.g. Rome, Italy)"
                      value={item.location}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((it) =>
                            it.id === item.id ? { ...it, location: val } : it,
                          ),
                        );
                      }}
                      className="w-full text-xs sm:text-sm rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />

                    <textarea
                      placeholder="Add a caption..."
                      rows={2}
                      value={item.caption}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((it) =>
                            it.id === item.id ? { ...it, caption: val } : it,
                          ),
                        );
                      }}
                      className="w-full text-xs sm:text-sm rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    />

                    {item.errorMessage && (
                      <p className="text-xs text-red-600 font-medium">
                        {item.errorMessage}
                      </p>
                    )}
                  </div>

                  {/* Remove Button (Screenshot 5 pill button) */}
                  <div className="flex sm:flex-col justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition cursor-pointer"
                    >
                      <svg
                        className="size-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Remove Image
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add more files if under capacity */}
            {items.length < allowedSlots && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition cursor-pointer py-1.5 px-4 rounded-full border border-dashed border-zinc-300 hover:border-zinc-400"
                >
                  + Add another photo ({allowedSlots - items.length} slots
                  remaining)
                </button>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full border border-zinc-300 text-zinc-700 text-sm font-semibold hover:bg-zinc-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startUpload}
                className="px-8 py-2.5 rounded-full bg-zinc-900 hover:bg-black text-white text-sm font-semibold transition cursor-pointer shadow-md"
              >
                Upload Photos
              </button>
            </div>
          </div>
        )}

        {/* =======================================================================
            VIEW 4: SCREENSHOT 2 (CIRCULAR PROGRESS % WITH CANCEL ACTION)
        ======================================================================== */}
        {step === "progress" && (
          <div className="py-6 sm:py-10 flex flex-col items-center justify-center">
            {/* Circular Progress Ring (Screenshot 2: "9%") */}
            <div className="relative size-28 sm:size-32 flex items-center justify-center mb-6">
              <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-zinc-100"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Golden Animated Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-[#FCDF9C] transition-all duration-300 ease-out"
                  strokeWidth="8"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * overallPercent) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <span className="absolute text-xl sm:text-2xl font-extrabold text-zinc-900">
                {overallPercent}%
              </span>
            </div>

            <p className="text-sm font-medium text-zinc-700 mb-6 text-center max-w-xs">
              {statusMessage}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {hasFailures ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep("curate")}
                    className="px-5 py-2 rounded-full border border-zinc-300 text-zinc-700 text-sm font-semibold hover:bg-zinc-100 transition cursor-pointer"
                  >
                    Edit Selections
                  </button>
                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    className="px-6 py-2 rounded-full bg-zinc-900 hover:bg-black text-white text-sm font-semibold transition cursor-pointer shadow-md"
                  >
                    Retry Failed
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="w-40 py-2.5 rounded-full border border-zinc-300 text-zinc-800 text-sm font-semibold hover:bg-zinc-100 transition cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
