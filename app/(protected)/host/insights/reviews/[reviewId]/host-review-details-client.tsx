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

export function HostReviewDetailsClient({ review: initialReview, returnTo = "/host/insights?tab=reviews" }: HostReviewDetailsClientProps) {
  const [review, setReview] = useState<HostReviewItemDTO>(initialReview);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton href={returnTo} aria-label="Back to Reviews" />
          <span className="text-sm font-semibold text-[#1F1F1F]">Back to Reviews</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            {review.status}
          </span>
        </div>
      </div>

      {/* Main Review Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left 2 Columns: Review Content & Host Response */}
        <div className="space-y-6 lg:col-span-2">
          {/* Guest Review Card */}
          <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm sm:p-8">
            {/* Guest Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#EDEDED] pb-6">
              <div className="flex items-center gap-4">
                {review.author.image ? (
                  <Image
                    src={review.author.image}
                    alt={review.author.name}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full object-cover ring-1 ring-[#EDEDED]"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1F1F1F] font-bold text-white text-base">
                    {review.author.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-bold text-[#1F1F1F]">{review.author.name}</h1>
                  <p className="text-xs text-[#727272]">{formattedDate}</p>
                </div>
              </div>

              {/* Overall Star Badge */}
              <div className="flex items-center gap-1.5 rounded-full bg-[#FEF9EE] border border-[#FCDF9C] px-3.5 py-1.5">
                <span className="text-sm font-bold text-[#1F1F1F]">{review.rating}</span>
                <span className="text-sm text-amber-500">★</span>
              </div>
            </div>

            {/* Public Review Comment */}
            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Guest Review</h2>
              <p className="mt-3 text-base leading-relaxed text-[#1F1F1F] whitespace-pre-line">
                {review.comment || <span className="italic text-[#727272]">No comment provided.</span>}
              </p>
            </div>

            {/* Private Note to Host (if available) */}
            {review.privateNoteToHost && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔒</span>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Private note to you</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-amber-950">
                  {review.privateNoteToHost}
                </p>
                <p className="mt-2 text-[11px] text-amber-800">
                  Only you can see this note. It is not visible to other guests or on your public listing.
                </p>
              </div>
            )}
          </section>

          {/* Host Response Section */}
          <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold text-[#1F1F1F]">Host response</h2>
            <p className="mt-1 text-xs text-[#727272]">
              Your response is displayed publicly under the review on your property listing.
            </p>

            {successMessage && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
                {error}
              </div>
            )}

            {review.response ? (
              <div className="mt-6 rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {review.response.author?.image ? (
                      <Image
                        src={review.response.author.image}
                        alt={review.response.author.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full object-cover ring-1 ring-[#EDEDED]"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F1F1F] text-xs font-bold text-white">
                        {review.response.author?.name ? review.response.author.name.charAt(0).toUpperCase() : "H"}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-[#1F1F1F]">
                        {review.response.author?.name || "Host response"}
                      </p>
                      <p className="text-[11px] text-[#727272]">
                        {new Date(review.response.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#F3F4F5] border border-[#EDEDED] px-2.5 py-0.5 text-[10px] font-semibold text-[#1F1F1F]">
                    Published
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-[#1F1F1F] whitespace-pre-line">
                  {review.response.comment}
                </p>
              </div>
            ) : (
              <form onSubmit={handleReplySubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="reply-comment" className="sr-only">
                    Write your public response
                  </label>
                  <textarea
                    id="reply-comment"
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a constructive, professional public response to this review..."
                    className="w-full rounded-2xl border border-[#D7D7D7] p-4 text-sm text-[#1F1F1F] placeholder:text-[#A0A0A0] transition focus:border-[#1F1F1F] focus:outline-hidden"
                    maxLength={2000}
                    disabled={isSubmitting}
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[#727272]">
                    <span>Write respectfully and acknowledge specific guest feedback.</span>
                    <span className="font-mono">{replyText.length} / 2000</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || replyText.trim().length < 2}
                    className="inline-flex items-center justify-center rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    {isSubmitting ? "Posting response..." : "Post response"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* Right Column: Reservation Context & Subratings */}
        <div className="space-y-6">
          {/* Reservation Card */}
          <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Reservation Details</h2>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs text-[#727272]">Property</p>
                <Link
                  href={`/host/listings/${review.listingId}`}
                  className="mt-0.5 block text-sm font-bold text-[#1F1F1F] underline underline-offset-2 hover:text-[#727272]"
                >
                  {review.listingTitle}
                </Link>
              </div>

              {review.booking && (
                <>
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#EDEDED]">
                    <div>
                      <p className="text-[11px] text-[#727272]">Check-in</p>
                      <p className="text-xs font-semibold text-[#1F1F1F]">
                        {new Date(review.booking.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#727272]">Check-out</p>
                      <p className="text-xs font-semibold text-[#1F1F1F]">
                        {new Date(review.booking.endDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[#EDEDED]">
                    <p className="text-[11px] text-[#727272]">Guests</p>
                    <p className="text-xs font-semibold text-[#1F1F1F]">
                      {review.booking.guests} {review.booking.guests === 1 ? "guest" : "guests"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Category Ratings Breakdown */}
          <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Category Subratings</h2>
            <div className="mt-4 divide-y divide-[#EDEDED]">
              {categoryScores.map((cat) => (
                <div key={cat.label} className="flex items-center justify-between py-2.5 text-xs">
                  <span className="font-medium text-[#1F1F1F]">{cat.label}</span>
                  <div className="flex items-center gap-2">
                    {cat.score !== null ? (
                      <>
                        <div className="h-1.5 w-16 rounded-full bg-[#F3F4F5] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#1F1F1F]"
                            style={{ width: `${(cat.score / 5) * 100}%` }}
                          />
                        </div>
                        <span className="font-bold text-[#1F1F1F] font-mono w-4 text-right">{cat.score}</span>
                      </>
                    ) : (
                      <span className="text-[#727272] italic">Not rated</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Response Best Practices Card */}
          <section className="rounded-3xl border border-[#E5E5E5] bg-[#F9F9F9] p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F1F1F]">Response Best Practices</h3>
            <ul className="mt-3 space-y-2 text-xs text-[#727272] list-disc pl-4">
              <li>Thank the guest for taking time to share their stay experience.</li>
              <li>Address any specific concerns constructively and objectively.</li>
              <li>Highlight positive changes or improvements you’ve made since the stay.</li>
              <li>Keep responses concise, welcoming, and professional for prospective guests.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
