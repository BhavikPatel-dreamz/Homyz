"use client";

import React from "react";

export function SectionHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-zinc-200" />
      <div className="h-4 w-72 rounded bg-zinc-100" />
    </div>
  );
}

export function SavedListingsSkeleton() {
  return (
    <div aria-label="Loading saved listings" role="status" className="space-y-6 animate-pulse">
      <SectionHeaderSkeleton />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col space-y-3">
            <div className="aspect-[4/3] w-full rounded-2xl bg-zinc-200" />
            <div className="h-4 w-3/4 rounded bg-zinc-200" />
            <div className="h-3 w-1/2 rounded bg-zinc-100" />
            <div className="h-4 w-1/3 rounded bg-zinc-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <div aria-label="Loading notifications" role="status" className="max-w-3xl space-y-4 animate-pulse">
      <SectionHeaderSkeleton />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 rounded-2xl border border-zinc-100 p-4">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-zinc-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-zinc-200" />
              <div className="h-3 w-3/4 rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoyaltyWalletSkeleton() {
  return (
    <div aria-label="Loading loyalty points" role="status" className="max-w-4xl space-y-6 animate-pulse">
      <SectionHeaderSkeleton />
      <div className="h-36 w-full rounded-3xl bg-zinc-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-28 rounded-2xl bg-zinc-100" />
        <div className="h-28 rounded-2xl bg-zinc-100" />
      </div>
    </div>
  );
}

export function ProfileManagementSkeleton() {
  return (
    <div aria-label="Loading profile management" role="status" className="space-y-8 animate-pulse">
      <div className="flex flex-col items-start gap-7 xl:flex-row xl:items-center xl:gap-6">
        <div className="h-[264px] w-full max-w-[360px] rounded-3xl bg-zinc-200" />
        <div className="flex flex-1 items-center gap-5">
          <div className="h-24 w-24 shrink-0 rounded-full bg-zinc-200" />
          <div className="space-y-3">
            <div className="h-5 w-80 max-w-full rounded bg-zinc-200" />
            <div className="h-4 w-48 rounded bg-zinc-100" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 border-b border-zinc-200 pb-3">
        <div className="h-10 w-44 rounded-full bg-zinc-200" />
        <div className="h-10 w-28 rounded-full bg-zinc-100" />
        <div className="h-10 w-36 rounded-full bg-zinc-100" />
      </div>

      <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3.5 border-b border-zinc-200/80 py-5">
            <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 rounded bg-zinc-200" />
              <div className="h-4 w-24 rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SupportChatSkeleton() {
  return (
    <div aria-label="Loading concierge chat" role="status" className="max-w-2xl space-y-4 animate-pulse">
      <SectionHeaderSkeleton />
      <div className="h-80 w-full rounded-2xl border border-zinc-200 bg-zinc-50" />
    </div>
  );
}
