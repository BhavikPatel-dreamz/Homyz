"use client";

import { Container } from "@/components/ui";
import React, { useState, useRef } from "react";
import { StepProgressFooter } from "./step-progress-footer";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";
import Image from "next/image";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

// Cute Camera SVG Illustration Component
function CameraPlaceholder() {
  return (
    <div className="w-22.5 h-22.5 flex items-center justify-center pointer-events-none">
      <Image src="/images/icons/camera-icon.svg" alt="camera-icon.svg" width={90} height={90}/>
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
      className="step-photo-mngmnt min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16"
    >
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          
          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="max-w-[1006px] mx-auto w-full flex flex-col my-auto">
            {/* Top Header Bar with Title & Plus (+) Button */}
            <div className="flex items-center justify-between w-full mb-8">
              <div>
                <h1 data-aos="fade-up">
                  Cool !<br className="sm:hidden block" /> How does this look?
                </h1>
                {/* <p className="text-xs font-normal text-[#727272] mt-1">
                  Review your property photos. Click Make cover to change the primary photo, or Replace to swap an image. ({photos.length} photos selected)
                </p> */}
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
                className="sm:w-10 sm:h-10 w-8 h-8 rounded-full border border-[#1f1f1f] hover:border-[#1F1F1F] bg-[#F3F4F5] hover:bg-[#1F1F1F] flex items-center justify-center hover:text-white text-[#1F1F1F] transition-colors duration-300 shadow-2xs cursor-pointer shrink-0"
                title="Add more photos"
              >
                <svg className="sm:w-5 w-4 sm:h-5 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
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
            <div data-aos="fade-up" data-aos-delay="100" className="grid grid-cols-1 sm:grid-cols-12 sm:gap-6 gap-2 w-full mb-8">
              {/* Left Column: Cover Photo (Slot 0) */}
              <div className="sm:col-span-6">
                <div className="w-full h-72 sm:h-111 sm:rounded-[20px] rounded-[10px] border border-[#727272] hover:border-[#727272] transition-all duration-300 bg-[#F3F4F5] flex items-center justify-center relative overflow-hidden shadow-xs group">
                  {photos[0] ? (
                    <>
                      <img src={photos[0]} alt="Cover Photo" className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
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
                      className="w-full h-full flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-[#E9EBFF]"
                    >
                      <CameraPlaceholder />
                      <span className="mt-4 text-base font-normal text-[#727272] block">Click to add cover photo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: 2x2 Grid (Slots 1, 2, 3, 4) */}
              <div className="sm:col-span-6 grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-[234px_234px] xl:gap-5.5">
                {[1, 2, 3, 4].map((slotIdx) => {
                  const photoUrl = photos[slotIdx];
                  return (
                    <div
                      key={slotIdx}
                      className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[10px] border border-[#727272] bg-[#F3F4F5] shadow-xs group sm:rounded-2xl xl:h-[210px] xl:w-[234px] xl:aspect-auto"
                    >
                      {photoUrl ? (
                        <>
                          <img src={photoUrl} alt={`Photo ${slotIdx + 1}`} className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                            <div className="flex items-center justify-between w-full">
                              <button
                                type="button"
                                onClick={() => handleSetCoverPhoto(slotIdx)}
                                className="bg-white/90 text-[#1F1F1F] text-[10px] font-medium px-2 py-1 rounded-md hover:bg-white transition-colors cursor-pointer"
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
                              className="bg-white/90 text-[#1F1F1F] text-[11px] font-medium py-1 px-2 rounded-md hover:bg-white transition-colors cursor-pointer self-start"
                            >
                              Replace
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-full flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-[#E9EBFF]"
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
              <div data-aos="fade-up" data-aos-delay="200" className="w-full mt-4">
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
