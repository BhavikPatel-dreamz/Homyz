"use client";

import React from "react";

interface StepStandoutIntroProps {
  onBack: () => void;
  onNext: () => void;
}

export function StepStandoutIntro({ onBack, onNext }: StepStandoutIntroProps) {
  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center my-auto">
        
        {/* Left Column: Step 2 Badge, Title & Subtitle */}
        <div className="lg:col-span-6 flex flex-col justify-center max-w-xl">
          <div className="mb-6">
            <span className="inline-flex items-center rounded-full border border-zinc-300 px-4 py-1 text-xs font-semibold text-zinc-700 bg-white shadow-2xs">
              Step 2
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-zinc-900 tracking-tight leading-[1.15] mb-6">
            Make your place <br />
            to stand out
          </h1>
          <p className="text-base font-medium text-zinc-500 leading-relaxed">
            Lorem ipsum non diam posuere malesuada nisl urna pharetra feugiat nisi a amet at pretium nam ac magna fermentum in.
          </p>
        </div>

        {/* Right Column: Cozy Room Interior Vector Illustration with Floating Accent Blobs */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end w-full relative">
          
          {/* Top-Left Floating Accent Shapes */}
          <div className="absolute -top-6 left-12 lg:left-24 z-10 flex gap-2">
            <div className="w-6 h-10 rounded-full bg-[#FCDF9C] transform -rotate-45" />
            <div className="w-4 h-6 rounded-full bg-[#FCDF9C] transform rotate-12 mt-4" />
          </div>

          {/* Main Illustration Container */}
          <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-zinc-100 bg-[#5C93A4] relative z-0">
            <svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
              {/* Teal Blue Wall Background */}
              <rect width="400" height="400" fill="#5C93A4" />

              {/* Diagonal Light Rays & Shadow Strokes */}
              <path d="M 0 0 L 260 0 L 150 400 L 0 400 Z" fill="white" fillOpacity="0.12" />
              <path d="M 200 0 L 360 0 L 250 400 L 90 400 Z" fill="white" fillOpacity="0.08" />

              {/* Floor Baseboard & Floorboard */}
              <rect y="335" width="400" height="65" fill="#4B7E8F" />
              <rect y="330" width="400" height="5" fill="#E2EFF3" fillOpacity="0.35" />

              {/* Wooden Side Table (Left Side) */}
              <line x1="75" y1="260" x2="60" y2="350" stroke="#8C6345" strokeWidth="5.5" strokeLinecap="round" />
              <line x1="110" y1="260" x2="100" y2="350" stroke="#724E33" strokeWidth="5" strokeLinecap="round" />
              <line x1="145" y1="260" x2="155" y2="350" stroke="#8C6345" strokeWidth="5.5" strokeLinecap="round" />
              <ellipse cx="110" cy="255" rx="55" ry="10" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="2" />

              {/* Plants on Side Table */}
              <rect x="75" y="240" width="16" height="15" rx="3" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="1.5" />
              <path d="M 83 240 Q 75 220 70 215 M 83 240 Q 88 218 92 215" stroke="#388E3C" strokeWidth="3" strokeLinecap="round" />
              
              <rect x="98" y="235" width="20" height="20" rx="4" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="1.5" />
              <path d="M 108 235 Q 100 205 92 200 Q 108 215 108 235 Z" fill="#2E7D32" />
              <path d="M 108 235 Q 116 205 124 200 Q 108 215 108 235 Z" fill="#4CAF50" />

              {/* Coffee Cup on Side Table */}
              <rect x="126" y="244" width="12" height="11" rx="2" fill="#FFFFFF" stroke="#D32F2F" strokeWidth="1.5" />
              <path d="M 138 247 C 142 247 142 252 138 252" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />

              {/* Large Leafy Plant behind Table */}
              <path d="M 45 270 Q 10 180 30 140 Q 55 175 52 270 Z" fill="#1B5E20" />
              <path d="M 50 270 Q 25 150 70 120 Q 75 160 55 270 Z" fill="#2E7D32" />
              <path d="M 55 270 Q 60 170 110 145 Q 95 185 58 270 Z" fill="#4CAF50" />
              <path d="M 52 270 Q 80 200 135 185 Q 110 220 56 270 Z" fill="#81C784" />

              {/* Modern Armchair (Right Side) */}
              {/* Chair Wooden Legs */}
              <line x1="225" y1="300" x2="210" y2="355" stroke="#8C6345" strokeWidth="7" strokeLinecap="round" />
              <line x1="335" y1="300" x2="350" y2="355" stroke="#8C6345" strokeWidth="7" strokeLinecap="round" />
              <line x1="260" y1="300" x2="250" y2="350" stroke="#724E33" strokeWidth="6" strokeLinecap="round" />
              <line x1="305" y1="300" x2="315" y2="350" stroke="#724E33" strokeWidth="6" strokeLinecap="round" />

              {/* Chair White Cushioned Frame */}
              <path d="M 220 220 C 220 190 340 190 340 220 L 345 300 C 345 315 215 315 215 300 Z" fill="#F8F8F5" />
              <path d="M 230 200 L 235 300" stroke="#E5E5E0" strokeWidth="2" />
              <path d="M 330 200 L 325 300" stroke="#E5E5E0" strokeWidth="2" />

              {/* Armrests */}
              <rect x="205" y="245" width="32" height="16" rx="8" fill="#E8E8E0" stroke="#D0D0C8" strokeWidth="2" />
              <rect x="325" y="245" width="32" height="16" rx="8" fill="#E8E8E0" stroke="#D0D0C8" strokeWidth="2" />

              {/* Seat Cushion */}
              <rect x="220" y="275" width="120" height="30" rx="10" fill="#FFFFFF" stroke="#E0E0DB" strokeWidth="2" />

              {/* Yellow Throw Cushion */}
              <path d="M 285 235 C 285 225 325 225 325 235 L 330 280 L 280 280 Z" fill="#FBC02D" />
              {/* White Back Pillow */}
              <path d="M 255 245 C 255 235 295 235 295 245 L 300 280 L 250 280 Z" fill="#FFF9C4" opacity="0.95" />
            </svg>
          </div>

          {/* Bottom-Right Floating Accent Shapes */}
          <div className="absolute -bottom-6 right-10 z-10 flex gap-2">
            <div className="w-4 h-6 rounded-full bg-[#FCDF9C] transform rotate-45" />
            <div className="w-6 h-10 rounded-full bg-[#FCDF9C] transform -rotate-12 mt-2" />
          </div>

        </div>

      </div>

      {/* Bottom Action Footer Bar */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-end gap-3 pt-8 border-t border-zinc-100 mt-8">
        <button
          type="button"
          onClick={onBack}
          className="px-7 py-2.5 rounded-full border border-zinc-300 hover:bg-zinc-100 text-sm font-bold text-zinc-800 transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-8 py-2.5 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-extrabold text-zinc-900 shadow-xs transition-colors cursor-pointer"
        >
          Next
        </button>
      </div>
    </main>
  );
}
