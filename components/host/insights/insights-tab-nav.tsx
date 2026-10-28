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
      className="scrollbar-none flex border-b border-[#E5E5E5] overflow-x-auto whitespace-nowrap"
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
              className={`group relative flex items-center gap-2 pb-4 pt-2 text-sm font-medium transition-colors focus:outline-none cursor-pointer ${
                isActive ? "text-[#1F1F1F]" : "text-[#727272] hover:text-[#1F1F1F]"
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === "reviews" && reviewCount !== undefined && reviewCount > 0 && (
                <span className="rounded-full bg-[#F3F4F5] px-2 py-0.5 text-xs text-[#1F1F1F] font-medium">
                  {reviewCount}
                </span>
              )}
              {tab.id === "opportunities" &&
                opportunitiesCount !== undefined &&
                opportunitiesCount > 0 && (
                  <span className="rounded-full bg-[#FEF9EE] border border-[#FCDF9C] px-2 py-0.5 text-xs text-[#D97706] font-medium">
                    {opportunitiesCount}
                  </span>
                )}
              {/* Active Underline */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1F1F1F] transition-all" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
