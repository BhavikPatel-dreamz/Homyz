"use client";

import React, { useMemo } from "react";

interface FinancialWaterfallChartProps {
  netEarningsCents: number;
  recordedCostsCents: number;
  estimatedProfitCents: number | null;
  profitMarginPercentage: number | null;
  currency?: string;
  className?: string;
}

const fmt = (cents: number, curr = "SAR") => {
  const val = Math.round(cents / 100);
  return `${curr} ${val.toLocaleString("en-US")}`;
};

const fmtAxis = (cents: number, curr = "SAR") => {
  const val = Math.round(cents / 100);
  if (val >= 1000) {
    const k = val / 1000;
    return `${curr} ${k % 1 === 0 ? k : k.toFixed(1).replace(".0", "")}K`;
  }
  return `${curr} ${val}`;
};

export function FinancialWaterfallChart({
  netEarningsCents,
  recordedCostsCents,
  estimatedProfitCents,
  profitMarginPercentage,
  currency = "SAR",
  className = "",
}: FinancialWaterfallChartProps) {
  const profitVal = estimatedProfitCents ?? netEarningsCents - recordedCostsCents;

  const bars = [
    {
      label: "Net host earnings",
      amount: netEarningsCents,
      formatted: fmt(netEarningsCents, currency),
      color: "linear-gradient(180deg, #F5D061 0%, #B8860B 100%)",
      isNegative: false,
    },
    {
      label: "Recorded costs",
      amount: recordedCostsCents,
      formatted: recordedCostsCents > 0 ? `-${fmt(recordedCostsCents, currency)}` : `${fmt(0, currency)}`,
      color: "linear-gradient(180deg, #F87171 0%, #DC2626 100%)",
      isNegative: true,
    },
    {
      label: "Estimated profit",
      amount: profitVal,
      formatted: fmt(profitVal, currency),
      color: "linear-gradient(180deg, #F5D061 0%, #B8860B 100%)",
      isNegative: false,
    },
  ];

  const maxVal = Math.max(100000, netEarningsCents, recordedCostsCents, profitVal);
  const yTicks = useMemo(() => {
    const rawStep = (maxVal / 100) / 3;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, rawStep))));
    const normalized = rawStep / magnitude;
    let step = magnitude;
    if (normalized > 5) step = 10 * magnitude;
    else if (normalized > 2) step = 5 * magnitude;
    else if (normalized > 1) step = 2 * magnitude;
    else step = magnitude;

    return [step * 3 * 100, step * 2 * 100, step * 100, 0];
  }, [maxVal]);

  const ceiling = yTicks[0] || 100000;

  return (
    <div className={`flex flex-col justify-between ${className}`}>
      {/* 3 Metrics Row */}
      <div className="grid grid-cols-1 gap-3 border-b border-zinc-100 pb-4 min-[430px]:grid-cols-3 min-[430px]:gap-2">
        <div>
          <span className="text-[11px] font-normal text-zinc-500 block">
            Net host earnings
          </span>
          <span className="text-sm sm:text-base font-medium text-zinc-950 block mt-0.5">
            {fmt(netEarningsCents, currency)}
          </span>
          <span className="text-[10px] font-normal text-zinc-400 block mt-0.5">
            Immutable snapshots
          </span>
        </div>

        <div>
          <span className="text-[11px] font-normal text-zinc-500 block">
            Recorded costs
          </span>
          <span className="text-sm sm:text-base font-medium text-rose-600 block mt-0.5">
            {recordedCostsCents > 0 ? `– ${fmt(recordedCostsCents, currency)}` : fmt(0, currency)}
          </span>
          <span className="text-[10px] font-normal text-zinc-400 block mt-0.5">
            Owner recorded expenses
          </span>
        </div>

        <div>
          <span className="text-[11px] font-normal text-zinc-500 block">
            Estimated profit
          </span>
          <span className="text-sm sm:text-base font-medium text-zinc-950 block mt-0.5">
            {fmt(profitVal, currency)}
          </span>
          <span className="text-[10px] font-normal text-emerald-700 block mt-0.5">
            {profitMarginPercentage !== null ? `${profitMarginPercentage}% margin` : "No costs recorded"}
          </span>
        </div>
      </div>

      {/* Visual Waterfall Bars */}
      <div className="mt-4 flex h-40 min-w-0 pt-2">
        {/* Y-Axis */}
        <div className="flex w-10 shrink-0 select-none flex-col justify-between pb-5 pr-1.5 text-right text-[9px] font-normal text-zinc-400 sm:w-12 sm:pr-2 sm:text-[10px]">
          {yTicks.map((tick, i) => (
            <span key={i} className="leading-none whitespace-nowrap">
              {fmtAxis(tick, currency)}
            </span>
          ))}
        </div>

        {/* Chart Canvas */}
        <div className="relative flex-1 flex flex-col justify-between">
          {/* Dotted Grid lines */}
          <div className="absolute inset-x-0 inset-y-0 pb-5 flex flex-col justify-between pointer-events-none">
            {yTicks.map((_, i) => (
              <div
                key={i}
                className="w-full border-b border-dashed border-zinc-200/60"
              />
            ))}
          </div>

          {/* 3 Waterfall Bars */}
          <div className="relative z-10 flex size-full items-end justify-around gap-1 px-1 pb-5 sm:px-4">
            {bars.map((bar, idx) => {
              const pct = Math.min(100, Math.max(4, (bar.amount / ceiling) * 100));

              return (
                <div
                  key={idx}
                  className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end cursor-pointer"
                >
                  {/* Amount above bar */}
                  <span className="text-[10px] sm:text-[11px] font-medium text-zinc-800 mb-1 leading-tight whitespace-nowrap">
                    {bar.formatted}
                  </span>

                  {/* Bar shape */}
                  <div
                    style={{
                      height: `${pct}%`,
                      background: bar.color,
                    }}
                    className="w-10 rounded-t-md transition-all duration-300 group-hover:brightness-105 sm:w-14"
                  />
                </div>
              );
            })}
          </div>

          {/* Bar Labels Row */}
          <div className="w-full flex items-center justify-around text-[10px] sm:text-[11px] font-normal text-zinc-500 pt-1.5 border-t border-zinc-200">
            {bars.map((bar, idx) => (
              <span key={idx} className="w-24 text-center truncate">
                {bar.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
