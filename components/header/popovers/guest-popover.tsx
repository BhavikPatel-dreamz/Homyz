"use client";

import React from "react";
import { useHeaderSearch } from "../header-search-context";
import { useLanguage } from "@/lib/i18n/language-context";
import type { GuestCounts } from "../header-types";

interface GuestRowProps {
  category: keyof GuestCounts;
  title: string;
  subtitle: string;
  value: number;
  min: number;
  max: number;
  onUpdate: (cat: keyof GuestCounts, delta: number) => void;
}

function GuestRow({
  category,
  title,
  subtitle,
  value,
  min,
  max,
  onUpdate,
}: GuestRowProps) {
  const isMin = value <= min;
  const isMax = value >= max;

  return (
    <div className="flex items-center justify-between py-4">
      <div className="min-w-0 pr-4">
        <p className="text-sm font-medium text-[#1F1F1F]">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          disabled={isMin}
          aria-label={`Decrease ${title}`}
          onClick={() => onUpdate(category, -1)}
          className="size-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 hover:text-zinc-900 disabled:opacity-20 disabled:hover:border-zinc-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <span className="w-5 text-center text-sm font-medium text-[#1F1F1F] select-none">
          {value}
        </span>

        <button
          type="button"
          disabled={isMax}
          aria-label={`Increase ${title}`}
          onClick={() => onUpdate(category, 1)}
          className="size-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 hover:text-zinc-900 disabled:opacity-20 disabled:hover:border-zinc-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function GuestPopover() {
  const { guests, updateGuestCount } = useHeaderSearch();
  const { t } = useLanguage();

  // If there are children or infants, min adults is 1
  const minAdults = guests.children > 0 || guests.infants > 0 ? 1 : 0;

  return (
    <div
      role="dialog"
      aria-label="Guests selector"
      className="w-[380px] max-w-[calc(100vw-2rem)] rounded-[32px] bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-zinc-100 animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="divide-y divide-zinc-100">
        <GuestRow
          category="adults"
          title={t("home_adults", "Adults")}
          subtitle={t("home_adults_desc", "Ages 13 or above")}
          value={guests.adults}
          min={minAdults}
          max={16}
          onUpdate={updateGuestCount}
        />
        <GuestRow
          category="children"
          title={t("home_children", "Children")}
          subtitle={t("home_children_desc", "Ages 2–12")}
          value={guests.children}
          min={0}
          max={15}
          onUpdate={updateGuestCount}
        />
        <GuestRow
          category="infants"
          title={t("home_infants", "Infants")}
          subtitle={t("home_infants_desc", "Under 2")}
          value={guests.infants}
          min={0}
          max={5}
          onUpdate={updateGuestCount}
        />
        <GuestRow
          category="pets"
          title={t("home_pets", "Pets")}
          subtitle={t("home_pets_desc", "Bringing a service animal?")}
          value={guests.pets}
          min={0}
          max={5}
          onUpdate={updateGuestCount}
        />
      </div>

      <div className="pt-2 text-[11px] text-zinc-400">
        {t("header_pets_policy_notice", "Pets must be approved by the host. Additional pet fees may apply.")}
      </div>
    </div>
  );
}

