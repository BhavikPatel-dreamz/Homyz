"use client";

import React, { useState } from "react";
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

  return (
    <section className="relative flex min-h-[410px] w-full items-center overflow-hidden rounded-[32px] bg-[#ddd] sm:min-h-[460px] lg:min-h-[512px] lg:rounded-[60px]">
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
  );
}
