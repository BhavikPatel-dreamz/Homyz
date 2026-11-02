"use client";

import React from "react";
import type { PhotoTourViewModel } from "@/lib/listing/photo-tour-view-model";
import { PhotoTourView } from "./photo-tour-view";

export type PhotoTourModalProps = {
  viewModel: PhotoTourViewModel;
  isOpen: boolean;
  onClose: () => void;
  onSelectPhoto?: (globalIndex: number) => void;
  listingTitle?: string;
  onShare?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  saveDisabled?: boolean;
};

export function PhotoTourModal({
  viewModel,
  isOpen,
  onClose,
  listingTitle,
  onShare,
  onSave,
  isSaved = false,
  saveDisabled = false,
}: PhotoTourModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${listingTitle || "Property"} photo tour`}
      className="relative z-20 w-full bg-white text-[#1f1f1f]"
    >
      <PhotoTourView
        viewModel={viewModel}
        listingTitle={listingTitle}
        onBack={onClose}
        onShare={onShare}
        onSave={onSave}
        isSaved={isSaved}
        saveDisabled={saveDisabled}
      />
    </div>
  );
}

export default PhotoTourModal;
