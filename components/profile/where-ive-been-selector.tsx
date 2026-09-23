"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import { CloseIcon } from "@/components/ui/close-icon";
import Image from "next/image";
import React, { useState, useTransition, useRef } from "react";
import {
  BUILTIN_TRAVEL_STAMPS,
  TravelStampItem,
  TravelStampLocation,
  createCustomStamp,
} from "@/lib/stamps/stamps-data";
import { TravelStampGraphic } from "@/components/stamps/travel-stamp-graphics";
import { updateProfileAction } from "@/actions/user/updateProfile";
import { toast } from "@/components/ui/toast";
import { LocationSearchInput } from "@/components/ui/location-search-input";
import { deleteUploadedMedia } from "@/lib/media/delete-uploaded";

type WhereIveBeenSelectorProps = {
  initialSelectedStamps?: string[];
  initialStampsVisible?: boolean;
  initialCustomStamps?: TravelStampItem[];
  maxStamps?: number;
  isOwner?: boolean;
  currentPublicProfile?: { selectedStamps?: string[]; stampsVisible?: boolean; customStamps?: TravelStampItem[] };
  onSaved?: (newProfile: { selectedStamps?: string[]; stampsVisible?: boolean; customStamps?: TravelStampItem[] }) => void;
};

export function WhereIveBeenSelector({
  initialSelectedStamps = [],
  initialStampsVisible = true,
  initialCustomStamps = [],
  maxStamps = 10,
  isOwner = true,
  currentPublicProfile = {},
  onSaved,
}: WhereIveBeenSelectorProps) {
  const [selectedStamps, setSelectedStamps] = useState<string[]>(
    (): string[] => {
      const list: string[] =
        currentPublicProfile?.selectedStamps || initialSelectedStamps || [];
      const unique: string[] = Array.from(new Set(list)).slice(0, maxStamps);
      return unique;
    },
  );

  const [stampsVisible, setStampsVisible] = useState<boolean>(() => {
    return currentPublicProfile?.stampsVisible ?? initialStampsVisible ?? true;
  });

  const [customStamps, setCustomStamps] = useState<TravelStampItem[]>(
    (): TravelStampItem[] => {
      return currentPublicProfile?.customStamps || initialCustomStamps || [];
    },
  );

  // Modal State for Add / Edit Stamp
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingStampId, setEditingStampId] = useState<string | null>(null);
  const [stampLocationValue, setStampLocationValue] = useState("");
  const [selectedLocationObj, setSelectedLocationObj] =
    useState<TravelStampLocation | null>(null);
  const [uploadedIconUrl, setUploadedIconUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, startTransition] = useTransition();

  // Combined dataset of builtin + custom stamps
  const allStamps = [...BUILTIN_TRAVEL_STAMPS, ...customStamps];

  const handleToggleStamp = (stampId: string) => {
    if (!isOwner || pending) return;

    let nextSelected: string[];
    if (selectedStamps.includes(stampId)) {
      nextSelected = selectedStamps.filter((id) => id !== stampId);
    } else {
      if (selectedStamps.length >= maxStamps) {
        toast.error(
          `Maximum ${maxStamps} stamps reached. Unselect a stamp to pick another.`,
        );
        return;
      }
      nextSelected = Array.from(new Set([...selectedStamps, stampId]));
    }

    setSelectedStamps(nextSelected);
    saveChanges(nextSelected, stampsVisible, customStamps);
  };

  const handleToggleVisibility = () => {
    if (!isOwner || pending) return;

    const nextVisibility = !stampsVisible;
    setStampsVisible(nextVisibility);
    saveChanges(selectedStamps, nextVisibility, customStamps);
  };

  // Open modal to add a new stamp
  const openAddModal = () => {
    setModalMode("add");
    setEditingStampId(null);
    setStampLocationValue("");
    setSelectedLocationObj(null);
    setUploadedIconUrl(null);
  };

  // Open modal to edit an existing stamp
  const openEditModal = (e: React.MouseEvent, stamp: TravelStampItem) => {
    e.stopPropagation();
    if (!isOwner) return;

    setModalMode("edit");
    setEditingStampId(stamp.id);
    setStampLocationValue(stamp.location?.name || stamp.title);
    setSelectedLocationObj(
      stamp.location || { name: stamp.title, country: stamp.countryCode },
    );
    setUploadedIconUrl(stamp.iconUrl || null);
  };

  // Handle File Upload to /api/v1/upload/stamp-icon
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/upload/stamp-icon", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to upload image.");
      }

      if (uploadedIconUrl && uploadedIconUrl !== data.url) {
        deleteUploadedMedia(uploadedIconUrl);
      }
      setUploadedIconUrl(data.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error uploading image.";
      toast.error(msg);
    } finally {
      setUploadingImage(false);
    }
  };

  // Save Custom Stamp (Add or Edit)
  const handleSaveStamp = () => {
    if (!stampLocationValue || !stampLocationValue.trim()) {
      toast.error("Please select or enter a valid location.");
      return;
    }

    const cleanTitle = stampLocationValue.split(",")[0].trim();

    let nextCustom: TravelStampItem[];
    let nextSelected = selectedStamps;

    if (modalMode === "add") {
      const newStamp = createCustomStamp(
        stampLocationValue,
        uploadedIconUrl || undefined,
        selectedLocationObj?.country,
        selectedLocationObj || undefined,
      );

      // Duplicate check
      if (
        allStamps.some(
          (s) =>
            s.id === newStamp.id ||
            s.title.toLowerCase() === cleanTitle.toLowerCase(),
        )
      ) {
        toast.error(
          `A stamp for "${cleanTitle}" already exists in your collection.`,
        );
        return;
      }

      nextCustom = [...customStamps, newStamp];
      if (selectedStamps.length < maxStamps) {
        nextSelected = [...selectedStamps, newStamp.id];
      }
    } else if (modalMode === "edit" && editingStampId) {
      nextCustom = customStamps.map((s) => {
        if (s.id === editingStampId) {
          return {
            ...s,
            title: cleanTitle,
            iconUrl: uploadedIconUrl || undefined,
            location: selectedLocationObj || { name: stampLocationValue },
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
    } else {
      return;
    }

    setCustomStamps(nextCustom);
    setSelectedStamps(nextSelected);
    setModalMode(null);
    saveChanges(nextSelected, stampsVisible, nextCustom);
  };

  // Delete Custom Stamp
  const handleConfirmDelete = (stampId: string) => {
    if (!isOwner || pending) return;

    const removed = customStamps.find((s) => s.id === stampId);
    if (removed?.iconUrl) deleteUploadedMedia(removed.iconUrl);
    const nextCustom = customStamps.filter((s) => s.id !== stampId);
    const nextSelected = selectedStamps.filter((id) => id !== stampId);

    setCustomStamps(nextCustom);
    setSelectedStamps(nextSelected);
    setConfirmDeleteId(null);
    saveChanges(nextSelected, stampsVisible, nextCustom);
  };

  const saveChanges = (
    stampsList: string[],
    visibility: boolean,
    customList: TravelStampItem[],
  ) => {
    startTransition(async () => {
      try {
        const payload = {
          publicProfile: {
            ...(currentPublicProfile || {}),
            stampsVisible: visibility,
            selectedStamps: stampsList.slice(0, maxStamps),
            customStamps: customList,
          },
        };

        const res = await updateProfileAction(payload);
        if (!res.ok) {
          throw new Error(res.error || "Failed to save stamp choices.");
        }

        toast.success("Travel stamps saved successfully!");
        if (onSaved && res.data?.publicProfile && typeof res.data.publicProfile === "object") {
          onSaved(res.data.publicProfile);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred while saving.";
        toast.error(errorMsg);
      }
    });
  };

  const isLimitReached = selectedStamps.length >= maxStamps;

  // Temporary preview stamp for the modal
  const previewStamp: TravelStampItem = {
    id: "preview-stamp",
    title: stampLocationValue
      ? stampLocationValue.split(",")[0].trim()
      : "Preview",
    subtitle: "stay like a homie",
    accentBg: "bg-pink-100/70",
    fillHex: "#FDE8EB",
    borderColor: "border-pink-300",
    iconType: "custom",
    iconUrl: uploadedIconUrl || undefined,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Row — Pixel Perfect Matching Reference Screenshot */}
      <div className="flex sm:flex-nowrap flex-wrap items-start justify-between">
        <div>
          <h3 className="text-[19px] font-semibold text-[#27272A] dark:text-zinc-100 tracking-tight mb-0.5">
            Where I&apos;ve been
          </h3>
          <p className="text-[#71717A] dark:text-zinc-400 text-[13px] font-normal leading-relaxed">
            Pick the stamps you want other people to see on your profile.
          </p>
        </div>

        {/* Red Toggle Switch & Control Actions */}
        <div className="flex items-center gap-3 shrink-0 pt-0.5">
          {isOwner && (
            <button
              type="button"
              onClick={openAddModal}
              disabled={pending}
              className="bg-[#FDE29B] dark:bg-amber-400 text-[#1F1F1F] dark:text-zinc-950 hover:bg-[#1F1F1F] dark:hover:bg-amber-300 hover:text-white dark:hover:text-zinc-950 font-medium text-xs px-3.5 py-2.5 rounded-full transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="text-sm font-semibold leading-none">+</span>
              <span>Add Stamp</span>
            </button>
          )}

          {/* Selection Counter Pill */}
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
              isLimitReached
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-900 dark:border-amber-700"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            {selectedStamps.length} / {maxStamps}
          </span>

          {/* Visibility Red Toggle Switch matching reference image */}
          {isOwner && (
            <button
              type="button"
              disabled={pending}
              onClick={handleToggleVisibility}
              className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer disabled:opacity-50 focus:outline-none ${
                stampsVisible ? "bg-[#FA595D]" : "bg-zinc-300 dark:bg-zinc-700"
              }`}
              title={
                stampsVisible
                  ? "Hide stamps from public profile"
                  : "Show stamps on public profile"
              }
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${
                  stampsVisible ? "translate-x-[22px]" : "translate-x-[2px]"
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Saving Notification */}
      {pending && (
        <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-2 animate-in fade-in">
          <svg
            className="w-3.5 h-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-25"
            />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              className="opacity-75"
            />
          </svg>
          Saving travel stamp choices...
        </div>
      )}

      {/* Stamps Display Grid — Reference Design Layout */}
      <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-2xs sm:p-6">
        {allStamps.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No travel stamps available. Click &quot;+ Add Stamp&quot; to search for your
            first destination!
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {allStamps.map((stamp) => {
                const isSelected = selectedStamps.includes(stamp.id);
                const isDisabled = !isOwner || (isLimitReached && !isSelected);

                return (
                  <div
                    key={stamp.id}
                    onClick={() => !isDisabled && handleToggleStamp(stamp.id)}
                    className={`group relative flex m-2 flex-col items-center justify-center p-2 transition-all select-none duration-300 ${
                      isDisabled
                        ? "cursor-not-allowed opacity-40"
                        : "cursor-pointer hover:scale-105"
                    }`}
                  >
                    {/* Selected Checkmark Badge */}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-[#FA595D] text-white flex items-center justify-center text-[10px] font-semibold shadow-sm">
                        ✓
                      </div>
                    )}

                    {/* Edit / Delete Overlay for Custom Stamps */}
                    {stamp.isCustom && isOwner && (
                      <div className="absolute left-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => openEditModal(e, stamp)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-200 shadow-2xs hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          title="Edit stamp"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(stamp.id);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-200 shadow-2xs hover:bg-rose-500 hover:text-white"
                          title="Delete stamp"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <TravelStampGraphic stamp={stamp} size="md" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-700 text-center">
            <h4 className="text-base font-semibold text-[#1F1F1F] dark:text-zinc-100 mb-2">
              Delete Travel Stamp?
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
              Are you sure you want to remove this stamp from your collection?
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-5 py-2 rounded-full text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(confirmDeleteId)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-6 py-2 rounded-full"
              >
                Delete
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Add / Edit Stamp Modal */}
      {modalMode && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 px-6 py-4 shadow-2xl border border-zinc-200 dark:border-zinc-700 text-[#1F1F1F] dark:text-zinc-100 relative my-auto">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-lg font-semibold text-[#1F1F1F] dark:text-zinc-100">
                {modalMode === "add" ? "Add Travel Stamp" : "Edit Travel Stamp"}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-[#1f1f1f] dark:text-zinc-300 hover:text-[#727272] dark:hover:text-zinc-100 text-lg font-semibold"
                aria-label="Close dialog"
              >
                <CloseIcon className="size-4" />
              </button>
            </div>

            {/* Live Interactive Stamp Preview */}
            <div className="flex flex-col items-center justify-center py-4 bg-zinc-50/80 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/60 dark:border-zinc-700 mb-6">
              <span className="text-base font-medium text-[#727272] dark:text-zinc-400 mb-2">
                Live Stamp Preview
              </span>
              <TravelStampGraphic stamp={previewStamp} size="lg" />
            </div>

            {/* Step 1: Icon Image Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#1F1F1F] dark:text-zinc-100 mb-1.5">
                Stamp Icon / Artwork (Optional)
              </label>
              <p className="text-xs text-[#727272] dark:text-zinc-400 mb-2">
                Upload a custom PNG, JPG, or WebP graphic for your stamp.
                Transparency is preserved.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="flex items-center gap-3">
                {uploadedIconUrl ? (
                  <div className="flex items-center gap-3 w-full p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    <img
                      src={uploadedIconUrl}
                      alt="Icon preview"
                      className="w-10 h-10 object-contain rounded-lg bg-white dark:bg-zinc-900 p-1"
                    />
                    <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium flex-1">
                      Image uploaded successfully
                    </span>
                    <button
                      type="button"
                      onClick={() => setUploadedIconUrl(null)}
                      className="text-sm font-medium text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-400 bg-zinc-50 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-800 text-sm font-medium text-[#1f1f1f] dark:text-zinc-100 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 sm:min-h-[56px] min-h-[45px]"
                  >
                    {uploadingImage ? (
                      <span>Uploading icon image...</span>
                    ) : (
                      <>
                        <Image src="/images/icons/camera.svg" alt="" width={24} height={24} className="object-contain dark:invert" />
                        <span>Click to Upload Stamp Artwork</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: Location Selection */}
            <div className="mb-6">
              <LocationSearchInput
                value={stampLocationValue}
                onChange={(val, locData) => {
                  setStampLocationValue(val);
                  if (locData) {
                    setSelectedLocationObj({
                      name: locData.formattedAddress,
                      country: locData.countryCode,
                      latitude: locData.latitude,
                      longitude: locData.longitude,
                    });
                  }
                }}
              />
            </div>

            {/* Modal Control Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-full border border-zinc-300 hover:border-[#1f1f1f] bg-white hover:bg-[#1f1f1f] text-[#1f1f1f] hover:text-white font-semibold text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStamp}
                disabled={!stampLocationValue.trim() || pending}
                className="inline-flex min-w-32 items-center justify-center gap-2 rounded-full bg-[#FCDF9C] px-8 py-2.5 text-sm font-semibold text-[#1f1f1f] transition-all duration-300 hover:bg-[#1f1f1f] hover:text-white disabled:cursor-wait disabled:opacity-70"
              >
                {modalMode === "add" ? "Save Stamp" : "Update Stamp"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
