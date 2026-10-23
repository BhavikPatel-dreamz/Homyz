"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
        {returnTo === "/host/insights?tab=reviews" ? (
          <Link
            href="/host/insights?tab=reviews"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950"
          >
            <span className="text-base">←</span>
            <span>Back to Reviews</span>
          </Link>
        ) : (
          <Link
            href={returnTo}
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950"
          >
            <span className="text-base">←</span>
            <span>Back to Reviews</span>
          </Link>
        )}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            {review.status}
          </span>
        </div>
      </div>

      {/* Main Review Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left 2 Columns: Review Content & Host Response */}
        <div className="space-y-6 lg:col-span-2">
          {/* Guest Review Card */}
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
            {/* Guest Header */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-6">
              <div className="flex items-center gap-4">
                {review.author.image ? (
                  <Image
                    src={review.author.image}
                    alt={review.author.name}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full object-cover ring-1 ring-zinc-200"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 font-bold text-white text-base">
                    {review.author.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-bold text-zinc-950">{review.author.name}</h1>
                  <p className="text-xs text-zinc-500">{formattedDate}</p>
                </div>
              </div>

              {/* Overall Star Badge */}
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 ring-1 ring-amber-500/20">
                <span className="text-sm font-bold text-amber-900">{review.rating}</span>
                <span className="text-sm text-amber-500">★</span>
              </div>
            </div>

            {/* Public Review Comment */}
            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Guest Review</h2>
              <p className="mt-3 text-base leading-relaxed text-zinc-800 whitespace-pre-line">
                {review.comment || <span className="italic text-zinc-400">No comment provided.</span>}
              </p>
            </div>

            {/* Private Note to Host (if available) */}
            {review.privateNoteToHost && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔒</span>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Private note to you</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-amber-950">
                  {review.privateNoteToHost}
                </p>
                <p className="mt-2 text-[11px] text-amber-700">
                  Only you can see this note. It is not visible to other guests or on your public listing.
                </p>
              </div>
            )}
          </section>

          {/* Host Response Section */}
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
            <h2 className="text-lg font-bold text-zinc-950">Host response</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Your response is displayed publicly under the review on your property listing.
            </p>

            {successMessage && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {error}
              </div>
            )}

            {review.response ? (
              <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {review.response.author?.image ? (
                      <Image
                        src={review.response.author.image}
                        alt={review.response.author.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-white">
                        {review.response.author?.name ? review.response.author.name.charAt(0).toUpperCase() : "H"}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-zinc-900">
                        {review.response.author?.name || "Host response"}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {new Date(review.response.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-zinc-200/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                    Published
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-zinc-800 whitespace-pre-line">
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
                    className="w-full rounded-2xl border border-zinc-300 p-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                    maxLength={2000}
                    disabled={isSubmitting}
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Write respectfully and acknowledge specific guest feedback.</span>
                    <span className="font-mono">{replyText.length} / 2000</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || replyText.trim().length < 2}
                    className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
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
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Reservation Details</h2>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs text-zinc-500">Property</p>
                <Link
                  href={`/host/listings/${review.listingId}`}
                  className="mt-0.5 block text-sm font-bold text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                >
                  {review.listingTitle}
                </Link>
              </div>

              {review.booking && (
                <>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100">
                    <div>
                      <p className="text-[11px] text-zinc-500">Check-in</p>
                      <p className="text-xs font-semibold text-zinc-900">
                        {new Date(review.booking.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-500">Check-out</p>
                      <p className="text-xs font-semibold text-zinc-900">
                        {new Date(review.booking.endDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-zinc-100">
                    <p className="text-[11px] text-zinc-500">Guests</p>
                    <p className="text-xs font-semibold text-zinc-900">
                      {review.booking.guests} {review.booking.guests === 1 ? "guest" : "guests"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Category Ratings Breakdown */}
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Category Subratings</h2>
            <div className="mt-4 divide-y divide-zinc-100">
              {categoryScores.map((cat) => (
                <div key={cat.label} className="flex items-center justify-between py-2.5 text-xs">
                  <span className="font-medium text-zinc-700">{cat.label}</span>
                  <div className="flex items-center gap-2">
                    {cat.score !== null ? (
                      <>
                        <div className="h-1.5 w-16 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-zinc-900"
                            style={{ width: `${(cat.score / 5) * 100}%` }}
                          />
                        </div>
                        <span className="font-bold text-zinc-950 font-mono w-4 text-right">{cat.score}</span>
                      </>
                    ) : (
                      <span className="text-zinc-400 italic">Not rated</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Response Best Practices Card */}
          <section className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-6 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">Response Best Practices</h3>
            <ul className="mt-3 space-y-2 text-xs text-zinc-600 list-disc pl-4">
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
