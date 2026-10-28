"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BackButton } from "@/components/ui/back-button";
import type { HostReviewItemDTO } from "@/services/host-reviews-insights.service";

interface HostReviewDetailsClientProps {
  review: HostReviewItemDTO;
  returnTo?: string;
}

export function HostReviewDetailsClient({
  review: initialReview,
  returnTo = "/host/insights?tab=reviews",
}: HostReviewDetailsClientProps) {
  const [review, setReview] = useState<HostReviewItemDTO>(initialReview);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [authorImageError, setAuthorImageError] = useState(false);
  const [responseImageError, setResponseImageError] = useState(false);

  const categoryScores = [
    { label: "Cleanliness", score: review.cleanlinessRating },
    { label: "Accuracy", score: review.accuracyRating },
    { label: "Check-in", score: review.checkInRating },
    { label: "Communication", score: review.communicationRating },
    { label: "Location", score: review.locationRating },
    { label: "Value", score: review.valueRating },
  ];

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const comment = replyText.trim();
    if (comment.length < 2) {
      setError("Response must be at least 2 characters.");
      return;
    }
    if (comment.length > 2000) {
      setError("Response cannot exceed 2000 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/host/insights/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message || payload?.message || "Failed to submit response.");
      }

      setReview((prev) => ({
        ...prev,
        response: {
          id: payload.data?.id || "temp-id",
          comment,
          createdAt: new Date().toISOString(),
          author: {
            id: payload.data?.author?.id || "host-id",
            name: payload.data?.author?.name || "You (Host)",
            image: payload.data?.author?.image || null,
          },
        },
      }));
      setReplyText("");
      setSuccessMessage("Your response has been published successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post response. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = new Date(review.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* ── Top Navigation Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDEDED] pb-4">
        <div className="flex items-center gap-3">
          <BackButton href={returnTo} aria-label="Back to Reviews" />
          <Link
            href={returnTo}
            className="text-sm font-medium text-[#1F1F1F] transition hover:text-[#727272]"
          >
            Back to Reviews
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {review.status}
          </span>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-7">
        {/* ── Left Column: Conversation Thread ── */}
        <div className="lg:col-span-2">
          <div className="sm:rounded-3xl rounded-lg border border-[#E5E5E5] bg-white p-5 sm:p-7 shadow-sm transition-all">
            {/* Guest Header Info */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {review.author.image && !authorImageError ? (
                  <Image
                    src={review.author.image}
                    alt={review.author.name}
                    width={40}
                    height={40}
                    className="size-10 rounded-full object-cover ring-1 ring-[#EDEDED]"
                    onError={() => setAuthorImageError(true)}
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-[#1F1F1F] text-sm font-medium text-white">
                    {review.author.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-sm font-medium text-[#1F1F1F]">
                    {review.author.name}
                  </h1>
                  <p className="text-xs text-[#727272] font-normal">{formattedDate}</p>
                </div>
              </div>

              {/* Overall Star Badge */}
              <div className="self-start sm:self-auto inline-flex items-center gap-1 rounded-full border border-[#FCDF9C] bg-[#FFF9EB] px-2.5 py-1 text-xs font-medium text-[#8F6A00] shadow-2xs">
                <span className="font-mono text-xs font-medium text-[#1F1F1F]">
                  {review.rating.toFixed(1)}
                </span>
                <svg
                  className="size-3.5 fill-amber-500 text-amber-500"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            </div>

            {/* Guest Review Quote Section */}
            <div className="mt-5 sm:mt-6">
              <div className="flex items-center justify-between border-b border-[#EDEDED] pb-2.5">
                <h2 className="text-base text-[#1f1f1f] font-medium">Guest Review</h2>
                <span className="text-xs text-[#727272] font-normal">Public listing feedback</span>
              </div>
              <div className="mt-4 pl-4 sm:pl-5 border-l-2 border-[#1F1F1F]/70">
                <p className="text-sm leading-relaxed text-[#1F1F1F] font-normal italic">
                  {review.comment ? (
                    `“${review.comment}”`
                  ) : (
                    <span className="italic text-[#727272]">No comment provided.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Private Note (if available) */}
            {review.privateNoteToHost && (
              <div className="mt-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3.5 sm:p-4 text-[#92400E]">
                <div className="flex items-center gap-2">
                  <svg
                    className="size-3.5 shrink-0 text-amber-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <p className="text-xs font-medium uppercase tracking-wider text-amber-900">Private note to you</p>
                  <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    Host only
                  </span>
                </div>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-amber-950 font-normal">
                  {review.privateNoteToHost}
                </p>
                <p className="mt-1.5 text-[11px] text-amber-800/80 font-normal">
                  Only you can see this note. It is not visible to other guests or on your public listing.
                </p>
              </div>
            )}

            {/* Conversation Bridge */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#EDEDED]" />
              </div>
              <div className="relative inline-flex items-center gap-1.5 rounded-full border border-[#EDEDED] bg-white px-3 py-1 text-xs text-[#727272] shadow-2xs">
                <svg className="size-3 text-[#1F1F1F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span className="font-medium text-[#1F1F1F]">Public Dialogue</span>
              </div>
            </div>

            {/* Host Response Section */}
            <section aria-labelledby="host-response-heading" className="space-y-3.5">
              <div className="flex flex-col gap-0.5">
                <h2 id="host-response-heading" className="text-base font-medium text-[#1F1F1F]">
                  Host response
                </h2>
                <p className="text-xs text-[#727272] font-normal">
                  Your response is displayed publicly under the review on your property listing.
                </p>
              </div>

              {/* Notification messages */}
              {successMessage && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                  <svg
                    className="size-3.5 shrink-0 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{successMessage}</span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
                  <svg
                    className="size-3.5 shrink-0 text-rose-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {review.response ? (
                /* Published Response Bubble */
                <div className="sm:rounded-2xl rounded-lg border border-neutral-200/80 bg-[#FAFAFC] p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#EDEDED] pb-3">
                    <div className="flex items-center gap-2.5">
                      {review.response.author?.image && !responseImageError ? (
                        <Image
                          src={review.response.author.image}
                          alt={review.response.author.name}
                          width={32}
                          height={32}
                          className="size-8 rounded-full object-cover ring-1 ring-[#EDEDED]"
                          onError={() => setResponseImageError(true)}
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-full bg-[#1F1F1F] text-xs font-medium text-white">
                          {review.response.author?.name ? review.response.author.name.charAt(0).toUpperCase() : "H"}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-[#1F1F1F]">
                          {review.response.author?.name || "Host response"}
                        </p>
                        <p className="text-[11px] text-[#727272] font-normal">
                          {new Date(review.response.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-800">
                      <span className="size-1 rounded-full bg-emerald-500" />
                      Published
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#1F1F1F] font-normal">
                    {review.response.comment}
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-[#EDEDED] flex items-center gap-1.5 text-xs text-[#727272]">
                    <svg className="size-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-normal text-xs">Visible to prospective guests browsing your listing.</span>
                  </div>
                </div>
              ) : (
                /* Public Reply Submission Form */
                <form onSubmit={handleReplySubmit} className="space-y-3.5">
                  <div className="relative">
                    <label htmlFor="reply-comment" className="sr-only">
                      Write your public response
                    </label>
                    <textarea
                      id="reply-comment"
                      rows={4}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a constructive, professional public response to this review..."
                      className="w-full resize-y rounded-2xl border border-neutral-300 bg-[#FAFAFC] p-3.5 text-sm font-normal text-[#1F1F1F] placeholder:text-[#A0A0A0] transition focus:border-[#1F1F1F] focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#1F1F1F]"
                      maxLength={2000}
                      disabled={isSubmitting}
                    />
                    <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-[#727272]">
                      <span className="font-normal">Write respectfully and acknowledge specific guest feedback.</span>
                      <span className="font-mono text-xs font-normal self-end sm:self-auto">{replyText.length} / 2000</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting || replyText.trim().length < 2}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1F1F1F] px-5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer active:scale-[0.99]"
                    >
                      {isSubmitting ? (
                        <>
                          <svg
                            className="size-3.5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          <span>Posting response...</span>
                        </>
                      ) : (
                        "Post response"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        </div>

        {/* ── Right Column: Single Unified Context Sidebar ── */}
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="sm:rounded-3xl rounded-lg border border-[#E5E5E5] bg-white p-5 sm:p-6 shadow-sm divide-y divide-[#EDEDED]">
            {/* Section 1: Reservation Details */}
            <section aria-labelledby="reservation-details-heading" className="pb-5">
              <div className="flex items-center justify-between pb-2.5">
                <h2 id="reservation-details-heading" className="text-xl text-[#1f1f1f] font-medium">
                  Reservation Details
                </h2>
              </div>

              <div className="space-y-2.5 pt-1">
                <div>
                  <p className="text-xs text-[#727272] font-normal">Property</p>
                  <Link
                    href={`/host/listings/${review.listingId}`}
                    className="group mt-0.5 flex items-center justify-between text-sm font-medium text-[#1F1F1F] hover:text-[#727272] transition"
                  >
                    <span className="truncate text-base">{review.listingTitle}</span>
                    <svg
                      className="size-4 shrink-0 text-[#1f1f1f] transition-transform group-hover:translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>

                {review.booking && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2 text-sm text-[#1F1F1F]">
                      <svg className="size-3.5 text-[#727272] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>
                        {new Date(review.booking.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" — "}
                        {new Date(review.booking.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#1F1F1F]">
                      <svg className="size-3.5 text-[#727272] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>
                        {review.booking.guests} {review.booking.guests === 1 ? "guest" : "guests"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Section 2: Category Subratings */}
            <section aria-labelledby="category-subratings-heading" className="py-5">
              <div className="flex items-center justify-between pb-2.5">
                <h2 id="category-subratings-heading" className="text-base text-[#1f1f1f] font-medium flex items-center">
                  <svg className="size-5 fill-amber-400 text-amber-400" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>  Category Sub Ratings
                </h2>
                <span className="text-[11px] text-[#727272] font-normal">5.0 scale</span>
              </div>

              <div className="space-y-2.5 pt-1">
                {categoryScores.map((cat) => (
                  <div key={cat.label} className="flex items-center justify-between text-sm">
                    <span className="font-normal text-[#1F1F1F]">{cat.label}</span>
                    <div className="flex items-center gap-2.5">
                      {cat.score !== null ? (
                        <>
                          <div className="h-2 w-20 sm:w-24 rounded-full bg-[#EDEDED] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#1F1F1F] transition-all duration-300"
                              style={{ width: `${(cat.score / 5) * 100}%` }}
                            />
                          </div>
                          <span className="font-medium text-[#1F1F1F] font-mono w-4 text-right">{cat.score}</span>
                        </>
                      ) : (
                        <span className="text-[#727272] italic font-normal text-xs">Not rated</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3: Response Best Practices */}
            <section aria-labelledby="best-practices-heading" className="pt-5">
              <div className="flex items-center gap-2 pb-2.5">
                <svg className="size-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 id="best-practices-heading" className="text-base text-[#1F1F1F] font-medium">
                  Response Best Practices
                </h3>
              </div>

              <ul className="space-y-2 pt-1 text-sm text-[#727272]">
                <li className="flex items-start gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#1F1F1F]" />
                  <span className="font-normal leading-relaxed">Thank the guest for taking time to share their stay experience.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#1F1F1F]" />
                  <span className="font-normal leading-relaxed">Address any specific concerns constructively and objectively.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#1F1F1F]" />
                  <span className="font-normal leading-relaxed">Highlight positive changes or improvements you’ve made since the stay.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#1F1F1F]" />
                  <span className="font-normal leading-relaxed">Keep responses concise, welcoming, and professional for prospective guests.</span>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
