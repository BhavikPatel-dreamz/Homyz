"use client";

import React from "react";
import type { InsightsTab } from "@/services/host-insights.service";

interface InsightsTabNavProps {
  activeTab: InsightsTab;
  onTabChange: (tab: InsightsTab) => void;
  reviewCount?: number;
  opportunitiesCount?: number;
}

const TABS: Array<{ id: InsightsTab; label: string }> = [
  { id: "reviews", label: "Reviews" },
  { id: "stats", label: "Stats" },
  { id: "opportunities", label: "Opportunities" },
  { id: "superhost", label: "Superhost" },
];

export function InsightsTabNav({
  activeTab,
  onTabChange,
  reviewCount,
  opportunitiesCount,
}: InsightsTabNavProps) {
  return (
    <nav
      aria-label="Insights tabs"
      className="scrollbar-none flex overflow-x-auto border-b border-zinc-200 whitespace-nowrap"
    >
      <div className="flex min-w-max gap-6 sm:gap-8" role="tablist">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={`group relative flex items-center gap-2 rounded-t-md px-1 pb-4 pt-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${
                isActive ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === "reviews" && reviewCount !== undefined && reviewCount > 0 && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-medium">
                  {reviewCount}
                </span>
              )}
              {tab.id === "opportunities" &&
                opportunitiesCount !== undefined &&
                opportunitiesCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 font-semibold">
                    {opportunitiesCount}
                  </span>
                )}
              {/* Active Underline */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-950 transition-all" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
