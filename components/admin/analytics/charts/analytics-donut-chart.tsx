"use client";

import React, { useMemo, useState } from "react";

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface AnalyticsDonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerTitle?: string;
  centerSubtitle?: string;
  centerLabel?: string;
  centerValue?: string;
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
  className?: string;
}

export function AnalyticsDonutChart({
  segments,
  size = 180,
  strokeWidth = 24,
  centerTitle,
  centerSubtitle,
  centerLabel,
  centerValue,
  valueFormatter = (v) => v.toLocaleString(),
  emptyMessage = "No distribution data available.",
  className = "",
}: AnalyticsDonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const displayTitle = centerValue || centerTitle;
  const displaySubtitle = centerLabel || centerSubtitle;

  const total = useMemo(
    () => segments.reduce((sum, s) => sum + (s.value || 0), 0),
    [segments]
  );

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute SVG stroke-dasharray and stroke-dashoffset for segments
  const renderedSegments = useMemo(() => {
    if (total === 0) return [];
    let accumulatedOffset = 0;

    return segments.map((s, idx) => {
      const ratio = s.value / total;
      const strokeDasharray = `${ratio * circumference} ${circumference}`;
      const strokeDashoffset = -accumulatedOffset;
      accumulatedOffset += ratio * circumference;

      return {
        ...s,
        ratio,
        strokeDasharray,
        strokeDashoffset,
        percentage: Math.round(ratio * 1000) / 10,
      };
    });
  }, [segments, total, circumference]);

  if (segments.length === 0 || total === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 text-center ${className}`}
        style={{ minHeight: size }}
      >
        <p className="text-xs font-normal text-zinc-500">{emptyMessage}</p>
      </div>
    );
  }

  const activeSegment = hoveredIdx !== null ? renderedSegments[hoverIdxSafe(hoveredIdx, renderedSegments.length)] : null;

  function hoverIdxSafe(idx: number, len: number) {
    return Math.max(0, Math.min(len - 1, idx));
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-center gap-6 ${className}`}>
      {/* SVG Donut Circle */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {/* Background Track Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#F4F4F5"
            strokeWidth={strokeWidth}
          />

          {/* Active Data Segments */}
          {renderedSegments.map((seg, i) => (
            <circle
              key={seg.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={hoveredIdx === i ? strokeWidth + 3 : strokeWidth}
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-150 cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>

        {/* Center Summary Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
          {activeSegment ? (
            <>
              <span className="text-xs font-medium text-zinc-900 truncate max-w-[110px]">
                {activeSegment.label}
              </span>
              <span className="text-sm font-medium text-zinc-900">
                {activeSegment.percentage}%
              </span>
              <span className="text-[10px] font-normal text-zinc-400">
                {valueFormatter(activeSegment.value)}
              </span>
            </>
          ) : (
            <>
              {displayTitle && (
                <span className="text-base font-medium text-zinc-900 tracking-tight">
                  {displayTitle}
                </span>
              )}
              {displaySubtitle && (
                <span className="text-[11px] font-normal text-zinc-400">
                  {displaySubtitle}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Legend List */}
      <div className="flex flex-col gap-2 min-w-[160px] text-xs">
        {renderedSegments.map((seg, i) => (
          <div
            key={seg.id}
            className={`flex items-center justify-between gap-3 p-1.5 rounded-lg transition-colors cursor-pointer ${
              hoveredIdx === i ? "bg-zinc-100" : "hover:bg-zinc-50"
            }`}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div className="flex items-center gap-2 truncate">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-normal text-zinc-700 truncate">{seg.label}</span>
            </div>
            <div className="text-right shrink-0">
              <span className="font-medium text-zinc-900">{seg.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
