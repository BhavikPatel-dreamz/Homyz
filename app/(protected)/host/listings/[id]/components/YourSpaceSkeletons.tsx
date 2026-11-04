"use client";

import React from "react";
import { Container } from "@/components/ui/container";

// ============================================================================
// BASE SHIMMER & SKELETON PRIMITIVES
// ============================================================================

export function SkeletonBox({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`animate-pulse rounded-xl bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({
  className = "",
  width,
}: {
  className?: string;
  width?: string;
}) {
  return (
    <div
      style={width ? { width } : undefined}
      className={`animate-pulse rounded-md bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCircle({
  className = "w-10 h-10",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-full bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0 motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonButton({
  className = "h-10 w-28",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-full bg-zinc-200/90 dark:bg-zinc-700/90 skeleton-shimmer shrink-0 motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonToggle() {
  return (
    <div
      className="h-6 w-11 rounded-full bg-zinc-200 dark:bg-zinc-700 skeleton-shimmer shrink-0"
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white bg-white p-4 shadow-[0px_2px_4px_0px_#00000040] space-y-3 transition-all duration-300 dark:bg-zinc-800/90 dark:border-zinc-700 ${className}`}
    >
      {children}
    </div>
  );
}

// ============================================================================
// 1. PHOTOS BOX SKELETON (Matches PhotoTourManager.tsx)
// ============================================================================

export function PhotosSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-3 sm:grid-cols-3 animate-in fade-in font-sans">
      {/* Cover Photo Slot */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-200/90 border border-zinc-200 shadow-xs">
        <SkeletonBox className="w-full h-full rounded-none" />
        <div className="absolute top-2 left-2">
          <SkeletonBox className="h-5 w-14 rounded-md bg-white/80" />
        </div>
      </div>

      {/* 4 Regular Photo Slots */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="aspect-[4/3] overflow-hidden rounded-xl bg-zinc-200/80 border border-zinc-200 shadow-xs"
        >
          <SkeletonBox className="w-full h-full rounded-none" />
        </div>
      ))}

      {/* Add photos placeholder slot */}
      <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white gap-2">
        <SkeletonCircle className="w-7 h-7" />
        <SkeletonText className="h-3 w-20" />
      </div>
    </div>
  );
}
export const PhotosBoxSkeleton = PhotosSkeleton;

// ============================================================================
// 2. TITLE BOX SKELETON (Matches PropertyDetailsViews.tsx -> title)
// ============================================================================

export function TitleSkeleton() {
  return (
    <div className="space-y-3 pt-1 animate-in fade-in font-sans">
      <div className="w-full rounded-2xl border border-zinc-300 bg-white p-4 shadow-2xs">
        <SkeletonText className="h-4 w-3/4" />
      </div>
      <div className="flex justify-between items-center px-1">
        <SkeletonText className="h-3 w-32" />
        <SkeletonText className="h-3 w-10" />
      </div>

      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}
export const TitleBoxSkeleton = TitleSkeleton;

// ============================================================================
// 3. PROPERTY TYPE BOX SKELETON (Matches PropertyDetailsViews.tsx -> propertyType)
// Exactly matches the red-boxed area in user reference image
// ============================================================================

export function PropertyTypeSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in pb-10 pr-0 font-sans lg:pr-6">
      {/* Back button & Section Header Skeleton */}
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-10 rounded-full shrink-0" />
        <SkeletonText className="h-8 w-52 rounded-lg" />
      </div>

      <div className="space-y-5 pt-1 max-w-none lg:max-w-[491px]">
      {/* 1. Which is most like your place? */}
      <div className="space-y-3">
        <SkeletonText className="h-3.5 w-44" />
        <div className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 flex items-center justify-between shadow-2xs">
          <SkeletonText className="h-3.5 w-28" />
          <SkeletonBox className="w-4 h-4 rounded-xs" />
        </div>
      </div>

      {/* 2. Property type */}
      <div className="space-y-3">
        <SkeletonText className="h-3.5 w-28" />
        <div className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 flex items-center justify-between shadow-2xs">
          <SkeletonText className="h-3.5 w-32" />
          <SkeletonBox className="w-4 h-4 rounded-xs" />
        </div>
        <SkeletonText className="h-3 w-72" />
      </div>

      {/* 3. Listing type */}
      <div className="space-y-3">
        <SkeletonText className="h-3.5 w-24" />
        <div className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 flex items-center justify-between shadow-2xs">
          <SkeletonText className="h-3.5 w-24" />
          <SkeletonBox className="w-4 h-4 rounded-xs" />
        </div>
        <SkeletonText className="h-3 w-80" />
      </div>

      {/* Stories / levels */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-3">
          <SkeletonText className="h-3.5 w-28" />
          <SkeletonText className="h-3 w-56" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonCircle className="w-7 h-7" />
          <SkeletonText className="w-4 h-3.5" />
          <SkeletonCircle className="w-7 h-7" />
        </div>
      </div>

      {/* Private entrance */}
      <div className="flex items-center justify-between py-2 border-t border-zinc-100">
        <div className="space-y-3">
          <SkeletonText className="h-3.5 w-28" />
          <SkeletonText className="h-3 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonCircle className="w-6 h-6" />
          <SkeletonCircle className="w-6 h-6" />
        </div>
      </div>

      {/* Year built */}
      <div className="space-y-3">
        <SkeletonText className="h-3.5 w-20" />
        <div className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 flex items-center justify-between shadow-2xs">
          <SkeletonText className="h-3.5 w-36" />
          <SkeletonBox className="w-4 h-4 rounded-xs" />
        </div>
      </div>

      {/* Property size & Unit */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8 space-y-1.5">
          <SkeletonText className="h-3.5 w-24" />
          <div className="w-full rounded-2xl border border-zinc-300 bg-white p-3.5 shadow-2xs">
            <SkeletonText className="h-3.5 w-16" />
          </div>
        </div>
        <div className="sm:col-span-4 space-y-1.5">
          <SkeletonText className="h-3.5 w-12" />
          <div className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 flex items-center justify-between shadow-2xs">
            <SkeletonText className="h-3.5 w-16" />
            <SkeletonBox className="w-4 h-4 rounded-xs" />
          </div>
        </div>
      </div>
      <SkeletonText className="h-3 w-64 text-[#727272]" />

      {/* Property categorization card */}
      <div className="pt-2 border-t border-zinc-200">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <SkeletonText className="h-3.5 w-40" />
            <SkeletonText className="h-3 w-72" />
          </div>
          <div className="sm:rounded-2xl rounded-lg shadow-md bg-white p-4 w-36 flex flex-col items-center gap-1">
            <SkeletonText className="h-3.5 w-16" />
            <SkeletonText className="h-2.5 w-24" />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <SkeletonButton className="h-11 w-28 rounded-full" />
      </div>
    </div>
    </div>
  );
}
export const PropertyTypeBoxSkeleton = PropertyTypeSkeleton;

// ============================================================================
// 4. PRICING BOX SKELETON (Matches PricingAndBookingViews.tsx -> pricing)
// ============================================================================

export function PricingSkeleton() {
  return (
    <div className="space-y-5 pt-1 animate-in fade-in font-sans">
      {/* Card 1: Base price card */}
      <SkeletonCard className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonText className="h-3.5 w-24" />
          <div className="flex items-center gap-2">
            <SkeletonText className="h-3 w-20" />
            <SkeletonToggle />
          </div>
        </div>
        <div className="flex items-baseline gap-2 pt-1">
          <SkeletonText className="h-6 w-8" />
          <SkeletonText className="h-8 w-24" />
        </div>
      </SkeletonCard>

      {/* Card 2: Weekend adjustment */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SkeletonText className="h-3.5 w-36" />
          <SkeletonText className="h-3 w-20" />
        </div>
        <SkeletonCard className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SkeletonCircle className="w-8 h-8" />
            <SkeletonText className="w-8 h-4 text-center" />
            <SkeletonCircle className="w-8 h-8" />
          </div>
          <SkeletonText className="h-4 w-28" />
        </SkeletonCard>
      </div>

      {/* Card 3: Discounts */}
      <SkeletonCard className="space-y-4">
        <SkeletonText className="h-3.5 w-24" />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <SkeletonText className="h-3.5 w-28" />
              <SkeletonText className="h-3 w-40 mt-1" />
            </div>
            <SkeletonBox className="h-8 w-20 rounded-xl" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
            <div>
              <SkeletonText className="h-3.5 w-28" />
              <SkeletonText className="h-3 w-40 mt-1" />
            </div>
            <SkeletonBox className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      </SkeletonCard>

      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}
export const PricingBoxSkeleton = PricingSkeleton;

// ============================================================================
// 5. AVAILABILITY BOX SKELETON (Matches PricingAndBookingViews.tsx -> availability)
// ============================================================================

export function AvailabilitySkeleton() {
  return (
    <div className="space-y-6 pt-1 animate-in fade-in font-sans">
      {/* Trip length */}
      <div className="space-y-2.5">
        <SkeletonText className="h-3.5 w-24" />
        <div className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 shadow-2xs flex items-center justify-between">
          <SkeletonText className="h-5 w-12" />
          <SkeletonText className="h-3 w-28" />
        </div>
        <div className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 shadow-2xs flex items-center justify-between">
          <SkeletonText className="h-5 w-12" />
          <SkeletonText className="h-3 w-28" />
        </div>
      </div>

      {/* Advance notice */}
      <div className="space-y-2">
        <SkeletonText className="h-3.5 w-28" />
        <SkeletonText className="h-3 w-72" />
        <div className="rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 flex items-center justify-between shadow-2xs">
          <SkeletonText className="h-3.5 w-24" />
          <SkeletonBox className="w-4 h-4 rounded-xs" />
        </div>
      </div>

      {/* Same-day requests */}
      <SkeletonCard className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <SkeletonText className="h-3.5 w-36" />
          <SkeletonText className="h-3 w-48" />
        </div>
        <SkeletonToggle />
      </SkeletonCard>

      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}
export const AvailabilityBoxSkeleton = AvailabilitySkeleton;

// ============================================================================
// 6. GUESTS BOX SKELETON (Matches PropertyDetailsViews.tsx -> guests)
// ============================================================================

export function GuestsSkeleton() {
  return (
    <div className="space-y-6 pt-1 animate-in fade-in font-sans">
      {/* Guest capacity card */}
      <SkeletonCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <SkeletonText className="h-3.5 w-32" />
            <SkeletonText className="h-3 w-48" />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonCircle className="w-8 h-8" />
            <SkeletonText className="w-6 h-4 text-center" />
            <SkeletonCircle className="w-8 h-8" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <SkeletonText className="h-3.5 w-20" />
              <SkeletonText className="h-2.5 w-28" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonCircle className="w-7 h-7" />
              <SkeletonText className="w-4 h-3 text-center" />
              <SkeletonCircle className="w-7 h-7" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <SkeletonText className="h-3.5 w-16" />
              <SkeletonText className="h-2.5 w-24" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonCircle className="w-7 h-7" />
              <SkeletonText className="w-4 h-3 text-center" />
              <SkeletonCircle className="w-7 h-7" />
            </div>
          </div>
        </div>
      </SkeletonCard>

      {/* Bathrooms breakdown card */}
      <SkeletonCard className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <SkeletonText className="h-3.5 w-28" />
            <SkeletonText className="h-3 w-52" />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonCircle className="w-8 h-8" />
            <SkeletonText className="w-6 h-4 text-center" />
            <SkeletonCircle className="w-8 h-8" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <SkeletonText className="h-3.5 w-24" />
            <div className="flex items-center gap-2">
              <SkeletonCircle className="w-7 h-7" />
              <SkeletonText className="w-4 h-3" />
              <SkeletonCircle className="w-7 h-7" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <SkeletonText className="h-3.5 w-24" />
            <div className="flex items-center gap-2">
              <SkeletonCircle className="w-7 h-7" />
              <SkeletonText className="w-4 h-3" />
              <SkeletonCircle className="w-7 h-7" />
            </div>
          </div>
        </div>
      </SkeletonCard>

      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}
export const GuestsBoxSkeleton = GuestsSkeleton;

// ============================================================================
// 7. SLEEPING ARRANGEMENTS BOX SKELETON (Matches PropertyDetailsViews.tsx -> sleeping-arrangements)
// ============================================================================

export function SleepingArrangementsSkeleton() {
  return (
    <div className="space-y-4 pt-1 animate-in fade-in font-sans">
      {[1, 2].map((i) => (
        <SkeletonCard key={i} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <SkeletonBox className="w-6 h-6 rounded-lg" />
              <SkeletonText className="h-4 w-28" />
            </div>
            <SkeletonText className="h-3 w-16" />
          </div>
          <div className="flex gap-2 pt-1">
            <SkeletonBox className="h-7 w-28 rounded-full" />
            <SkeletonBox className="h-7 w-20 rounded-full" />
          </div>
        </SkeletonCard>
      ))}

      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}
export const SleepingArrangementsBoxSkeleton = SleepingArrangementsSkeleton;

// ============================================================================
// 8. DESCRIPTION BOX SKELETON (Matches PropertyDetailsViews.tsx -> description)
// ============================================================================

export function DescriptionSkeleton() {
  return (
    <div className="space-y-3 pt-1 animate-in fade-in font-sans">
      {/* Accordion 1: Open state */}
      <div className="rounded-2xl bg-zinc-100/90 border border-zinc-200/80 p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <SkeletonText className="h-4 w-36" />
            <SkeletonText className="h-3 w-28" />
          </div>
          <SkeletonBox className="w-4 h-4 rounded-xs" />
        </div>
        <div className="rounded-xl bg-white border border-zinc-200 p-3 shadow-2xs space-y-2">
          <SkeletonText className="h-3 w-full" />
          <SkeletonText className="h-3 w-5/6" />
          <SkeletonText className="h-3 w-4/6" />
        </div>
      </div>

      {/* Accordions 2-5: Collapsed */}
      {[
        "Your property",
        "Guest access",
        "Interaction with guests",
        "Other things to note",
      ].map((title, idx) => (
        <div
          key={idx}
          className="rounded-2xl bg-white border border-zinc-200 p-4 flex items-center justify-between shadow-2xs"
        >
          <div className="space-y-1">
            <SkeletonText className="h-4 w-32" />
            <SkeletonText className="h-3 w-20" />
          </div>
          <SkeletonBox className="w-4 h-4 rounded-xs" />
        </div>
      ))}

      <div className="pt-2">
        <SkeletonButton className="h-11 w-36 rounded-full" />
      </div>
    </div>
  );
}
export const DescriptionBoxSkeleton = DescriptionSkeleton;

// ============================================================================
// 9. AMENITIES BOX SKELETON (Matches PropertyDetailsViews.tsx -> amenities & add-amenities)
// ============================================================================

export function AmenitiesSkeleton() {
  return (
    <div className="space-y-4 pt-1 animate-in fade-in font-sans">
      {/* Category card 1 */}
      <SkeletonCard className="space-y-3">
        <SkeletonText className="h-4 w-36" />
        <div className="space-y-2.5 pt-1">
          {[1, 2, 3].map((j) => (
            <div key={j} className="flex items-center gap-3">
              <SkeletonCircle className="w-6 h-6 rounded-lg" />
              <SkeletonText className="h-3.5 w-40" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Category card 2 */}
      <SkeletonCard className="space-y-3">
        <SkeletonText className="h-4 w-28" />
        <div className="space-y-2.5 pt-1">
          {[1, 2].map((j) => (
            <div key={j} className="flex items-center gap-3">
              <SkeletonCircle className="w-6 h-6 rounded-lg" />
              <SkeletonText className="h-3.5 w-32" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
export const AmenitiesBoxSkeleton = AmenitiesSkeleton;

// ============================================================================
// 10. ACCESSIBILITY BOX SKELETON (Matches PropertyDetailsViews.tsx -> accessibility)
// ============================================================================

export function AccessibilitySkeleton() {
  return (
    <div className="space-y-3 pt-2 animate-in fade-in font-sans">
      {/* Expanded feature card */}
      <div className="rounded-2xl bg-zinc-100/90 border border-zinc-200/80 p-5 space-y-4 shadow-2xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <SkeletonCircle className="w-8 h-8 rounded-xl" />
            <div className="space-y-1">
              <SkeletonText className="h-4 w-44" />
              <SkeletonText className="h-3 w-64 max-w-full" />
            </div>
          </div>
          <SkeletonToggle />
        </div>

        {/* Photo slots */}
        <div className="pt-2 border-t border-zinc-200/80 space-y-2">
          <SkeletonText className="h-3 w-32" />
          <div className="flex gap-2.5">
            <SkeletonBox className="h-24 w-28 rounded-xl" />
            <div className="h-24 w-28 rounded-xl border border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center gap-1.5">
              <SkeletonCircle className="w-6 h-6" />
              <SkeletonText className="h-2.5 w-14" />
            </div>
          </div>
        </div>
      </div>

      {/* Collapsed feature cards */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-zinc-200 bg-white p-4 flex items-center justify-between shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <SkeletonCircle className="w-7 h-7 rounded-lg" />
            <SkeletonText className="h-4 w-48" />
          </div>
          <SkeletonBox className="w-4 h-4 rounded-xs" />
        </div>
      ))}
    </div>
  );
}
export const AccessibilityBoxSkeleton = AccessibilitySkeleton;

// ============================================================================
// 11. LOCATION BOX SKELETON (Matches HostAndLocationViews.tsx -> location)
// ============================================================================

export function LocationSkeleton() {
  return (
    <div className="space-y-4 pt-1 font-sans animate-in fade-in">
      {/* Map preview */}
      <div className="h-64 w-full rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-200/80">
        <SkeletonBox className="w-full h-full rounded-none" />
      </div>

      {/* Address Card */}
      <SkeletonCard className="space-y-3">
        <SkeletonText className="h-4 w-20" />
        <SkeletonBox className="h-11 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonBox className="h-11 rounded-xl" />
          <SkeletonBox className="h-11 rounded-xl" />
          <SkeletonBox className="h-11 rounded-xl" />
          <SkeletonBox className="h-11 rounded-xl" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
          <SkeletonText className="h-3.5 w-40" />
          <SkeletonToggle />
        </div>
        <div className="pt-2">
          <SkeletonButton className="h-10 w-28 rounded-full" />
        </div>
      </SkeletonCard>

      {/* Neighborhood Card */}
      <SkeletonCard className="space-y-3">
        <SkeletonText className="h-4 w-28" />
        <SkeletonBox className="h-28 w-full rounded-xl" />
      </SkeletonCard>
    </div>
  );
}
export const LocationBoxSkeleton = LocationSkeleton;

// ============================================================================
// 12. ABOUT HOST BOX SKELETON (Matches HostAndLocationViews.tsx -> about-host)
// ============================================================================

export function AboutHostSkeleton() {
  return (
    <div className="space-y-5 pt-2 font-sans animate-in fade-in">
      {/* Avatar + Info block */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
        <div className="relative h-44 w-60 shrink-0 rounded-2xl border border-zinc-300 bg-zinc-100 p-2 shadow-2xs">
          <SkeletonBox className="w-full h-full rounded-xl" />
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            <SkeletonButton className="h-8 w-20 rounded-full" />
          </div>
        </div>
        <SkeletonText className="h-4 w-64 max-w-full" />
      </div>

      {/* Profile Prompt Fields Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 pt-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-zinc-200 py-3.5">
            <SkeletonCircle className="w-5 h-5" />
            <SkeletonText className="h-4 w-32" />
          </div>
        ))}
      </div>

      {/* About me card */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3 shadow-2xs">
        <SkeletonText className="h-4 w-24" />
        <SkeletonBox className="h-28 w-full rounded-xl bg-white" />
      </div>

      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}
export const AboutHostBoxSkeleton = AboutHostSkeleton;

// ============================================================================
// 13. CO-HOST BOX SKELETON (Matches HostAndLocationViews.tsx -> co-host)
// ============================================================================

export function CoHostSkeleton() {
  return (
    <div className="space-y-3 pt-2 font-sans animate-in fade-in">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 p-4 bg-white shadow-2xs"
        >
          <div className="space-y-1">
            <SkeletonText className="h-4 w-36" />
            <SkeletonText className="h-3 w-44" />
          </div>
          <SkeletonText className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}
export const CoHostBoxSkeleton = CoHostSkeleton;

// ============================================================================
// 14. BOOKING SETTINGS BOX SKELETON (Matches PricingAndBookingViews.tsx -> booking-settings)
// ============================================================================

export function BookingSettingsSkeleton() {
  return (
    <div className="space-y-4 pt-1 font-sans animate-in fade-in">
      {/* Card 1 */}
      <div className="rounded-2xl border-2 border-zinc-200 bg-white px-6 py-5 shadow-2xs flex items-start justify-between gap-5">
        <div className="space-y-1.5 flex-1">
          <SkeletonText className="h-4 w-52" />
          <SkeletonText className="h-3.5 w-32" />
          <SkeletonText className="h-3 w-full" />
        </div>
        <SkeletonCircle className="w-8 h-8 mt-1" />
      </div>

      {/* Card 2: Instant Book (active) */}
      <div className="rounded-2xl border-2 border-zinc-300 bg-white px-6 py-5 shadow-2xs space-y-4">
        <div className="flex items-start justify-between gap-5">
          <div className="space-y-1.5 flex-1">
            <SkeletonText className="h-4 w-36" />
            <SkeletonText className="h-3 w-72 max-w-full" />
          </div>
          <SkeletonCircle className="w-8 h-8" />
        </div>

        <div className="border-t border-zinc-200 my-4" />

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <SkeletonText className="h-3.5 w-44" />
              <SkeletonText className="h-3 w-64 max-w-full" />
            </div>
            <SkeletonToggle />
          </div>
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="space-y-1">
              <SkeletonText className="h-3.5 w-40" />
              <SkeletonText className="h-3 w-56 max-w-full" />
            </div>
            <SkeletonText className="h-5 w-4" />
          </div>
        </div>
      </div>

      {/* Card 3 */}
      <div className="rounded-2xl border-2 border-zinc-200 bg-white px-6 py-5 shadow-2xs flex items-center justify-between gap-5">
        <div className="space-y-1 flex-1">
          <SkeletonText className="h-4 w-44" />
          <SkeletonText className="h-3 w-56" />
        </div>
        <SkeletonCircle className="w-8 h-8" />
      </div>
    </div>
  );
}
export const BookingSettingsBoxSkeleton = BookingSettingsSkeleton;

// ============================================================================
// 15. HOUSE RULES BOX SKELETON (Matches HouseRulesAndArrivalViews.tsx -> house-rules)
// ============================================================================

export function HouseRulesSkeleton() {
  return (
    <div className="divide-y divide-zinc-200/80 pt-2 font-sans animate-in fade-in">
      {/* Row 1: Pets */}
      <div className="py-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <SkeletonText className="h-4 w-28" />
            <SkeletonText className="h-3 w-72" />
          </div>
          <div className="flex gap-2">
            <SkeletonBox className="h-7 w-12 rounded-full" />
            <SkeletonBox className="h-7 w-12 rounded-full" />
          </div>
        </div>
      </div>

      {/* Rows 2-5: Yes/No questions */}
      {[
        { title: "Events allowed", sub: "Gatherings must comply with local limits" },
        { title: "Smoking, vaping, e-cigarettes allowed", sub: "Specify your smoking policy" },
        { title: "Quiet hours", sub: "Set quiet hours for neighbors" },
        { title: "Commercial photography and filming allowed", sub: "Commercial productions" },
      ].map((item, idx) => (
        <div key={idx} className="py-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <SkeletonText className="h-4 w-40" />
            <SkeletonText className="h-3 w-64" />
          </div>
          <div className="flex gap-2">
            <SkeletonBox className="h-7 w-12 rounded-full" />
            <SkeletonBox className="h-7 w-12 rounded-full" />
          </div>
        </div>
      ))}

      <div className="pt-4">
        <SkeletonButton className="h-11 w-32 rounded-full" />
      </div>
    </div>
  );
}
export const HouseRulesBoxSkeleton = HouseRulesSkeleton;

// ============================================================================
// 16. GUESTS SAFETY BOX SKELETON (Matches GuestsSafetyView.tsx)
// ============================================================================

export function GuestsSafetySkeleton() {
  return (
    <div className="divide-y divide-zinc-200/80 pt-1 font-sans animate-in fade-in">
      {/* Row 1: Safety considerations */}
      <div className="flex items-center justify-between py-5 px-2">
        <div className="space-y-1.5">
          <SkeletonText className="h-4 w-40" />
          <SkeletonText className="h-3 w-56" />
        </div>
        <SkeletonBox className="w-4 h-4 rounded-xs" />
      </div>

      {/* Row 2: Safety devices */}
      <div className="flex items-center justify-between py-5 px-2">
        <div className="space-y-1.5">
          <SkeletonText className="h-4 w-32" />
          <SkeletonText className="h-3 w-48" />
        </div>
        <SkeletonBox className="w-4 h-4 rounded-xs" />
      </div>

      {/* Row 3: Property info */}
      <div className="flex items-center justify-between py-5 px-2">
        <div className="space-y-1.5">
          <SkeletonText className="h-4 w-28" />
          <SkeletonText className="h-3 w-52" />
        </div>
        <SkeletonBox className="w-4 h-4 rounded-xs" />
      </div>
    </div>
  );
}
export const GuestsSafetyBoxSkeleton = GuestsSafetySkeleton;

// ============================================================================
// 17. CANCELLATION POLICY BOX SKELETON (Matches CancellationPolicyView.tsx)
// ============================================================================

export function CancellationPolicySkeleton() {
  return (
    <div className="space-y-3 pt-1 font-sans animate-in fade-in">
      {/* Short-term stays Card */}
      <SkeletonCard className="space-y-4 border-zinc-200 p-5 shadow-[0_2px_3px_rgba(0,0,0,0.12)] sm:p-6">
        <div className="space-y-3 border-b border-zinc-300 pb-4">
          <SkeletonText className="h-8 w-36" />
          <SkeletonText className="h-4 w-3/4" />
        </div>
        <div className="flex items-end justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="space-y-2">
            <SkeletonText className="h-4 w-24" />
            <SkeletonText className="h-5 w-28" />
          </div>
          <SkeletonButton className="h-11 w-20" />
        </div>
        <div className="flex items-start justify-between gap-4 pt-0.5">
          <div className="space-y-2">
            <SkeletonText className="h-4 w-40" />
            <SkeletonText className="h-4 w-72" />
          </div>
          <SkeletonToggle />
        </div>
      </SkeletonCard>

      {/* Long-term stays Card */}
      <SkeletonCard className="space-y-4 border-zinc-200 p-5 shadow-[0_2px_3px_rgba(0,0,0,0.12)] sm:p-6">
        <div className="space-y-3 border-b border-zinc-300 pb-4">
          <SkeletonText className="h-8 w-36" />
          <SkeletonText className="h-4 w-2/3" />
        </div>
        <div className="flex items-end justify-between gap-4 pt-0.5">
          <div className="space-y-2">
            <SkeletonText className="h-4 w-24" />
            <SkeletonText className="h-5 w-32" />
          </div>
          <SkeletonButton className="h-11 w-20" />
        </div>
      </SkeletonCard>
    </div>
  );
}
export const CancellationPolicyBoxSkeleton = CancellationPolicySkeleton;

// ============================================================================
// 18. CUSTOM LINK BOX SKELETON (Matches HostAndLocationViews.tsx -> custom-link)
// ============================================================================

export function CustomLinkSkeleton() {
  return (
    <div className="min-h-[380px] flex flex-col items-center justify-center font-sans animate-in fade-in">
      <div className="flex flex-col items-center justify-center space-y-6 w-full py-12">
        <SkeletonText className="h-3.5 w-44" />
        <div className="flex items-center justify-center gap-2">
          <SkeletonText className="h-8 w-36" />
          <SkeletonBox className="h-9 w-48 rounded-md" />
        </div>
        <SkeletonText className="h-3 w-64" />
        <SkeletonButton className="h-9 w-24 rounded-full" />
      </div>
    </div>
  );
}
export const CustomLinkBoxSkeleton = CustomLinkSkeleton;

// ============================================================================
// 19. LISTING STATUS SKELETON (Matches ListingStatusView.tsx)
// ============================================================================

export function ListingStatusSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <SkeletonText className="h-7 w-48" />
      </div>

      {/* 4-Step progress bar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <SkeletonText className="h-4 w-32" />
          <SkeletonText className="h-4 w-20" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBox className="h-1.5 w-full rounded-full" />
              <SkeletonText className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Current Status Card */}
      <SkeletonCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <SkeletonCircle className="size-3" />
              <SkeletonText className="h-6 w-40" />
            </div>
            <SkeletonText className="h-4 w-72 pl-5" />
          </div>
          <SkeletonBox className="h-6 w-20 rounded-full" />
        </div>
      </SkeletonCard>

      {/* Checklist / Action Card */}
      <SkeletonCard className="p-5 sm:p-6 space-y-4">
        <SkeletonText className="h-5 w-44" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
              <div className="space-y-1">
                <SkeletonText className="h-4 w-36" />
                <SkeletonText className="h-3 w-56" />
              </div>
              <SkeletonBox className="h-4 w-12 rounded-md" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      <SkeletonButton className="h-11 w-44 rounded-full" />
    </div>
  );
}

// ============================================================================
// 20. LANGUAGES SKELETON (Matches HouseRulesAndArrivalViews.tsx -> LanguagesView)
// ============================================================================

export function LanguagesSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <SkeletonText className="h-7 w-36" />
      </div>
      <SkeletonText className="h-4 w-72" />

      {/* Language Chips Card */}
      <SkeletonCard className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap gap-2.5">
          {[1, 2, 3].map((i) => (
            <SkeletonBox key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
        <SkeletonButton className="h-10 w-36 rounded-full" />
      </SkeletonCard>

      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}

// ============================================================================
// 21. REGULATIONS SKELETON (Matches LicenseRegulationsView.tsx)
// ============================================================================

export function RegulationsSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <div>
          <SkeletonText className="h-7 w-52" />
          <SkeletonText className="h-4 w-80 mt-1" />
        </div>
      </div>

      {/* License verification card */}
      <SkeletonCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <SkeletonText className="h-5 w-40" />
            <SkeletonText className="h-4 w-72" />
          </div>
          <SkeletonBox className="h-6 w-24 rounded-full" />
        </div>
        <SkeletonBox className="h-12 w-full rounded-xl" />
        <div className="flex justify-end gap-3 pt-2">
          <SkeletonButton className="h-10 w-24 rounded-full" />
          <SkeletonButton className="h-10 w-28 rounded-full" />
        </div>
      </SkeletonCard>

      {/* Policy requirements card */}
      <SkeletonCard className="p-5 sm:p-6 space-y-3">
        <SkeletonText className="h-5 w-36" />
        <SkeletonText className="h-4 w-full" />
        <SkeletonText className="h-4 w-4/5" />
      </SkeletonCard>
    </div>
  );
}

// ============================================================================
// 22. TAXES SKELETON (Matches TaxesManager.tsx)
// ============================================================================

export function TaxesSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <div>
          <SkeletonText className="h-7 w-28" />
          <SkeletonText className="h-4 w-72 mt-1" />
        </div>
      </div>

      {/* Jurisdiction banner card */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-2 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-2">
          <SkeletonCircle className="size-4" />
          <SkeletonText className="h-4 w-48" />
        </div>
        <SkeletonText className="h-3 w-full" />
      </div>

      {/* Tax collection card */}
      <SkeletonCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonText className="h-5 w-32" />
          <SkeletonButton className="h-9 w-28 rounded-full" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-100 bg-zinc-50/60 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="space-y-1">
                <SkeletonText className="h-4 w-32" />
                <SkeletonText className="h-3 w-48" />
              </div>
              <SkeletonBox className="h-6 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}

// ============================================================================
// 23. GUEST REQUIREMENTS SKELETON (Matches GuestRequirementsView)
// ============================================================================

export function GuestRequirementsSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <div>
          <SkeletonText className="h-7 w-52" />
          <SkeletonText className="h-4 w-72 mt-1" />
        </div>
      </div>

      <SkeletonCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <SkeletonText className="h-5 w-44" />
            <SkeletonText className="h-4 w-72" />
          </div>
          <SkeletonToggle />
        </div>
      </SkeletonCard>

      <SkeletonCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <SkeletonText className="h-5 w-40" />
            <SkeletonText className="h-4 w-64" />
          </div>
          <SkeletonBox className="h-6 w-20 rounded-full" />
        </div>
      </SkeletonCard>

      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}

// ============================================================================
// 24. LOCAL LAWS SKELETON (Matches LocalLawsView)
// ============================================================================

export function LocalLawsSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <SkeletonText className="h-7 w-36" />
      </div>
      <SkeletonText className="h-4 w-80" />

      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="p-5 space-y-2">
          <SkeletonText className="h-5 w-48" />
          <SkeletonText className="h-4 w-full" />
          <SkeletonText className="h-4 w-3/4" />
        </SkeletonCard>
      ))}
    </div>
  );
}

// ============================================================================
// 25. ARRIVAL GUIDE & CHECK-IN SKELETON
// ============================================================================

export function ArrivalGuideSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <div>
          <SkeletonText className="h-7 w-56" />
          <SkeletonText className="h-4 w-72 mt-1" />
        </div>
      </div>

      <SkeletonCard className="p-5 sm:p-6 space-y-5">
        <div className="space-y-2">
          <SkeletonText className="h-4 w-28" />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonBox className="h-12 w-full rounded-xl" />
            <SkeletonBox className="h-12 w-full rounded-xl" />
          </div>
        </div>
        <div className="space-y-2">
          <SkeletonText className="h-4 w-28" />
          <SkeletonBox className="h-12 w-full rounded-xl" />
        </div>
      </SkeletonCard>

      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}

// ============================================================================
// 26. DIRECTIONS SKELETON
// ============================================================================

export function DirectionsSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <SkeletonText className="h-7 w-36" />
      </div>
      <SkeletonText className="h-4 w-72" />
      <SkeletonBox className="h-36 w-full rounded-2xl" />
      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}

// ============================================================================
// 27. CHECK-IN METHOD SKELETON
// ============================================================================

export function CheckInMethodSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <SkeletonText className="h-7 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} className="p-4 flex flex-col items-center gap-2">
            <SkeletonCircle className="size-8" />
            <SkeletonText className="h-4 w-20" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonBox className="h-28 w-full rounded-2xl" />
      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}

// ============================================================================
// 28. WIFI DETAILS SKELETON
// ============================================================================

export function WifiDetailsSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <SkeletonText className="h-7 w-36" />
      </div>
      <SkeletonCard className="p-5 sm:p-6 space-y-4">
        <div className="space-y-2">
          <SkeletonText className="h-4 w-24" />
          <SkeletonBox className="h-12 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <SkeletonText className="h-4 w-24" />
          <SkeletonBox className="h-12 w-full rounded-xl" />
        </div>
      </SkeletonCard>
      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}

// ============================================================================
// 29. HOUSE MANUAL SKELETON
// ============================================================================

export function HouseManualSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <SkeletonText className="h-7 w-36" />
      </div>
      <SkeletonText className="h-4 w-80" />
      <SkeletonBox className="h-40 w-full rounded-2xl" />
      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}

// ============================================================================
// 30. CHECKOUT INSTRUCTIONS SKELETON
// ============================================================================

export function CheckoutInstructionsSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <SkeletonText className="h-7 w-56" />
      </div>
      <SkeletonCard className="p-5 sm:p-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
            <div className="flex items-center gap-3">
              <SkeletonCircle className="size-5" />
              <SkeletonText className="h-4 w-36" />
            </div>
            <SkeletonToggle />
          </div>
        ))}
      </SkeletonCard>
      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}

// ============================================================================
// 31. GUIDEBOOKS SKELETON
// ============================================================================

export function GuidebooksSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <SkeletonCircle className="size-9" />
          <SkeletonText className="h-7 w-36" />
        </div>
        <SkeletonButton className="h-10 w-36 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <SkeletonCard key={i} className="p-4 space-y-3">
            <SkeletonBox className="h-28 w-full rounded-xl" />
            <SkeletonText className="h-4 w-32" />
            <SkeletonText className="h-3 w-48" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 32. INTERACTION PREFERENCES SKELETON
// ============================================================================

export function InteractionPreferencesSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <SkeletonText className="h-7 w-56" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <SkeletonText className="h-4 w-36" />
              <SkeletonText className="h-3 w-64" />
            </div>
            <SkeletonCircle className="size-5" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}

// ============================================================================
// 33. ORG STAYS SKELETON (Matches AirbnbOrgStaysView.tsx)
// ============================================================================

export function OrgStaysSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <div>
          <SkeletonText className="h-7 w-44" />
          <SkeletonText className="h-4 w-72 mt-1" />
        </div>
      </div>
      <SkeletonCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <SkeletonText className="h-5 w-40" />
            <SkeletonText className="h-4 w-64" />
          </div>
          <SkeletonToggle />
        </div>
      </SkeletonCard>
      <SkeletonButton className="h-11 w-32 rounded-full" />
    </div>
  );
}

