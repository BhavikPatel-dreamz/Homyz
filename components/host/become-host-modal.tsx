"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import { BackButton } from "@/components/ui/back-button";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";

export type HostingTypeOption = "HOME" | "EXPERIENCE" | "SERVICE";

export interface BecomeHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: HostingTypeOption;
}

export function BecomeHostModal({
  isOpen,
  onClose,
  initialType = "HOME",
}: BecomeHostModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  // Step 1: "Welcome back, [Name] - Start a new listing"
  // Step 2: "What would you like to host?"
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<HostingTypeOption>(initialType);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset to Step 1 whenever modal opens
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setStep(1);
      setSelectedType("HOME");
      setIsNavigating(false);
    }
  }

  if (!isOpen) return null;

  const displayName = user?.name
    ? user.name.split(" ")[0]
    : user?.email
    ? user.email.split("@")[0]
    : "Host";

  // Step 1 Actions
  const handleSelectCreateNew = () => {
    setStep(2);
  };

  const handleCreateFromExisting = () => {
    setIsNavigating(true);
    onClose();
    if (user?.role === "HOST" || user?.role === "ADMIN") {
      router.push(`/host/listings?mode=duplicate&type=HOME`);
    } else {
      router.push(`/host/listings/new?type=HOME`);
    }
  };

  // Step 2 Actions
  const handleStep2Next = () => {
    if (selectedType !== "HOME") return;
    setIsNavigating(true);
    onClose();
    router.push(`/host/listings/new?type=${selectedType}`);
  };

  const isTypeSupported = selectedType === "HOME";

  return (
    <ModalOverlay className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4">
      {/* Dark overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* STEP 1: Welcome back, [Name] - Start a new listing */}
      {step === 1 && (
        <div className="relative z-10 w-full sm:max-w-lg sm:h-auto h-full sm:rounded-3xl bg-white py-6 px-6 sm:px-8 shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-200">
          {/* Header Controls: Close Button */}
          <div className="flex items-center justify-end mb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:bg-[#E9EBFF] hover:text-zinc-700 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#1A1A1A" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Header Titles */}
          <div className="px-2 mb-6">
            <h2 className="text-lg sm:text-xl font-medium text-[#727272] tracking-tight">
              Welcome back, <span className="capitalize text-[#1F1F1F] ">{displayName}</span>
            </h2>
            <p className="text-sm font-normal text-[#727272] mt-3">
              Start a new listing
            </p>
          </div>

          {/* Options List with Separators */}
          <div className="my-2 divide-y divide-[#727272]">
            {/* Option 1: Create a new listing */}
            <button
              type="button"
              onClick={handleSelectCreateNew}
              disabled={isNavigating}
              className="w-full flex items-center justify-between py-4 px-2 text-left group hover:bg-zinc-50/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-500 group-hover:border-zinc-900 group-hover:text-[#1F1F1F] transition-colors shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-base font-normal text-[#1F1F1F] group-hover:text-[#727272] transition-colors">
                  Create a new listing
                </span>
              </div>
              <svg className="w-5 h-5 text-[#1D1D1D] group-hover:text-[#727272] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Option 2: Create from an existing listing */}
            <button
              type="button"
              onClick={handleCreateFromExisting}
              disabled={isNavigating}
              className="w-full flex items-center justify-between py-4 px-2 text-left group hover:bg-zinc-50/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-500 group-hover:border-zinc-900 group-hover:text-[#1F1F1F] transition-colors shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-base font-normal text-[#1F1F1F] group-hover:text-[#727272] transition-colors">
                  Create from an existing listing
                </span>
              </div>
              <svg className="w-5 h-5 text-[#1D1D1D] group-hover:text-[#727272] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: What would you like to host? */}
      {step === 2 && (
        <div className="relative z-10 w-full max-w-172.5 sm:h-auto h-full sm:rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-200">
          {/* Header Controls: Back Button & Close Button */}
          <div className="flex items-center justify-between mb-4">
            <BackButton
              onClick={() => setStep(1)}
              aria-label="Back to welcome screen"
              title="Back"
            />

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:bg-[#E9EBFF] hover:text-zinc-700 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#1A1A1A" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Header Title */}
          <h2 className="text-2xl sm:text-3xl font-medium text-[#1F1F1F] text-left tracking-tight mb-2">
            What would you like to host?
          </h2>

          {/* 3 Hosting Category Choice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 mt-12">
            {/* Option 1: Home */}
            <button
              type="button"
              onClick={() => setSelectedType("HOME")}
              className={`relative flex sm:flex-col flex-row-reverse items-center sm:justify-center justify-between p-6 rounded-2xl border transition-all cursor-pointer select-none text-center sm:min-h-[172px] min-h-[164px] shadow-[0px_2px_4px_rgba(0,0,0,0.25)] ${selectedType === "HOME"
                  ? "border-[#1F1F1F] bg-white"
                  : "border-white bg-white"
                }`}
            >
              {/* House Icon */}
              <div className="w-16 h-16 flex items-center justify-center mb-3">
                <Image src="/images/icons/home-icon.svg" alt="" width={37} height={47} />
              </div>
              <span className="text-base font-semibold text-[#1F1F1F]">Home</span>
            </button>

            {/* Option 2: Experience */}
            <button
              type="button"
              onClick={() => setSelectedType("EXPERIENCE")}
              className={`relative flex sm:flex-col flex-row-reverse items-center sm:justify-center justify-between p-6 rounded-2xl border transition-all cursor-pointer select-none text-center sm:min-h-[172px] min-h-[164px] shadow-[0px_2px_4px_rgba(0,0,0,0.25)] ${
                selectedType === "EXPERIENCE"
                  ? "border-[#1F1F1F] bg-white"
                  : "border-white bg-white"
                }`}
            >
              <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full">
                Soon
              </span>
              {/* Experience Icon */}
              <div className="w-16 h-16 flex items-center justify-center mb-3 opacity-80">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="28" cy="28" r="22" fill="#FFF0ED" />
                  <circle cx="28" cy="20" r="7.5" fill="#FF8D6B" />
                  <path d="M 12 38 L 22 26 L 30 35 L 38 23 L 46 38 Z" fill="#D3C1D8" />
                  <path d="M 8 40 C 18 35, 38 35, 48 40 C 48 42, 8 42, 8 40 Z" fill="#7BAA9C" />
                </svg>
              </div>
              <span className="text-base font-semibold text-[#1F1F1F]">Experience</span>
            </button>

            {/* Option 3: Service */}
            <button
              type="button"
              onClick={() => setSelectedType("SERVICE")}
              className={`relative flex sm:flex-col flex-row-reverse items-center sm:justify-center justify-between p-6 rounded-2xl border transition-all cursor-pointer select-none text-center sm:min-h-[172px] min-h-[164px] shadow-[0px_2px_4px_rgba(0,0,0,0.25)] ${
                selectedType === "SERVICE"
                  ? "border-[#1F1F1F] bg-white"
                  : "border-white bg-white"
                }`}
            >
              <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full">
                Soon
              </span>
              {/* Service Icon */}
              <div className="w-16 h-16 flex items-center justify-center mb-3 opacity-80">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="18" y="10" width="22" height="34" rx="4" fill="#3A5A80" />
                  <rect x="20" y="13" width="18" height="28" rx="2" fill="#E2F4F8" />
                  <circle cx="29" cy="22" r="5" fill="#EE6C4D" />
                  <path d="M 23 32 C 23 28, 35 28, 35 32 Z" fill="#293241" />
                  <circle cx="36" cy="18" r="5" fill="#2563EB" />
                  <path d="M 33.5 18 L 35 19.5 L 38.5 16" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-base font-semibold text-[#1F1F1F]">Service</span>
            </button>
          </div>

          {/* Feedback banner if non-HOME is selected */}
          {!isTypeSupported && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm flex items-center gap-2.5">
              <svg className="w-4 h-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>{selectedType === "EXPERIENCE" ? "Experience" : "Service"} hosting</strong> is coming soon to Homyz. Please select <strong>Home</strong> to create a place listing today.
              </span>
            </div>
          )}

          {/* Modal Action Buttons: Cancel and Next */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6.75 py-3 rounded-full border border-[#1F1F1F] hover:bg-[#1F1F1F] text-sm font-medium text-[#1F1F1F] hover:text-white  transition-colors delay-300 duration-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStep2Next}
              disabled={!isTypeSupported || isNavigating}
              className={`px-4 py-3 rounded-full text-sm hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white font-medium shadow-xs transition-colors delay-300 duration-300 flex items-center justify-center gap-2 min-w-[100px] border border-transparent hover:border-[#1F1F1F] ${
                isTypeSupported && !isNavigating
                ? "bg-[#FCDF9C] cursor-pointer"
                : "bg-[#F3F4F5] cursor-not-allowed"
              }`}
            >
              {isNavigating ? "Loading..." : "Next"}
            </button>
          </div>
        </div>
      )}
    </ModalOverlay>
  );
}
