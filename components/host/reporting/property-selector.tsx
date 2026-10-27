"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";

export interface PropertyListingOption {
  id: string;
  title: string;
  photo?: string | null;
  city?: string | null;
  country?: string | null;
  status?: string | null;
}

interface PropertySelectorProps {
  listings: PropertyListingOption[];
  selectedListingId: string | null;
  onSelect: (listingId: string | null) => void;
  disabled?: boolean;
  className?: string;
}

/* ─── Robust Thumbnail with Graceful SVG Fallback ────────────────────────── */
function SafeListingThumbnail({
  src,
  size = "size-10",
  rounded = "rounded-lg",
}: {
  src?: string | null;
  size?: string;
  rounded?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex ${size} shrink-0 items-center justify-center ${rounded} bg-[#F3F4F5] border border-[#EDEDED] text-[#727272]`}
      >
        <svg
          className="h-4 w-4 text-[#727272]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`relative flex ${size} shrink-0 items-center justify-center overflow-hidden ${rounded} bg-[#F3F4F5] border border-[#EDEDED]`}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="44px"
        unoptimized
        className="object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export function PropertySelector({
  listings,
  selectedListingId,
  onSelect,
  disabled = false,
  className = "",
}: PropertySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedListing = useMemo(
    () => listings.find((l) => l.id === selectedListingId) || null,
    [listings, selectedListingId],
  );

  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((l) => {
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchCity = l.city ? l.city.toLowerCase().includes(q) : false;
      const matchCountry = l.country ? l.country.toLowerCase().includes(q) : false;
      return matchTitle || matchCity || matchCountry;
    });
  }, [listings, search]);

  // Click outside listener for desktop popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearch("");
  };

  const handleSelect = (id: string | null) => {
    onSelect(id);
    closeDropdown();
  };

  return (
    <div ref={containerRef} className={`relative inline-block w-full sm:w-auto text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group flex h-11 sm:h-12 w-full sm:w-auto sm:min-w-[190px] sm:max-w-[250px] lg:min-w-[220px] lg:max-w-[300px] shrink-0 items-center justify-between gap-2.5 sm:gap-3 rounded-full border bg-white px-3 sm:px-3.5 text-left text-xs sm:text-sm font-medium transition-all shadow-2xs cursor-pointer ${isOpen
            ? "border-[#1F1F1F] ring-2 ring-[#1F1F1F]/5"
            : "border-[#D7D7D7] hover:border-[#1F1F1F]"
          } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          {/* Thumbnail / Portfolio Icon */}
          {selectedListing ? (
            <SafeListingThumbnail
              src={selectedListing.photo}
              size="size-8"
              rounded="rounded-full"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1F1F1F] text-white">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M9 22V12h6v10" />
              </svg>
            </div>
          )}

          <div className="min-w-0 flex-1 truncate">
            <p className="truncate text-xs sm:text-sm font-medium text-[#1F1F1F] lg:max-w-[170px]">
              {selectedListing ? selectedListing.title : "All listings"}
            </p>
            <p className="truncate text-xs text-[#727272] lg:max-w-[170px]">
              {selectedListing
                ? [selectedListing.city, selectedListing.country].filter(Boolean).join(", ") || "Selected property"
                : `${listings.length} ${listings.length === 1 ? "property" : "properties"} total`}
            </p>
          </div>
        </div>

        <svg
          className={`h-4 w-4 shrink-0 text-[#727272] transition-transform duration-200 ${isOpen ? "rotate-180 text-[#1F1F1F]" : "group-hover:text-[#1F1F1F]"
            }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Menu (Desktop) */}
      {isOpen && (
        <div className="absolute left-0 z-50 mt-2.5 hidden w-[420px] max-w-[calc(100vw-32px)] rounded-3xl border border-[#E5E5E5] bg-white p-3.5 shadow-2xl shadow-black/10 sm:block animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727272]">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" strokeWidth={2} />
                <path d="m21 21-4.3-4.3" strokeWidth={2} strokeLinecap="round" />
              </svg>
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, city or country…"
              className="w-full rounded-lg border border-[#ddd] bg-[#F7F7F8] py-2.5 pl-10 pr-9 text-xs sm:text-sm text-[#1F1F1F] placeholder:text-[#8E8E93] transition-colors focus:border-[#1F1F1F] focus:bg-white focus:outline-hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E5E5] text-[#1F1F1F] hover:bg-[#D7D7D7] transition-colors text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* All Listings Hero Option */}
          <div className="pb-2">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`group flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-all cursor-pointer ${selectedListingId === null
                ? "bg-[#FCDF9C] text-[#1f1f1f]"
                : "hover:bg-[#F7F7F8] text-[#1F1F1F]"
                }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${selectedListingId === null
                    ? "bg-white text-[#1F1F1F]"
                    : "bg-[#F3F4F5] text-[#1F1F1F] hover:bg-[#1f1f1f] hover:text-white"
                    }`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <path d="M9 22V12h6v10" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-medium truncate ${selectedListingId === null ? "text-[#1F1F1F]" : "text-[#1F1F1F]"
                        }`}
                    >
                      All listings
                    </p>
                    <span
                      className={`inline-flex items-center justify-center rounded-full min-w-6 min-h-6 text-[10px] font-medium ${selectedListingId === null
                        ? "bg-[#1f1f1f] text-white"
                        : "bg-[#F3F4F5] text-[#727272]"
                        }`}
                    >
                      {listings.length}
                    </span>
                  </div>
                  <p
                    className={`text-xs truncate ${selectedListingId === null ? "text-[#727272]" : "text-[#727272]"
                      }`}
                  >
                    Consolidated entire portfolio
                  </p>
                </div>
              </div>
              {selectedListingId === null && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[#1F1F1F] ml-2">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          </div>

          {/* Section Divider & Header */}
          <div className="mb-2 flex items-center justify-between border-t border-[#EDEDED] px-3 pt-3">
            <span className="text-xs font-medium text-[#727272]">
              Properties ({filteredListings.length})
            </span>
            {selectedListingId !== null && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="text-xs font-normal text-[#727272] hover:text-[#1F1F1F] underline cursor-pointer"
              >
                Reset to all
              </button>
            )}
          </div>

          {/* Individual Properties List */}
          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {filteredListings.map((listing) => {
              const isSelected = selectedListingId === listing.id;
              return (
                <button
                  key={listing.id}
                  type="button"
                  onClick={() => handleSelect(listing.id)}
                  className={`group flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition-all cursor-pointer ${isSelected
                    ? "bg-[#FCDF9C] border border-amber-200/80 text-[#1F1F1F]"
                    : "hover:bg-[#F7F7F8] text-[#1F1F1F] border border-transparent"
                    }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <SafeListingThumbnail src={listing.photo} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium truncate ${isSelected ? "text-[#1F1F1F]" : "text-[#1F1F1F] group-hover:text-black"
                          }`}
                      >
                        {listing.title}
                      </p>
                      <p className="text-xs text-[#727272] truncate">
                        {[listing.city, listing.country].filter(Boolean).join(", ") || "Active property"}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#1F1F1F] bg-white ml-2">
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}

            {filteredListings.length === 0 && (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F5] text-[#727272]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <p className="mt-2 text-xs font-semibold text-[#1F1F1F]">No properties found</p>
                <p className="text-xs text-[#727272]">Try searching by another title or city</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {isOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:hidden backdrop-blur-xs"
          onClick={() => setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl border-t border-[#E5E5E5] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom"
          >
            <div className="flex items-center justify-between pb-3">
              <div>
                <h3 className="text-base font-medium text-[#1F1F1F]">Select property</h3>
                <p className="text-xs text-[#727272]">{listings.length} properties available</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#727272] hover:bg-[#F3F4F5] hover:text-[#1F1F1F] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Mobile Search */}
            <div className="relative mb-3">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727272]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth={2} />
                  <path d="m21 21-4.3-4.3" strokeWidth={2} strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, city or country…"
                className="w-full rounded-2xl border border-[#D7D7D7] bg-[#F7F7F8] py-2.5 pl-10 pr-9 text-sm text-[#1F1F1F] focus:border-[#1F1F1F] focus:bg-white focus:outline-hidden"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E5E5] text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Mobile List */}
            <div className="flex-1 overflow-y-auto space-y-1 overscroll-contain pr-1">
              {/* All Listings Option */}
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`flex w-full items-center justify-between rounded-2xl p-3 text-left transition-colors ${selectedListingId === null ? "bg-[#1F1F1F] text-white" : "hover:bg-[#F7F7F8]"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selectedListingId === null ? "bg-white/15 text-white" : "bg-[#F3F4F5] text-[#1F1F1F]"
                      }`}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <path d="M9 22V12h6v10" />
                    </svg>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${selectedListingId === null ? "text-white" : "text-[#1F1F1F]"}`}>
                      All listings
                    </p>
                    <p className={`text-xs ${selectedListingId === null ? "text-zinc-300" : "text-[#727272]"}`}>
                      {listings.length} properties total
                    </p>
                  </div>
                </div>
                {selectedListingId === null && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#1F1F1F]">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>

              {filteredListings.map((listing) => {
                const isSelected = selectedListingId === listing.id;
                return (
                  <button
                    key={listing.id}
                    type="button"
                    onClick={() => handleSelect(listing.id)}
                    className={`flex w-full items-center justify-between rounded-2xl p-3 text-left transition-colors ${isSelected ? "bg-[#FEF9EE] border border-amber-200" : "hover:bg-[#F7F7F8]"
                      }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SafeListingThumbnail src={listing.photo} />
                      <div className="min-w-0 flex-1 truncate">
                        <p className="truncate text-sm font-semibold text-[#1F1F1F]">{listing.title}</p>
                        <p className="truncate text-xs text-[#727272]">
                          {[listing.city, listing.country].filter(Boolean).join(", ") || "Active property"}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#1F1F1F] bg-white ml-2">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
