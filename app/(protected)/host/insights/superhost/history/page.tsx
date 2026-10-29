import React from "react";
import Link from "next/link";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { getSuperhostAssessmentHistory } from "@/services/superhost.service";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { BackButton } from "@/components/ui/back-button";
import {
  HOST_REPORTING_CONTAINER_CLASS,
  HOST_REPORTING_MAIN_CLASS,
} from "@/components/host/dashboard/host-reporting-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const getQuarterLabel = (date: Date) => {
  const d = new Date(date);
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter} ${year}`;
};

export default async function SuperhostAssessmentHistoryPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const evaluations = await getSuperhostAssessmentHistory(actor.id);
  const chronological = [...evaluations].reverse();
  const rows = chronological
    .map((evaluation, index) => {
      const blocked = evaluation.failureReasons.some((reason) =>
        /cannot be verified|cannot be determined/i.test(reason),
      );
      const previous = chronological[index - 1];
      const outcome = blocked
        ? "Review required"
        : evaluation.qualified
          ? previous?.qualified
            ? "Renewed"
            : "Awarded"
          : previous?.qualified
            ? "Status lost"
            : "Not qualified";
      return { evaluation, blocked, outcome };
    })
    .reverse();

  const totalEvaluations = evaluations.length;
  const qualifiedCount = evaluations.filter((e) => e.qualified).length;
  const latestEvaluation = rows[0];

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-0">
      <HostHeader />
      <main className={HOST_REPORTING_MAIN_CLASS}>
        <Container className={HOST_REPORTING_CONTAINER_CLASS}>
          <div className="space-y-6 sm:space-y-8">
            {/* Top Navigation & Header */}
            <div className="flex flex-col gap-4 border-b border-[#E5E5E5] pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 sm:gap-4">
                <BackButton
                  href="/host/insights?tab=superhost"
                  aria-label="Back to Superhost"
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FCDF9C] bg-[#FFF9EB] px-3 py-0.5 text-xs font-medium text-[#8F6A00]">
                      <svg
                        className="size-3 text-[#B88700] shrink-0"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span>Superhost Program</span>
                    </span>
                    <span className="text-xs font-normal text-[#727272]">Historical evaluations</span>
                  </div>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-medium tracking-tight text-[#1F1F1F]">
                    Assessment history
                  </h1>
                  <p className="mt-1.5 text-xs sm:text-sm font-normal text-[#727272] leading-relaxed max-w-3xl">
                    Official quarterly evaluations are retained as finalized historical records. Review your past assessments, qualification outcomes, and criteria metrics across each 12-month evaluation window.
                  </p>
                </div>
              </div>

              {/* Quick Link to Current Superhost Status */}
              <Link
                href="/host/insights?tab=superhost"
                className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#EDEDED] bg-white hover:bg-[#1F1F1F] hover:text-white px-4 py-2 text-xs font-medium text-[#1F1F1F] transition shadow-2xs hover:border-[#1F1F1F] sm:self-auto"
              >
                <span>Live qualification</span>
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

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
              <div className="group flex h-full flex-col justify-between rounded-2xl border border-white bg-[#F3F4F5] p-3 min-[380px]:p-3.5 sm:p-5 shadow-[0_2px_4px_0px_#00000040] transition-all duration-300">
                <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm font-normal text-[#727272] truncate">Total assessments</span>
                  <span className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full border border-[#EDEDED] bg-white text-[#727272] shadow-2xs transition-all group-hover:border-[#1F1F1F] group-hover:text-[#1F1F1F]">
                    <svg className="size-3 sm:size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-4">
                  <p className="text-xl min-[380px]:text-2xl sm:text-3xl font-medium tracking-tight text-[#1F1F1F] truncate">
                    {totalEvaluations}
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs font-normal text-[#727272] leading-snug">
                    <span className="sm:hidden">Quarterly reviews</span>
                    <span className="hidden sm:inline">Recorded quarterly reviews</span>
                  </p>
                </div>
              </div>

              <div className="group flex h-full flex-col justify-between rounded-2xl border border-white bg-[#F3F4F5] p-3 min-[380px]:p-3.5 sm:p-5 shadow-[0_2px_4px_0px_#00000040] transition-all duration-300">
                <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm font-normal text-[#727272] truncate">Quarters qualified</span>
                  <span className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full border border-[#FCDF9C] bg-[#FFF9EB] text-[#B88700] shadow-2xs transition-all">
                    <svg className="size-3 sm:size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-4">
                  <p className="text-xl min-[380px]:text-2xl sm:text-3xl font-medium tracking-tight text-[#1F1F1F] truncate">
                    {qualifiedCount}
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs font-normal text-[#727272] leading-snug">
                    {totalEvaluations > 0 ? (
                      <>
                        <span className="sm:hidden">{Math.round((qualifiedCount / totalEvaluations) * 100)}% lifetime rate</span>
                        <span className="hidden sm:inline">{Math.round((qualifiedCount / totalEvaluations) * 100)}% lifetime qualification</span>
                      </>
                    ) : (
                      <>
                        <span className="sm:hidden">No reviews yet</span>
                        <span className="hidden sm:inline">No assessments completed</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="group flex h-full flex-col justify-between rounded-2xl border border-white bg-[#F3F4F5] p-3 min-[380px]:p-3.5 sm:p-5 shadow-[0_2px_4px_0px_#00000040] transition-all duration-300">
                <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm font-normal text-[#727272] truncate">Latest outcome</span>
                  <span className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full border border-[#EDEDED] bg-white text-[#727272] shadow-2xs transition-all group-hover:border-[#1F1F1F] group-hover:text-[#1F1F1F]">
                    <svg className="size-3 sm:size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 14 14" />
                    </svg>
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-4">
                  <p className="text-xl min-[380px]:text-2xl sm:text-3xl font-medium tracking-tight text-[#1F1F1F] truncate">
                    {latestEvaluation ? latestEvaluation.outcome : "Pending"}
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs font-normal text-[#727272] leading-snug">
                    {latestEvaluation ? (
                      dateFormat.format(latestEvaluation.evaluation.evaluationDate)
                    ) : (
                      <>
                        <span className="sm:hidden">Awaiting review</span>
                        <span className="hidden sm:inline">Awaiting first assessment</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="group flex h-full flex-col justify-between rounded-2xl border border-white bg-[#F3F4F5] p-3 min-[380px]:p-3.5 sm:p-5 shadow-[0_2px_4px_0px_#00000040] transition-all duration-300">
                <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm font-normal text-[#727272] truncate">Assessment cadence</span>
                  <span className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full border border-[#EDEDED] bg-white text-[#727272] shadow-2xs transition-all group-hover:border-[#1F1F1F] group-hover:text-[#1F1F1F]">
                    <svg className="size-3 sm:size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 21h5v-5" />
                    </svg>
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-4">
                  <p className="text-xl min-[380px]:text-2xl sm:text-3xl font-medium tracking-tight text-[#1F1F1F] truncate">
                    Quarterly
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs font-normal text-[#727272] leading-snug">
                    <span className="sm:hidden">Jan · Apr · Jul · Oct</span>
                    <span className="hidden sm:inline">Jan 1 · Apr 1 · Jul 1 · Oct 1</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Assessment Records or Empty State */}
            {evaluations.length === 0 ? (
              <div className="rounded-3xl border border-white bg-[#F3F4F5] p-8 sm:p-14 text-center shadow-[0_2px_4px_0px_#00000040]">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[#FCDF9C] bg-[#FFF9EB] text-[#B88700] shadow-2xs">
                  <svg
                    className="size-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h2 className="mt-4 text-lg sm:text-xl font-medium text-[#1F1F1F]">
                  No completed quarterly assessments are available yet
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm font-normal text-[#727272] leading-relaxed">
                  Evaluations take place automatically every quarter at midnight on January 1, April 1, July 1, and October 1. As soon as your first evaluation completes, finalized audit details will appear here.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/host/insights?tab=superhost"
                    className="inline-flex items-center gap-2 rounded-full bg-[#1F1F1F] px-5 py-2.5 text-xs font-medium text-white transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
                  >
                    <span>Check live Superhost progress</span>
                    <svg
                      className="size-3.5"
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
            ) : (
              <div className="space-y-4">
                {/* Desktop & Tablet Table (>= md) */}
                <div className="hidden md:block overflow-hidden rounded-3xl border border-[#E5E5E5] bg-white shadow-2xs">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#EDEDED] bg-[#FAFAFB] text-xs font-medium text-[#727272]">
                        <th className="px-5 py-4">Assessment Checkpoint</th>
                        <th className="px-5 py-4">12-Month Review Window</th>
                        <th className="px-5 py-4">Outcome</th>
                        <th className="px-5 py-4">Hosting Volume</th>
                        <th className="px-5 py-4">Guest Quality</th>
                        <th className="px-5 py-4">Reliability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDEDED]">
                      {rows.map(({ evaluation, blocked, outcome }) => {
                        const quarter = getQuarterLabel(evaluation.evaluationDate);
                        return (
                          <tr
                            key={evaluation.id}
                            className="align-top hover:bg-[#FAFAFB]/80 transition-colors"
                          >
                            <td className="px-5 py-4.5">
                              <span className="font-medium text-[#1F1F1F]">
                                {dateFormat.format(evaluation.evaluationDate)}
                              </span>
                              <span className="mt-0.5 block text-xs font-normal text-[#727272]">
                                {quarter} Checkpoint
                              </span>
                            </td>

                            <td className="px-5 py-4.5 text-xs text-[#727272]">
                              <span className="font-medium text-[#1F1F1F]">
                                {dateFormat.format(evaluation.windowStart)} – {dateFormat.format(evaluation.windowEnd)}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-[#727272]">
                                Preceding 365 days
                              </span>
                            </td>

                            <td className="px-5 py-4.5">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                                  blocked
                                    ? "border-amber-200 bg-amber-50 text-amber-900"
                                    : evaluation.qualified
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : "border-[#EDEDED] bg-[#F3F4F5] text-[#727272]"
                                }`}
                              >
                                {evaluation.qualified ? (
                                  <svg
                                    className="size-3 text-emerald-700"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : blocked ? (
                                  <svg
                                    className="size-3 text-amber-800"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                  </svg>
                                ) : null}
                                <span>{outcome}</span>
                              </span>

                              {blocked && (
                                <p className="mt-1.5 max-w-xs text-xs font-normal leading-relaxed text-amber-900">
                                  {evaluation.failureReasons.find((reason) =>
                                    /cannot be verified|cannot be determined/i.test(reason),
                                  )}
                                </p>
                              )}

                              {!blocked && !evaluation.qualified && evaluation.failureReasons.length > 0 && (
                                <ul className="mt-1.5 max-w-xs space-y-1 text-[11px] font-normal text-[#727272] leading-tight">
                                  {evaluation.failureReasons.map((reason, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <span className="size-1 rounded-full bg-[#727272] mt-1 shrink-0" />
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>

                            <td className="px-5 py-4.5 text-xs text-[#1F1F1F]">
                              <p className="font-medium text-[#1F1F1F]">
                                {evaluation.completedReservations} stays
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#727272]">
                                {evaluation.completedNights} nights hosted
                              </p>
                            </td>

                            <td className="px-5 py-4.5 text-xs text-[#1F1F1F]">
                              <p className="font-medium text-[#1F1F1F]">
                                {evaluation.overallRating !== null
                                  ? `${evaluation.overallRating.toFixed(2)} ★`
                                  : "No rating"}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#727272]">
                                {evaluation.publishedReviewCount} published reviews
                              </p>
                            </td>

                            <td className="px-5 py-4.5 text-xs text-[#1F1F1F]">
                              <p className="font-medium text-[#1F1F1F]">
                                {evaluation.responseRatePercentage !== null
                                  ? `${evaluation.responseRatePercentage}% response`
                                  : "—"}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#727272]">
                                {evaluation.hostCancellationRatePercentage}% cancellation ·{" "}
                                {evaluation.accountGoodStanding ? "Good standing" : "Account issues"}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List (< md) */}
                <div className="block md:hidden space-y-4">
                  {rows.map(({ evaluation, blocked, outcome }) => {
                    const quarter = getQuarterLabel(evaluation.evaluationDate);
                    return (
                      <div
                        key={evaluation.id}
                        className="rounded-3xl border border-[#E5E5E5] bg-white p-5 shadow-2xs space-y-4"
                      >
                        {/* Header: Date & Outcome */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-base font-medium text-[#1F1F1F]">
                              {dateFormat.format(evaluation.evaluationDate)}
                            </span>
                            <span className="block text-xs font-normal text-[#727272]">
                              {quarter} Assessment
                            </span>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                              blocked
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : evaluation.qualified
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-[#EDEDED] bg-[#F3F4F5] text-[#727272]"
                            }`}
                          >
                            {evaluation.qualified ? (
                              <svg
                                className="size-3 text-emerald-700"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : null}
                            <span>{outcome}</span>
                          </span>
                        </div>

                        {/* Review Period */}
                        <p className="text-xs font-normal text-[#727272] border-t border-[#EDEDED] pt-3">
                          Assessment period:{" "}
                          <span className="font-medium text-[#1F1F1F]">
                            {dateFormat.format(evaluation.windowStart)} – {dateFormat.format(evaluation.windowEnd)}
                          </span>
                        </p>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="rounded-2xl border border-[#EDEDED] bg-[#FAFAFB] p-3">
                            <span className="text-[11px] font-normal text-[#727272]">Hosting Volume</span>
                            <p className="mt-1 text-xs font-medium text-[#1F1F1F]">
                              {evaluation.completedReservations} stays · {evaluation.completedNights} nights
                            </p>
                          </div>

                          <div className="rounded-2xl border border-[#EDEDED] bg-[#FAFAFB] p-3">
                            <span className="text-[11px] font-normal text-[#727272]">Overall Rating</span>
                            <p className="mt-1 text-xs font-medium text-[#1F1F1F]">
                              {evaluation.overallRating !== null
                                ? `${evaluation.overallRating.toFixed(2)} ★`
                                : "No rating"}
                              <span className="ml-1 text-[11px] font-normal text-[#727272]">
                                ({evaluation.publishedReviewCount})
                              </span>
                            </p>
                          </div>

                          <div className="rounded-2xl border border-[#EDEDED] bg-[#FAFAFB] p-3">
                            <span className="text-[11px] font-normal text-[#727272]">Response Rate</span>
                            <p className="mt-1 text-xs font-medium text-[#1F1F1F]">
                              {evaluation.responseRatePercentage !== null
                                ? `${evaluation.responseRatePercentage}%`
                                : "—"}
                              <span className="ml-1 text-[11px] font-normal text-[#727272]">
                                ({evaluation.totalGuestInquiries} inq.)
                              </span>
                            </p>
                          </div>

                          <div className="rounded-2xl border border-[#EDEDED] bg-[#FAFAFB] p-3">
                            <span className="text-[11px] font-normal text-[#727272]">Cancellation Rate</span>
                            <p className="mt-1 text-xs font-medium text-[#1F1F1F]">
                              {evaluation.hostCancellationRatePercentage}%
                            </p>
                          </div>
                        </div>

                        {/* Blocked or failure reasons callout */}
                        {blocked && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                            <p className="font-medium text-amber-950">Resolution required:</p>
                            <p className="mt-0.5 font-normal leading-relaxed">
                              {evaluation.failureReasons.find((reason) =>
                                /cannot be verified|cannot be determined/i.test(reason),
                              )}
                            </p>
                          </div>
                        )}

                        {!blocked && !evaluation.qualified && evaluation.failureReasons.length > 0 && (
                          <div className="rounded-xl border border-[#EDEDED] bg-[#FAFAFB] p-3 text-xs">
                            <p className="font-medium text-[#1F1F1F]">Unmet qualification criteria:</p>
                            <ul className="mt-1.5 space-y-1 font-normal text-[#727272]">
                              {evaluation.failureReasons.map((reason, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="size-1 rounded-full bg-[#727272] mt-1.5 shrink-0" />
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Information Card about Quarterly Audits */}
            <div className="rounded-3xl border border-white bg-[#F3F4F5] p-5 sm:p-8 shadow-[0_2px_4px_0px_#00000040]">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between border-b border-black/5 pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-medium text-[#1F1F1F]">
                    How Superhost evaluations work
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm font-normal text-[#727272]">
                    Understand the qualification cycle, review intervals, and status retention.
                  </p>
                </div>
                <span className="text-xs font-normal text-[#727272]">Official Program Policy</span>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4.5 shadow-2xs">
                  <div className="flex size-8 items-center justify-center rounded-full border border-[#FCDF9C] bg-[#FFF9EB] text-[#B88700]">
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <h4 className="mt-3 text-sm font-medium text-[#1F1F1F]">Fixed Quarterly Windows</h4>
                  <p className="mt-1.5 text-xs font-normal leading-relaxed text-[#727272]">
                    Evaluations run automatically every 3 months on Jan 1, Apr 1, Jul 1, and Oct 1, assessing performance during the previous 365 days.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4.5 shadow-2xs">
                  <div className="flex size-8 items-center justify-center rounded-full border border-[#FCDF9C] bg-[#FFF9EB] text-[#B88700]">
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <h4 className="mt-3 text-sm font-medium text-[#1F1F1F]">Automatic Badge Grant</h4>
                  <p className="mt-1.5 text-xs font-normal leading-relaxed text-[#727272]">
                    Hosts do not need to apply. When all six criteria are satisfied, the Superhost badge is awarded or renewed automatically on your listings.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4.5 shadow-2xs">
                  <div className="flex size-8 items-center justify-center rounded-full border border-[#FCDF9C] bg-[#FFF9EB] text-[#B88700]">
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <h4 className="mt-3 text-sm font-medium text-[#1F1F1F]">Quarter-Long Status</h4>
                  <p className="mt-1.5 text-xs font-normal leading-relaxed text-[#727272]">
                    Once awarded, Superhost status and associated search placement benefits remain active for the entire quarter until the next scheduled assessment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
