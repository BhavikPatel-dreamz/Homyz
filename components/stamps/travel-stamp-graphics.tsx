"use client";

import React from "react";
import { TravelStampItem } from "@/lib/stamps/stamps-data";

type StampGraphicProps = {
  stamp: TravelStampItem;
  size?: "sm" | "md" | "lg";
};

function getFillColor(accentBg: string = "", fillHex?: string): string {
  if (fillHex && fillHex.startsWith("#")) return fillHex;
  if (accentBg.includes("pink")) return "#FDE8EB";
  if (accentBg.includes("indigo")) return "#E0E7FF";
  if (accentBg.includes("amber") || accentBg.includes("yellow")) return "#FEF3C7";
  if (accentBg.includes("red") || accentBg.includes("rose")) return "#FEE2E2";
  if (accentBg.includes("blue") || accentBg.includes("sky")) return "#DBEAFE";
  if (accentBg.includes("emerald") || accentBg.includes("teal")) return "#D1FAE5";
  if (accentBg.includes("orange")) return "#FFEDD5";
  if (accentBg.includes("purple")) return "#F3E8FF";
  if (accentBg.includes("cyan")) return "#CFFAFE";
  return "#FDE8EB";
}

export function TravelStampGraphic({ stamp, size = "md" }: StampGraphicProps) {
  const sizeClasses = {
    sm: "w-24 h-24",
    md: "w-32 h-32 sm:w-36 sm:h-36",
    lg: "w-40 h-40",
  }[size];

  // If user uploaded a custom stamp image, render image directly without extra SVG wrappers
  if (stamp.iconUrl) {
    return (
      <div className="flex flex-col items-center shrink-0 select-none">
        <div className={`relative ${sizeClasses} flex items-center justify-center`}>
          <img
            src={stamp.iconUrl}
            alt={stamp.title}
            className="w-full h-full object-contain"
          />
        </div>
        <span className="text-xs sm:text-sm font-serif italic text-zinc-800 mt-1">{stamp.title}</span>
      </div>
    );
  }

  const arcId = `arc-${stamp.id}`;
  const circleFill = getFillColor(stamp.accentBg, stamp.fillHex);

  return (
    <div className="flex flex-col items-center shrink-0 select-none">
      <div className={`relative ${sizeClasses} flex items-center justify-center`}>
        <svg className="w-full h-full" viewBox="0 0 160 160">
          {/* Inner pastel circle */}
          <circle
            cx="80"
            cy="88"
            r="54"
            fill={circleFill}
            stroke="#A1A1AA"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Curved "stay like a homie." text arc */}
          <path id={arcId} d="M 28,68 A 62,62 0 0,1 132,68" fill="none" />
          <text className="text-[13px] fill-zinc-800" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}>
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
              {stamp.subtitle}.
            </textPath>
          </text>

          {/* Hand-drawn Icon Illustrations */}
          <g stroke="#27272A" strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {stamp.iconType === "paris" && (
              <>
                <line x1="80" y1="34" x2="80" y2="48" />
                <circle cx="80" cy="33" r="1.5" fill="#27272A" />
                <polygon points="76,48 84,48 82,72 78,72" />
                <line x1="74" y1="72" x2="86" y2="72" />
                <polygon points="76,72 84,72 87,105 73,105" />
                <line x1="70" y1="105" x2="90" y2="105" />
                <line x1="75" y1="88" x2="85" y2="88" />
                <path d="M 73,105 L 63,142" />
                <path d="M 87,105 L 97,142" />
                <path d="M 69,142 C 72,120 88,120 91,142" />
                <line x1="58" y1="142" x2="102" y2="142" />
              </>
            )}

            {stamp.iconType === "coffee" && (
              <>
                <circle cx="80" cy="48" r="3" fill="#27272A" />
                <path d="M 68,62 L 80,51 L 92,62 Z" />
                <polygon points="68,62 92,62 88,92 72,92" />
                <line x1="66" y1="92" x2="94" y2="92" />
                <line x1="66" y1="96" x2="94" y2="96" />
                <polygon points="72,96 88,96 92,134 68,134" />
                <path d="M 92,68 C 108,70 108,110 90,115" />
                <path d="M 68,66 L 58,76 L 68,84" />
                <line x1="65" y1="134" x2="95" y2="134" />
              </>
            )}

            {stamp.iconType === "rome" && (
              <>
                <path d="M 58,135 L 102,135" />
                <path d="M 62,135 L 62,95 C 62,80 98,80 98,95 L 98,135" />
                <path d="M 62,110 L 98,110" />
                <path d="M 70,135 L 70,110" />
                <path d="M 80,135 L 80,110" />
                <path d="M 90,135 L 90,110" />
                <path d="M 62,95 L 98,95" />
                <path d="M 62,78 M 65,78 L 95,78" />
              </>
            )}

            {stamp.iconType === "tokyo" && (
              <>
                <path d="M 60,138 L 100,138" />
                <path d="M 70,138 L 70,75 L 90,75 L 90,138" />
                <path d="M 62,118 L 98,118" />
                <path d="M 64,98 L 96,98" />
                <path d="M 66,78 L 94,78" />
                <path d="M 80,75 L 80,50" />
                <circle cx="80" cy="48" r="2" fill="#27272A" />
              </>
            )}

            {stamp.iconType === "newyork" && (
              <>
                <path d="M 70,138 L 90,138" />
                <path d="M 74,138 L 74,90 L 86,90 L 86,138" />
                <path d="M 70,90 L 90,90" />
                <path d="M 80,90 L 80,60" />
                <path d="M 75,55 L 85,55 L 80,45 Z" />
                <path d="M 86,75 L 98,62" />
              </>
            )}

            {stamp.iconType === "london" && (
              <>
                <path d="M 65,138 L 95,138" />
                <path d="M 70,138 L 70,70 L 90,70 L 90,138" />
                <path d="M 70,88 L 90,88" />
                <circle cx="80" cy="79" r="6" />
                <path d="M 70,70 L 80,50 L 90,70 Z" />
                <line x1="80" y1="50" x2="80" y2="40" />
              </>
            )}

            {stamp.iconType === "barcelona" && (
              <>
                <path d="M 58,138 L 102,138" />
                <path d="M 66,138 L 66,60 M 94,138 L 94,60" />
                <path d="M 60,60 L 72,45 L 80,60 L 88,45 L 100,60" />
                <path d="M 72,138 L 72,90 M 88,138 L 88,90" />
                <circle cx="80" cy="85" r="4" />
              </>
            )}

            {stamp.iconType === "dubai" && (
              <>
                <path d="M 60,138 L 100,138" />
                <path d="M 70,138 C 70,90 85,60 95,45" />
                <path d="M 70,138 L 70,55 L 95,45" />
                <line x1="70" y1="75" x2="88" y2="75" />
                <line x1="70" y1="95" x2="82" y2="95" />
                <line x1="70" y1="115" x2="78" y2="115" />
              </>
            )}

            {stamp.iconType === "sydney" && (
              <>
                <path d="M 55,135 L 105,135" />
                <path d="M 60,135 C 60,105 78,95 85,135" />
                <path d="M 72,135 C 72,100 92,90 98,135" />
                <path d="M 85,135 C 85,110 102,105 105,135" />
              </>
            )}

            {stamp.iconType === "bucharest" && (
              <>
                <path d="M 55,135 L 105,135" />
                <path d="M 60,135 L 60,90 L 100,90 L 100,135" />
                <path d="M 60,105 L 100,105" />
                <path d="M 72,90 L 72,70 L 88,70 L 88,90" />
                <path d="M 65,135 L 65,110 M 75,135 L 75,110 M 85,135 L 85,110 M 95,135 L 95,110" />
              </>
            )}

            {stamp.iconType === "bali" && (
              <>
                <path d="M 55,135 L 105,135" />
                <path d="M 80,135 C 80,95 65,70 58,60" />
                <path d="M 78,85 C 65,80 55,85 50,90" />
                <path d="M 79,75 C 68,68 62,60 60,52" />
                <path d="M 81,95 C 92,88 100,92 105,98" />
              </>
            )}

            {stamp.iconType === "riyadh" && (
              <>
                <path d="M 65,138 L 95,138" />
                <path d="M 70,138 L 70,55 C 70,55 80,45 90,55 L 90,138" />
                <ellipse cx="80" cy="70" rx="6" ry="12" />
                <line x1="70" y1="100" x2="90" y2="100" />
              </>
            )}

            {stamp.iconType === "custom" && (
              stamp.iconUrl ? (
                <image
                  href={stamp.iconUrl}
                  x="45"
                  y="53"
                  width="70"
                  height="70"
                  preserveAspectRatio="xMidYMid meet"
                  className="rounded-full"
                />
              ) : (
                <>
                  {/* Hand-drawn pin / compass globe for custom locations */}
                  <circle cx="80" cy="85" r="18" />
                  <circle cx="80" cy="85" r="6" fill="#27272A" />
                  <path d="M 80,60 L 80,67" />
                  <path d="M 80,103 L 80,110" />
                  <path d="M 55,85 L 62,85" />
                  <path d="M 98,85 L 105,85" />
                  <path d="M 65,125 C 70,120 90,120 95,125" />
                </>
              )
            )}
          </g>
        </svg>
      </div>
      <span className="text-xs sm:text-sm font-serif italic text-zinc-800 mt-1">{stamp.title}</span>
    </div>
  );
}
