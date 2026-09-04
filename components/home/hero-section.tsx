"use client";

import React, { useState } from "react";

interface HeroSectionProps {
  onSearch?: (searchParams: { destination: string; checkIn: string; checkOut: string; guests: string }) => void;
}

export function HeroSection({ onSearch }: HeroSectionProps) {
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("");
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

  const heroImageSrc =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuA3K20jRjftudCWIxrnFB1dOlEUg02ooujonniMoGsObE7lzbLhZIcUnNaeGBKeJkG5GHvicSvrvyxxOIEYC-wv8-BKtO-44IIkJ7MZy6vDtrNpZEjFVTaQ1F3zUhTHwoHyrtSl57T5McMMZLpWGKNrwbTLGDOt8XghJCTaQ32qvTde9M00arFt4dbWIcGCHhAL2J4JEKJrkUBG5HzRSPtMh6jnXv8vAr88yMybK1WiV9ci6WgOcLOu7Q";

  return (
    <section className="relative w-full rounded-3xl overflow-hidden bg-[#D3D3D3] min-h-[380px] lg:min-h-[460px] flex items-center shadow-inner">
      {/* Background Travel Imagery */}
      <div className="absolute inset-0 z-0">
        <img
          alt="Traveler with backpack planning journey"
          className="w-full h-full object-cover object-[right_center] opacity-90 brightness-[0.98]"
          src={heroImageSrc}
        />
        {/* Gradient Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#E3DCD5]/95 via-[#E3DCD5]/70 to-transparent"></div>
      </div>

      {/* Hero Content & Search Bar */}
      <div className="relative z-10 p-8 sm:p-12 lg:p-16 max-w-2xl">
        <h1 className="mb-8 tracking-tight text-gray-900">
          Book cozy stays<br />
          <span>that feel like home</span>
        </h1>

        {/* Floating Search Container */}
        <form
          onSubmit={handleSearchSubmit}
          className="bg-white/95 backdrop-blur-md p-2 rounded-full shadow-lg border border-gray-200/80 flex items-center divide-x divide-gray-200 max-w-xl relative"
        >
          {/* Where */}
          <div className="px-5 py-1.5 flex-1 min-w-[110px] cursor-pointer">
            <span className="block text-xs font-bold text-gray-800 leading-none">Where</span>
            <input
              className="w-full p-0 text-xs text-gray-600 placeholder-gray-400 bg-transparent border-none focus:ring-0 focus:outline-none truncate font-medium mt-0.5"
              placeholder="Search destinations"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          {/* Check in */}
          <div className="px-4 py-1.5 flex-1 min-w-[95px] cursor-pointer relative">
            <span className="block text-xs font-bold text-gray-800 leading-none">Check in</span>
            <input
              type="date"
              className="w-full p-0 text-xs text-gray-500 bg-transparent border-none focus:ring-0 focus:outline-none truncate mt-0.5 cursor-pointer font-medium"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              placeholder="Add dates"
            />
          </div>

          {/* Check out */}
          <div className="px-4 py-1.5 flex-1 min-w-[95px] cursor-pointer relative">
            <span className="block text-xs font-bold text-gray-800 leading-none">Check out</span>
            <input
              type="date"
              className="w-full p-0 text-xs text-gray-500 bg-transparent border-none focus:ring-0 focus:outline-none truncate mt-0.5 cursor-pointer font-medium"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              placeholder="Add dates"
            />
          </div>

          {/* Who & Search Action */}
          <div className="pl-4 pr-1.5 py-1 flex items-center justify-between flex-1 min-w-[120px] relative">
            <div
              className="cursor-pointer"
              onClick={() => setGuestPickerOpen(!guestPickerOpen)}
            >
              <span className="block text-xs font-bold text-gray-800 leading-none">Who</span>
              <span className="block text-xs text-gray-500 truncate mt-0.5 font-medium">
                {guestCount === 1 ? "1 guest" : `${guestCount} guests`}
              </span>
            </div>

            {/* Search circle icon */}
            <button
              type="submit"
              aria-label="Search"
              className="w-10 h-10 rounded-full bg-[#EAB308] hover:bg-[#CA8A04] flex items-center justify-center text-white shadow-sm transition ml-2 flex-shrink-0 cursor-pointer"
            >
              <i className="fa-solid fa-magnifying-glass text-sm"></i>
            </button>

            {/* Guest counter popover */}
            {guestPickerOpen && (
              <div className="absolute right-0 top-full mt-3 w-56 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl z-50 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">Guests</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={guestCount <= 1}
                      onClick={() => setGuestCount((prev) => Math.max(1, prev - 1))}
                      className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-xs font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      -
                    </button>
                    <span className="text-xs font-semibold text-gray-900">{guestCount}</span>
                    <button
                      type="button"
                      onClick={() => setGuestCount((prev) => prev + 1)}
                      className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-xs font-bold text-gray-700 hover:bg-gray-100"
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
