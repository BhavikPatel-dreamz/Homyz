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
    <div aria-label="Loading saved listings" role="status" className="flex w-full min-w-0 flex-col animate-pulse">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between xl:mb-8">
        <div className="h-[30px] w-32 rounded-lg bg-zinc-200 sm:h-[36px] lg:h-[40px] xl:h-[44px]" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-[288/256] w-full rounded-2xl bg-zinc-200" />
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
    <div aria-label="Loading notifications" role="status" className="max-w-4xl space-y-6 animate-pulse">
      {/* Notifications Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-zinc-100">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded-lg bg-zinc-200 skeleton-shimmer" />
          <div className="h-4 w-72 rounded bg-zinc-100 skeleton-shimmer" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-zinc-100 skeleton-shimmer" />
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <div className="h-9 w-16 rounded-xl bg-zinc-200 skeleton-shimmer" />
        <div className="h-9 w-20 rounded-xl bg-zinc-100 skeleton-shimmer" />
        <div className="h-9 w-24 rounded-xl bg-zinc-100 skeleton-shimmer" />
        <div className="h-9 w-24 rounded-xl bg-zinc-100 skeleton-shimmer" />
        <div className="h-9 w-24 rounded-xl bg-zinc-100 skeleton-shimmer" />
      </div>

      {/* Notifications List Rows */}
      <div className="space-y-3 pt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs"
          >
            {/* Notification type icon */}
            <div className="h-10 w-10 shrink-0 rounded-xl bg-zinc-200 skeleton-shimmer" />

            {/* Notification content */}
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="h-4 w-48 rounded bg-zinc-200 skeleton-shimmer" />
                <div className="h-3 w-16 rounded bg-zinc-100 skeleton-shimmer" />
              </div>
              <div className="h-3.5 w-3/4 rounded bg-zinc-100 skeleton-shimmer" />
              <div className="h-3 w-28 rounded bg-zinc-100 skeleton-shimmer" />
            </div>

            {/* Read/unread toggle button placeholder */}
            <div className="h-6 w-6 shrink-0 rounded-full bg-zinc-100 skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoyaltyWalletSkeleton() {
  return (
    <div aria-label="Loading loyalty points" role="status" className="flex flex-col animate-pulse">
      <div className="mb-6 space-y-2 lg:mb-8">
        <div className="h-[30px] w-64 rounded-lg bg-zinc-200 sm:h-[36px] lg:h-[40px] xl:h-[44px]" />
        <div className="h-5 w-full max-w-2xl rounded bg-zinc-100" />
      </div>
      <div className="mb-8 h-[238px] rounded-3xl border border-zinc-200 bg-zinc-100 sm:h-[248px]" />
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[102px] rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
      <div className="mb-4 h-7 w-44 rounded bg-zinc-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[178px] rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
    </div>
  );
}

