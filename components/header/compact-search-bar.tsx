"use client";

import React from "react";
import Image from "next/image";
import { useHeaderSearch } from "./header-search-context";

export function CompactSearchBar() {
  const {
    compactDestination,
    compactDates,
    compactGuests,
    setIsExpanded,
    setActiveField,
    setIsMobileSearchOpen,
  } = useHeaderSearch();

  const handleOpenDesktop = (field: "where" | "when" | "who") => {
    setIsExpanded(true);
    setActiveField(field);
  };

  return (
    <>
      {/* Desktop & Tablet Compact Search Pill (screens >= md) */}
      <div className="hidden h-[46px] min-w-0 max-w-[calc(100vw-22rem)] items-center rounded-full border border-zinc-200 bg-white py-1 pl-4 pr-1.5 text-sm shadow-[0_3px_10px_rgba(0,0,0,0.13)] transition-shadow duration-200 hover:shadow-md md:flex lg:max-w-[540px]">
        {/* Destination segment */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDesktop("where");
          }}
          className="flex min-w-0 max-w-[170px] items-center gap-2 truncate rounded-full py-2 pr-4 font-medium text-[#1F1F1F] transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 lg:max-w-[195px]"
        >
          <Image src="/images/icons/house.svg" alt="" width={20} height={20} className="size-5 shrink-0 opacity-75" />
          <span className="truncate" title={compactDestination}>{compactDestination}</span>
        </button>

        <span className="h-5 w-px shrink-0 bg-zinc-200" aria-hidden="true" />

        {/* Dates segment */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDesktop("when");
          }}
          className="shrink-0 rounded-full px-4 py-2 font-medium whitespace-nowrap text-[#1F1F1F] transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {compactDates}
        </button>

        <span className="h-5 w-px shrink-0 bg-zinc-200" aria-hidden="true" />

        {/* Guests segment */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDesktop("who");
          }}
          className="max-w-[118px] shrink truncate rounded-full px-4 py-2 text-left font-medium text-[#1F1F1F] transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <span title={compactGuests}>{compactGuests}</span>
        </button>

        {/* Search Icon Circle Button */}
        <button
          type="button"
          aria-label="Search"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDesktop("where");
          }}
          className="ml-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e31c5f] text-white shadow-sm transition-colors duration-200 hover:bg-[#c91550] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e31c5f] focus-visible:ring-offset-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-3.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </div>

      {/* Mobile Compact Search Pill (screens < md) */}
      <div className="block md:hidden w-full max-w-full px-2">
        <button
          type="button"
          onClick={() => setIsMobileSearchOpen(true)}
          className="w-full flex items-center justify-between h-12 rounded-full border border-zinc-200/90 bg-white px-3.5 shadow-xs active:scale-[0.99] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <div className="text-left min-w-0">
              <p className="text-xs font-medium text-[#1F1F1F] truncate">{compactDestination}</p>
              <p className="text-[11px] text-zinc-500 truncate">{`${compactDates} · ${compactGuests}`}</p>
            </div>
          </div>

          <div className="size-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 shrink-0 ml-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
              <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
            </svg>
          </div>
        </button>
      </div>
    </>
  );
}
