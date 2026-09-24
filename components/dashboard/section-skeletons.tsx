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
    <div aria-label="Loading profile management" role="status" className="max-w-2xl space-y-6 animate-pulse">
      <div className="flex gap-3 border-b border-zinc-200 pb-3">
        <div className="h-6 w-20 rounded bg-zinc-200" />
        <div className="h-6 w-20 rounded bg-zinc-100" />
        <div className="h-6 w-20 rounded bg-zinc-100" />
      </div>
      <div className="space-y-4">
        <div className="h-12 w-full rounded-xl bg-zinc-100" />
        <div className="h-12 w-full rounded-xl bg-zinc-100" />
        <div className="h-24 w-full rounded-xl bg-zinc-100" />
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

