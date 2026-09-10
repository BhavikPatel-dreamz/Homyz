"use client";

import { Container } from "@/components/ui";
import React, { useState, useRef } from "react";
import { StepProgressFooter } from "./step-progress-footer";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

// Cute Camera SVG Illustration Component
function CameraPlaceholder() {
  return (
    <div className="w-14 h-14 flex items-center justify-center pointer-events-none">
      <svg width="56" height="56" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 22 28 C 22 15 58 15 58 28" stroke="#E67E22" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <rect x="14" y="26" width="52" height="36" rx="10" fill="#D8B4E2" stroke="#4A235A" strokeWidth="2" />
        <rect x="26" y="20" width="16" height="8" rx="3" fill="#D8B4E2" stroke="#4A235A" strokeWidth="2" />
        <circle cx="40" cy="44" r="13" fill="#4A235A" />
        <circle cx="40" cy="44" r="8" fill="#FFF9C4" />
        <circle cx="40" cy="44" r="4.5" fill="#4A235A" />
        <circle cx="56" cy="33" r="2.5" fill="#E67E22" />
      </svg>
    </div>
  );
}

interface StepPhotoManagementProps {
  photos: string[];
  onUpdatePhotos: (photos: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepPhotoManagement({
  photos,
  onUpdatePhotos,
  onBack,
  onNext,
  isLoading = false,
}: StepPhotoManagementProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetIdx, setReplaceTargetIdx] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<string> => {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      throw new Error("Use JPEG, PNG, WebP, or AVIF photos up to 10 MB each.");
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/v1/upload/listing-photo", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok || !result || typeof result !== "object" || !("url" in result)) {
      const message =
        result && typeof result === "object" && "error" in result
          ? String((result as { error?: string }).error)
          : "Photo upload failed.";
      throw new Error(message);
    }
    return String((result as { url: string }).url);
  };

