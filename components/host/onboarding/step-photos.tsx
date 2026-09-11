"use client";

import { Container } from "@/components/ui";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useRef } from "react";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";
import Image from "next/image";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

interface StepPhotosProps {
  photos: string[];
  onUpdatePhotos: (photos: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepPhotos({
  photos,
  onUpdatePhotos,
  onBack,
  onNext,
  isLoading = false,
}: StepPhotosProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection from local device
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    addFiles(newFiles);
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(
      (file) => ACCEPTED_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_FILE_SIZE,
    );
    if (validFiles.length !== newFiles.length) {
      setUploadError("Use JPEG, PNG, WebP, or AVIF photos up to 10 MB each.");
    } else {
      setUploadError(null);
    }
    const updatedFiles = [...selectedFiles, ...validFiles];
    setSelectedFiles(updatedFiles);

    const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
    setFilePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleConfirmUpload = async () => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const uploadedUrls = await Promise.all(
        selectedFiles.map(async (file) => {
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
                : "Upload failed.";
            throw new Error(message);
          }
          return String((result as { url: string }).url);
        }),
      );
      onUpdatePhotos([...photos, ...uploadedUrls]);
      filePreviews.forEach((preview) => URL.revokeObjectURL(preview));
      setSelectedFiles([]);
      setFilePreviews([]);
      setIsModalOpen(false);
    } catch (error: unknown) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Please retry.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const updated = photos.filter((_, idx) => idx !== index);
    onUpdatePhotos(updated);
  };

  const handleRemoveModalPreview = (index: number) => {
    URL.revokeObjectURL(filePreviews[index]);
    setFilePreviews((prev) => prev.filter((_, idx) => idx !== index));
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <main className="step-photos min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          
          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className={`${photos.length > 0 ? "max-w-[1006px]" : "max-w-lg"} mx-auto w-full flex flex-col items-start text-left justify-center my-auto`}>
            {/* Main Title & Subtitle */}
            {photos.length === 0 ? (
              <>
                <h1 data-aos="fade-up" className="mb-5">Add some photos of your house</h1>
                <p data-aos="fade-up" data-aos-delay="100" className="sm:text-base text-sm font-normal text-[#727272] mb-10">
                  You’ll need 5 photos to get started. You can add more or make changes later.
                </p>
              </>
            ) : (
              <div className="mb-7 flex w-full items-start justify-between gap-4">
                <h1>Cool! How does this look?</h1>
                {/* Plus (+) Button to Add More Photos */}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  aria-label="Add more photos"
                  className="sm:w-10 sm:h-10 w-8 h-8 rounded-full border border-[#1f1f1f] hover:border-[#1F1F1F] bg-[#F3F4F5] hover:bg-[#1F1F1F] flex items-center justify-center hover:text-white text-[#1F1F1F] transition-colors duration-300 shadow-2xs cursor-pointer shrink-0"
                >
                  <svg className="sm:w-5 w-4 sm:h-5 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>
            )}

            {/* Hidden Global File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Main Upload Box Container */}
            {photos.length === 0 ? (
              <div data-aos="fade-up" data-aos-delay="200" className="w-full max-w-xl sm:h-[446px] h-[338px] rounded-3xl border-2 border-[#1F1F1F] bg-[#F3F4F5] flex flex-col items-center justify-center p-6 text-center shadow-xs">
                {/* Cute Camera Icon Illustration */}
                <div className="w-20 h-20 mb-4 flex items-center justify-center relative">
                  <Image src="/images/icons/camera-icon.svg" alt="camera-icon.svg" width={90} height={90} />
                </div>

                {/* Add Photos Action Button */}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="rounded-full border border-transparent bg-[#FCDF9C] px-5 py-2.75 text-base font-medium text-[#1F1F1F] transition-colors delay-100 duration-300 hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-13 lg:min-h-0 lg:flex-none lg:px-6"
                >
                  Add photos
                </button>
              </div>
            ) : (
              /* Uploaded Photos Grid Display */
              <div data-aos="fade-up" data-aos-delay="200" className="w-full">
                <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-6">
                  {photos.map((url, idx) => (
                    <div
                      key={idx}
                      className={`relative overflow-hidden rounded-xl border border-[#1F1F1F]/30 bg-[#F3F4F5] group aspect-square ${idx === 0 ? "col-span-2 sm:row-span-2" : ""
                        }`}
                    >
                      <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        aria-label={`Remove upload ${idx + 1}`}
                        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-xs font-semibold text-zinc-700 opacity-0 shadow-xs transition-colors group-hover:opacity-100 hover:bg-red-500 hover:text-white focus-visible:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Modal */}
          {isModalOpen && (
            <ModalOverlay className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[20px] p-8 max-w-[340px] w-full shadow-2xl relative flex flex-col items-center text-center">
                {/* Close Button (X) */}
                <button
                  type="button"
                  onClick={() => !isUploading && setIsModalOpen(false)}
                  className="absolute top-5 right-5 text-[#1F1F1F] hover:text-zinc-700 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Modal Header Title */}
                <h2 className="text-xl font-medium text-[#1F1F1F] mb-6 mt-6">
                  {filePreviews.length === 0
                    ? "You can upload best 5 images of your place"
                    : "Choose at least 5 photos"}
                </h2>

                {uploadError && (
                  <p role="alert" className="mb-4 w-full rounded-xl bg-rose-50 px-3 py-2 text-left text-xs font-medium text-rose-700">
                    {uploadError}
                  </p>
                )}

                {/* Drop Zone Area */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-[202px] border-2 border-dashed border-zinc-200 hover:border-amber-400 rounded-[20px] px-6 py-3.25 sm:p-8 flex flex-col items-center justify-center bg-zinc-50/60 transition-colors cursor-pointer"
                >
                  {filePreviews.length === 0 ? (
                    /* Empty Dropzone State */
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-[#FCDF9C] flex items-center justify-center mb-3 text-[#1F1F1F] shadow-2xs border border-[#1F1F1F]">
                        <Image src="/images/icons/upload-icon.svg" alt="upload-icon.svg" width={24} height={24} />
                      </div>
                      <span className="text-base font-normal text-black">Drop files here</span>
                    </div>
                  ) : (
                    /* Photo Grid Previews State inside Modal */
                    <div className="grid w-[216px] grid-cols-6 gap-2">
                      {Array.from({ length: Math.max(5, filePreviews.length) }, (_, idx) => {
                        const url = filePreviews[idx];
                        return (
                          <div
                            key={idx}
                            className={`relative col-span-2 aspect-square overflow-hidden rounded-xl bg-zinc-300 group ${idx === 3 ? "col-start-2" : ""}`}
                          >
                            {url && (
                              <>
                                <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveModalPreview(idx);
                                  }}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px] font-semibold"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                            {!url && idx === 4 && (
                              <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-3xl font-light text-[#1F1F1F]">
                                +
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {filePreviews.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full mt-8 rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-5 py-2.25 text-base font-medium text-[#1F1F1F] transition-colors delay-100 duration-300 hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-14 min-h-12 lg:flex-none lg:px-6"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmUpload}
                    disabled={isUploading}
                    className="w-full mt-8 rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-5 py-2.25 text-base font-medium text-[#1F1F1F] transition-colors delay-100 duration-300 hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-14 min-h-12 lg:flex-none lg:px-6"
                  >
                    {isUploading ? "Uploading..." : "Upload"}
                  </button>
                )}
              </div>
            </ModalOverlay>
          )}

          {/* Bottom Action Footer Bar */}
          <div className="max-w-7xl mx-auto w-full flex items-center justify-end sm:mt-8 sm:pt-0 pt-8 mt-auto">
            <OnboardingBackButton
              onClick={onBack}
              disabled={isLoading}
            />
            <OnboardingPrimaryButton
              onClick={onNext}
              disabled={isUploading}
              isLoading={isLoading}
              label="Next"
            />
          </div>
        </div>
      </Container>
    </main>
  );
}
