"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";

interface SeeAllCardProps {
  href: string;
  previewImages?: string[];
  title?: string;
  totalCount?: number;
}

const FALLBACK_PREVIEW_IMAGES = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=400&q=80",
];

export function SeeAllCard({
  href,
  previewImages = [],
  title,
  totalCount,
}: SeeAllCardProps) {
  const { t } = useLanguage();
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  // Ensure we always have 3 images for the fan stack
  const images = [
    previewImages[0] || FALLBACK_PREVIEW_IMAGES[0],
    previewImages[1] || FALLBACK_PREVIEW_IMAGES[1],
    previewImages[2] || FALLBACK_PREVIEW_IMAGES[2],
  ];

  return (
    <Link
      href={href}
      className="group relative flex h-full min-h-[300px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[20px] border border-zinc-200 bg-white p-5 text-center transition-all duration-300 hover:border-zinc-300 hover:shadow-lg sm:min-h-[320px] sm:rounded-[22px] select-none"
      aria-label={`See all ${title || "properties"}`}
    >
      {/* Stacked Floating Photo Fan */}
      <div className="relative mb-5 flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
        {/* Photo 1: Back Top-Center */}
        <div className="absolute top-1 left-4 h-20 w-20 sm:h-22 sm:w-22 -rotate-6 overflow-hidden rounded-2xl border-2 border-white shadow-md transition-transform duration-300 group-hover:-translate-y-2 group-hover:-rotate-10">
          <img
            src={imgErrors[0] ? FALLBACK_PREVIEW_IMAGES[0] : images[0]}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgErrors((prev) => ({ ...prev, 0: true }))}
            loading="lazy"
          />
        </div>

        {/* Photo 2: Middle Right */}
        <div className="absolute top-3 right-3 h-20 w-20 sm:h-22 sm:w-22 rotate-8 overflow-hidden rounded-2xl border-2 border-white shadow-md transition-transform duration-300 group-hover:translate-x-2 group-hover:rotate-12">
          <img
            src={imgErrors[1] ? FALLBACK_PREVIEW_IMAGES[1] : images[1]}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgErrors((prev) => ({ ...prev, 1: true }))}
            loading="lazy"
          />
        </div>

        {/* Photo 3: Foreground Left */}
        <div className="absolute bottom-1 left-2 z-10 h-22 w-22 sm:h-24 sm:w-24 -rotate-10 overflow-hidden rounded-2xl border-[2.5px] border-white shadow-xl transition-transform duration-300 group-hover:-translate-x-1.5 group-hover:scale-105">
          <img
            src={imgErrors[2] ? FALLBACK_PREVIEW_IMAGES[2] : images[2]}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgErrors((prev) => ({ ...prev, 2: true }))}
            loading="lazy"
          />
        </div>
      </div>

      {/* "See all" Text & Count */}
      <div className="flex flex-col items-center">
        <span className="text-base sm:text-lg font-bold text-[#0052cc] group-hover:text-[#003b95] group-hover:underline transition-colors">
          {t("home_see_all")}
        </span>
        {totalCount && totalCount > 0 ? (
          <span className="text-[11px] text-zinc-400 font-normal mt-0.5">
            {t("home_count_stays", { count: totalCount })}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

