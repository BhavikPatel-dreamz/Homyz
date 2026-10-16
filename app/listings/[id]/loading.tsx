import React from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";

export default function ListingDetailLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <AppHeader />

      <main className="w-full flex-1 pb-13 pt-5 sm:pt-10">
        <Container>
          <div className="single-listing-page animate-pulse" aria-busy="true" aria-label="Loading property details">
            {/* Header Section: Title & Actions (Desktop) */}
            <div className="hidden items-start justify-between gap-4 pb-5 sm:pb-6 lg:flex">
              <div className="min-w-0 space-y-2.5">
                <div className="h-8 sm:h-9 lg:h-10 w-96 max-w-[540px] rounded-lg bg-zinc-200 skeleton-shimmer" />
                <div className="flex items-center gap-2">
                  <div className="h-5 w-28 rounded-full bg-zinc-100 skeleton-shimmer" />
                  <div className="h-5 w-24 rounded-full bg-zinc-100 skeleton-shimmer" />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 pt-0.5 sm:gap-8">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 skeleton-shimmer" />
                  <span className="hidden sm:inline-block h-4 w-12 rounded bg-zinc-200 skeleton-shimmer" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 skeleton-shimmer" />
                  <span className="hidden sm:inline-block h-4 w-12 rounded bg-zinc-200 skeleton-shimmer" />
                </div>
              </div>
            </div>

            {/* Photo Gallery (ListingGallery representative contract) */}
            <div className="relative mb-6 lg:mb-8">
              {/* Mobile Back and Share/Save Bar */}
              <div className="absolute left-0 top-0 z-10 flex w-full items-start justify-between px-3 pt-3 md:hidden">
                <span className="flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white/95 skeleton-shimmer" />
                <div className="flex gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white/95 skeleton-shimmer" />
                  <span className="flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white/95 skeleton-shimmer" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 aspect-[4/3] sm:aspect-[21/9] md:grid-cols-4">
                <div className="md:col-span-2 relative h-full overflow-hidden rounded-[20px] bg-zinc-200 skeleton-shimmer" />
                <div className="relative hidden h-full grid-cols-2 gap-4 md:col-span-2 md:grid">
                  <div className="relative h-full overflow-hidden rounded-[10px] bg-zinc-200 skeleton-shimmer" />
                  <div className="relative h-full overflow-hidden rounded-[10px] bg-zinc-200 skeleton-shimmer" />
                  <div className="relative h-full overflow-hidden rounded-[10px] bg-zinc-200 skeleton-shimmer" />
                  <div className="relative h-full overflow-hidden rounded-[10px] bg-zinc-200 skeleton-shimmer" />
                  {/* Show all photos button matching ListingGallery line 193 */}
                  <div className="absolute bottom-5 right-5 z-10 flex h-10 w-44 items-center gap-2 rounded-full border border-zinc-300 bg-white/95 px-4 py-1.5 shadow-xs skeleton-shimmer" />
                </div>
              </div>

              {/* Mobile Photo Count Badge */}
              <div className="absolute bottom-3 right-3 z-10 h-8 w-16 rounded-full bg-white/90 shadow-sm md:hidden skeleton-shimmer" />
            </div>

            {/* Mobile Title (Rendered after gallery on mobile) */}
            <div className="mb-4 h-7 w-3/4 rounded-md bg-zinc-200 skeleton-shimmer lg:hidden" />

            {/* Main Content Layout: Left Details (7 cols) + Right Booking Widget (5 cols) */}
            <div className="grid grid-cols-1 gap-9 lg:grid-cols-12 lg:gap-10">
              {/* LEFT COLUMN */}
              <div className="lg:col-span-7">
                {/* Stay Type & Location Specs */}
                <div className="pb-1 space-y-2">
                  <div className="h-6 w-72 max-w-sm rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="h-4 w-56 max-w-xs rounded bg-zinc-100 skeleton-shimmer" />
                </div>

                {/* Guest Favourite Summary Badge (XL Desktop) */}
                <div className="mt-7 hidden w-full max-w-[720px] overflow-hidden rounded-[40px] border border-[#dedede] bg-white p-5 h-[111px] xl:grid xl:grid-cols-[1.1fr_1.75fr_.85fr_.62fr] gap-4 items-center shadow-xs">
                  <div className="h-6 w-28 mx-auto rounded-full bg-zinc-100 skeleton-shimmer" />
                  <div className="h-4 w-full rounded bg-zinc-100 skeleton-shimmer" />
                  <div className="h-6 w-16 mx-auto rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="h-6 w-20 mx-auto rounded bg-zinc-200 skeleton-shimmer" />
                </div>

                {/* Property Summary & Host */}
                <div className="mt-7 flex items-center gap-4 border-b border-[#DDDDDE] pb-7.5 lg:mt-12 lg:gap-6">
                  <div className="order-first size-[76px] lg:size-[104px] rounded-full bg-zinc-200 skeleton-shimmer shrink-0" />
                  <div className="min-w-0 space-y-2 flex-1">
                    <div className="h-5 w-48 rounded bg-zinc-200 skeleton-shimmer" />
                    <div className="h-4 w-36 rounded bg-zinc-100 skeleton-shimmer" />
                  </div>
                </div>

                {/* Key Highlights */}
                <div className="mt-7.5 space-y-3.5 border-b border-zinc-200/80 pb-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-6">
                      <span className="flex size-10 shrink-0 rounded-full border border-zinc-200 bg-zinc-100 skeleton-shimmer" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 w-44 rounded bg-zinc-200 skeleton-shimmer" />
                        <div className="h-3.5 w-64 max-w-full rounded bg-zinc-100 skeleton-shimmer" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* About this place (Description) */}
                <div className="mt-6 border-b border-zinc-200/80 pb-7.5 space-y-3">
                  <div className="h-6 w-36 rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="h-4 w-full rounded bg-zinc-100 skeleton-shimmer" />
                  <div className="h-4 w-11/12 rounded bg-zinc-100 skeleton-shimmer" />
                  <div className="h-4 w-4/5 rounded bg-zinc-100 skeleton-shimmer" />
                  <div className="mt-8 h-12 w-32 rounded-full border border-zinc-300 bg-zinc-100 skeleton-shimmer" />
                </div>

                {/* What this place offers (Amenities) */}
                <div className="mt-7.5 space-y-5 border-b border-zinc-200/80 pb-7.5">
                  <div className="h-6 w-52 rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="grid grid-cols-1 gap-x-12 gap-y-2.5 sm:grid-cols-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="size-9 rounded-full bg-zinc-100 border border-zinc-200 skeleton-shimmer shrink-0" />
                        <div className="h-4 w-32 rounded bg-zinc-200 skeleton-shimmer" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 h-12 w-44 rounded-full border border-zinc-300 bg-zinc-100 skeleton-shimmer" />
                </div>

                {/* Availability Calendar */}
                <div className="mt-7.5 pb-7 space-y-4">
                  <div className="h-6 w-56 rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="h-4 w-44 rounded bg-zinc-100 skeleton-shimmer" />
                  <div className="max-w-[608px] rounded-2xl bg-[#F3F4F5] p-3 sm:p-4">
                    <div className="rounded-2xl bg-white px-3 py-5 sm:px-5 sm:py-6 h-[320px] flex flex-col justify-between">
                      <div className="flex justify-between items-center px-4">
                        <div className="h-5 w-28 bg-zinc-200 rounded skeleton-shimmer" />
                        <div className="h-5 w-28 bg-zinc-200 rounded skeleton-shimmer" />
                      </div>
                      <div className="grid grid-cols-2 gap-8 my-auto">
                        <div className="grid grid-cols-7 gap-2">
                          {Array.from({ length: 28 }).map((_, idx) => (
                            <div key={idx} className="h-7 w-7 sm:h-8 sm:w-8 rounded-full mx-auto bg-zinc-100 skeleton-shimmer" />
                          ))}
                        </div>
                        <div className="hidden sm:grid grid-cols-7 gap-2">
                          {Array.from({ length: 28 }).map((_, idx) => (
                            <div key={idx} className="h-7 w-7 sm:h-8 sm:w-8 rounded-full mx-auto bg-zinc-100 skeleton-shimmer" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN (Desktop Sticky Booking Widget - hidden on mobile) */}
              <div className="hidden lg:col-span-5 lg:block">
                <div className="sticky top-24 space-y-6">
                  {/* Prices Include All Fees Pill */}
                  <div className="flex min-h-[72px] items-center justify-center gap-4 rounded-[30px] border border-zinc-200/80 bg-white/70 px-4 py-3 shadow-[2px_0px_4px_rgba(0,0,0,0.08)]">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 skeleton-shimmer" />
                    <div className="h-4 w-44 rounded bg-zinc-200 skeleton-shimmer" />
                  </div>

                  {/* Main Booking Card */}
                  <div className="space-y-4 rounded-[30px] border border-zinc-300 bg-white/70 p-6 shadow-[2px_0px_4px_rgba(0,0,0,0.08)] sm:p-5">
                    {/* Price and Badge */}
                    <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
                      <div className="h-7 w-36 rounded bg-zinc-200 skeleton-shimmer" />
                      <div className="h-6 w-24 rounded-full bg-emerald-50 skeleton-shimmer" />
                    </div>

                    {/* Date Pickers & Guests Card */}
                    <div className="rounded-[10px] border border-[#727272] overflow-hidden divide-y divide-[#727272] bg-[#F3F4F5]">
                      <div className="grid grid-cols-2 divide-x divide-[#727272]">
                        <div className="p-3 space-y-1.5">
                          <div className="h-3 w-16 bg-zinc-200 rounded skeleton-shimmer" />
                          <div className="h-4 w-24 bg-zinc-300 rounded skeleton-shimmer" />
                        </div>
                        <div className="p-3 space-y-1.5">
                          <div className="h-3 w-16 bg-zinc-200 rounded skeleton-shimmer" />
                          <div className="h-4 w-24 bg-zinc-300 rounded skeleton-shimmer" />
                        </div>
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="h-3 w-14 bg-zinc-200 rounded skeleton-shimmer" />
                        <div className="h-4 w-24 bg-zinc-300 rounded skeleton-shimmer" />
                      </div>
                    </div>

                    {/* Reserve Button */}
                    <div className="h-13 w-full rounded-full bg-[#FCDF9C] skeleton-shimmer shadow-xs" />
                    <div className="h-3 w-56 mx-auto rounded bg-zinc-100 skeleton-shimmer" />

                    {/* Pricing Breakdown Rows */}
                    <div className="space-y-2.5 pt-2 border-t border-zinc-100 text-sm">
                      <div className="flex justify-between items-center">
                        <div className="h-4 w-40 bg-zinc-100 rounded skeleton-shimmer" />
                        <div className="h-4 w-16 bg-zinc-200 rounded skeleton-shimmer" />
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="h-4 w-28 bg-zinc-100 rounded skeleton-shimmer" />
                        <div className="h-4 w-14 bg-zinc-200 rounded skeleton-shimmer" />
                      </div>
                      <div className="pt-2 border-t border-zinc-200 flex justify-between items-center">
                        <div className="h-5 w-20 bg-zinc-200 rounded skeleton-shimmer" />
                        <div className="h-5 w-24 bg-zinc-300 rounded skeleton-shimmer" />
                      </div>
                    </div>
                  </div>

                  {/* Report Listing */}
                  <div className="mx-auto flex items-center justify-center gap-4 pt-1">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 skeleton-shimmer" />
                    <div className="h-4 w-28 rounded bg-zinc-100 skeleton-shimmer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Sections Flow (Order matches PublicListingDetailClient flex order) */}
            <div className="mt-7.5 flex flex-col w-full sm:space-y-12 space-y-8">
              {/* Reviews Section (Order-3 on loaded page) */}
              <div className="order-3 border-t border-[#DDDDDE] py-8 sm:py-14 text-center space-y-4">
                <div className="mx-auto max-w-[350px] space-y-3">
                  <div className="mx-auto h-16 w-36 rounded-xl bg-zinc-200 skeleton-shimmer" />
                  <div className="mx-auto h-5 w-44 rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="mx-auto h-4 w-64 rounded bg-zinc-100 skeleton-shimmer" />
                </div>
                <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4 text-left">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-3">
                      <div className="size-12 rounded-full bg-zinc-200 skeleton-shimmer" />
                      <div className="h-4 w-24 rounded bg-zinc-200 skeleton-shimmer" />
                      <div className="h-16 rounded bg-zinc-100 skeleton-shimmer" />
                      <div className="h-4 w-20 rounded bg-zinc-200 skeleton-shimmer" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Where you'll be - Map (Order-4 on loaded page, matching exact h-[163px] sm:h-[604px]) */}
              <div className="order-4 space-y-3 sm:pb-12 pb-8 w-full lg:w-[calc(100vw-3rem)] lg:max-w-[1262px] mx-auto">
                <div className="h-6 w-44 rounded bg-zinc-200 skeleton-shimmer mb-1" />
                <div className="h-4 w-56 rounded bg-zinc-100 skeleton-shimmer mb-4" />
                <div className="h-[163px] sm:h-[604px] w-full overflow-hidden sm:rounded-[30px] rounded-[10px] border border-zinc-200 bg-[#F1F1F199] skeleton-shimmer shadow-sm" />
              </div>

              {/* Meet your host (Order-5 on loaded page) */}
              <div className="order-5 sm:pt-12 pt-7.5 sm:pb-12 pb-7.5 border-y border-zinc-200/80 w-full lg:w-[calc(100vw-3rem)] lg:max-w-[1262px] mx-auto space-y-6">
                <div className="h-6 w-36 rounded bg-zinc-200 skeleton-shimmer mb-6" />
                <div className="grid gap-8 md:grid-cols-[376px_minmax(0,1fr)] md:gap-[100px]">
                  <div className="h-[260px] w-full max-w-[376px] rounded-[30px] border border-[#dedede] bg-white p-7 shadow-[0_2px_5px_rgba(0,0,0,0.14)] skeleton-shimmer" />
                  <div className="space-y-4 pt-1">
                    <div className="h-6 w-52 rounded bg-zinc-200 skeleton-shimmer" />
                    <div className="h-4 w-full max-w-xl rounded bg-zinc-100 skeleton-shimmer" />
                    <div className="h-4 w-3/4 max-w-lg rounded bg-zinc-100 skeleton-shimmer" />
                    <div className="h-12 w-44 rounded-full border border-zinc-300 bg-zinc-100 skeleton-shimmer mt-6" />
                  </div>
                </div>
              </div>

              {/* Things to know (Order-6 on loaded page) */}
              <div className="order-6 md:pb-12 w-full lg:w-[calc(100vw-3rem)] lg:max-w-[1262px] mx-auto space-y-6">
                <div className="h-6 w-40 rounded bg-zinc-200 skeleton-shimmer mb-6" />
                <div className="grid sm:gap-8 gap-4 md:grid-cols-[1fr_1fr_1.25fr]">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="min-h-[294px] rounded-[30px] border border-[#dedede] bg-white/60 sm:p-7 py-8 px-5 space-y-4 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)]">
                      <div className="h-5 w-32 rounded bg-zinc-200 skeleton-shimmer" />
                      <div className="space-y-2 pt-2">
                        <div className="h-4 w-full rounded bg-zinc-100 skeleton-shimmer" />
                        <div className="h-4 w-5/6 rounded bg-zinc-100 skeleton-shimmer" />
                        <div className="h-4 w-4/6 rounded bg-zinc-100 skeleton-shimmer" />
                      </div>
                      <div className="h-4 w-20 rounded bg-zinc-200 skeleton-shimmer mt-8" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </main>

      {/* Mobile Fixed Bottom Booking Bar Skeleton (lg:hidden) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-5 w-24 rounded bg-zinc-200 skeleton-shimmer" />
          <div className="h-3 w-16 rounded bg-zinc-100 skeleton-shimmer" />
        </div>
        <div className="h-10 w-36 rounded-2xl bg-[#fee09a] skeleton-shimmer" />
      </div>

      <Footer />
    </div>
  );
}
