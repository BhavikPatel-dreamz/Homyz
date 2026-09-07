"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

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

  // Step 1: "What would you like to host?"
  // Step 2: "Welcome back, [Name] - Start a new listing"
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<HostingTypeOption>(initialType);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  // Reset to Step 1 whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIsNavigating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const displayName = user?.name
    ? user.name.split(" ")[0]
    : user?.email
    ? user.email.split("@")[0]
    : "Host";

  // Step 1 Next button handler -> advances to Step 2
  const handleStep1Next = () => {
    setStep(2);
  };

  // Step 2 Action 1: Create a new listing
  const handleCreateNew = () => {
    setIsNavigating(true);
    onClose();
    router.push(`/host/listings/new?type=${selectedType}`);
  };

  // Step 2 Action 2: Create from an existing listing
  const handleCreateFromExisting = () => {
    setIsNavigating(true);
    onClose();
    if (user?.role === "HOST" || user?.role === "ADMIN") {
      router.push(`/host/listings?mode=duplicate&type=${selectedType}`);
    } else {
      router.push(`/host/listings/new?type=${selectedType}`);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Dark overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* STEP 1: What would you like to host? */}
      {step === 1 && (
        <div className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 sm:p-10 shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-200">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Modal Header Title */}
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#1F1F1F] text-center tracking-tight mb-8">
            What would you like to host?
          </h2>

          {/* 3 Hosting Category Choice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {/* Option 1: Home */}
            <button
              type="button"
              onClick={() => setSelectedType("HOME")}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all cursor-pointer select-none text-center ${
                selectedType === "HOME"
                ? "border-zinc-500 ring-[#FCDF9C] shadow-md bg-white"
                  : "border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50/50"
              }`}
            >
              {/* House Icon */}
              <div className="w-16 h-16 flex items-center justify-center mb-3">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="18" width="40" height="30" rx="6" fill="#F4EDE4" />
                  <circle cx="16" cy="24" r="7" fill="#88C999" />
                  <rect x="15" y="27" width="2.5" height="10" fill="#8C6D53" />
                  <rect x="22" y="22" width="22" height="18" rx="2" fill="#FFFFFF" stroke="#4A3E3D" strokeWidth="1.8" />
                  <path d="M 19 23 L 33 12 L 47 23 Z" fill="#E88399" stroke="#4A3E3D" strokeWidth="1.8" strokeLinejoin="round" />
                  <rect x="39" y="13" width="3.5" height="6" fill="#C0607D" />
                  <rect x="30" y="30" width="6" height="10" rx="1" fill="#7A685D" />
                  <rect x="25" y="25" width="4.5" height="4.5" rx="1" fill="#FFEDC2" stroke="#4A3E3D" strokeWidth="1" />
                </svg>
              </div>
              <span className="text-base font-semibold text-[#1F1F1F]">Home</span>
            </button>

            {/* Option 2: Experience */}
            <button
              type="button"
              onClick={() => setSelectedType("EXPERIENCE")}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all cursor-pointer select-none text-center ${
                selectedType === "EXPERIENCE"
                ? "border-zinc-500 ring-[#FCDF9C] shadow-md bg-white"
                : "border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50/50"
              }`}
            >
              {/* Experience Icon */}
              <div className="w-16 h-16 flex items-center justify-center mb-3">
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
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all cursor-pointer select-none text-center ${
                selectedType === "SERVICE"
                ? "border-zinc-500 ring-[#FCDF9C] shadow-md bg-white"
                : "border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50/50"
              }`}
            >
              {/* Service Icon */}
              <div className="w-16 h-16 flex items-center justify-center mb-3">
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

          {/* Modal Action Buttons: Cancel and Next */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-full border border-zinc-300 hover:bg-zinc-100 text-sm font-semibold text-zinc-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStep1Next}
              className="px-8 py-2.5 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-semibold text-[#1F1F1F] shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 min-w-[100px]"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Welcome back, [Name] - Start a new listing */}
      {step === 2 && (
        <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-200">
          {/* Header Controls: Back Button & Close Button */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
              aria-label="Back to step 1"
              title="Back"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Header Titles */}
          <div className="px-2 mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1F1F1F] tracking-tight">
              Welcome back, <span className="capitalize">{displayName}</span>
            </h2>
            <p className="text-sm font-medium text-zinc-500 mt-1">
              Start a new listing
            </p>
          </div>

          {/* Options List with Separators */}
          <div className="border-t border-b border-zinc-100 divide-y divide-zinc-100 my-2">
            {/* Option 1: Create a new listing */}
            <button
              type="button"
              onClick={handleCreateNew}
              disabled={isNavigating}
              className="w-full flex items-center justify-between py-4 px-2 text-left group hover:bg-zinc-50/80 transition-colors rounded-xl cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-500 group-hover:border-zinc-900 group-hover:text-[#1F1F1F] transition-colors shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-base font-semibold text-[#1F1F1F] group-hover:text-zinc-950 transition-colors">
                  Create a new listing
                </span>
              </div>
              <svg className="w-5 h-5 text-zinc-400 group-hover:text-[#1F1F1F] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Option 2: Create from an existing listing */}
            <button
              type="button"
              onClick={handleCreateFromExisting}
              disabled={isNavigating}
              className="w-full flex items-center justify-between py-4 px-2 text-left group hover:bg-zinc-50/80 transition-colors rounded-xl cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-500 group-hover:border-zinc-900 group-hover:text-[#1F1F1F] transition-colors shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v2.25A2.25 2.25 0 0113.5 21.75h-9a2.25 2.25 0 01-2.25-2.25v-9A2.25 2.25 0 014.5 8.25h2.25m6 0H19.5a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9a2.25 2.25 0 012.25-2.25z" />
                  </svg>
                </div>
                <span className="text-base font-semibold text-[#1F1F1F] group-hover:text-zinc-950 transition-colors">
                  Create from an existing listing
                </span>
              </div>
              <svg className="w-5 h-5 text-zinc-400 group-hover:text-[#1F1F1F] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </ModalOverlay>
  );
}