// ============================================================================
// 34. REMOVE LISTING SKELETON
// ============================================================================

export function RemoveListingSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in pb-10 font-sans">
      <div className="flex items-center gap-6">
        <SkeletonCircle className="size-9" />
        <SkeletonText className="h-7 w-40" />
      </div>
      <SkeletonCard className="p-5 sm:p-6 space-y-4 border-rose-200">
        <div className="flex items-center gap-3">
          <SkeletonCircle className="size-10" />
          <div className="space-y-1">
            <SkeletonText className="h-5 w-36" />
            <SkeletonText className="h-3.5 w-60" />
          </div>
        </div>
        <SkeletonText className="h-4 w-full" />
        <div className="pt-2 flex justify-end">
          <SkeletonButton className="h-10 w-32 rounded-full" />
        </div>
      </SkeletonCard>
    </div>
  );
}

// ============================================================================
// RIGHT SIDEBAR SKELETON (Matches EditorSidebar.tsx)
// ============================================================================

export function EditorSidebarSkeleton({
  tab = "space",
}: {
  tab?: "space" | "arrival" | "preferences";
} = {}) {
  return (
    <aside className="w-full space-y-3 font-sans lg:h-full lg:overflow-y-auto lg:overflow-x-hidden lg:pl-8 lg:pt-10 lg:pr-4" aria-label="Sidebar loading skeleton">
      {/* 1. Header Title & Back Button */}
      <div className="flex shrink-0 flex-col pb-5 lg:pb-9">
        <div className="flex items-center gap-2.5">
          <SkeletonCircle className="size-9 rounded-full" />
          <SkeletonText className="h-6 w-36" />
        </div>
      </div>

      {/* 2. Sub-Pills: [Your space] [Arrival guide] ⚙️ */}
      <div className="mb-6 flex shrink-0 items-center justify-between gap-2 lg:mb-12 lg:max-w-[calc(100%-70px)]">
        <div className="flex w-full max-w-none items-center rounded-full border border-zinc-200 bg-white p-1 lg:max-w-[272px] lg:p-1.5 dark:border-zinc-700 dark:bg-zinc-800">
          <div className={`min-h-11 flex-1 rounded-full px-3 py-1.5 flex items-center justify-center lg:min-h-[48px] ${tab === "space" ? "bg-amber-100 dark:bg-amber-400/30" : ""}`}>
            <SkeletonText className="h-4 w-20" />
          </div>
          <div className={`min-h-11 flex-1 rounded-full px-3 py-1.5 flex items-center justify-center lg:min-h-[48px] ${tab === "arrival" ? "bg-amber-100 dark:bg-amber-400/30" : ""}`}>
            <SkeletonText className="h-4 w-20" />
          </div>
        </div>
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-full border lg:size-12 ${tab === "preferences" ? "border-amber-300 bg-amber-100" : "border-zinc-200 bg-white"}`}>
          <SkeletonCircle className="size-6 rounded-full" />
        </div>
      </div>

      {/* 3. Cards Stack depending on active tab */}
      {tab === "preferences" ? (
        <div className="space-y-3 pb-8">
          {/* 1. Listing status */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-28" />
            <SkeletonText className="h-3.5 w-36" />
          </SkeletonCard>
          {/* 2. Languages */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-24" />
            <SkeletonText className="h-3.5 w-40" />
          </SkeletonCard>
          {/* 3. Guest requirements */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-36" />
            <SkeletonText className="h-3.5 w-28" />
          </SkeletonCard>
          {/* 4. Local laws */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-24" />
            <SkeletonText className="h-3.5 w-32" />
          </SkeletonCard>
          {/* 5. Regulations */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-28" />
            <SkeletonText className="h-3.5 w-48" />
          </SkeletonCard>
          {/* 6. Taxes */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-16" />
            <SkeletonText className="h-3.5 w-36" />
          </SkeletonCard>
          {/* 7. Homyz stays */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-28" />
            <SkeletonText className="h-3.5 w-44" />
          </SkeletonCard>
          {/* 8. Remove listing */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-32" />
            <SkeletonText className="h-3.5 w-40" />
          </SkeletonCard>
        </div>
      ) : tab === "arrival" ? (
        <div className="space-y-3 pb-8">
          {/* 1. Check-in & checkout */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-36" />
            <SkeletonText className="h-3.5 w-44" />
          </SkeletonCard>
          {/* 2. Directions */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-24" />
            <SkeletonText className="h-3.5 w-32" />
          </SkeletonCard>
          {/* 3. Check-in method */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-32" />
            <SkeletonText className="h-3.5 w-28" />
          </SkeletonCard>
          {/* 4. Wifi details */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-24" />
            <SkeletonText className="h-3.5 w-36" />
          </SkeletonCard>
          {/* 5. House manual */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-28" />
            <SkeletonText className="h-3.5 w-40" />
          </SkeletonCard>
          {/* 6. Checkout instructions */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-40" />
            <SkeletonText className="h-3.5 w-32" />
          </SkeletonCard>
          {/* 7. Guidebooks */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-24" />
            <SkeletonText className="h-3.5 w-20" />
          </SkeletonCard>
          {/* 8. Interaction preferences */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-44" />
            <SkeletonText className="h-3.5 w-28" />
          </SkeletonCard>
        </div>
      ) : (
        <div className="space-y-3 pb-8">
          {/* 1. Photo preview card (4-card horizontal stack skeleton) */}
          <div className="relative h-36 sm:h-40 w-full my-2 overflow-hidden rounded-2xl p-0.5">
            <div className="absolute top-0 bottom-0 left-0 w-[54%] rounded-2xl border border-zinc-200 bg-zinc-200/80 skeleton-shimmer z-0" />
            <div className="absolute top-0 bottom-0 left-[15%] w-[54%] rounded-2xl border border-zinc-200 bg-zinc-200/80 skeleton-shimmer z-10" />
            <div className="absolute top-0 bottom-0 left-[30%] w-[54%] rounded-2xl border border-zinc-200 bg-zinc-200/80 skeleton-shimmer z-20" />
            <div className="absolute top-0 bottom-0 left-[46%] w-[54%] rounded-2xl border border-zinc-200 bg-zinc-100 skeleton-shimmer z-30 flex items-center justify-center">
              <div className="bg-white/90 rounded-2xl px-4 py-2.5 shadow-xs border border-zinc-200/80 flex flex-col items-center gap-1">
                <SkeletonBox className="h-4 w-6 rounded-md" />
                <SkeletonBox className="h-2.5 w-10 rounded-md" />
              </div>
            </div>
          </div>

          {/* 2. Title Card */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-12" />
            <SkeletonText className="h-4 w-36" />
          </SkeletonCard>

          {/* 3. Property Type Card */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-28" />
            <SkeletonText className="h-4 w-40" />
          </SkeletonCard>

          {/* 4. Pricing Card */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-16" />
            <SkeletonText className="h-4 w-20" />
            <SkeletonText className="h-3 w-32" />
          </SkeletonCard>

          {/* 5. Availability Card */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-24" />
            <SkeletonText className="h-4 w-32" />
            <SkeletonText className="h-3 w-24" />
          </SkeletonCard>

          {/* 6. Guests Card */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-32" />
            <SkeletonText className="h-4 w-20" />
          </SkeletonCard>

          {/* 7. Sleeping arrangements */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-40" />
            <SkeletonText className="h-4 w-32" />
          </SkeletonCard>

          {/* 8. Description Card */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-24" />
            <SkeletonText className="h-3 w-full" />
            <SkeletonText className="h-3 w-4/5" />
          </SkeletonCard>

          {/* 9. Amenities Card */}
          <SkeletonCard className="p-4 space-y-2">
            <SkeletonText className="h-4 w-20" />
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center gap-2">
                <SkeletonCircle className="w-4 h-4" />
                <SkeletonText className="h-3 w-28" />
              </div>
              <div className="flex items-center gap-2">
                <SkeletonCircle className="w-4 h-4" />
                <SkeletonText className="h-3 w-24" />
              </div>
            </div>
          </SkeletonCard>

          {/* 10. Accessibility Card */}
          <SkeletonCard className="p-4 space-y-1.5">
            <SkeletonText className="h-4 w-36" />
            <SkeletonText className="h-3 w-20" />
          </SkeletonCard>

          {/* 11. Location Card */}
          <SkeletonCard className="p-4 space-y-2">
            <SkeletonText className="h-4 w-16" />
            <SkeletonBox className="h-24 w-full rounded-xl" />
            <SkeletonText className="h-3.5 w-48" />
          </SkeletonCard>

          {/* 12. About host Card */}
          <SkeletonCard className="p-5 space-y-3">
            <SkeletonText className="h-4 w-28 mb-2" />
            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="flex flex-col items-center">
                <SkeletonCircle className="w-16 h-16" />
                <SkeletonText className="h-3.5 w-16 mt-2" />
                <SkeletonText className="h-2.5 w-14 mt-1" />
              </div>
              <div className="flex flex-col items-center space-y-2">
                <SkeletonText className="h-4 w-8" />
                <SkeletonText className="h-2.5 w-10" />
                <div className="w-full border-t border-zinc-200" />
                <SkeletonText className="h-4 w-8" />
                <SkeletonText className="h-2.5 w-10" />
              </div>
            </div>
          </SkeletonCard>
        </div>
      )}
    </aside>
  );
}

// ============================================================================
// SECTION DISPATCHER SKELETON
// ============================================================================

export function YourSpaceSectionSkeleton({ section }: { section: string }) {
  switch (section) {
    case "photos":
      return <PhotosSkeleton />;
    case "title":
      return <TitleSkeleton />;
    case "propertyType":
    case "property-type":
    case "basics":
      return <PropertyTypeSkeleton />;
    case "pricing":
      return <PricingSkeleton />;
    case "availability":
      return <AvailabilitySkeleton />;
    case "guests":
      return <GuestsSkeleton />;
    case "sleeping-arrangements":
    case "sleepingarrangements":
      return <SleepingArrangementsSkeleton />;
    case "description":
      return <DescriptionSkeleton />;
    case "amenities":
    case "add-amenities":
      return <AmenitiesSkeleton />;
    case "accessibility":
      return <AccessibilitySkeleton />;
    case "location":
      return <LocationSkeleton />;
    case "about-host":
    case "abouthost":
      return <AboutHostSkeleton />;
    case "co-host":
    case "cohost":
      return <CoHostSkeleton />;
    case "booking-settings":
    case "bookingsettings":
      return <BookingSettingsSkeleton />;
    case "house-rules":
    case "houserules":
      return <HouseRulesSkeleton />;
    case "guests-safety":
    case "guestssafety":
    case "safety":
      return <GuestsSafetySkeleton />;
    case "cancellation-policy":
    case "cancellationpolicy":
      return <CancellationPolicySkeleton />;
    case "custom-link":
    case "customlink":
      return <CustomLinkSkeleton />;
    case "listing-status":
    case "listingstatus":
      return <ListingStatusSkeleton />;
    case "language":
    case "languages":
      return <LanguagesSkeleton />;
    case "regulations":
    case "license":
      return <RegulationsSkeleton />;
    case "taxes":
      return <TaxesSkeleton />;
    case "guest-requirements":
    case "guestrequirements":
      return <GuestRequirementsSkeleton />;
    case "local-laws":
    case "locallaws":
      return <LocalLawsSkeleton />;
    case "arrival-guide":
    case "arrivalguide":
    case "check-in-out":
    case "checkinout":
      return <ArrivalGuideSkeleton />;
    case "directions":
      return <DirectionsSkeleton />;
    case "check-in-method":
    case "checkinmethod":
      return <CheckInMethodSkeleton />;
    case "wifi-details":
    case "wifidetails":
      return <WifiDetailsSkeleton />;
    case "house-manual":
    case "housemanual":
      return <HouseManualSkeleton />;
    case "checkout-instructions":
    case "check-out-instructions":
    case "checkout":
      return <CheckoutInstructionsSkeleton />;
    case "guidebooks":
    case "guidebook":
      return <GuidebooksSkeleton />;
    case "interaction-preferences":
    case "interactionpreferences":
      return <InteractionPreferencesSkeleton />;
    case "homyz-stays":
    case "homyzstays":
    case "homyz-org-stays":
    case "airbnb-org-stays":
    case "airbnb-stays":
      return <OrgStaysSkeleton />;
    case "remove-listing":
    case "removelisting":
      return <RemoveListingSkeleton />;
    default:
      return <PropertyTypeSkeleton />;
  }
}

const PREFERENCE_SECTION_KEYS = new Set([
  "listing-status",
  "listingstatus",
  "language",
  "languages",
  "guest-requirements",
  "guestrequirements",
  "local-laws",
  "locallaws",
  "regulations",
  "license",
  "taxes",
  "homyz-stays",
  "homyzstays",
  "homyz-org-stays",
  "airbnb-org-stays",
  "airbnb-stays",
  "remove-listing",
  "removelisting",
]);

const ARRIVAL_SECTION_KEYS = new Set([
  "arrival-guide",
  "arrivalguide",
  "check-in-out",
  "checkinout",
  "parking",
  "directions",
  "check-in-method",
  "checkinmethod",
  "wifi-details",
  "wifidetails",
  "house-manual",
  "housemanual",
  "checkout-instructions",
  "check-out-instructions",
  "checkout",
  "check-out",
  "guidebooks",
  "guidebook",
  "interaction-preferences",
  "interactionpreferences",
]);

// ============================================================================
// FULL EDITOR PAGE WORKSPACE SKELETON
// ============================================================================

export function YourSpaceEditorSkeleton({
  section = "propertyType",
  tab,
}: {
  section?: string;
  tab?: "space" | "arrival" | "preferences";
}) {
  const derivedTab =
    tab ||
    (PREFERENCE_SECTION_KEYS.has(section)
      ? "preferences"
      : ARRIVAL_SECTION_KEYS.has(section)
      ? "arrival"
      : "space");

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-white pb-12 font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] selection:text-[#1F1F1F] lg:h-dvh lg:min-h-0 lg:overflow-hidden lg:pb-0">
      {/* Mobile top spacing button placeholder */}
      <div className="flex justify-end px-8 sm:pt-10 pt-5 lg:hidden">
        <div className="h-8 w-8 rounded-full skeleton-shimmer" />
      </div>

      {/* 3. MAIN EDITOR CONTENT AREA (matches the desktop editor split) */}
      <Container className="lg:-mt-3 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <div className="flex-1 grid grid-cols-1 gap-8 sm:py-10 py-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)] lg:grid-rows-1 lg:h-full lg:min-h-0 lg:gap-8 lg:overflow-hidden lg:py-0 xl:gap-10">
          {/* LEFT COLUMN: LISTING EDITOR NAVIGATION */}
          <div className="hidden lg:order-1 lg:flex lg:min-w-0 lg:h-full lg:overflow-hidden lg:bg-[rgba(241,241,241,0.5)] lg:border-r lg:border-transparent lg:[border-image:linear-gradient(270deg,#1F1F1F_0%,rgba(31,31,31,0.2)_100%)_1]">
            <EditorSidebarSkeleton tab={derivedTab} />
          </div>

          {/* RIGHT COLUMN: SECTION EDITOR */}
          <main className="flex min-w-0 flex-col space-y-6 pb-12 lg:order-2 lg:pb-12 lg:pt-10 lg:h-full lg:max-h-full lg:overflow-y-auto lg:overscroll-contain lg:pl-4 custom-scrollbar">
            <YourSpaceSectionSkeleton section={section} />
          </main>
        </div>
      </Container>
    </div>
  );
}
