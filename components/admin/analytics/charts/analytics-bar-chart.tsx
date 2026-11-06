"use client";

import React, { useState } from "react";

export interface BarChartItem {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  secondaryValue?: number;
}

interface AnalyticsBarChartProps {
  items: BarChartItem[];
  maxVal?: number;
  height?: number;
  color?: "amber" | "emerald" | "sky" | "violet" | "rose";
  valueFormatter?: (val: number) => string;
  secondaryLabel?: string;
  emptyMessage?: string;
  className?: string;
}

const colorStyles = {
  amber: "bg-amber-500 hover:bg-amber-600",
  emerald: "bg-emerald-500 hover:bg-emerald-600",
  sky: "bg-sky-500 hover:bg-sky-600",
  violet: "bg-violet-500 hover:bg-violet-600",
  rose: "bg-rose-500 hover:bg-rose-600",
};

export function AnalyticsBarChart({
  items,
  maxVal,
  height = 180,
  color = "amber",
  valueFormatter = (v) => v.toLocaleString(),
  emptyMessage = "No comparison data available.",
  className = "",
}: AnalyticsBarChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const highest = Math.max(1, maxVal ?? Math.max(...items.map((i) => i.value || 0)));
  const barClass = colorStyles[color] || colorStyles.amber;

  if (items.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 text-center ${className}`}
        style={{ height }}
      >
        <p className="text-xs font-normal text-zinc-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col justify-end gap-2 ${className}`} style={{ minHeight: height }}>
      {/* Bars Container */}
      <div className="flex items-end gap-2 sm:gap-3 w-full h-full pt-6">
        {items.map((item) => {
          const pct = Math.max(4, Math.round((item.value / highest) * 100));
          const isHovered = hoveredId === item.id;

          return (
            <div
              key={item.id}
              className="relative flex-1 flex flex-col items-center group h-full justify-end cursor-pointer"
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Floating Tooltip */}
              {isHovered && (
                <div className="absolute -top-11 z-20 flex flex-col items-center pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
                  <div className="rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-md">
                    <span className="text-zinc-400 mr-1">{item.label}:</span>
                    <span>{valueFormatter(item.value)}</span>
                  </div>
                  <div className="h-1.5 w-1.5 rotate-45 bg-zinc-900 -mt-0.5" />
                </div>
              )}

              {/* Bar Fill */}
              <div
                className={`w-full max-w-[40px] rounded-t-lg transition-all duration-150 ${barClass} ${
                  isHovered ? "opacity-100 scale-y-[1.02]" : "opacity-85"
                }`}
                style={{ height: `${pct}%` }}
              />

              {/* Bottom Label */}
              <div className="mt-2 text-center w-full truncate">
                <span className="block text-[11px] font-medium text-zinc-700 truncate">
                  {item.label}
                </span>
                {item.sublabel && (
                  <span className="block text-[10px] font-normal text-zinc-400 truncate">
                    {item.sublabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

