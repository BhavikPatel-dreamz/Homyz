"use client";

import { useState } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";

export type AdminReviewItem = {
  id: string;
  direction: "GUEST_TO_PROPERTY" | "HOST_TO_GUEST";
  status: "PRIVATE" | "PUBLISHED" | "HIDDEN" | "DELETED" | "PENDING_MODERATION" | "EXPIRED";
  rating: number;
  cleanlinessRating?: number | null;
  accuracyRating?: number | null;
  checkInRating?: number | null;
  communicationRating?: number | null;
  locationRating?: number | null;
  valueRating?: number | null;
  houseRulesRating?: number | null;
  comment: string;
  privateNoteToHost?: string | null;
  privateNoteToGuest?: string | null;
  recommendGuest?: boolean | null;
  submittedAt: string | Date;
  publishedAt?: string | Date | null;
  reviewDeadline?: string | Date | null;
  editDeadline?: string | Date | null;
  moderatedAt?: string | Date | null;
  rejectionReason?: string | null;
  moderationNotes?: string | null;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
  };
  targetUser?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
  } | null;
  listing?: {
    id: string;
    title: string;
    city: string | null;
    country: string | null;
  } | null;
  booking?: {
    id: string;
    startDate: string | Date;
    endDate: string | Date;
    status: string;
  } | null;
  response?: {
    id: string;
    comment: string;
    createdAt: string | Date;
    author: {
      name: string | null;
      image: string | null;
    };
  } | null;
  moderationCase?: {
    id: string;
    caseReference: string;
    status: string;
    severity: string;
  } | null;
};

interface AdminReviewDetailModalProps {
  review: AdminReviewItem;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}