  // Handle adding new photos with real persistent storage upload
  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    e.target.value = "";
    setIsUploading(true);
    setUploadError(null);
    try {
      const uploadedUrls = await Promise.all(newFiles.map(uploadFile));
      onUpdatePhotos([...photos, ...uploadedUrls]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload photo(s).");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle replacing a specific photo at target index with real persistent storage upload
  const handleReplacePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || replaceTargetIdx === null) return;
    const file = e.target.files[0];
    const targetIdx = replaceTargetIdx;
    setReplaceTargetIdx(null);
    e.target.value = "";
    setIsUploading(true);
    setUploadError(null);
    try {
      const persistentUrl = await uploadFile(file);
      const updated = [...photos];
      updated[targetIdx] = persistentUrl;
      onUpdatePhotos(updated);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to replace photo.");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerReplace = (idx: number) => {
    setReplaceTargetIdx(idx);
    replaceInputRef.current?.click();
  };

  const handleRemovePhoto = (index: number) => {
    const updated = photos.filter((_, idx) => idx !== index);
    onUpdatePhotos(updated);
  };

  const handleSetCoverPhoto = (index: number) => {
    if (index === 0) return;
    const updated = [...photos];
    const [selected] = updated.splice(index, 1);
    updated.unshift(selected);
    onUpdatePhotos(updated);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setIsUploading(true);
      setUploadError(null);
      try {
        const uploadedUrls = await Promise.all(droppedFiles.map(uploadFile));
        onUpdatePhotos([...photos, ...uploadedUrls]);
      } catch (err: unknown) {
        setUploadError(err instanceof Error ? err.message : "Failed to upload dropped photo(s).");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const extraPhotos = photos.slice(5);

  return (
    <main
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="py-10"
    >
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col justify-between animate-in fade-in duration-200">
          <div className="max-w-4xl mx-auto w-full flex flex-col my-auto">
            {/* Top Header Bar with Title & Plus (+) Button */}
            <div className="flex items-center justify-between w-full mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#1F1F1F] tracking-tight">
                  Cool ! How does this look?
                </h1>
                <p className="text-xs font-normal text-[#727272] mt-1">
                  Review your property photos. Click Make cover to change the primary photo, or Replace to swap an image. ({photos.length} photos selected)
                </p>
                {uploadError && (
                  <p className="text-xs font-semibold text-rose-600 mt-2 bg-rose-50 border border-rose-200 rounded-lg p-2">
                    {uploadError}
                  </p>
                )}
                {isUploading && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 animate-pulse">
                    <svg className="animate-spin h-3.5 w-3.5 text-amber-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Uploading photo(s) to secure storage...</span>
                  </div>
                )}
              </div>

              {/* Plus (+) Button to Add More Photos */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-full border border-zinc-300 hover:border-zinc-500 bg-white flex items-center justify-center text-zinc-700 hover:text-[#1F1F1F] transition-colors shadow-2xs cursor-pointer shrink-0"
                title="Add more photos"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>

            {/* Hidden File Inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleAddPhotos}
              onClick={(e) => ((e.target as HTMLInputElement).value = "")}
            />
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReplacePhoto}
              onClick={(e) => ((e.target as HTMLInputElement).value = "")}
            />

            {/* Primary 5-Photo Collage Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 w-full mb-8">
              {/* Left Column: Cover Photo (Slot 0) */}
              <div className="sm:col-span-6">
                <div className="w-full h-72 sm:h-96 rounded-3xl border border-zinc-200 bg-zinc-50 flex items-center justify-center relative overflow-hidden shadow-xs group">
                  {photos[0] ? (
                    <>
                      <img src={photos[0]} alt="Cover Photo" className="w-full h-full object-cover" />
                      <span className="absolute top-4 left-4 bg-zinc-900/80 backdrop-blur-xs text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-xs">
                        Cover photo
                      </span>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-4">
                        <button
                          type="button"
                          onClick={() => triggerReplace(0)}
                          className="bg-white/90 text-[#1F1F1F] text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-white transition-colors cursor-pointer"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(0)}
                          className="w-8 h-8 rounded-full bg-white/90 text-zinc-700 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer"
                          title="Remove photo"
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100/70 transition-colors"
                    >
                      <CameraPlaceholder />
                      <span className="mt-2 text-xs font-semibold text-zinc-600">Click to add cover photo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: 2x2 Grid (Slots 1, 2, 3, 4) */}
              <div className="sm:col-span-6 grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((slotIdx) => {
                  const photoUrl = photos[slotIdx];
                  return (
                    <div
                      key={slotIdx}
                      className="w-full aspect-square rounded-2xl border border-zinc-200 bg-zinc-50 flex items-center justify-center relative overflow-hidden shadow-xs group"
                    >
                      {photoUrl ? (
                        <>
                          <img src={photoUrl} alt={`Photo ${slotIdx + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                            <div className="flex items-center justify-between w-full">
                              <button
                                type="button"
                                onClick={() => handleSetCoverPhoto(slotIdx)}
                                className="bg-white/90 text-[#1F1F1F] text-[10px] font-semibold px-2 py-1 rounded-md hover:bg-white transition-colors cursor-pointer"
                              >
                                Make cover
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(slotIdx)}
                                className="w-6 h-6 rounded-full bg-white/90 text-zinc-700 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer"
                                title="Remove photo"
                              >
                                ✕
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => triggerReplace(slotIdx)}
                              className="bg-white/90 text-[#1F1F1F] text-[11px] font-semibold py-1 px-2 rounded-md hover:bg-white transition-colors cursor-pointer self-start"
                            >
                              Replace
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100/70 transition-colors"
                        >
                          <CameraPlaceholder />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Additional Photos Section (If more than 5 photos uploaded) */}
            {extraPhotos.length > 0 && (
              <div className="w-full mt-4">
                <h3 className="text-sm font-semibold text-zinc-800 mb-3">Additional photos ({extraPhotos.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 w-full">
                  {extraPhotos.map((url, idx) => {
                    const actualIdx = idx + 5;
                    return (
                      <div
                        key={actualIdx}
                        className="relative rounded-2xl overflow-hidden border border-zinc-200 aspect-square group bg-zinc-50"
                      >
                        <img src={url} alt={`Extra photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5">
                          <div className="flex items-center justify-between w-full">
                            <button
                              type="button"
                              onClick={() => handleSetCoverPhoto(actualIdx)}
                              className="bg-white/90 text-[#1F1F1F] text-[10px] font-semibold px-2 py-0.5 rounded-md hover:bg-white cursor-pointer"
                            >
                              Make cover
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(actualIdx)}
                              className="w-5 h-5 rounded-full bg-white/90 text-zinc-700 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs font-semibold cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => triggerReplace(actualIdx)}
                            className="bg-white/90 text-[#1F1F1F] text-[10px] font-semibold py-0.5 px-2 rounded-md hover:bg-white cursor-pointer self-start"
                          >
                            Replace
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {/* Extra Add Slot */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100/80 flex flex-col items-center justify-center aspect-square text-zinc-500 cursor-pointer transition-colors"
                  >
                    <span className="text-2xl font-semibold mb-1">+</span>
                    <span className="text-[11px] font-semibold">Add photo</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <StepProgressFooter
            currentStep={3}
            totalSteps={6}
            onBack={onBack}
            onNext={onNext}
            isLoading={isLoading || isUploading}
          />
        </div>
      </Container>
    </main>
  );
}
