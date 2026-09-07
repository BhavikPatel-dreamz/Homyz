"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useRef } from "react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection from local device
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    addFiles(newFiles);
  };

  const addFiles = (newFiles: File[]) => {
    const updatedFiles = [...selectedFiles, ...newFiles];
    setSelectedFiles(updatedFiles);

    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
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
    // Combine existing photos with new previews
    const allPhotos = [...photos, ...filePreviews];
    onUpdatePhotos(allPhotos);
    setIsUploading(false);
    setIsModalOpen(false);
    // Directly navigate to "Cool ! How does this look?" screen
    onNext();
  };

  const handleRemovePhoto = (index: number) => {
    const updated = photos.filter((_, idx) => idx !== index);
    onUpdatePhotos(updated);
  };

  const handleRemoveModalPreview = (index: number) => {
    setFilePreviews((prev) => prev.filter((_, idx) => idx !== index));
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-4xl mx-auto w-full flex flex-col items-center text-center my-auto">
        {/* Main Title & Subtitle */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-zinc-900 tracking-tight leading-tight mb-2">
          Add some photos of your house
        </h1>
        <p className="text-sm font-medium text-zinc-500 mb-10">
          You’ll need 5 photos to get started. You can add more or make changes later.
        </p>

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
          <div className="w-full max-w-xl h-80 rounded-3xl border border-zinc-300/80 bg-zinc-50/70 flex flex-col items-center justify-center p-6 text-center shadow-xs">
            {/* Cute Camera Icon Illustration */}
            <div className="w-20 h-20 mb-4 flex items-center justify-center relative">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Orange Camera Strap */}
                <path d="M 22 28 C 22 15 58 15 58 28" stroke="#E67E22" strokeWidth="5" strokeLinecap="round" fill="none" />
                {/* Purple Camera Body */}
                <rect x="14" y="26" width="52" height="36" rx="10" fill="#D8B4E2" stroke="#4A235A" strokeWidth="2" />
                <rect x="26" y="20" width="16" height="8" rx="3" fill="#D8B4E2" stroke="#4A235A" strokeWidth="2" />
                {/* Camera Lens Outer */}
                <circle cx="40" cy="44" r="14" fill="#4A235A" />
                {/* Camera Lens Inner Ring */}
                <circle cx="40" cy="44" r="9" fill="#FFF9C4" />
                <circle cx="40" cy="44" r="5" fill="#4A235A" />
                {/* Flash & Accent Dots */}
                <circle cx="56" cy="33" r="2.5" fill="#E67E22" />
              </svg>
            </div>

            {/* Add Photos Action Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-7 py-3 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-bold text-zinc-900 shadow-xs transition-colors cursor-pointer"
            >
              Add photos
            </button>
          </div>
        ) : (
          /* Uploaded Photos Grid Display */
          <div className="w-full max-w-2xl flex flex-col items-center">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full mb-6">
              {photos.map((url, idx) => (
                <div
                  key={idx}
                  className={`relative rounded-2xl overflow-hidden border border-zinc-200 shadow-sm group aspect-4/3 ${
                    idx === 0 ? "col-span-2 sm:col-span-2 aspect-16/9" : ""
                  }`}
                >
                  <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute top-3 left-3 bg-zinc-900/80 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-full">
                      Cover photo
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/90 text-zinc-700 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs font-bold transition-colors shadow-xs opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Add More Slot */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100/80 flex flex-col items-center justify-center p-4 transition-colors aspect-4/3 cursor-pointer"
              >
                <span className="text-2xl text-zinc-400 mb-1">+</span>
                <span className="text-xs font-bold text-zinc-600">Add more</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <ModalOverlay className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative flex flex-col items-center text-center">
            {/* Close Button (X) */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal Header Title */}
            <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 mb-6">
              {filePreviews.length === 0
                ? "You can upload best 5 images of your place"
                : "Choose at least 5 photos"}
            </h2>

            {/* Drop Zone Area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-zinc-200 hover:border-amber-400 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center bg-zinc-50/60 transition-colors cursor-pointer"
            >
              {filePreviews.length === 0 ? (
                /* Empty Dropzone State */
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#FCDF9C] flex items-center justify-center mb-3 text-zinc-900 shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-zinc-700">Drop files here</span>
                </div>
              ) : (
                /* Photo Grid Previews State inside Modal */
                <div className="grid grid-cols-3 gap-2.5 w-full">
                  {filePreviews.map((url, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden aspect-square border border-zinc-200 group">
                      <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveModalPreview(idx);
                        }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px] font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {filePreviews.length < 5 && (
                    <div className="rounded-xl border border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center aspect-square text-zinc-400">
                      <span className="text-lg font-bold">+</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {filePreviews.length === 0 ? (
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full py-3 rounded-full border border-zinc-300 text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition-colors mt-6 cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmUpload}
                disabled={isUploading}
                className="w-full py-3 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-extrabold text-zinc-900 shadow-xs transition-colors mt-6 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* Bottom Action Footer Bar */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-end gap-3 pt-8 border-t border-zinc-100 mt-12">
        <button
          type="button"
          onClick={onBack}
          className="px-7 py-2.5 rounded-full border border-zinc-300 hover:bg-zinc-100 text-sm font-bold text-zinc-800 transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          className="px-8 py-2.5 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-extrabold text-zinc-900 shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 min-w-[100px]"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-zinc-900 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading...</span>
            </>
          ) : (
            "Next"
          )}
        </button>
      </div>
    </main>
  );
}
