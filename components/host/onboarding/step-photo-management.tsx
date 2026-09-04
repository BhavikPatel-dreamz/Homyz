"use client";

import React, { useState, useRef } from "react";

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

  // Handle adding new photos
  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    const newUrls = newFiles.map((file) => URL.createObjectURL(file));
    onUpdatePhotos([...photos, ...newUrls]);
    e.target.value = "";
  };

  // Handle replacing a specific photo at target index
  const handleReplacePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || replaceTargetIdx === null) return;
    const file = e.target.files[0];
    const newUrl = URL.createObjectURL(file);
    const updated = [...photos];
    updated[replaceTargetIdx] = newUrl;
    onUpdatePhotos(updated);
    setReplaceTargetIdx(null);
    e.target.value = "";
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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const newUrls = droppedFiles.map((file) => URL.createObjectURL(file));
      onUpdatePhotos([...photos, ...newUrls]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Cute Camera SVG Illustration Component
  const CameraPlaceholder = () => (
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

  const mainCollageSlots = [0, 1, 2, 3, 4];
  const extraPhotos = photos.slice(5);

  return (
    <main
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200"
    >
      <div className="max-w-4xl mx-auto w-full flex flex-col my-auto">
        {/* Top Header Bar with Title & Plus (+) Button */}
        <div className="flex items-center justify-between w-full mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              Cool ! How does this look?
            </h1>
            <p className="text-xs font-medium text-zinc-500 mt-1">
              Drag photos to reorder or click <span className="font-bold text-zinc-700">+</span> to add more. ({photos.length} photos selected)
            </p>
          </div>

          {/* Plus (+) Button to Add More Photos */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-full border border-zinc-300 hover:border-zinc-500 bg-white flex items-center justify-center text-zinc-700 hover:text-zinc-900 transition-colors shadow-2xs cursor-pointer shrink-0"
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
                  <span className="absolute top-4 left-4 bg-zinc-900/80 backdrop-blur-xs text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-xs">
                    Cover photo
                  </span>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-4">
                    <button
                      type="button"
                      onClick={() => triggerReplace(0)}
                      className="bg-white/90 text-zinc-900 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white transition-colors cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(0)}
                      className="w-8 h-8 rounded-full bg-white/90 text-zinc-700 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
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
                  <span className="mt-2 text-xs font-bold text-zinc-600">Click to add cover photo</span>
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
                            className="bg-white/90 text-zinc-900 text-[10px] font-bold px-2 py-1 rounded-md hover:bg-white transition-colors cursor-pointer"
                          >
                            Make cover
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(slotIdx)}
                            className="w-6 h-6 rounded-full bg-white/90 text-zinc-700 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                            title="Remove photo"
                          >
                            ✕
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => triggerReplace(slotIdx)}
                          className="bg-white/90 text-zinc-900 text-[11px] font-bold py-1 px-2 rounded-md hover:bg-white transition-colors cursor-pointer self-start"
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
            <h3 className="text-sm font-bold text-zinc-800 mb-3">Additional photos ({extraPhotos.length})</h3>
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
                          className="bg-white/90 text-zinc-900 text-[10px] font-bold px-2 py-0.5 rounded-md hover:bg-white cursor-pointer"
                        >
                          Make cover
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(actualIdx)}
                          className="w-5 h-5 rounded-full bg-white/90 text-zinc-700 hover:bg-red-500 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => triggerReplace(actualIdx)}
                        className="bg-white/90 text-zinc-900 text-[10px] font-bold py-0.5 px-2 rounded-md hover:bg-white cursor-pointer self-start"
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
                <span className="text-2xl font-bold mb-1">+</span>
                <span className="text-[11px] font-bold">Add photo</span>
              </button>
            </div>
          </div>
        )}
      </div>

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
