"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface HeroSectionProps {
  onSearch?: (searchParams: { destination: string; checkIn: string; checkOut: string; guests: string }) => void;
}

export function HeroSection({ onSearch }: HeroSectionProps) {
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestPickerOpen, setGuestPickerOpen] = useState(false);
  const [guestCount, setGuestCount] = useState(1);

  // Mobile search popup state
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<"where" | "when" | "who">("where");

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("searchModal")) {
      setIsMobileSearchOpen(true);
    }
  }, []);

  // Prevent body and html scroll when mobile search modal is open
  useEffect(() => {
    if (!isMobileSearchOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSearchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        destination,
        checkIn,
        checkOut,
        guests: `${guestCount} guest${guestCount > 1 ? "s" : ""}`,
      });
    }
  };

  const handleMobileSubmit = () => {
    if (onSearch) {
      onSearch({
        destination,
        checkIn,
        checkOut,
        guests: `${guestCount} guest${guestCount > 1 ? "s" : ""}`,
      });
    }
    setIsMobileSearchOpen(false);
  };

  const handleMobileNext = () => {
    if (activeStep === "where") {
      setActiveStep("when");
    } else if (activeStep === "when") {
      setActiveStep("who");
    } else {
      handleMobileSubmit();
    }
  };

  return (
    <>
      {/* Mobile Hero Section (screens < md) */}
      <div className="block md:hidden w-full">
        {/* Top Image Card */}
        <div className="relative aspect-[358/512] w-full overflow-hidden rounded-[28px] bg-[#e5e5e5] shadow-xs">
          <Image
            src="/images/home/hero.png"
            alt="Traveler with backpack planning journey"
            fill
            priority
            className="object-cover object-[center_12%]"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        </div>

        {/* Heading */}
        <div className="mt-6">
          <h1 className="text-[28px] font-normal leading-[1.18] tracking-[-0.6px] text-[#1f1f1f]">
            Book cozy stays<br />
            <span className="font-medium">that feel like home</span>
          </h1>
        </div>

        {/* Start your search bar */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => {
              setActiveStep("where");
              setIsMobileSearchOpen(true);
            }}
            className="flex h-[56px] w-full items-center justify-between rounded-full bg-[#f3f4f6] pl-6 pr-2 shadow-xs transition-transform active:scale-[0.99] cursor-pointer"
            aria-label="Start your search"
          >
            <span className="text-base font-medium text-[#1f1f1f]">
              {destination || "Start your search"}
            </span>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FCDF9C] text-[#1f1f1f]">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4.5 w-4.5"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Desktop / Tablet Hero Section (screens >= md) */}
      <section className="relative hidden md:flex min-h-[410px] w-full items-center overflow-hidden rounded-[32px] bg-[#ddd] sm:min-h-[460px] lg:min-h-[512px] lg:rounded-[60px]">
        {/* Background Travel Imagery */}
        <div className="absolute inset-0 z-0">
          <Image
            alt="Traveler with backpack planning journey"
            className="object-cover"
            src="/images/home/hero-banner.png"
            fill
            sizes="(min-width: 1024px) 1520px, 100vw"
            priority
          />
        </div>

        {/* Hero Content & Search Bar */}
        <div className="relative z-10 w-full px-7 sm:px-12 lg:px-8 xl:px-8">
          <h1 className="mb-11 text-[34px] font-normal leading-[1.12] tracking-[-1.4px] text-[#1f1f1f] sm:text-[42px] lg:text-[50px] lg:leading-[1.08] xl:text-[52px]">
            Book cozy stays<br />
            <span className="font-semibold">that feel like home</span>
          </h1>

          {/* Floating Search Container */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative grid h-[62px] w-full max-w-[768px] grid-cols-[1.28fr_1fr_1fr_1.43fr] items-center rounded-full bg-white shadow-[0_2px_7px_rgba(0,0,0,.08)] lg:grid-cols-[205px_161px_170px_1fr]"
          >
            {/* Where */}
            <div className="min-w-0 cursor-pointer pl-6 pr-3 lg:pl-[33px]">
              <span className="block text-[16px] font-normal leading-[20px] text-[#1f1f1f]">Where</span>
              <input
                className="mt-px w-full truncate border-none bg-transparent p-0 text-[14px] leading-[20px] text-[#727272] placeholder-[#727272] focus:outline-none focus:ring-0"
                placeholder="Search destinations"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>

            {/* Check in */}
            <div className="relative min-w-0 cursor-pointer pl-6 pr-3 before:absolute before:left-0 before:top-1/2 before:h-8 before:w-px before:-translate-y-1/2 before:bg-[#e3e3e3] lg:pl-[54px]">
              <span className="block text-[16px] font-normal leading-[20px] text-[#1f1f1f]">Check in</span>
              <input
                type="date"
                aria-label="Check in date"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
              <span className="mt-px block truncate text-[14px] leading-[20px] text-[#727272]">
                {checkIn || "Add dates"}
              </span>
            </div>

            {/* Check out */}
            <div className="relative min-w-0 cursor-pointer pl-6 pr-3 before:absolute before:left-0 before:top-1/2 before:h-8 before:w-px before:-translate-y-1/2 before:bg-[#e3e3e3] lg:pl-[42px]">
              <span className="block text-[16px] font-normal leading-[20px] text-[#1f1f1f]">Check out</span>
              <input
                type="date"
                aria-label="Check out date"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
              <span className="mt-px block truncate text-[14px] leading-[20px] text-[#727272]">
                {checkOut || "Add dates"}
              </span>
            </div>

            {/* Who & Search Action */}
            <div className="relative flex min-w-0 items-center justify-between pl-5 before:absolute before:left-0 before:top-1/2 before:h-8 before:w-px before:-translate-y-1/2 before:bg-[#e3e3e3] lg:pl-[30px]">
              <div
                className="cursor-pointer"
                onClick={() => setGuestPickerOpen(!guestPickerOpen)}
              >
                <span className="block text-[16px] font-normal leading-[20px] text-[#1f1f1f]">Who</span>
                <span className="mt-px block truncate text-[14px] leading-[20px] text-[#727272]">
                  {guestCount === 1 ? "Add guests" : `${guestCount} guests`}
                </span>
              </div>

              {/* Search circle icon */}
              <button
                type="submit"
                aria-label="Search"
                className="ml-2 mr-2 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#fcdf9c] text-[#1f1f1f] transition hover:bg-[#f3cf77] lg:mr-[25px]"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-[22px] w-[22px]"
                >
                  <circle cx="10.75" cy="10.75" r="6.75" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m15.75 15.75 4.25 4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Guest counter popover */}
              {guestPickerOpen && (
                <div className="absolute right-0 top-full mt-3 w-56 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl z-50 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#1F1F1F]">Guests</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={guestCount <= 1}
                        onClick={() => setGuestCount((prev) => Math.max(1, prev - 1))}
                        className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-xs font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="text-xs font-semibold text-gray-900">{guestCount}</span>
                      <button
                        type="button"
                        onClick={() => setGuestCount((prev) => prev + 1)}
                        className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Mobile Search Popup Modal */}
      {isMobileSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[74px] pb-6 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
          onClick={() => setIsMobileSearchOpen(false)}
        >
          <div
            className="relative w-full max-w-[365px] rounded-[28px] bg-[#D9D9D9] p-4 pt-3 pb-5 shadow-[0_12px_40px_rgba(0,0,0,0.16)] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button at top right */}
            <div className="flex justify-end mb-1.5">
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#1f1f1f] hover:bg-black/10 transition-colors cursor-pointer"
                aria-label="Close search"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4.5 w-4.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Where? Card */}
            <div className="rounded-[22px] bg-white p-4 shadow-xs">
              <h3 className="text-[19px] font-semibold text-[#1f1f1f] mb-3">Where?</h3>

              {/* Search input pill */}
              <div className="flex items-center justify-between rounded-full border border-[#ececec] bg-white pl-4 pr-1.5 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-3 transition-colors">
                <input
                  type="text"
                  placeholder="Search destinations"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleMobileSubmit();
                    }
                  }}
                  className="w-full bg-transparent text-[14px] text-[#1f1f1f] placeholder-[#717171] focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleMobileSubmit}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FCDF9C] text-[#1f1f1f] transition-transform active:scale-95 cursor-pointer hover:brightness-95"
                  aria-label="Search"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </button>
              </div>

              <p className="text-[12px] font-medium text-[#717171] mb-2.5">Sugested destinations</p>

              {/* Suggestions with scrollbar accent */}
              <div className="relative flex items-center justify-between">
                <div className="w-full space-y-2.5 pr-2">
                  {/* Recent searches */}
                  <button
                    type="button"
                    onClick={() => {
                      setDestination("Recent searches");
                      setActiveStep("when");
                    }}
                    className="flex w-full items-center gap-3 text-left group cursor-pointer transition-opacity hover:opacity-80"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#1f1f1f]">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M12 3a2 2 0 0 0-2 2v6.5a1.5 1.5 0 0 1-3 0V9a1 1 0 0 0-2 0v5a6 6 0 0 0 12 0v-4a1 1 0 0 0-2 0v2.5a1.5 1.5 0 0 1-3 0V6a1 1 0 0 0-2 0" />
                        <path d="M6 17h11" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-[#1f1f1f]">Recent searches</div>
                      <div className="text-[12px] text-[#717171]">find what&apos;s around you</div>
                    </div>
                  </button>

                  {/* Nearby */}
                  <button
                    type="button"
                    onClick={() => {
                      setDestination("Nearby");
                      setActiveStep("when");
                    }}
                    className="flex w-full items-center gap-3 text-left group cursor-pointer transition-opacity hover:opacity-80"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#1f1f1f]">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-[#1f1f1f]">Nearby</div>
                      <div className="text-[12px] text-[#717171]">find what&apos;s around you</div>
                    </div>
                  </button>

                  {/* Suggested destinations */}
                  <button
                    type="button"
                    onClick={() => {
                      setDestination("Suggested destinations");
                      setActiveStep("when");
                    }}
                    className="flex w-full items-center gap-3 text-left group cursor-pointer transition-opacity hover:opacity-80"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#1f1f1f]">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M12 2a6 6 0 0 0-6 6c0 4.5 6 11 6 11s6-6.5 6-11a6 6 0 0 0-6-6z" />
                        <circle cx="12" cy="8" r="2" />
                        <path d="M6 19a7 7 0 0 0 12 0" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-[#1f1f1f]">Suggested destinations</div>
                      <div className="text-[12px] text-[#717171]">find what&apos;s around you</div>
                    </div>
                  </button>
                </div>

                {/* Vertical scrollbar indicator matching design */}
                <div className="h-24 w-[2px] shrink-0 rounded-full bg-[#e5e5e5] relative self-center">
                  <div className="h-9 w-[2px] rounded-full bg-[#eba900]" />
                </div>
              </div>
            </div>

            {/* When Section */}
            <div className="mt-3 rounded-[20px] bg-white px-5 py-3.5 shadow-xs">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setActiveStep(activeStep === "when" ? "where" : "when")}
              >
                <span className="text-[14px] text-[#1f1f1f] font-normal">When</span>
                <span className="text-[15px] text-[#1f1f1f] font-semibold">
                  {checkIn && checkOut ? `${checkIn} - ${checkOut}` : "Add dates"}
                </span>
              </div>
              {activeStep === "when" && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 animate-in fade-in">
                  <div>
                    <label className="block text-[11px] text-[#717171] mb-1">Check in</label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full text-[12px] p-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#717171] mb-1">Check out</label>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full text-[12px] p-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Who Section */}
            <div className="mt-3 rounded-[20px] bg-white px-5 py-3.5 shadow-xs">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setActiveStep(activeStep === "who" ? "where" : "who")}
              >
                <span className="text-[14px] text-[#1f1f1f] font-normal">Who</span>
                <span className="text-[15px] text-[#1f1f1f] font-semibold">
                  {guestCount === 1 ? "Add guests" : `${guestCount} guests`}
                </span>
              </div>
              {activeStep === "who" && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between animate-in fade-in">
                  <span className="text-[13px] text-[#1f1f1f]">Guests</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={guestCount <= 1}
                      onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
                      className="h-7 w-7 rounded-full border border-gray-300 flex items-center justify-center text-sm disabled:opacity-40 hover:bg-gray-100 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-sm font-semibold">{guestCount}</span>
                    <button
                      type="button"
                      onClick={() => setGuestCount((c) => c + 1)}
                      className="h-7 w-7 rounded-full border border-gray-300 flex items-center justify-center text-sm hover:bg-gray-100 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="mt-5 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => {
                  setDestination("");
                  setCheckIn("");
                  setCheckOut("");
                  setGuestCount(1);
                }}
                className="text-[15px] font-semibold underline text-[#1f1f1f] cursor-pointer hover:opacity-75"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={handleMobileNext}
                className="rounded-full bg-[#1f1f1f] px-8 py-3 text-[14px] font-medium text-white transition-colors hover:bg-black cursor-pointer shadow-sm active:scale-95"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
