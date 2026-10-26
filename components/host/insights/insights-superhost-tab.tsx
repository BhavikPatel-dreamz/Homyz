"use client";

import React from "react";
import Link from "next/link";
import type { HostInsightsData } from "@/services/host-insights.service";

interface InsightsSuperhostTabProps {
  data: HostInsightsData["superhost"];
}

const formatDate = (dateStr: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(dateStr),
  );

export function InsightsSuperhostTab({ data }: InsightsSuperhostTabProps) {
  const { officialStatus, isQualified, windowStart, windowEnd, nextEvaluationAt, criteria, benefits, gaps } = data;

  const metCount = criteria.filter((c) => c.isMet).length;
  const criterionHref: Record<string, string> = {
    STAYS: "/host/bookings",
    RATING: "/host/insights?tab=reviews",
    RESPONSE_RATE: "/host/insights/stats/response-rate",
    CANCELLATION: "/host/insights/stats/cancellations",
    GOOD_STANDING: "/host/profile",
  };

  return (
    <div className="space-y-10">
      {/* Superhost Status Hero Card */}
      <section className="relative overflow-hidden rounded-3xl border border-[#E5E5E5] bg-gradient-to-br from-[#FAFAFA] to-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <span
              className={`inline-flex rounded-full px-3.5 py-1 text-xs font-semibold ${
                officialStatus
                  ? "bg-[#FEF9EE] text-[#D97706] border border-[#FCDF9C]"
                  : isQualified
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-[#F3F4F5] text-[#1F1F1F] border border-[#EDEDED]"
              }`}
            >
              {officialStatus
                ? "Official Superhost"
                : isQualified
                  ? "Eligible at next assessment"
                  : "Superhost in progress"}
            </span>

            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#1F1F1F] sm:text-3xl">
              {officialStatus ? "You are a Superhost" : `${metCount} of ${criteria.length} criteria completed`}
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-[#727272] sm:text-sm">
              Assessment period: {formatDate(windowStart)} – {formatDate(windowEnd)} · Next evaluation:{" "}
              <strong className="text-[#1F1F1F] font-semibold">{formatDate(nextEvaluationAt)}</strong>
            </p>
          </div>

          <div className="text-right">
            <span className="text-3xl font-bold text-[#1F1F1F] sm:text-4xl">
              {Math.round((metCount / criteria.length) * 100)}%
            </span>
            <p className="text-[11px] font-medium text-[#727272]">Progress to Superhost</p>
            <Link href="/host/insights/superhost/history" className="mt-2 inline-block text-xs font-semibold text-[#1F1F1F] underline hover:text-[#727272]">
              Assessment history
            </Link>
          </div>
        </div>

        {gaps.length > 0 && !officialStatus && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
            <p className="font-semibold">Actions needed before next assessment:</p>
            <ul className="mt-1.5 list-disc pl-5 space-y-1">
              {gaps.map((gap, i) => (
                <li key={i}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 5 Criteria Cards Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-[#1F1F1F]">Superhost qualification criteria</h2>
          <p className="mt-1 text-xs text-[#727272]">
            Assessed automatically every quarter across all your authorized listings
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {criteria.map((crit) => (
            <Link
              key={crit.id}
              href={criterionHref[crit.id]}
              className="flex flex-col justify-between rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm transition hover:border-[#1F1F1F]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#1F1F1F]">{crit.title}</h3>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      crit.isMet ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-[#F3F4F5] text-[#727272] border border-[#EDEDED]"
                    }`}
                  >
                    {crit.isMet ? "Completed ✓" : "In progress"}
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-[#727272]">{crit.description}</p>
              </div>

              <div className="mt-6 border-t border-[#EDEDED] pt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-[#1F1F1F]">{crit.currentValue}</span>
                  <span className="text-[#727272]">Target: {crit.targetValue}</span>
                </div>

                <div className="mt-2 h-2 w-full rounded-full bg-[#F3F4F5] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      crit.isMet ? "bg-emerald-600" : "bg-[#1F1F1F]"
                    }`}
                    style={{ width: `${crit.progressPercentage}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Homyz Superhost Benefits */}
      <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-[#1F1F1F]">Superhost benefits on Homyz</h2>
        <p className="mt-1 text-xs text-[#727272]">Benefits shown here are limited to features verified in Homyz.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F1F1F] text-white font-bold text-sm">
                ★
              </span>
              <h3 className="mt-3 text-sm font-bold text-[#1F1F1F]">{b.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#727272]">{b.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
