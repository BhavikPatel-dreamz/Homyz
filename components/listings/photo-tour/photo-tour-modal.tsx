"use client";

import React, { useEffect, useState } from "react";
import type { PhotoTourViewModel } from "@/lib/listing/photo-tour-view-model";
import { PhotoTourView } from "./photo-tour-view";

export type PhotoTourModalProps = {
  viewModel: PhotoTourViewModel;
  isOpen: boolean;
  onClose: () => void;
  listingTitle?: string;
  onShare?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  saveDisabled?: boolean;
  onReserve?: () => void;
  reserveLabel?: string;
};

/**
 * Mobile/tablet presentation for a tour opened from the listing page. The
 * short-lived leaving state is important: it lets the panel travel down before
 * the parent removes it and leaves the listing's scroll position untouched.
 */
export function PhotoTourModal({
  viewModel, isOpen, onClose, listingTitle, onShare, onSave, isSaved = false,
  saveDisabled = false, onReserve, reserveLabel,
}: PhotoTourModalProps) {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const scrollY = window.scrollY;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalOverflow = document.body.style.overflow;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(onClose, reduced ? 0 : 340);
  };

  if (!isOpen) return null;
  const isVisible = entered && !leaving;
  const transition = "transition-[transform,opacity] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

  return (
    <div role="dialog" aria-modal="true" aria-label={`${listingTitle || "Property"} photo tour`} className="fixed inset-0 z-[90] isolate">
      <button type="button" aria-label="Close photo tour" onClick={close} className={`absolute inset-0 bg-black/25 ${transition} ${isVisible ? "opacity-100" : "opacity-0"}`} />
      <div className={`absolute inset-0 overflow-y-auto overscroll-contain bg-white shadow-2xl ${transition} ${isVisible ? "translate-y-0" : "translate-y-full"}`}>
        <PhotoTourView viewModel={viewModel} listingTitle={listingTitle} onBack={close} onShare={onShare} onSave={onSave} isSaved={isSaved} saveDisabled={saveDisabled} onReserve={onReserve} reserveLabel={reserveLabel} />
      </div>
    </div>
  );
}

export default PhotoTourModal;
