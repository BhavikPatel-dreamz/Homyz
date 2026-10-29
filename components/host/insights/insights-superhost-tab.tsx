"use client";

import Link from "next/link";
import React from "react";
import type { HostInsightsData } from "@/services/host-insights.service";

interface Props {
  data: HostInsightsData["superhost"];
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));

const criterionHref: Record<string, string> = {
  LISTING_OWNERSHIP: "/host/listings",
  HOSTING_VOLUME: "/host/bookings",
  RATING: "/host/insights?tab=reviews",
  RESPONSE_RATE: "/host/insights/stats/response-rate",
  CANCELLATION_RATE: "/host/insights/stats/cancellations",
  GOOD_STANDING: "/host/profile",
};

export function InsightsSuperhostTab({ data }: Props) {
  const {
    officialStatus,
    isQualified,
    eligibilityStatus,
    windowStart,
    windowEnd,
    nextEvaluationAt,
    criteria,
    benefits,
    gaps,
  } = data;
  const isBlocked = eligibilityStatus === "CANNOT_DETERMINE";
  const metCount = criteria.filter((item) => item.isMet).length;

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ── Section A: Superhost Status Banner ── */}
      <section
        className={`relative overflow-hidden rounded-3xl border p-5 sm:p-8 shadow-[0_2px_4px_0px_#00000040] transition-all duration-300 ${
          officialStatus
            ? "border-[#FCDF9C] bg-gradient-to-br from-[#FEF9EE] via-[#FFFDF7] to-white"
            : "border-white bg-[#F3F4F5]"
        }`}
        aria-labelledby="superhost-status-heading"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-medium ${
                  officialStatus
                    ? "border-[#FCDF9C] bg-[#FFF9EB] text-[#8F6A00]"
                    : isBlocked
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : isQualified
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-[#EDEDED] bg-white text-[#1F1F1F]"
                }`}
              >
                <svg className="size-3 text-[#B88700] shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>
                  {officialStatus
                    ? "Official Superhost"
                    : isBlocked
                      ? "Assessment needs review"
                      : isQualified
                        ? "Eligible at next assessment"
                        : "Superhost in progress"}
                </span>
              </span>
            </div>
            <h2
              id="superhost-status-heading"
              className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-[#1F1F1F]"
            >
              {officialStatus
                ? "You are a Superhost"
                : isBlocked
                  ? "Qualification cannot be determined yet"
                  : `${metCount} of ${criteria.length} criteria completed`}
            </h2>
            <p className="mt-2 text-xs sm:text-sm font-normal leading-relaxed text-[#727272]">
              Assessment period: {formatDate(windowStart)} – {formatDate(windowEnd)} · Next evaluation:{" "}
              <span className="font-medium text-[#1F1F1F]">{formatDate(nextEvaluationAt)}</span>
            </p>
          </div>

          {/* Right side KPI badge & Assessment History Link */}
          <div className="flex flex-col sm:flex-row sm:items-center lg:flex-col lg:items-end justify-between gap-4 border-t border-[#EDEDED] lg:border-t-0 pt-4 lg:pt-0 shrink-0">
            <div className="lg:text-right">
              <span className="text-3xl sm:text-4xl font-medium tracking-tight text-[#1F1F1F]">
                {isBlocked ? "—" : `${Math.round((metCount / criteria.length) * 100)}%`}
              </span>
              <p className="text-xs font-normal text-[#727272]">Progress to Superhost</p>
            </div>
            <Link
              href="/host/insights/superhost/history"
              className="group inline-flex items-center gap-1.5 rounded-full border border-[#D7D7D7] bg-[#1F1F1F] hover:bg-white hover:text-[#1f1f1f] px-4 py-2 text-xs font-medium text-white transition hover:border-[#1F1F1F] self-start sm:self-auto"
            >
              <span>Assessment history</span>
              <svg
                className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Action gaps notification panel */}
        {(gaps.length > 0 || isBlocked) && !officialStatus && (
          <div className="mt-6 rounded-2xl border border-[#E5E5E5] bg-white p-4.5 sm:p-5 shadow-2xs">
            <div className="flex items-start gap-3 sm:gap-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-900">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1F1F1F]">
                  {isBlocked ? "Assessment needs resolution:" : "Actions needed before next assessment:"}
                </p>
                <ul className="mt-1.5 space-y-1 text-xs font-normal text-[#727272] leading-relaxed">
                  {gaps.map((gap, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-[#1F1F1F] mt-1.5 shrink-0" />
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Section B: Qualification Criteria ── */}
      <section className="space-y-5" aria-labelledby="superhost-criteria-heading">
        <div className="flex flex-col gap-2 border-b border-[#E5E5E5] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs sm:text-sm font-normal text-[#727272]">Quarterly evaluation</p>
            <h2 id="superhost-criteria-heading" className="mt-1 text-xl sm:text-2xl font-medium tracking-tight text-[#1F1F1F]">
              Superhost qualification criteria
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-normal text-[#727272]">
              Six authoritative host-level criteria, assessed automatically each quarter.
            </p>
          </div>
          <div className="inline-flex self-start sm:self-auto items-center gap-1.5 rounded-full border border-[#EDEDED] bg-white px-3 py-1 text-xs font-medium text-[#727272] shadow-2xs">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Automatic quarterly review</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {criteria.map((criterion) => {
            const href = criterionHref[criterion.id];
            const isMet = criterion.status === "PASS";
            const isBlockedCriterion = criterion.status === "BLOCKED";

            const content = (
              <div className="flex h-full flex-col justify-between">
                <div>
                  {/* Card Header: Title + Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-medium text-[#1F1F1F] leading-snug">{criterion.title}</h3>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        isMet
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : isBlockedCriterion
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-[#EDEDED] bg-[#F3F4F5] text-[#727272]"
                      }`}
                    >
                      {isMet ? (
                        <>
                          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Pass</span>
                        </>
                      ) : isBlockedCriterion ? (
                        <span>Blocked</span>
                      ) : (
                        <span>Not met</span>
                      )}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-normal leading-relaxed text-[#727272]">
                    {criterion.description}
                  </p>
                </div>

                {/* Progress / Value Module */}
                <div className="mt-5 space-y-2.5 rounded-2xl border border-[#EDEDED] bg-[#FAFAFB] p-3.5">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-medium text-[#1F1F1F]">{criterion.currentValue}</span>
                    <span className="text-right text-[#727272]">Target: {criterion.targetValue}</span>
                  </div>
                  {criterion.progressPercentage === null ? (
                    <p className="mt-1 text-xs font-normal text-amber-900">
                      Progress is unavailable until this criterion is resolved.
                    </p>
                  ) : (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#EDEDED]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isMet ? "bg-[#FCDF9C]" : "bg-[#1F1F1F]"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, criterion.progressPercentage))}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Footer divider with action link */}
                <div className="mt-4 flex items-center justify-between border-t border-[#EDEDED] pt-3 text-xs font-normal text-[#727272]">
                  <span>{isMet ? "Requirement satisfied" : "Action recommended"}</span>
                  {href ? (
                    <span className="ml-2 inline-flex items-center gap-1 font-medium text-[#1F1F1F] group-hover:underline">
                      <span>View details</span>
                      <svg
                        className="size-3 transition-transform duration-200 group-hover:translate-x-0.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </span>
                  ) : null}
                </div>
              </div>
            );

            return href ? (
              <Link
                key={criterion.id}
                href={href}
                className="group flex h-full flex-col justify-between rounded-3xl border border-[#E5E5E5] bg-white p-5 sm:p-6 shadow-2xs transition-all duration-300 hover:border-[#1F1F1F] hover:shadow-xs"
              >
                {content}
              </Link>
            ) : (
              <article
                key={criterion.id}
                className="group flex h-full flex-col justify-between rounded-3xl border border-[#E5E5E5] bg-white p-5 sm:p-6 shadow-2xs"
              >
                {content}
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Section C: Superhost Benefits ── */}
      <section className="rounded-3xl border border-white bg-[#F3F4F5] p-5 sm:p-8 shadow-[0_2px_4px_0px_#00000040]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-black/5 pb-4">
          <div>
            <p className="text-xs sm:text-sm font-normal text-[#727272]">Perks & recognition</p>
            <h2 className="mt-1 text-xl sm:text-2xl font-medium tracking-tight text-[#1F1F1F]">
              Superhost benefits on Homyz
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-normal text-[#727272]">
              Exclusive advantages granted to verified Superhosts across the platform.
            </p>
          </div>
          <span className="text-xs font-normal text-[#727272]">Verified Homyz features</span>
        </div>

        <div className="mt-6 grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-4">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="group flex h-full flex-col justify-between rounded-2xl border border-[#E5E5E5] bg-white p-4.5 sm:p-5 shadow-2xs transition-all duration-300 hover:border-[#1F1F1F]"
            >
              <div>
                <span className="flex size-9 items-center justify-center rounded-full border border-[#FCDF9C] bg-[#FFF9EB] text-[#B88700] shadow-2xs">
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </span>
                <h3 className="mt-3.5 text-sm font-medium text-[#1F1F1F]">{benefit.title}</h3>
                <p className="mt-1.5 text-xs font-normal leading-relaxed text-[#727272]">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
