"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/language-context";

export function HostDisputeDetailsSkeleton() {
  const { t } = useLanguage();

  return (
    <div className="w-full space-y-8 font-sans text-[#1F1F1F]">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-[#727272]">
        <span className="font-medium text-[#1F1F1F]">
          {t("host_dispute_back_center", "← Resolution Center")}
        </span>
        <span className="text-zinc-300">/</span>
        <div className="h-4 w-28 rounded-md bg-zinc-200 skeleton-shimmer" />
      </div>

      {/* Main Header with Actions */}
      <header className="flex flex-col gap-4 sm:gap-5 border-b border-zinc-200 pb-6 sm:pb-7 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2.5 flex-1 min-w-0">
          {/* Status & Category Badges */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <div className="h-5 w-24 rounded-md bg-zinc-200 skeleton-shimmer" />
            <div className="h-6 w-24 rounded-full bg-zinc-100 skeleton-shimmer" />
            <div className="h-6 w-24 rounded-full bg-zinc-100 skeleton-shimmer" />
            <div className="h-6 w-32 rounded-full bg-zinc-100 skeleton-shimmer" />
          </div>

          {/* Title */}
          <div className="mt-2 h-8 sm:h-9 lg:h-10 w-64 sm:w-80 rounded-xl bg-zinc-200 skeleton-shimmer" />

          {/* Subtitle / Metadata */}
          <div className="h-4 w-full max-w-md rounded-md bg-zinc-100 skeleton-shimmer" />
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full xl:w-auto">
          <div className="h-11 w-full sm:w-32 rounded-full bg-zinc-900/10 skeleton-shimmer" />
          <div className="h-11 w-full sm:w-36 rounded-full bg-zinc-100 skeleton-shimmer" />
        </div>
      </header>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* LEFT COLUMN: Tabs & Main Content */}
        <div className="space-y-6 min-w-0">
          {/* Navigation Tabs Bar */}
          <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-2 sm:gap-2.5 overflow-x-auto border-b border-zinc-200 pb-3 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="h-10 sm:h-11 w-28 sm:w-32 shrink-0 rounded-full bg-zinc-900/10 skeleton-shimmer" />
              <div className="h-10 sm:h-11 w-28 sm:w-32 shrink-0 rounded-full bg-zinc-100 skeleton-shimmer" />
              <div className="h-10 sm:h-11 w-24 sm:w-28 shrink-0 rounded-full bg-zinc-100 skeleton-shimmer" />
              <div className="h-10 sm:h-11 w-24 sm:w-28 shrink-0 rounded-full bg-zinc-100 skeleton-shimmer" />
              <div className="h-10 sm:h-11 w-32 sm:w-36 shrink-0 rounded-full bg-zinc-100 skeleton-shimmer" />
            </div>
          </div>

          {/* Complaint Description Card Skeleton */}
          <section className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="h-5 w-48 rounded bg-zinc-200 skeleton-shimmer" />
              <div className="h-4 w-28 rounded bg-zinc-100 skeleton-shimmer" />
            </div>
            <div className="space-y-2.5 pt-2">
              <div className="h-4 w-full rounded bg-zinc-100 skeleton-shimmer" />
              <div className="h-4 w-5/6 rounded bg-zinc-100 skeleton-shimmer" />
              <div className="h-4 w-2/3 rounded bg-zinc-100 skeleton-shimmer" />
            </div>
          </section>

          {/* Quick Actions Panel Skeleton */}
          <section className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs space-y-4">
            <div className="h-5 w-48 rounded bg-zinc-200 skeleton-shimmer" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="h-16 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 skeleton-shimmer" />
              <div className="h-16 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 skeleton-shimmer" />
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Sidebar Summary */}
        <div className="space-y-6">
          <div className="rounded-[20px] border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
            <div className="h-5 w-36 rounded bg-zinc-200 skeleton-shimmer" />
            <div className="h-24 w-full rounded-2xl bg-zinc-100 skeleton-shimmer" />
            <div className="space-y-2 pt-2">
              <div className="h-4 w-3/4 rounded bg-zinc-100 skeleton-shimmer" />
              <div className="h-4 w-1/2 rounded bg-zinc-100 skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