export function InviteEarnSkeleton() {
  return (
    <div aria-label="Loading invite and earn" role="status" className="flex w-full max-w-[1080px] flex-col animate-pulse">
      <div className="mb-7 space-y-2 lg:mb-9">
        <div className="h-[30px] w-52 rounded-lg bg-zinc-200 sm:h-[36px] lg:h-[40px] xl:h-[44px]" />
        <div className="h-5 w-full max-w-xl rounded bg-zinc-100" />
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <div className="h-5 w-36 rounded bg-zinc-200" />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="h-12 flex-1 rounded-xl bg-zinc-100" />
          <div className="h-12 w-28 rounded-full bg-zinc-200" />
        </div>
        <div className="mt-4 h-10 w-40 rounded-full bg-zinc-100" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-[122px] rounded-2xl border border-zinc-200 bg-white p-5" />)}
      </div>
      <div className="mt-6 h-[260px] rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6" />
      <div className="mt-6 h-[122px] rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6" />
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
    <div aria-label="Loading concierge chat" role="status" className="flex flex-col animate-pulse">
      {/* Title Header Skeleton */}
      <div className="mb-6 space-y-2 lg:mb-8">
        <div className="h-9 w-72 rounded-lg bg-zinc-200 skeleton-shimmer" />
        <div className="h-4 w-full max-w-xl rounded bg-zinc-100 skeleton-shimmer" />
      </div>

      {/* Grid Layout matching SupportChatView */}
      <div className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        {/* Live Chat Box Skeleton */}
        <div className="flex h-[540px] min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xs">
          {/* Agent Header Bar */}
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-zinc-200 skeleton-shimmer" />
              <div className="space-y-1.5">
                <div className="h-4 w-36 rounded bg-zinc-200 skeleton-shimmer" />
                <div className="h-3 w-48 rounded bg-zinc-100 skeleton-shimmer" />
              </div>
            </div>
            <div className="h-3 w-28 rounded bg-zinc-100 skeleton-shimmer max-[420px]:hidden" />
          </div>

          {/* Chat Messages Feed Skeleton */}
          <div className="flex-1 overflow-hidden p-4 sm:p-6 space-y-4">
            {/* Agent Message Bubble */}
            <div className="flex flex-col items-start">
              <div className="h-16 w-3/4 max-w-[85%] rounded-2xl rounded-bl-none bg-zinc-100 skeleton-shimmer" />
              <div className="mt-1 h-2.5 w-12 rounded bg-zinc-100" />
            </div>
            {/* User Message Bubble */}
            <div className="flex flex-col items-end">
              <div className="h-10 w-1/2 max-w-[75%] rounded-2xl rounded-br-none bg-zinc-200 skeleton-shimmer" />
              <div className="mt-1 h-2.5 w-12 rounded bg-zinc-100" />
            </div>
            {/* Agent Reply Bubble */}
            <div className="flex flex-col items-start">
              <div className="h-14 w-2/3 max-w-[85%] rounded-2xl rounded-bl-none bg-zinc-100 skeleton-shimmer" />
              <div className="mt-1 h-2.5 w-12 rounded bg-zinc-100" />
            </div>
          </div>

          {/* Quick Prompts Bar Skeleton */}
          <div className="flex items-center gap-2 border-t border-zinc-200 bg-white px-4 py-2">
            <div className="h-8 w-44 rounded-full bg-zinc-100 skeleton-shimmer" />
            <div className="h-8 w-52 rounded-full bg-zinc-100 skeleton-shimmer" />
            <div className="h-8 w-40 rounded-full bg-zinc-100 skeleton-shimmer" />
          </div>

          {/* Message Input Bar Skeleton */}
          <div className="flex items-center gap-2 border-t border-zinc-200 bg-white p-3">
            <div className="h-10 flex-1 rounded-full bg-zinc-100 skeleton-shimmer" />
            <div className="h-10 w-20 rounded-full bg-zinc-200 skeleton-shimmer" />
          </div>
        </div>

        {/* Other Help Channels Sidebar Skeleton */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 xl:flex xl:flex-col">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
              <div className="h-4 w-32 rounded bg-zinc-200 skeleton-shimmer" />
              <div className="h-3.5 w-full rounded bg-zinc-100 skeleton-shimmer" />
              <div className="h-3.5 w-4/5 rounded bg-zinc-100 skeleton-shimmer" />
              <div className="pt-1">
                <div className="h-4 w-28 rounded bg-zinc-200 skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PersonalInfoSkeleton() {
  return (
    <div aria-label="Loading personal information" role="status" className="w-full max-w-2xl space-y-6 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-zinc-200 skeleton-shimmer" />
      <div className="divide-y divide-zinc-200">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-5">
            <div className="space-y-2">
              <div className="h-4 w-36 rounded bg-zinc-200 skeleton-shimmer" />
              <div className="h-3 w-48 rounded bg-zinc-100 skeleton-shimmer" />
            </div>
            <div className="h-4 w-12 rounded bg-zinc-200 skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