export function AdminReviewDetailModal({
  review,
  isOpen,
  onClose,
  onActionComplete,
}: AdminReviewDetailModalProps) {
  const [busy, setBusy] = useState(false);
  const [actionType, setActionType] = useState<"HIDE" | "RESTORE" | "DELETE" | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleModerate(action: "HIDE" | "RESTORE" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() || undefined, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to execute moderation action");
      }
      setActionType(null);
      onActionComplete();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 px-6 py-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              {review.direction === "GUEST_TO_PROPERTY" ? "Guest to Property" : "Host to Guest"}
            </span>
            <h2 id="review-detail-title" className="text-lg font-bold text-slate-900 dark:text-zinc-100">
              Review Details &middot; ID: {review.id.slice(0, 8)}...
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200 transition"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm font-medium text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
              {error}
            </div>
          )}

          {/* Status & Direction Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                review.status === "PUBLISHED"
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800/40"
                  : review.status === "PRIVATE"
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-transparent dark:border-amber-800/40"
                  : review.status === "HIDDEN"
                  ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-transparent dark:border-rose-800/40"
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200"
              }`}
            >
              {review.status}
            </span>
            <span className="flex items-center text-sm font-bold text-amber-500">
              {"★".repeat(review.rating)}
              <span className="ml-1 text-slate-700 dark:text-zinc-300">({review.rating}/5)</span>
            </span>
            {review.recommendGuest !== null && review.recommendGuest !== undefined && (
              <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 border border-transparent dark:border-blue-900/40">
                {review.recommendGuest ? "✓ Recommends Guest" : "✗ Does Not Recommend Guest"}
              </span>
            )}
            {review.moderationCase && (
              <Link
                href={`/admin/moderation/cases/${review.moderationCase.id}`}
                className="rounded-full bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 text-xs font-semibold text-purple-800 dark:text-purple-300 hover:underline"
              >
                Case: {review.moderationCase.caseReference} ({review.moderationCase.status})
              </Link>
            )}
          </div>

          {/* Parties */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50 p-4 border border-slate-100 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Reviewer (Author)</p>
              <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{review.author.name || "Anonymous"}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">{review.author.email || review.author.id}</p>
              <span className="inline-block mt-1 rounded bg-slate-200 dark:bg-zinc-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-zinc-300">
                {review.author.role}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Reviewed Subject (Target)</p>
              {review.targetUser ? (
                <>
                  <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{review.targetUser.name || "User"}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">{review.targetUser.email || review.targetUser.id}</p>
                  <span className="inline-block mt-1 rounded bg-slate-200 dark:bg-zinc-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-zinc-300">
                    {review.targetUser.role}
                  </span>
                </>
              ) : review.listing ? (
                <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                  {review.listing.title} ({review.listing.city}, {review.listing.country})
                </p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-zinc-500">N/A</p>
              )}
            </div>
          </div>

          {/* Public Comment */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Public Review Comment</h3>
            <div className="mt-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-sm text-slate-800 dark:text-zinc-200">
              {review.comment ? (
                <p className="whitespace-pre-wrap">{review.comment}</p>
              ) : (
                <p className="italic text-slate-400 dark:text-zinc-500">Rating-only review (no written comment)</p>
              )}
            </div>
          </div>

          {/* Category Ratings */}
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {review.cleanlinessRating && (
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2">
                <span className="text-slate-500 dark:text-zinc-400">Cleanliness:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{review.cleanlinessRating}/5</span>
              </div>
            )}
            {review.accuracyRating && (
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2">
                <span className="text-slate-500 dark:text-zinc-400">Accuracy:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{review.accuracyRating}/5</span>
              </div>
            )}
            {review.communicationRating && (
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2">
                <span className="text-slate-500 dark:text-zinc-400">Communication:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{review.communicationRating}/5</span>
              </div>
            )}
            {review.checkInRating && (
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2">
                <span className="text-slate-500 dark:text-zinc-400">Check-in:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{review.checkInRating}/5</span>
              </div>
            )}
            {review.locationRating && (
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2">
                <span className="text-slate-500 dark:text-zinc-400">Location:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{review.locationRating}/5</span>
              </div>
            )}
            {review.valueRating && (
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2">
                <span className="text-slate-500 dark:text-zinc-400">Value:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{review.valueRating}/5</span>
              </div>
            )}
            {review.houseRulesRating && (
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2">
                <span className="text-slate-500 dark:text-zinc-400">House rules:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{review.houseRulesRating}/5</span>
              </div>
            )}
          </div>

          {/* Private Notes */}
          {(review.privateNoteToHost || review.privateNoteToGuest) && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Private Feedback</h3>
              <div className="mt-1 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                {review.privateNoteToHost && (
                  <p>
                    <span className="font-semibold">Note to Host:</span> {review.privateNoteToHost}
                  </p>
                )}
                {review.privateNoteToGuest && (
                  <p>
                    <span className="font-semibold">Note to Guest:</span> {review.privateNoteToGuest}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Public Response */}
          {review.response && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Public Response</h3>
              <div className="mt-1 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 p-3 text-xs text-slate-800 dark:text-zinc-200">
                <p className="font-semibold text-slate-900 dark:text-zinc-100">{review.response.author.name || "Respondent"}:</p>
                <p className="mt-1 whitespace-pre-wrap">{review.response.comment}</p>
                <p className="mt-2 text-[10px] text-slate-400 dark:text-zinc-500">
                  Responded on {new Date(review.response.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/50 p-3 text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
            <p>Submitted: {new Date(review.submittedAt).toLocaleString()}</p>
            {review.publishedAt && <p>Published: {new Date(review.publishedAt).toLocaleString()}</p>}
            {review.reviewDeadline && <p>Review Deadline: {new Date(review.reviewDeadline).toLocaleString()}</p>}
            {review.rejectionReason && (
              <p className="text-rose-600 dark:text-rose-400 font-medium">Rejection Reason: {review.rejectionReason}</p>
            )}
          </div>

          {/* Moderation Form (if an action is selected) */}
          {actionType && (
            <div className="rounded-xl border-2 border-slate-900 dark:border-zinc-700 p-4 space-y-3 bg-slate-50 dark:bg-zinc-800/60">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
                Confirm Moderation: {actionType}
              </h4>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Reason</label>
                <input
                  type="text"
                  placeholder="e.g., Policy violation, abusive language, inappropriate content"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 p-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional context for audit log"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 p-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleModerate(actionType)}
                  className="rounded-lg bg-slate-900 dark:bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition"
                >
                  {busy ? "Processing..." : `Confirm ${actionType}`}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setActionType(null)}
                  className="rounded-lg border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 px-6 py-4">
          <div className="flex gap-2">
            {!actionType && (
              <>
                {review.status !== "HIDDEN" ? (
                  <button
                    type="button"
                    onClick={() => setActionType("HIDE")}
                    className="rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition"
                  >
                    Hide Review
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActionType("RESTORE")}
                    className="rounded-lg border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition"
                  >
                    Restore Review
                  </button>
                )}
                {review.status !== "DELETED" && (
                  <button
                    type="button"
                    onClick={() => setActionType("DELETE")}
                    className="rounded-lg border border-rose-300 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition"
                  >
                    Delete Review
                  </button>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-200 dark:bg-zinc-700 px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-300 dark:hover:bg-zinc-600 transition"
          >
            Close
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

