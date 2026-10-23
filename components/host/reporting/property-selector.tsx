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
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-zinc-900 shadow-2xs transition-all hover:border-zinc-400 focus:border-zinc-950 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[220px] sm:max-w-[280px]"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Thumbnail / Icon */}
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-200/60">
            {selectedListing?.photo ? (
              <Image
                src={selectedListing.photo}
                alt={selectedListing.title}
                fill
                sizes="28px"
                className="object-cover"
              />
            ) : (
              <span className="text-sm">🏠</span>
            )}
          </div>

          <div className="min-w-0 flex-1 truncate">
            <p className="truncate text-xs font-bold text-zinc-950">
              {selectedListing ? selectedListing.title : "All listings"}
            </p>
            <p className="truncate text-[10px] text-zinc-500">
              {selectedListing
                ? selectedListing.city || selectedListing.country || "Property"
                : `${listings.length} ${listings.length === 1 ? "property" : "properties"}`}
            </p>
          </div>
        </div>

        <svg
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180 text-zinc-900" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Menu (Desktop) */}
      {isOpen && (
        <div className="absolute left-0 z-40 mt-2 hidden w-80 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl ring-1 ring-black/5 sm:block">
          {/* Search Header */}
          <div className="relative mb-2 px-1 pt-1">
            <svg
              className="pointer-events-none absolute left-3.5 top-3.5 h-3.5 w-3.5 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search property or city..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100">
            {/* All Listings Option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors hover:bg-zinc-100 ${
                selectedListingId === null ? "bg-zinc-100/90 font-bold text-zinc-950" : "text-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-sm">
                  🏢
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">All listings</p>
                  <p className="text-[10px] text-zinc-500">{listings.length} properties total</p>
                </div>
              </div>
              {selectedListingId === null && <span className="text-xs text-zinc-950 font-bold">✓</span>}
            </button>

            {/* Individual Properties */}
            {filteredListings.map((listing) => {
              const isSelected = selectedListingId === listing.id;
              return (
                <button
                  key={listing.id}
                  type="button"
                  onClick={() => handleSelect(listing.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors hover:bg-zinc-100 ${
                    isSelected ? "bg-zinc-100/90 font-bold text-zinc-950" : "text-zinc-700"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-200/60">
                      {listing.photo ? (
                        <Image
                          src={listing.photo}
                          alt={listing.title}
                          fill
                          sizes="28px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-sm">🏠</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 truncate">
                      <p className="truncate font-semibold text-zinc-900">{listing.title}</p>
                      <p className="truncate text-[10px] text-zinc-500">
                        {[listing.city, listing.country].filter(Boolean).join(", ") || "Active property"}
                      </p>
                    </div>
                  </div>
                  {isSelected && <span className="ml-2 text-xs text-zinc-950 font-bold">✓</span>}
                </button>
              );
            })}

            {filteredListings.length === 0 && (
              <p className="py-4 text-center text-xs text-zinc-400">No properties matching &quot;{search}&quot;</p>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {isOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:hidden"
          onClick={() => setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-zinc-200 bg-white p-5 shadow-2xl animate-in slide-in-from-bottom"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-300" />
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-base font-bold text-zinc-950">Select property</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            {/* Mobile Search */}
            <div className="relative my-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search property or city..."
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50/70 p-2.5 text-sm text-zinc-900 focus:border-zinc-950 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Mobile List */}
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-zinc-100">
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`flex w-full items-center justify-between py-3 text-left ${
                  selectedListingId === null ? "font-bold text-zinc-950" : "text-zinc-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏢</span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">All listings</p>
                    <p className="text-xs text-zinc-500">{listings.length} properties total</p>
                  </div>
                </div>
                {selectedListingId === null && <span className="text-zinc-950 font-bold">✓</span>}
              </button>

              {filteredListings.map((listing) => (
                <button
                  key={listing.id}
                  type="button"
                  onClick={() => handleSelect(listing.id)}
                  className={`flex w-full items-center justify-between py-3 text-left ${
                    selectedListingId === listing.id ? "font-bold text-zinc-950" : "text-zinc-700"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
                      {listing.photo ? (
                        <Image
                          src={listing.photo}
                          alt={listing.title}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-base">🏠</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 truncate">
                      <p className="truncate text-sm font-semibold text-zinc-900">{listing.title}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {[listing.city, listing.country].filter(Boolean).join(", ") || "Active property"}
                      </p>
                    </div>
                  </div>
                  {selectedListingId === listing.id && <span className="text-zinc-950 font-bold">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
