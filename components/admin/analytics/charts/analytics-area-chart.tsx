"use client";

import React, { useMemo, useState, useRef } from "react";

export interface AreaChartPoint {
  dateKey: string;
  label: string;
  value: number | null;
}

interface AnalyticsAreaChartProps {
  data: AreaChartPoint[];
  height?: number;
  color?: "amber" | "emerald" | "sky" | "violet" | "rose";
  valueFormatter?: (val: number) => string;
  unitLabel?: string;
  emptyMessage?: string;
  className?: string;
}

const colorMap = {
  amber: {
    stroke: "#D97706", // amber-600
    fillStart: "rgba(245, 158, 11, 0.28)", // amber-500
    fillEnd: "rgba(245, 158, 11, 0.01)",
    point: "#B45309",
  },
  emerald: {
    stroke: "#059669", // emerald-600
    fillStart: "rgba(16, 185, 129, 0.28)",
    fillEnd: "rgba(16, 185, 129, 0.01)",
    point: "#047857",
  },
  sky: {
    stroke: "#0284C7", // sky-600
    fillStart: "rgba(14, 165, 233, 0.28)",
    fillEnd: "rgba(14, 165, 233, 0.01)",
    point: "#0369A1",
  },
  violet: {
    stroke: "#7C3AED", // violet-600
    fillStart: "rgba(139, 92, 246, 0.28)",
    fillEnd: "rgba(139, 92, 246, 0.01)",
    point: "#6D28D9",
  },
  rose: {
    stroke: "#E11D48", // rose-600
    fillStart: "rgba(244, 63, 94, 0.28)",
    fillEnd: "rgba(244, 63, 94, 0.01)",
    point: "#BE123C",
  },
};

export function AnalyticsAreaChart({
  data,
  height = 240,
  color = "amber",
  valueFormatter = (v) => v.toLocaleString(),
  unitLabel = "",
  emptyMessage = "No activity recorded for this period.",
  className = "",
}: AnalyticsAreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const colors = colorMap[color] || colorMap.amber;

  // Filter valid points
  const points = useMemo(() => data.filter((d) => d && d.dateKey), [data]);

  const maxVal = useMemo(() => {
    const raw = Math.max(0, ...points.map((p) => p.value || 0));
    if (raw === 0) return 100;
    return Math.ceil(raw * 1.15);
  }, [points]);

  // Coordinate mapper
  const svgWidth = 800;
  const padLeft = 12;
  const padRight = 12;
  const padTop = 18;
  const padBottom = 26;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const coords = useMemo(() => {
    if (points.length === 0) return [];
    const n = points.length;
    return points.map((p, i) => {
      const x = padLeft + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
      const v = p.value || 0;
      const y = padTop + chartH - (v / maxVal) * chartH;
      return { x, y, point: p };
    });
  }, [points, maxVal, chartW, chartH, padLeft, padTop]);

  // Spline builder
  const { pathD, areaD } = useMemo(() => {
    if (coords.length === 0) return { pathD: "", areaD: "" };
    if (coords.length === 1) {
      const c = coords[0];
      return {
        pathD: `M ${c.x} ${c.y}`,
        areaD: `M ${c.x} ${padTop + chartH} L ${c.x} ${c.y} L ${c.x} ${padTop + chartH} Z`,
      };
    }

    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    const first = coords[0];
    const last = coords[coords.length - 1];
    const baselineY = (padTop + chartH).toFixed(2);
    const aD = `${d} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`;

    return { pathD: d, areaD: aD };
  }, [coords, padTop, chartH]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || coords.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const targetIdx = Math.max(
      0,
      Math.min(coords.length - 1, Math.round(relX * (coords.length - 1)))
    );
    setHoverIdx(targetIdx);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!containerRef.current || coords.length === 0 || !e.touches[0]) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = (e.touches[0].clientX - rect.left) / rect.width;
    const targetIdx = Math.max(
      0,
      Math.min(coords.length - 1, Math.round(relX * (coords.length - 1)))
    );
    setHoverIdx(targetIdx);
  };

  const activeCoord = hoverIdx !== null && coords[hoverIdx] ? coords[hoverIdx] : null;

  if (points.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-8 text-center ${className}`}
        style={{ height }}
      >
        <p className="text-xs font-normal text-zinc-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Floating Hover Tooltip */}
      {activeCoord && (
        <div
          className="pointer-events-none absolute z-20 flex flex-col items-center transform -translate-x-1/2 transition-transform duration-75"
          style={{
            left: `${(activeCoord.x / svgWidth) * 100}%`,
            top: `${Math.max(6, activeCoord.y - 48)}px`,
          }}
        >
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-900/95 px-3 py-1.5 shadow-lg backdrop-blur-xs text-center">
            <span className="block text-[10px] font-normal text-zinc-400">
              {activeCoord.point.dateKey}
            </span>
            <span className="block text-xs font-medium text-white">
              {valueFormatter(activeCoord.point.value || 0)} {unitLabel}
            </span>
          </div>
          <div className="h-1.5 w-1.5 rotate-45 bg-zinc-900/95 -mt-1" />
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        className="w-full h-auto overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setHoverIdx(null)}
        role="img"
        aria-label="Area performance chart"
      >
        <defs>
          <linearGradient id={`areaGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.fillStart} />
            <stop offset="100%" stopColor={colors.fillEnd} />
          </linearGradient>
        </defs>

        {/* Horizontal Dashed Guidelines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padTop + chartH * (1 - ratio);
          return (
            <line
              key={idx}
              x1={padLeft}
              y1={y}
              x2={svgWidth - padRight}
              y2={y}
              stroke="#E4E4E7"
              strokeDasharray="4 4"
              strokeWidth="0.8"
            />
          );
        })}

        {/* Gradient Area Fill */}
        <path d={areaD} fill={`url(#areaGrad-${color})`} />

        {/* Smooth Curve Stroke */}
        <path
          d={pathD}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover Crosshair Line */}
        {activeCoord && (
          <g>
            <line
              x1={activeCoord.x}
              y1={padTop}
              x2={activeCoord.x}
              y2={padTop + chartH}
              stroke={colors.stroke}
              strokeWidth="1.2"
              strokeDasharray="3 3"
              opacity="0.8"
            />
            <circle
              cx={activeCoord.x}
              cy={activeCoord.y}
              r="4.5"
              fill="#FFFFFF"
              stroke={colors.stroke}
              strokeWidth="2.5"
            />
          </g>
        )}

        {/* X-Axis Date Labels */}
        {coords.map((c, i) => {
          // Label thinning for readability on small screen widths
          const step = Math.ceil(coords.length / 7);
          if (i !== 0 && i !== coords.length - 1 && i % step !== 0) return null;
          return (
            <text
              key={i}
              x={c.x}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === coords.length - 1 ? "end" : "middle"}
              className="fill-zinc-400 text-[10px] font-normal"
            >
              {c.point.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
