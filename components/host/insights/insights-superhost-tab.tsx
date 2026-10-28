"use client";

import Link from "next/link";
import type { HostInsightsData } from "@/services/host-insights.service";

interface Props { data: HostInsightsData["superhost"]; }

const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
const criterionHref: Record<string, string> = {
  LISTING_OWNERSHIP: "/host/listings", HOSTING_VOLUME: "/host/bookings", RATING: "/host/insights?tab=reviews", RESPONSE_RATE: "/host/insights/stats/response-rate", CANCELLATION_RATE: "/host/insights/stats/cancellations", GOOD_STANDING: "/host/profile",
};

export function InsightsSuperhostTab({ data }: Props) {
  const { officialStatus, isQualified, eligibilityStatus, windowStart, windowEnd, nextEvaluationAt, criteria, benefits, gaps } = data;
  const isBlocked = eligibilityStatus === "CANNOT_DETERMINE";
  const metCount = criteria.filter((item) => item.isMet).length;

  return <div className="space-y-10">
    <section className="rounded-3xl border border-[#E5E5E5] bg-gradient-to-br from-[#FAFAFA] to-white p-6 shadow-sm sm:p-8" aria-labelledby="superhost-status-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <span className={`inline-flex rounded-full border px-3.5 py-1 text-xs font-semibold ${officialStatus ? "border-[#FCDF9C] bg-[#FEF9EE] text-[#D97706]" : isBlocked ? "border-amber-200 bg-amber-50 text-amber-900" : isQualified ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[#EDEDED] bg-[#F3F4F5] text-[#1F1F1F]"}`}>{officialStatus ? "Official Superhost" : isBlocked ? "Assessment needs review" : isQualified ? "Eligible at next assessment" : "Superhost in progress"}</span>
          <h2 id="superhost-status-heading" className="mt-3 text-2xl font-bold tracking-tight text-[#1F1F1F] sm:text-3xl">{officialStatus ? "You are a Superhost" : isBlocked ? "Qualification cannot be determined yet" : `${metCount} of ${criteria.length} criteria completed`}</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#727272] sm:text-sm">Assessment period: {formatDate(windowStart)} – {formatDate(windowEnd)} · Next evaluation: <strong className="font-semibold text-[#1F1F1F]">{formatDate(nextEvaluationAt)}</strong></p>
        </div>
        <div className="text-right"><span className="text-3xl font-bold text-[#1F1F1F] sm:text-4xl">{isBlocked ? "—" : `${Math.round((metCount / criteria.length) * 100)}%`}</span><p className="text-[11px] font-medium text-[#727272]">Progress to Superhost</p><Link href="/host/insights/superhost/history" className="mt-2 inline-block text-xs font-semibold text-[#1F1F1F] underline hover:text-[#727272]">Assessment history</Link></div>
      </div>
      {(gaps.length > 0 || isBlocked) && !officialStatus && <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900"><p className="font-semibold">{isBlocked ? "Assessment needs resolution:" : "Actions needed before next assessment:"}</p><ul className="mt-1.5 list-disc space-y-1 pl-5">{gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul></div>}
    </section>

    <section className="space-y-4" aria-labelledby="superhost-criteria-heading">
      <div><h2 id="superhost-criteria-heading" className="text-xl font-bold text-[#1F1F1F]">Superhost qualification criteria</h2><p className="mt-1 text-xs text-[#727272]">Six authoritative host-level criteria, assessed automatically each quarter.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">{criteria.map((criterion) => {
        const href = criterionHref[criterion.id];
        const body = <><div><div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold text-[#1F1F1F]">{criterion.title}</h3><span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${criterion.status === "PASS" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : criterion.status === "BLOCKED" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-[#EDEDED] bg-[#F3F4F5] text-[#727272]"}`}>{criterion.status === "PASS" ? "Pass" : criterion.status === "BLOCKED" ? "Blocked" : "Not met"}</span></div><p className="mt-2 text-xs leading-relaxed text-[#727272]">{criterion.description}</p></div><div className="mt-6 border-t border-[#EDEDED] pt-4"><div className="flex items-baseline justify-between gap-3 text-xs"><span className="font-semibold text-[#1F1F1F]">{criterion.currentValue}</span><span className="text-right text-[#727272]">Target: {criterion.targetValue}</span></div>{criterion.progressPercentage === null ? <p className="mt-2 text-xs font-medium text-amber-900">Progress is unavailable until this criterion is resolved.</p> : <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#F3F4F5]"><div className={`h-full rounded-full ${criterion.status === "PASS" ? "bg-emerald-600" : "bg-[#1F1F1F]"}`} style={{ width: `${criterion.progressPercentage}%` }} /></div>}</div></>;
        return href ? <Link key={criterion.id} href={href} className="flex flex-col justify-between rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm transition hover:border-[#1F1F1F]">{body}</Link> : <article key={criterion.id} className="flex flex-col justify-between rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm">{body}</article>;
      })}</div>
    </section>

    <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-bold text-[#1F1F1F]">Superhost benefits on Homyz</h2><p className="mt-1 text-xs text-[#727272]">Benefits shown here are limited to features verified in Homyz.</p><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{benefits.map((benefit) => <div key={benefit.title} className="rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-4"><span className="flex size-10 items-center justify-center rounded-xl bg-[#1F1F1F] text-sm font-bold text-white">★</span><h3 className="mt-3 text-sm font-bold text-[#1F1F1F]">{benefit.title}</h3><p className="mt-1 text-xs leading-relaxed text-[#727272]">{benefit.description}</p></div>)}</div></section>
  </div>;
}
