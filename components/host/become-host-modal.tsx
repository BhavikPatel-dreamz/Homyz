"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import { BackButton } from "@/components/ui/back-button";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/language-context";
import { duplicateListingAction } from "@/actions/host/listings";
import type { HostListingCardDTO } from "@/services/mappers";

export type HostingTypeOption = "HOME" | "EXPERIENCE" | "SERVICE";

export interface BecomeHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: HostingTypeOption;
  initialStep?: 1 | 2;
}

export function BecomeHostModal({
  isOpen,
  onClose,
  initialType = "HOME",
  initialStep,
}: BecomeHostModalProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  // Step 1: "Welcome back, [Name] - Start a new listing"
  // Step 2: "What would you like to host?"
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep ?? 1);
  const [selectedType, setSelectedType] = useState<HostingTypeOption | null>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("host_type");
      if (saved) {
        const upper = saved.toUpperCase();
        if (upper === "HOME" || upper === "EXPERIENCE" || upper === "SERVICE") {
          return upper as HostingTypeOption;
        }
      }
    }
    return initialType || "HOME";
  });
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [sourceListings, setSourceListings] = useState<HostListingCardDTO[]>([]);
  const [sourcePage, setSourcePage] = useState(1);
  const [hasMoreSources, setHasMoreSources] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<HostListingCardDTO | null>(null);
  const duplicateRequestRef = React.useRef<string | null>(null);

  const handleClose = React.useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  }, [isClosing, onClose]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Reset to initialStep whenever modal opens
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setIsClosing(false);
      setStep(initialStep ?? 1);
      if (typeof window !== "undefined") {
        const saved = sessionStorage.getItem("host_type");
        if (saved) {
          const upper = saved.toUpperCase();
          if (upper === "HOME" || upper === "EXPERIENCE" || upper === "SERVICE") {
            setSelectedType(upper as HostingTypeOption);
          }
        }
      }
      setIsNavigating(false);
      setSelectedSource(null);
      setSourceError(null);
      setSourcePage(1);
      setSourceListings([]);
    }
  }

  const loadSourceListings = React.useCallback(async (page: number, append = false) => {
    setIsLoadingSources(true);
    setSourceError(null);
    try {
      const response = await fetch(`/api/v1/host/listings?tab=ALL&ownedOnly=true&page=${page}&limit=24`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !Array.isArray(payload?.data?.items)) {
        throw new Error(payload?.error?.message || "Unable to load your listings.");
      }
      const items = payload.data.items as HostListingCardDTO[];
      setSourceListings((current) => append ? [...current, ...items] : items);
      setHasMoreSources(Boolean(payload.data.hasMore));
      setSourcePage(page);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Unable to load your listings.");
    } finally {
      setIsLoadingSources(false);
    }
  }, []);

  if (!isOpen && !isClosing) return null;

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
    setSourceListings([]);
    setSourceError(null);
    void loadSourceListings(1);
    setStep(3);
  };

  const handleDuplicate = async (includePhotos: boolean) => {
    if (!selectedSource || isNavigating || duplicateRequestRef.current) return;
    const requestKey = typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${selectedSource.id}-${Date.now()}`;
    duplicateRequestRef.current = requestKey;
    setIsNavigating(true);
    let didStartNavigation = false;
    try {
      const result = await duplicateListingAction(selectedSource.id, includePhotos, requestKey);
      if (!result.ok) throw new Error(result.error || "Unable to duplicate this listing.");
      didStartNavigation = true;
      onClose();
      router.push(`/host/listings/new?type=HOME&draftId=${result.data.id}`);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Unable to duplicate this listing.");
      setStep(3);
    } finally {
      if (!didStartNavigation) {
        duplicateRequestRef.current = null;
        setIsNavigating(false);
      }
    }
  };

  // Step 2 Actions
  const handleStep2Next = () => {
    if (!selectedType || selectedType !== "HOME") return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("host_type", selectedType.toLowerCase());
    }
    setIsNavigating(true);
    onClose();
    router.push(`/host/listings/new?type=${selectedType}`);
  };

  const isTypeSupported = selectedType === "HOME";

  return (
    <ModalOverlay className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4">
      {/* Dark overlay backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-xs ${
          isClosing ? "modal-backdrop-animate-out" : "modal-backdrop-animate-in"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* STEP 1: Welcome back, [Name] - Start a new listing */}
      {step === 1 && (
        <div
          className={`relative z-10 w-full sm:max-w-lg sm:h-auto h-full sm:rounded-3xl bg-white py-6 px-6 sm:px-8 shadow-2xl border border-zinc-100 ${
            isClosing ? "modal-dialog-animate-out" : "modal-dialog-animate-in"
          }`}
        >
          {/* Header Controls: Close Button */}
          <div className="flex items-top justify-between mb-2">

            {/* Modal Header Titles */}
            <div className="px-2 mb-6">
              <h2 className="text-lg sm:text-xl font-medium text-[#727272] tracking-tight">
                {t("host_welcome_back")} <span className="capitalize text-[#1F1F1F] ">{displayName}</span>
              </h2>
              <p className="text-sm font-normal text-[#727272] mt-3">
                {t("host_start_new_listing")}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#727272] hover:bg-[#E9EBFF] hover:text-zinc-700 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#1A1A1A" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
                <div className="w-9 h-9 rounded-full border border-zinc-300 flex items-center justify-center text-[#727272] group-hover:border-zinc-900 group-hover:text-[#1F1F1F] transition-colors shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-base font-normal text-[#1F1F1F] group-hover:text-[#727272] transition-colors">
                  {t("host_create_new")}
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
                <div className="w-9 h-9 rounded-full border border-zinc-300 flex items-center justify-center text-[#727272] group-hover:border-zinc-900 group-hover:text-[#1F1F1F] transition-colors shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-base font-normal text-[#1F1F1F] group-hover:text-[#727272] transition-colors">
                  {t("host_create_from_existing")}
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
        <div
          className={`relative z-10 w-full max-w-172.5 sm:h-auto h-full sm:rounded-3xl bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800 ${
            isClosing ? "modal-dialog-animate-out" : "modal-dialog-animate-in"
          }`}
        >
          {/* Header Controls: Back Button & Close Button */}
          <div className="flex items-center justify-between mb-4">
            <BackButton
              onClick={() => setStep(1)}
              aria-label="Back to welcome screen"
              title="Back"
            />

            <button
              type="button"
              onClick={handleClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#727272] hover:bg-[#E9EBFF] hover:text-zinc-700 transition-colors cursor-pointer dark:text-[#727272] dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Header Title */}
          <h2 className="text-2xl sm:text-3xl font-medium text-[#1F1F1F] text-left tracking-tight mb-2">
            {t("host_what_would_you_like_to_host")}
          </h2>

          {/* 3 Hosting Category Choice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 mt-12">
            {/* Option 1: Home */}
            <button
              type="button"
              onClick={() => {
                setSelectedType("HOME");
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("host_type", "home");
                }
              }}
              className={`relative flex sm:flex-col flex-row-reverse items-center sm:justify-center justify-between p-6 rounded-2xl transition-all cursor-pointer select-none text-center sm:min-h-[172px] min-h-[164px] ${selectedType === "HOME"
                  ? "border-2 border-zinc-950 bg-white shadow-md ring-2 ring-zinc-950/10"
                  : "border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-2xs"
                }`}
            >
              {/* House Icon */}
              <div className="w-16 h-16 flex items-center justify-center mb-3">
                <Image src="/images/icons/home-icon.svg" alt="" width={37} height={47} />
              </div>
              <span className="text-base font-medium text-[#1F1F1F]">{t("host_home")}</span>
            </button>

            {/* Option 2: Experience */}
            <button
              type="button"
              onClick={() => {
                setSelectedType("EXPERIENCE");
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("host_type", "experience");
                }
              }}
              className={`relative flex sm:flex-col flex-row-reverse items-center sm:justify-center justify-between p-6 rounded-2xl transition-all cursor-pointer select-none text-center sm:min-h-[172px] min-h-[164px] ${selectedType === "EXPERIENCE"
                  ? "border-2 border-zinc-950 bg-white shadow-md ring-2 ring-zinc-950/10"
                  : "border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-2xs"
                }`}
            >
              <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full">
                {t("host_soon")}
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
              <span className="text-base font-medium text-[#1F1F1F]">{t("host_experience")}</span>
            </button>

            {/* Option 3: Service */}
            <button
              type="button"
              onClick={() => {
                setSelectedType("SERVICE");
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("host_type", "service");
                }
              }}
              className={`relative flex sm:flex-col flex-row-reverse items-center sm:justify-center justify-between p-6 rounded-2xl transition-all cursor-pointer select-none text-center sm:min-h-[172px] min-h-[164px] ${selectedType === "SERVICE"
                  ? "border-2 border-zinc-950 bg-white shadow-md ring-2 ring-zinc-950/10"
                  : "border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-2xs"
                }`}
            >
              <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full">
                {t("host_soon")}
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
              <span className="text-base font-medium text-[#1F1F1F]">{t("host_service")}</span>
            </button>
          </div>

          {/* Feedback banner if non-HOME is selected */}
          {(!isTypeSupported && selectedType) && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm flex items-center gap-2.5">
              <svg className="w-4 h-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {t("host_type_coming_soon_notice", { type: selectedType === "EXPERIENCE" ? t("host_experience") : t("host_service") }, `${selectedType === "EXPERIENCE" ? t("host_experience") : t("host_service")} hosting is coming soon to Homyz. Please select ${t("host_home")} to create a place listing today.`)}
              </span>
            </div>
          )}

          {/* Modal Action Buttons: Cancel and Next */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-6.75 py-3 rounded-full border border-[#1F1F1F] hover:bg-[#1F1F1F] text-sm font-medium text-[#1F1F1F] hover:text-white  transition-colors delay-300 duration-300 cursor-pointer"
            >
              {t("host_cancel")}
            </button>
            <button
              type="button"
              onClick={handleStep2Next}
              disabled={!selectedType || !isTypeSupported || isNavigating}
              className={`px-4 py-3 rounded-full text-sm hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white font-medium shadow-xs transition-colors delay-300 duration-300 flex items-center justify-center gap-2 min-w-[100px] border border-transparent hover:border-[#1F1F1F] ${selectedType && isTypeSupported && !isNavigating
                  ? "bg-[#FCDF9C] cursor-pointer"
                  : "bg-[#F3F4F5] text-[#727272] cursor-not-allowed"
                }`}
            >
              {isNavigating ? t("host_loading") : t("host_next")}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Choose an owned listing to duplicate. */}
      {step === 3 && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-listing-title"
          className={`relative z-10 flex h-full w-full flex-col bg-white px-5 py-6 shadow-2xl sm:h-auto sm:max-h-[min(740px,calc(100dvh-2rem))] sm:max-w-5xl sm:rounded-3xl sm:px-7 sm:py-6 ${
            isClosing ? "modal-dialog-animate-out" : "modal-dialog-animate-in"
          }`}
        >
          <h2 id="duplicate-listing-title" className="text-center text-xl font-medium text-[#1F1F1F]">
            Choose a listing
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full text-[#1F1F1F] transition-colors hover:bg-zinc-100"
            aria-label="Close modal"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>

          <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-1 sm:mt-10">
            {isLoadingSources && sourceListings.length === 0 ? (
              <div className="space-y-3" aria-label="Loading listings">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-26 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
                ))}
              </div>
            ) : sourceError ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
                <p className="text-sm font-medium text-rose-800">{sourceError}</p>
                <button
                  type="button"
                  onClick={() => void loadSourceListings(1)}
                  className="mt-4 rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-white"
                >
                  Retry
                </button>
              </div>
            ) : sourceListings.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
                <p className="text-base font-semibold text-[#1F1F1F]">No listings to copy yet</p>
                <p className="mt-2 max-w-sm text-sm text-[#727272]">Create your first listing to use it as a starting point for another one.</p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mt-5 rounded-full bg-[#FCDF9C] px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white"
                >
                  Create a new listing
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sourceListings.map((listing) => {
                  const thumbnail = listing.photos[0];
                  return (
                    <button
                      key={listing.id}
                      type="button"
                      onClick={() => {
                        setSelectedSource(listing);
                        setStep(4);
                      }}
                      className="group flex min-h-24 w-full items-center gap-4 rounded-2xl border border-zinc-300 bg-white p-3 text-left transition-colors hover:border-[#1F1F1F] hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                    >
                      <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-zinc-600 sm:size-14">
                        {thumbnail ? (
                          <Image src={thumbnail} alt="" fill unoptimized sizes="56px" className="object-cover" />
                        ) : (
                          <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
                          </svg>
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-base font-medium text-[#1F1F1F]">{listing.title || "Untitled listing"}</span>
                      <svg aria-hidden="true" className="size-5 shrink-0 text-[#1F1F1F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
                {hasMoreSources && (
                  <button
                    type="button"
                    onClick={() => void loadSourceListings(sourcePage + 1, true)}
                    disabled={isLoadingSources}
                          className="mx-auto mt-2 block rounded-full border border-[#FCDF9C] bg-[#FCDF9C] hover:bg-[#1f1f1f] px-5 py-2 text-sm font-medium text-[#1F1F1F] hover:text-white hover:border-[#1F1F1F] disabled:opacity-50 duration-300"
                  >
                    {isLoadingSources ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* STEP 4: Explicit media choice keeps each duplicated gallery independent. */}
      {step === 4 && selectedSource && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-photo-title"
          className={`relative z-10 flex h-full w-full flex-col bg-white px-5 py-6 shadow-2xl sm:h-auto sm:min-h-[520px] sm:max-w-5xl sm:rounded-3xl sm:px-7 sm:py-6 ${
            isClosing ? "modal-dialog-animate-out" : "modal-dialog-animate-in"
          }`}
        >
          <h2 id="duplicate-photo-title" className="text-center text-lg font-semibold text-[#1F1F1F]">
            Want to use the same photos?
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isNavigating}
            className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full text-[#1F1F1F] transition-colors hover:bg-zinc-100 disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>

          <div className="my-auto space-y-3 py-10">
            <button
              type="button"
              onClick={() => void handleDuplicate(true)}
              disabled={isNavigating}
              className="group flex min-h-26 w-full items-center gap-4 rounded-2xl border border-zinc-300 bg-white px-5 text-left transition-colors hover:border-[#1F1F1F] hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-[#1F1F1F]">
                <svg aria-hidden="true" className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="m21 15-4.5-4.5L8 19" />
                </svg>
              </span>
              <span className="flex-1 text-base font-semibold text-[#1F1F1F]">{isNavigating ? "Creating draft…" : "Duplicate with photos"}</span>
              <svg aria-hidden="true" className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" /></svg>
            </button>
            <button
              type="button"
              onClick={() => void handleDuplicate(false)}
              disabled={isNavigating}
              className="group flex min-h-26 w-full items-center gap-4 rounded-2xl border border-zinc-300 bg-white px-5 text-left transition-colors hover:border-[#1F1F1F] hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-[#1F1F1F]">
                <svg aria-hidden="true" className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <rect x="7" y="5" width="11" height="15" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 16V6a2 2 0 0 1 2-2h8" />
                </svg>
              </span>
              <span className="flex-1 text-base font-semibold text-[#1F1F1F]">Duplicate without photos</span>
              <svg aria-hidden="true" className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" /></svg>
            </button>
          </div>
        </section>
      )}
    </ModalOverlay>
  );
}
