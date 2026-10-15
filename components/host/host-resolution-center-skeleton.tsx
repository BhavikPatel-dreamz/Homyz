"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/language-context";

export function HostResolutionCenterSkeleton() {
  const { t } = useLanguage();

  return (
    <div className="w-full space-y-8 font-sans text-[#1F1F1F]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              {t("host_res_center_breadcrumb_ops", "Host Operations")}
            </span>
            <span className="text-zinc-300">/</span>
            <span className="text-xs sm:text-sm text-[#727272]">{t("host_res_center_title", "Resolution Center")}</span>
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1F1F1F]">
            {t("host_res_center_title", "Resolution Center")}
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-[#727272] max-w-2xl leading-relaxed">
            {t("host_res_center_desc", "Manage booking complaints, respond to support inquiries, submit evidence, and propose resolutions for your properties.")}
          </p>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[20px] border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-[#727272]">
            {t("host_res_center_kpi_total", "Total Disputes")}
          </span>
          <div className="mt-3 h-9 sm:h-10 w-20 rounded-xl bg-zinc-200 skeleton-shimmer" />
        </div>

        <div className="rounded-[20px] border border-amber-300 bg-amber-50/70 p-5 sm:p-6 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-amber-900">
            {t("host_res_center_kpi_response_req", "Response Required")}
          </span>
          <div className="mt-3 h-9 sm:h-10 w-16 rounded-xl bg-amber-200/80 skeleton-shimmer" />
        </div>

        <div className="rounded-[20px] border border-blue-200 bg-blue-50/70 p-5 sm:p-6 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-blue-900">
            {t("host_res_center_kpi_under_review", "Under Review")}
          </span>
          <div className="mt-3 h-9 sm:h-10 w-16 rounded-xl bg-blue-200/80 skeleton-shimmer" />
        </div>

        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-900">
            {t("host_res_center_kpi_resolved", "Resolved")}
          </span>
          <div className="mt-3 h-9 sm:h-10 w-16 rounded-xl bg-emerald-200/80 skeleton-shimmer" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
        <div className="h-11 w-24 shrink-0 rounded-full bg-zinc-900/10 skeleton-shimmer" />
        <div className="h-11 w-36 shrink-0 rounded-full bg-zinc-200/60 skeleton-shimmer" />
        <div className="h-11 w-24 shrink-0 rounded-full bg-zinc-200/60 skeleton-shimmer" />
        <div className="h-11 w-24 shrink-0 rounded-full bg-zinc-200/60 skeleton-shimmer" />
      </div>

      {/* Filter Controls Panel */}
      <div className="grid gap-3.5 rounded-[20px] border border-zinc-200 bg-zinc-50/80 p-5 md:grid-cols-6 text-sm">
        <div className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white md:col-span-2 skeleton-shimmer" />
        <div className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white skeleton-shimmer" />
        <div className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white skeleton-shimmer" />
        <div className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white skeleton-shimmer" />
        <div className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white skeleton-shimmer" />
      </div>

      {/* Disputes List */}
      <div className="overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-xs divide-y divide-zinc-100">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-5 p-5 sm:p-7 md:flex-row md:items-center md:justify-between"
          >
            {/* Left: Thumbnail & Content Info */}
            <div className="flex items-start gap-4 sm:gap-5 min-w-0 flex-1">
              {/* Property Thumbnail */}
              <div className="size-20 sm:size-24 shrink-0 rounded-2xl bg-zinc-200 skeleton-shimmer" />

              <div className="min-w-0 space-y-2.5 flex-1">
                {/* Badges Line */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-4 w-20 rounded-md bg-zinc-200 skeleton-shimmer" />
                  <div className="h-5 w-24 rounded-full bg-zinc-100 skeleton-shimmer" />
                  <div className="h-5 w-28 rounded-full bg-zinc-100 skeleton-shimmer" />
                </div>

                {/* Property Title */}
                <div className="h-6 w-3/4 max-w-sm rounded-lg bg-zinc-200 skeleton-shimmer" />

                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-4 w-24 rounded-md bg-zinc-100 skeleton-shimmer" />
                  <div className="h-4 w-32 rounded-md bg-zinc-100 skeleton-shimmer" />
                  <div className="h-4 w-28 rounded-md bg-zinc-100 skeleton-shimmer" />
                </div>
              </div>
            </div>

            {/* Actions Column */}
            <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center pt-2 md:pt-0">
              <div className="h-10 w-24 rounded-full bg-zinc-100 skeleton-shimmer" />
              <div className="h-10 w-28 rounded-full bg-zinc-200 skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
