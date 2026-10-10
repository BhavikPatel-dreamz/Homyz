"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { GuestAuthoredReviewDTO } from "@/lib/profile/profile-loader";

import { useLanguage } from "@/lib/i18n/language-context";

interface MyReviewsSectionProps {
  reviews: GuestAuthoredReviewDTO[];
  className?: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${star <= rating ? "text-[#1F1F1F] fill-[#1F1F1F]" : "text-zinc-300 fill-zinc-200"}`}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function MyReviewsSection({ reviews, className = "" }: MyReviewsSectionProps) {
  const [selectedReview, setSelectedReview] = useState<GuestAuthoredReviewDTO | null>(null);
  const { t } = useLanguage();

  return (
    <section className={`w-full flex flex-col ${className}`} aria-labelledby="my-reviews-heading">
      <div className="mb-5">
        <h2 id="my-reviews-heading" className="text-xl font-medium tracking-tight text-[#1F1F1F]">
          My reviews
        </h2>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center sm:p-12 bg-zinc-50/50">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-[#727272]">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h3 className="mt-3 text-base font-semibold text-[#1F1F1F]">
            {t("profile_reviews_empty_title", "You haven't written any reviews yet.")}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 max-w-sm mx-auto">
            {t("profile_reviews_empty_desc", "Once you complete a stay, you can share feedback with the host and community here.")}
          </p>
        </div>
      ) : (
          <div className="grid w-full gap-x-8 gap-y-10 xl:grid-cols-3 md:grid-cols-2 grid-cols-1">
          {reviews.map((rev) => {
            const dateStr = new Date(rev.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const listing = rev.listing;
            const propertyTitle = listing?.title || "Property Stay";
            const propertyLocation = [listing?.city, listing?.country].filter(Boolean).join(", ");
            const propertyHref = listing ? `/listings/${listing.customSlug || listing.id}` : undefined;
            const isLong = rev.comment.length > 150;

            const reviewContent = (
                <div>
                  <div className="relative h-15 w-15 overflow-hidden rounded-full bg-zinc-100">
                    {listing?.photos[0] ? (
                      <Image
                        src={listing.photos[0]}
                        alt={propertyTitle}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-[#727272]">
                        Stay
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <StarRating rating={rev.rating} />
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-[#727272] line-clamp-3">
                    {rev.comment || <span className="italic">{t("reviews_no_written_comment", "Rating provided without written comment.")}</span>}
                  </p>

                  <div className="mt-3 min-w-0 text-sm text-[#1F1F1F]">
                    <span className="block truncate font-medium">{propertyTitle}</span>
                    {propertyLocation && (
                      <p className="mt-0.5 truncate text-[#727272]">{propertyLocation}</p>
                    )}
                    <span className="mt-0.5 block text-xs text-[#727272]">{dateStr}</span>
                  </div>
                </div>
            );

            return (
              <article key={rev.id} className="flex flex-col">
                {propertyHref ? (
                  <Link
                    href={propertyHref}
                    aria-label={`View ${propertyTitle}`}
                    className="relative block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1F1F] focus-visible:ring-offset-2"
                  >
                    {reviewContent}
                  </Link>
                ) : (
                  reviewContent
                )}

                {/* Show review Action */}
                {isLong && (
                  <div className="relative mt-5">
                    <button
                      type="button"
                      onClick={() => setSelectedReview(rev)}
                      className="rounded-full bg-[#FFE29A] px-5 py-2 text-xs font-medium text-[#1F1F1F] transition-colors hover:bg-[#f7d57e] cursor-pointer"
                    >
                      {t("profile_reviews_show_review", "Show review")}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* FULL REVIEW DETAIL MODAL */}
      {selectedReview && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
            className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl transition-all"
          >
            <button
              type="button"
              onClick={() => setSelectedReview(null)}
              aria-label="Close dialog"
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-[#727272] hover:bg-zinc-100 hover:text-zinc-800"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <StarRating rating={selectedReview.rating} />
              <span className="text-xs text-[#727272]">
                {new Date(selectedReview.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {selectedReview.listing && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-200">
                  {selectedReview.listing.photos[0] && (
                    <Image
                      src={selectedReview.listing.photos[0]}
                      alt={selectedReview.listing.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="review-modal-title" className="text-sm font-semibold text-[#1F1F1F] truncate">
                    {selectedReview.listing.title}
                  </h3>
                  <p className="text-xs text-[#727272] truncate">
                    {[selectedReview.listing.city, selectedReview.listing.country].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 max-h-[50vh] overflow-y-auto pr-1">
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-800">
                {selectedReview.comment}
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                className="rounded-full bg-[#1F1F1F] px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
              >
                {t("profile_reviews_close", "Close")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </section>
  );
}

