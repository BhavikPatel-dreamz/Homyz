"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MobileDatePicker, initialDatePreferences, type DatePreferences } from "./mobile-date-picker";

const emptyMobileGuests = { adults: 0, children: 0, infants: 0, pets: 0 };
const mobileGuestRows = [
  { key: "adults", label: "Adults", description: "Ages 13 or above" },
  { key: "children", label: "Children", description: "Ages 2 – 12" },
  { key: "infants", label: "Infants", description: "Under 2" },
  { key: "pets", label: "Pets", description: "Bringing a service animal?" },
] as const;

interface HeroSectionProps {
  onSearch?: (searchParams: { destination: string; checkIn: string; checkOut: string; guests: string; datePreferences?: DatePreferences; guestDetails?: typeof emptyMobileGuests }) => void;
}

export function HeroSection({ onSearch }: HeroSectionProps) {
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [desktopPanel, setDesktopPanel] = useState<"where" | "checkIn" | "checkOut" | "who" | null>(null);
  const desktopSearchRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!desktopPanel) return;
    const dismiss = (event: PointerEvent) => {
      if (!desktopSearchRef.current?.contains(event.target as Node)) setDesktopPanel(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        desktopSearchRef.current?.querySelector<HTMLElement>('[aria-expanded="true"]')?.focus();
        setDesktopPanel(null);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [desktopPanel]);
  const [mobileGuests, setMobileGuests] = useState(emptyMobileGuests);
  const mobileGuestCount = mobileGuests.adults + mobileGuests.children;
  const mobileGuestSummary = [
    mobileGuestCount ? `${mobileGuestCount} guest${mobileGuestCount === 1 ? "" : "s"}` : "",
    mobileGuests.infants ? `${mobileGuests.infants} infant${mobileGuests.infants === 1 ? "" : "s"}` : "",
    mobileGuests.pets ? `${mobileGuests.pets} pet${mobileGuests.pets === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(", ");
  const [datePreferences, setDatePreferences] = useState<DatePreferences>(initialDatePreferences);
  const destinationListRef = useRef<HTMLDivElement>(null);
  const [destinationScroll, setDestinationScroll] = useState(0);

  // Mobile search popup state
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<"where" | "when" | "who">("where");

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("searchModal")) {
      setIsMobileSearchOpen(true);
    }
  }, []);

  // Close mobile search with Escape; ModalOverlay owns background scroll locking.
  useEffect(() => {
    if (!isMobileSearchOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSearchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleMobileSubmit();
    setDesktopPanel(null);
  };

  const handleMobileSubmit = () => {
    if (onSearch) {
      onSearch({
        destination,
        checkIn: datePreferences.mode === "dates" ? checkIn : "",
        checkOut: datePreferences.mode === "dates" ? checkOut : "",
        datePreferences,
        guests: `${mobileGuestCount} guest${mobileGuestCount === 1 ? "" : "s"}`,
        guestDetails: { ...mobileGuests },
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

  const destinationSuggestions = (
    <>
              {/* Scrollable suggestions */}
              <div className="relative flex items-center justify-between">
                <div
                  ref={destinationListRef}
                  onScroll={(event) => {
                    const list = event.currentTarget;
                    const scrollableHeight = list.scrollHeight - list.clientHeight;
                    setDestinationScroll(scrollableHeight > 0 ? (list.scrollTop / scrollableHeight) * 100 : 0);
                  }}
                  className="no-scrollbar max-h-30 w-full space-y-2.5 overflow-y-auto pr-5"
                >
                  {/* Recent searches */}
                  <button
                    type="button"
                    onClick={() => {
                      setDestination("Recent searches");
                      setActiveStep("when");
                      if (!isMobileSearchOpen) setDesktopPanel("checkIn");
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
                      if (!isMobileSearchOpen) setDesktopPanel("checkIn");
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
                      if (!isMobileSearchOpen) setDesktopPanel("checkIn");
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
                <input
                  type="range"
                  min={0}
                  max={100}
                  step="any"
                  value={destinationScroll}
                  aria-label="Scroll suggested destinations"
                  aria-orientation="vertical"
                  className="destination-scrollbar"
                  onChange={(event) => {
                    const list = destinationListRef.current;
                    if (!list) return;
                    const progress = Number(event.target.value);
                    list.scrollTop = (progress / 100) * (list.scrollHeight - list.clientHeight);
                    setDestinationScroll(progress);
                  }}
                />
              </div>
    </>
  );

  const guestOptions = (
                <div className="mt-1 divide-y divide-[#aaa]">
                  {mobileGuestRows.map(({ key, label, description }) => (
                    <div key={key} className="flex items-center justify-between gap-3 py-5 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-[15px] text-[#1f1f1f]">{label}</p>
                        <p className={`mt-1 text-[14px] leading-[1.5] text-[#777] ${key === "pets" ? "max-w-[145px] underline underline-offset-4" : ""}`}>
                          {description}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" aria-label={`Remove ${label.toLowerCase()}`}
                          disabled={mobileGuests[key] === 0}
                          onClick={() => setMobileGuests((counts) => ({ ...counts, [key]: Math.max(0, counts[key] - 1) }))}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#444] disabled:border-[#aaa] disabled:text-[#999] hover:bg-white disabled:hover:bg-transparent">
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M5 12h14" /></svg>
                        </button>
                        <span aria-live="polite" aria-label={`${label}: ${mobileGuests[key]}`} className="min-w-3 text-center text-[16px] tabular-nums">{mobileGuests[key]}</span>
                        <button type="button" aria-label={`Add ${label.toLowerCase()}`}
                          onClick={() => setMobileGuests((counts) => ({ ...counts, [key]: counts[key] + 1 }))}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#444] hover:bg-white">
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M5 12h14M12 5v14" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
  );

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
              setDesktopPanel(null);
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
      <section className="relative z-20 hidden md:flex min-h-[410px] w-full items-center rounded-[32px] bg-[#ddd] sm:min-h-[460px] lg:min-h-[512px] lg:rounded-[60px]">
        {/* Background Travel Imagery */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-[32px] lg:rounded-[60px]">
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
          <form ref={desktopSearchRef} onSubmit={handleSearchSubmit}
            className="relative grid h-[62px] w-full max-w-[768px] grid-cols-[1.28fr_1fr_1fr_1.43fr] items-center rounded-full bg-white shadow-[0_2px_7px_rgba(0,0,0,.08)]">
            <div className={`flex h-full min-w-0 flex-col justify-center rounded-full px-5 ${desktopPanel === "where" ? "bg-[#fcdf9c]" : ""}`}>
              <label htmlFor="desktop-destination" className="text-[16px] leading-5">Where</label>
              <input id="desktop-destination" type="text" placeholder="Search destinations" value={destination}
                aria-controls="desktop-search-panel"
                onFocus={() => setDesktopPanel("where")} onClick={() => setDesktopPanel("where")}
                onChange={(event) => setDestination(event.target.value)}
                className="w-full truncate bg-transparent text-[14px] text-[#727272] outline-none" />
            </div>
            {(["checkIn", "checkOut"] as const).map((field) => (
              <button key={field} type="button" aria-expanded={desktopPanel === field} aria-controls="desktop-search-panel"
                onClick={() => setDesktopPanel(desktopPanel === field ? null : field)}
                className={`h-full min-w-0 rounded-full px-4 text-left ${desktopPanel === field ? "bg-[#fcdf9c]" : "hover:bg-[#f3f4f5]"}`}>
                <span className="block text-[16px] leading-5">{field === "checkIn" ? "Check in" : "Check out"}</span>
                <span className="block truncate text-[14px] text-[#727272]">
                  {datePreferences.mode !== "dates" ? "Flexible dates" : (field === "checkIn" ? checkIn : checkOut) || "Add dates"}
                </span>
              </button>
            ))}
            <div className="flex h-full min-w-0 items-center pr-2">
              <button type="button" aria-expanded={desktopPanel === "who"} aria-controls="desktop-search-panel"
                onClick={() => setDesktopPanel(desktopPanel === "who" ? null : "who")}
                className={`h-full min-w-0 flex-1 rounded-full px-4 text-left ${desktopPanel === "who" ? "bg-[#fcdf9c]" : "hover:bg-[#f3f4f5]"}`}>
                <span className="block text-[16px] leading-5">Who</span>
                <span className="block truncate text-[14px] text-[#727272]">{mobileGuestSummary || "Add guests"}</span>
              </button>
              <button type="submit" aria-label="Search" className="ml-1 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#fcdf9c] hover:bg-[#f3cf77]">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-[22px] w-[22px]">
                  <circle cx="10.75" cy="10.75" r="6.75" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m15.75 15.75 4.25 4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {desktopPanel && (
              <div id="desktop-search-panel" role="region" aria-label={desktopPanel === "where" ? "Suggested destinations" : desktopPanel === "who" ? "Guests" : "Choose dates"}
                className={`absolute top-full z-50 mt-3 max-h-[min(600px,70dvh)] max-w-full overflow-y-auto rounded-[22px] border border-white bg-white p-5 shadow-xl ${desktopPanel === "where" ? "left-0 w-[340px]" : desktopPanel === "who" ? "right-0 w-[360px]" : "left-0 w-[600px]"}`}>
                {desktopPanel === "where" ? <>
                  <p className="mb-3 text-[12px] text-[#717171]">Suggested destinations</p>
                  {destinationSuggestions}
                </> : desktopPanel === "who" ? guestOptions : (
                  <MobileDatePicker desktop checkIn={checkIn} checkOut={checkOut}
                    selectionTarget={desktopPanel === "checkOut" ? "checkOut" : "checkIn"}
                    onDatesChange={(start, end) => {
                      setCheckIn(start); setCheckOut(end);
                      if (start && !end) setDesktopPanel("checkOut");
                    }} preferences={datePreferences} onPreferencesChange={setDatePreferences} />
                )}
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Mobile Search Popup Modal */}
      {isMobileSearchOpen && (
        <ModalOverlay
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
            {activeStep !== "where" ? (
              <button type="button" onClick={() => setActiveStep("where")} aria-expanded={false}
                className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-white bg-[#f3f4f5] px-5 py-4 text-left">
                <span className="text-[14px]">Where</span>
                <span className="truncate text-[17px] font-semibold">{destination || "I’m flexible"}</span>
              </button>
            ) : (
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

              {destinationSuggestions}

            </div>

            )}

            {/* When Section */}
            <div className="mt-3 rounded-[22px] border border-white bg-[#f3f4f5] p-3">
              <button type="button" aria-expanded={activeStep === "when"}
                className={`flex w-full items-center justify-between gap-2 text-left ${activeStep === "when" ? "mb-4 px-1 pt-1" : "px-2 py-1"}`}
                onClick={() => setActiveStep(activeStep === "when" ? "where" : "when")}>
                <span className={activeStep === "when" ? "text-[20px] font-semibold" : "text-[14px]"}>{activeStep === "when" ? "When?" : "When"}</span>
                {activeStep !== "when" && <span className="text-right text-[15px] font-semibold">
                  {datePreferences.mode !== "dates"
                    ? `${datePreferences.mode === "flexible" ? datePreferences.stay + " · " : ""}${datePreferences.months.length ? datePreferences.months.map((month) => new Date(month + "-01T00:00:00").toLocaleDateString("en-US", { month: "short" })).join(", ") : "Anytime"}`
                    : checkIn ? `${new Date(checkIn + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}${checkOut ? " – " + new Date(checkOut + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : " – Add checkout"}` : "Add dates"}
                </span>}
              </button>
              {activeStep === "when" && <MobileDatePicker checkIn={checkIn} checkOut={checkOut}
                onDatesChange={(start, end) => { setCheckIn(start); setCheckOut(end); }}
                preferences={datePreferences} onPreferencesChange={setDatePreferences} />}
            </div>

            {/* Who Section */}
            <div className="mt-3 rounded-[22px] border border-white bg-[#f3f4f5] px-4 py-4">
              <button type="button" aria-expanded={activeStep === "who"}
                aria-controls="mobile-guest-options"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setActiveStep(activeStep === "who" ? "where" : "who")}>
                <span className={activeStep === "who" ? "text-[20px] font-semibold" : "text-[14px]"}>
                  {activeStep === "who" ? "Who?" : "Who"}
                </span>
                {activeStep !== "who" && <span className="text-right text-[15px] font-semibold">
                  {mobileGuestSummary || "Add guests"}
                </span>}
              </button>
              {activeStep === "who" && (
                <div id="mobile-guest-options">{guestOptions}</div>
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
                  setMobileGuests(emptyMobileGuests);
                  setDatePreferences(initialDatePreferences);
                  setDestinationScroll(0);
                  setActiveStep("where");
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
        </ModalOverlay>
      )}
    </>
  );
}
