"use client";

import { AppHeader } from "@/components/dashboard/app-header";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/dashboard/footer";
import {
  SkeletonBox,
  SkeletonText,
  SkeletonCircle,
  SkeletonButton,
  SkeletonCard,
} from "@/app/(protected)/host/listings/[id]/components/YourSpaceSkeletons";

export function NewListingWizardSkeleton({ step = "overview" }: { step?: string }) {
  const normalizedStep = (step || "overview").toLowerCase();
  const isOverview = normalizedStep === "overview" || normalizedStep === "0";
  const isCategory = normalizedStep === "category" || normalizedStep === "2";
  const isPlaceType = normalizedStep === "place-type" || normalizedStep === "3";
  const isLocation =
    normalizedStep === "location" ||
    normalizedStep === "4" ||
    normalizedStep === "address" ||
    normalizedStep === "5";
  const isAmenities = normalizedStep === "amenities" || normalizedStep === "8";
  const isPhotos =
    normalizedStep === "photos" ||
    normalizedStep === "9" ||
    normalizedStep === "photos-review" ||
    normalizedStep === "10";
  const isPrice =
    normalizedStep === "price" ||
    normalizedStep === "15" ||
    normalizedStep === "weekend-price" ||
    normalizedStep === "16";

  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FEE08B]">
      {/* 1. TOP HEADER */}
      <AppHeader />

      {/* 2. MAIN WIZARD AREA */}
      <main className="min-w-0 flex-1 pt-6 pb-28">
        <Container className="max-w-6xl max-sm:px-4">
          {isOverview ? (
            /* OVERVIEW STEP SKELETON (Matches StepOverview.tsx) */
            <div className="grid w-full grid-cols-1 items-start gap-8 py-8 lg:grid-cols-12 lg:py-12">
              {/* Left Heading Skeleton */}
              <div className="flex flex-col justify-center space-y-4 lg:col-span-4 lg:pr-8">
                <SkeletonText className="h-10 w-3/4 rounded-xl" />
                <SkeletonText className="h-10 w-full rounded-xl" />
                <SkeletonText className="h-6 w-1/2 rounded-lg" />
              </div>

              {/* Right Step Cards Skeleton (3 Cards with badges 1, 2, 3) */}
              <div className="mx-auto w-full max-w-[628px] space-y-9 sm:space-y-12 lg:col-span-8 lg:mx-0">
                {[1, 2, 3].map((num) => (
                  <div
                    key={num}
                    className="relative min-h-[159px] sm:min-h-[175px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-md flex flex-col items-start justify-center gap-3"
                  >
                    <div className="absolute -top-5 left-1/2 size-10 -translate-x-1/2 rounded-full border border-zinc-300 bg-white skeleton-shimmer" />
                    <SkeletonText className="h-6 w-52 rounded-md mt-4" />
                    <SkeletonText className="h-4 w-full rounded-md" />
                    <SkeletonText className="h-4 w-3/4 rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* WIZARD QUESTION STEP SKELETON (Category, Place Type, Photos, Price, Location, etc.) */
            <div className="mx-auto max-w-2xl space-y-8 py-8">
              {/* Step Heading Skeleton */}
              <div className="space-y-3">
                <SkeletonText className="h-8 w-3/4 rounded-xl" />
                <SkeletonText className="h-4 w-1/2 rounded-md" />
              </div>

              {/* Step-Specific Options / Content Skeleton */}
              {isCategory ? (
                /* Grid of Category option cards */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <SkeletonCard
                      key={i}
                      className="p-4 flex flex-col items-start justify-between min-h-[110px] rounded-2xl border border-zinc-200"
                    >
                      <SkeletonCircle className="size-8 rounded-lg" />
                      <SkeletonText className="h-4 w-20 rounded-md mt-2" />
                    </SkeletonCard>
                  ))}
                </div>
              ) : isPlaceType ? (
                /* Stack of Place Type options */
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <SkeletonCard
                      key={i}
                      className="p-6 flex items-center justify-between rounded-2xl border border-zinc-200"
                    >
                      <div className="space-y-2">
                        <SkeletonText className="h-5 w-40 rounded-md" />
                        <SkeletonText className="h-4 w-64 rounded-md" />
                      </div>
                      <SkeletonCircle className="size-8 rounded-full" />
                    </SkeletonCard>
                  ))}
                </div>
              ) : isPhotos ? (
                /* Photo Uploader grid skeleton */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="col-span-2 sm:col-span-3 aspect-[16/9] rounded-2xl border border-dashed border-zinc-300 skeleton-shimmer flex items-center justify-center">
                    <SkeletonCircle className="size-12 rounded-full" />
                  </div>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="aspect-[4/3] rounded-xl border border-zinc-200 skeleton-shimmer"
                    />
                  ))}
                </div>
              ) : isPrice ? (
                /* Price Input skeleton */
                <div className="space-y-6 flex flex-col items-center justify-center py-10">
                  <SkeletonText className="h-16 w-48 rounded-2xl" />
                  <SkeletonText className="h-4 w-64 rounded-md" />
                </div>
              ) : (
                /* Generic Step Skeleton */
                <div className="space-y-4">
                  <SkeletonBox className="h-14 w-full rounded-2xl" />
                  <SkeletonBox className="h-14 w-full rounded-2xl" />
                  <SkeletonBox className="h-14 w-full rounded-2xl" />
                </div>
              )}
            </div>
          )}
        </Container>
      </main>

      {/* 3. WIZARD STEP PROGRESS FOOTER SKELETON */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200/80 px-6 py-4">
        {/* Progress bar line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-zinc-100 overflow-hidden">
          <div className="h-full w-1/3 bg-zinc-300 skeleton-shimmer" />
        </div>
        <Container className="max-w-6xl flex items-center justify-between">
          <SkeletonButton className="h-11 w-24 rounded-full" />
          <SkeletonButton className="h-11 w-32 rounded-full" />
        </Container>
      </footer>

      <Footer />
    </div>
  );
}
