"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import { TagPeopleInput, type TaggedUser } from "@/components/ui/tag-people-input";
import {
  type TravelPhotoDTO,
  type TravelTripDTO,
  MAX_PHOTOS_PER_TRIP,
} from "@/types/travel";
import { ADDRESS_COUNTRIES, type AddressCountry } from "@/lib/location/address-countries";

function countryFlag(iso2: string) {
  return iso2
    .toUpperCase()
    .replace(/./g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

function resolveCountry(value?: string | null): AddressCountry | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return (
    ADDRESS_COUNTRIES.find(
      (country) =>
        country.iso2 === normalized.toUpperCase() ||
        country.name.toLocaleLowerCase() === normalized.toLocaleLowerCase() ||
        country.value.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
    ) ?? null
  );
}

interface SelectedPhotoItem {
  id: string; // client local id
  file: File;
  previewUrl: string;
  caption: string;
  location: string;
  taggedUsers: TaggedUser[];
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
  // Step: "dropzone", "preview", "curate", "progress"
  const [step, setStep] = useState<
    "dropzone" | "preview" | "curate" | "progress"
  >("dropzone");
  const [selectedTripId, setSelectedTripId] = useState<string>(
    initialTripId || "__NEW__",
  );
  const [newTripTitle, setNewTripTitle] = useState<string>("");
  const [newTripCountryCode, setNewTripCountryCode] = useState(
    () => resolveCountry(initialDestinationCountry)?.iso2 ?? "",
  );
  const [newTripStartDate, setNewTripStartDate] = useState("");
  const [newTripEndDate, setNewTripEndDate] = useState("");
  const [tripTitleError, setTripTitleError] = useState<string | null>(null);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const [countryHighlightIndex, setCountryHighlightIndex] = useState(0);

  // Maintain the newly created trip ID for this session so retries or subsequent uploads don't recreate trips
  const [sessionCreatedTripId, setSessionCreatedTripId] = useState<string | null>(null);
  const [trips, setTrips] = useState<TravelTripDTO[]>(existingTrips);

  const [items, setItems] = useState<SelectedPhotoItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [overallPercent, setOverallPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("Uploading...");
  const [hasFailures, setHasFailures] = useState(false);

  const activeXhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const countryPickerRef = useRef<HTMLDivElement | null>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const isUploadingRef = useRef<boolean>(false);
  const isAbortedRef = useRef<boolean>(false);

  const selectedNewTripCountry = useMemo(
    () => ADDRESS_COUNTRIES.find((country) => country.iso2 === newTripCountryCode) ?? null,
    [newTripCountryCode],
  );
  const matchingCountries = useMemo(() => {
    const query = countrySearch.trim().toLocaleLowerCase();
    if (!query) return ADDRESS_COUNTRIES;
    return ADDRESS_COUNTRIES.filter((country) =>
      country.name.toLocaleLowerCase().includes(query),
    );
  }, [countrySearch]);

  // Fetch user trips on mount if not provided
  useEffect(() => {
    if (existingTrips.length === 0) {
      fetch("/api/v1/travel-media/trips")
        .then((res) => res.json())
        .then((data) => {
          if (data.trips) {
            setTrips(data.trips);
            if (!initialTripId && data.trips.length > 0 && !initialDestinationCountry) {
              // Keep default "__NEW__" or user can choose
            }
          }
        })
        .catch(() => {});
    }
  }, [existingTrips.length, initialTripId, initialDestinationCountry]);

  useEffect(() => {
    const closeCountryPicker = (event: MouseEvent) => {
      if (!countryPickerRef.current?.contains(event.target as Node)) {
        setIsCountryPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", closeCountryPicker);
    return () => document.removeEventListener("mousedown", closeCountryPicker);
  }, []);

  // Cleanup object URLs only when the modal unmounts. Depending on `items`
  // would revoke active previews after every state update.
  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Determine current trip and capacity
  const selectedTrip =
    selectedTripId && selectedTripId !== "__NEW__"
      ? trips.find((t) => t.id === selectedTripId)
      : null;
  const currentTripPhotoCount = selectedTrip ? selectedTrip.photoCount : 0;
  // If replacing a photo, capacity is 1
  const allowedSlots = replaceTargetPhoto
    ? 1
    : Math.max(0, MAX_PHOTOS_PER_TRIP - currentTripPhotoCount);

  const validateNewTripDetails = useCallback(() => {
    let valid = true;
    if (!newTripTitle.trim()) {
      setTripTitleError("Trip name is required.");
      valid = false;
    } else {
      setTripTitleError(null);
    }
    if (!selectedNewTripCountry) {
      setCountryError("Country is required.");
      valid = false;
    } else {
      setCountryError(null);
    }
    return valid;
  }, [newTripTitle, selectedNewTripCountry]);

  const selectCountry = (country: AddressCountry) => {
    setNewTripCountryCode(country.iso2);
    setCountrySearch("");
    setCountryError(null);
    setIsCountryPickerOpen(false);
  };

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

  // Upload runner function that handles automatic trip creation + photo uploads sequentially
  const executeUploadSequence = useCallback(
    async (candidateItems: SelectedPhotoItem[]) => {
      if (!candidateItems.length) return;
      if (isUploadingRef.current) return;

      const isNewTrip = !selectedTripId || selectedTripId === "__NEW__";

      // A new trip only exists once its required metadata is complete.
      if (isNewTrip && !sessionCreatedTripId && !replaceTargetPhoto) {
        if (!validateNewTripDetails()) {
          setStep("preview");
          return;
        }
      }

      setTripTitleError(null);
      isUploadingRef.current = true;
      isAbortedRef.current = false;
      setHasFailures(false);
      setOverallPercent(0);
      setStep("progress");
      setStatusMessage("Preparing upload...");

      // 1. Automatic Trip Creation if needed
      let targetTripId: string | null =
        selectedTripId && selectedTripId !== "__NEW__"
          ? selectedTripId
          : sessionCreatedTripId;

      if (!targetTripId && !replaceTargetPhoto) {
        setStatusMessage("Creating new trip...");
        try {
          const tripRes = await fetch("/api/v1/travel-media/trips", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: newTripTitle.trim(),
              country: selectedNewTripCountry?.iso2,
              startDate: newTripStartDate || undefined,
              endDate: newTripEndDate || undefined,
            }),
          });
          const tripData = await tripRes.json();
          if (!tripRes.ok) {
            throw new Error(tripData.error || "Failed to create trip");
          }
          const createdTrip: TravelTripDTO = tripData.trip;
          targetTripId = createdTrip.id;
          setSessionCreatedTripId(createdTrip.id);
          setTrips((prev) => [createdTrip, ...prev]);
          setSelectedTripId(createdTrip.id);
        } catch (err: unknown) {
          isUploadingRef.current = false;
          setStep("preview");
          const msg = err instanceof Error ? err.message : "Failed to create trip";
          setTripTitleError(msg);
          toast.error(msg);
          return;
        }
      }

      // 2. Sequential Photo Uploads with byte-level progress
      const totalBytes = candidateItems.reduce(
        (sum, item) => sum + (item.status === "completed" ? 0 : item.file.size),
        0,
      );
      let cumulativeUploadedBytes = 0;
      const completedPhotos: TravelPhotoDTO[] = [];
      let failureCount = 0;

      for (let i = 0; i < candidateItems.length; i++) {
        const item = candidateItems[i];

        if (item.status === "completed" && item.uploadedPhoto) {
          completedPhotos.push(item.uploadedPhoto);
          continue;
        }

        if (isAbortedRef.current) break;

        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: "uploading", progressPercent: 0 }
              : it,
          ),
        );
        setStatusMessage(
          `Uploading photo ${i + 1} of ${candidateItems.length}...`,
        );

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
                  const totalLoadedSoFar =
                    cumulativeUploadedBytes + event.loaded;
                  const batchPercent = Math.min(
                    99,
                    Math.round(
                      (totalLoadedSoFar / (totalBytes || 1)) * 100,
                    ),
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
              }
              if (item.caption.trim()) {
                formData.append("caption", item.caption.trim());
              }
              const resolvedLoc =
                item.location.trim() ||
                selectedNewTripCountry?.name || "";
              if (resolvedLoc) {
                formData.append("location", resolvedLoc);
              }
              formData.append(
                "taggedUserIds",
                JSON.stringify(item.taggedUsers.map((user) => user.id)),
              );
              if (replaceTargetPhoto) {
                formData.append("replacePhotoId", replaceTargetPhoto.id);
              }

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
          if (isAbortedRef.current) break;
          failureCount++;
          const message =
            err instanceof Error ? err.message : "Upload error";
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: "failed", errorMessage: message }
                : it,
            ),
          );
        }
      }

      isUploadingRef.current = false;

      if (failureCount === 0 && !isAbortedRef.current) {
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
        }, 500);
      } else {
        setHasFailures(true);
        setStatusMessage(
          "Some uploads failed. You can retry failed files below.",
        );
      }
    },
    [
      selectedTripId,
      sessionCreatedTripId,
      replaceTargetPhoto,
      newTripTitle,
      selectedNewTripCountry,
      newTripStartDate,
      newTripEndDate,
      validateNewTripDetails,
      onSuccess,
      onClose,
    ],
  );

  const validateAndAddFiles = (filesList: FileList | File[]) => {
    const rawFiles = Array.from(filesList);
    if (!rawFiles.length) return;

    const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB

    const validFiles: File[] = [];
    const knownFiles = new Set(
      items.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`),
    );

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
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
      if (knownFiles.has(fingerprint)) {
        toast.info(`"${file.name}" has already been selected.`);
        continue;
      }
      knownFiles.add(fingerprint);
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
        `Added ${remainingSlots} photos (capacity limit is ${MAX_PHOTOS_PER_TRIP} photos per trip).`,
      );
    }

    const newItems: SelectedPhotoItem[] = filesToAdd.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return {
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl,
        caption: "",
        location: selectedNewTripCountry?.name || initialDestinationCountry || "",
        taggedUsers: [],
        status: "pending",
        progressPercent: 0,
      };
    });

    const combined = [...items, ...newItems];
    setItems(combined);

    // Automatic trigger: retain selected files and show inline field errors until
    // the required new-trip details have been provided.
    const isNewTrip = !selectedTripId || selectedTripId === "__NEW__";
    if (isNewTrip && !sessionCreatedTripId && !replaceTargetPhoto) {
      if (!validateNewTripDetails()) {
        setStep("preview");
        return;
      }
    }

    // Required details are ready -> automatically create the trip and upload.
    void executeUploadSequence(combined);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrlsRef.current.delete(target.previewUrl);
      }
      const filtered = prev.filter((i) => i.id !== id);
      if (filtered.length === 0) {
        setStep("dropzone");
      }
      return filtered;
    });
  };

  const handleRetryFailed = () => {
    void executeUploadSequence(items);
  };

  useEffect(() => {
    const isNewTrip = !selectedTripId || selectedTripId === "__NEW__";
    if (
      step === "preview" &&
      items.length > 0 &&
      (!isNewTrip || sessionCreatedTripId || replaceTargetPhoto ||
        (newTripTitle.trim() && selectedNewTripCountry))
    ) {
      const uploadTimer = window.setTimeout(() => {
        void executeUploadSequence(items);
      }, 0);
      return () => window.clearTimeout(uploadTimer);
    }
  }, [
    executeUploadSequence,
    items,
    newTripTitle,
    replaceTargetPhoto,
    selectedNewTripCountry,
    selectedTripId,
    sessionCreatedTripId,
    step,
  ]);

  return (
    <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg md:max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-200 text-zinc-900 relative my-auto max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close upload modal"
          disabled={step === "progress" && !hasFailures}
          className="absolute top-5 right-5 size-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center transition-colors z-10 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ✕
        </button>

        {/* Modal Heading */}
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">Add Trip Photos</h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            {replaceTargetPhoto
              ? `Replacing photo in "${replaceTargetPhoto.tripTitle || "Travel Trip"}"`
              : "Create a trip and upload up to 5 photos."}
          </p>
        </div>

        {/* Trip Selector & Trip Details Container */}
        {!replaceTargetPhoto && step !== "progress" && (
          <div className="mb-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label
                htmlFor="tripSelect"
                className="text-xs font-semibold text-zinc-700"
              >
                Trip association
              </label>
              <span className="text-[11px] font-medium text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                {selectedTrip
                  ? `${selectedTrip.photoCount}/5 photos used (${allowedSlots} slots left)`
                  : "New trip: 5 slots available"}
              </span>
            </div>

            <div className="space-y-3">
              {/* Trip selector dropdown */}
              <div className="max-w-sm">
                <select
                  id="tripSelect"
                  value={selectedTripId}
                  onChange={(e) => {
                    setSelectedTripId(e.target.value);
                    setTripTitleError(null);
                    setCountryError(null);
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
              </div>

              {/* Trip details form or selected trip info */}
              {selectedTripId === "__NEW__" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="newTripTitle" className="mb-1 block text-xs font-medium text-zinc-700">Trip name <span aria-hidden="true">*</span></label>
                    <input
                      id="newTripTitle"
                      type="text"
                      placeholder="Trip name (required)"
                      value={newTripTitle}
                      onChange={(e) => {
                        setNewTripTitle(e.target.value);
                        if (tripTitleError && e.target.value.trim()) {
                          setTripTitleError(null);
                        }
                      }}
                      maxLength={50}
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 sm:text-sm transition ${
                        tripTitleError
                          ? "border-red-400 focus:ring-red-400 ring-1 ring-red-400 bg-red-50/20"
                          : "border-zinc-300 focus:ring-amber-400"
                      }`}
                    />
                    {tripTitleError && (
                      <p className="text-[11px] font-medium text-red-600 mt-1 flex items-center gap-1">
                        <span className="inline-block size-1.5 rounded-full bg-red-600"></span>
                        {tripTitleError}
                      </p>
                    )}
                  </div>

                  <div ref={countryPickerRef} className="relative">
                    <label htmlFor="newTripCountry" className="mb-1 block text-xs font-medium text-zinc-700">Country <span aria-hidden="true">*</span></label>
                    <input
                      id="newTripCountry"
                      type="text"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-controls="trip-country-options"
                      aria-expanded={isCountryPickerOpen}
                      aria-activedescendant={isCountryPickerOpen ? `trip-country-option-${countryHighlightIndex}` : undefined}
                      aria-invalid={Boolean(countryError)}
                      placeholder="Search for a country"
                      value={isCountryPickerOpen ? countrySearch : (selectedNewTripCountry ? `${countryFlag(selectedNewTripCountry.iso2)} ${selectedNewTripCountry.name}` : "")}
                      onFocus={() => { setIsCountryPickerOpen(true); setCountrySearch(""); setCountryHighlightIndex(0); }}
                      onChange={(e) => { setCountrySearch(e.target.value); setIsCountryPickerOpen(true); setCountryHighlightIndex(0); if (newTripCountryCode) setNewTripCountryCode(""); }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown") { event.preventDefault(); setIsCountryPickerOpen(true); setCountryHighlightIndex((index) => Math.min(index + 1, Math.max(0, matchingCountries.length - 1))); }
                        if (event.key === "ArrowUp") { event.preventDefault(); setCountryHighlightIndex((index) => Math.max(index - 1, 0)); }
                        if (event.key === "Enter" && matchingCountries[countryHighlightIndex]) { event.preventDefault(); selectCountry(matchingCountries[countryHighlightIndex]); }
                        if (event.key === "Escape") setIsCountryPickerOpen(false);
                      }}
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-zinc-800 outline-none transition focus:ring-2 sm:text-sm ${countryError ? "border-red-400 ring-1 ring-red-400 focus:ring-red-400" : "border-zinc-300 focus:ring-amber-400"}`}
                    />
                    {isCountryPickerOpen && (
                      <div id="trip-country-options" role="listbox" aria-label="Country options" className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
                        {matchingCountries.length ? matchingCountries.map((country, index) => (
                          <button key={country.iso2} id={`trip-country-option-${index}`} type="button" role="option" aria-selected={country.iso2 === newTripCountryCode} onMouseDown={(event) => event.preventDefault()} onClick={() => selectCountry(country)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 sm:text-sm ${index === countryHighlightIndex ? "bg-amber-50 text-zinc-950" : "hover:bg-zinc-50"}`}>
                            <span aria-hidden="true">{countryFlag(country.iso2)}</span>{country.name}
                          </button>
                        )) : <p className="px-2.5 py-3 text-xs text-zinc-500">No countries match your search.</p>}
                      </div>
                    )}
                    {countryError && <p className="mt-1 text-[11px] font-medium text-red-600">{countryError}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    <input
                      type="date"
                      id="newTripStartDate"
                      aria-label="Trip start date"
                      value={newTripStartDate}
                      onChange={(e) => setNewTripStartDate(e.target.value)}
                      className="min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                      type="date"
                      id="newTripEndDate"
                      aria-label="Trip end date"
                      value={newTripEndDate}
                      onChange={(e) => setNewTripEndDate(e.target.value)}
                      className="min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-white p-2.5 flex flex-col justify-center">
                  <span className="text-xs font-semibold text-zinc-900">
                    {selectedTrip?.title}
                  </span>
                  <span className="text-[11px] text-zinc-500 mt-0.5">
                    {allowedSlots > 0
                      ? `${allowedSlots} photo slot${allowedSlots === 1 ? "" : "s"} available for this trip`
                      : "Trip is full (5/5 photos). Select another trip or create a new one."}
                  </span>
                </div>
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
            VIEW 1: INITIAL DRAG AND DROP ZONE
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
              {/* Golden circular upload icon */}
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

              <span className="text-sm sm:text-base font-semibold text-zinc-800">Drag and drop your photos here</span>
              <span className="text-xs text-zinc-500 mt-1">
                Or browse from your device
              </span>
              <span className="text-[11px] text-zinc-400 mt-3">
                JPG, PNG, WebP, AVIF up to 10 MB each • {allowedSlots} photo slot{allowedSlots === 1 ? "" : "s"} remaining
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
            VIEW 2: PREVIEW GRID WITH THUMBNAILS & UPLOAD TRIGGER
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

            {/* Add more files if under capacity */}
            {items.length < allowedSlots && (
              <div className="mt-2 mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition cursor-pointer py-1.5 px-4 rounded-full border border-dashed border-zinc-300 hover:border-zinc-400"
                >
                  + Add another photo ({allowedSlots - items.length} slots remaining)
                </button>
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
              <p className="text-center text-xs text-zinc-500">Your photos will upload automatically when the required trip details are complete.</p>
            </div>
          </div>
        )}

        {/* =======================================================================
            VIEW 3: LIST CURATION (CAPTION, LOCATION, REMOVE IMAGE)
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
                      maxLength={300}
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

                    <TagPeopleInput
                      selectedUsers={item.taggedUsers}
                      onChange={(taggedUsers) => {
                        setItems((prev) =>
                          prev.map((it) =>
                            it.id === item.id ? { ...it, taggedUsers } : it,
                          ),
                        );
                      }}
                    />

                    {item.errorMessage && (
                      <p className="text-xs text-red-600 font-medium">
                        {item.errorMessage}
                      </p>
                    )}
                  </div>

                  {/* Remove Button */}
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

            <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-zinc-100">
              <p className="text-xs text-zinc-500">Changes save automatically when required trip details are complete.</p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full border border-zinc-300 text-zinc-700 text-sm font-semibold hover:bg-zinc-100 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* =======================================================================
            VIEW 4: CIRCULAR PROGRESS RING & REAL-TIME PHOTO PREVIEW STATUS
        ======================================================================== */}
        {step === "progress" && (
          <div className="py-6 sm:py-8 flex flex-col items-center justify-center">
            {/* Circular Progress Ring */}
            <div className="relative size-28 sm:size-32 flex items-center justify-center mb-4">
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

            <p className="text-sm font-medium text-zinc-700 mb-4 text-center max-w-xs">
              {statusMessage}
            </p>

            {/* Selected Image Previews with live status indicators */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-md mx-auto mb-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="relative size-14 sm:size-16 rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-2xs"
                >
                  <Image
                    src={item.previewUrl}
                    alt={item.file.name}
                    fill
                    className="object-cover"
                  />
                  {item.status === "completed" && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="size-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">
                        ✓
                      </div>
                    </div>
                  )}
                  {item.status === "uploading" && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {item.status === "failed" && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="size-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold">
                        ✕
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

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
              ) : <p className="text-xs text-zinc-500">Please keep this window open while your photos are saved.</p>}
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
