"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { ModerationPolicy } from "@/lib/moderation/policies";

export interface ReportContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "REVIEW" | "LISTING" | "LISTING_PHOTO" | "PROFILE" | "USER" | "MESSAGE";
  targetId: string;
  targetTitle?: string;
  relatedBookingId?: string;
  onReportSubmitted?: (caseReference: string) => void;
}

const DEFAULT_REVIEW_REASONS: ModerationPolicy[] = [
  { code: "FAKE_OR_INAUTHENTIC_REVIEW", targetTypes: ["REVIEW"], defaultSeverity: "MEDIUM", description: "Review may not reflect a genuine stay." },
  { code: "RETALIATORY_REVIEW", targetTypes: ["REVIEW"], defaultSeverity: "MEDIUM", description: "Review may be retaliation rather than genuine feedback." },
  { code: "IRRELEVANT_REVIEW", targetTypes: ["REVIEW"], defaultSeverity: "LOW", description: "Review is unrelated to the listing or stay." },
  { code: "HARASSMENT_OR_THREATS", targetTypes: ["REVIEW"], defaultSeverity: "HIGH", description: "Harassment, threats, or abusive language." },
  { code: "DISCRIMINATORY_CONTENT", targetTypes: ["REVIEW"], defaultSeverity: "HIGH", description: "Discriminatory or hateful content." },
  { code: "SPAM_OR_PROMOTION", targetTypes: ["REVIEW"], defaultSeverity: "LOW", description: "Spam or unauthorized promotional content." },
  { code: "PRIVATE_INFORMATION", targetTypes: ["REVIEW"], defaultSeverity: "HIGH", description: "Personal contact details or private information exposed." },
  { code: "EXTORTION_OR_MANIPULATION", targetTypes: ["REVIEW"], defaultSeverity: "HIGH", description: "Extortion, review manipulation, or coercion." },
  { code: "ILLEGAL_OR_PROHIBITED_CONTENT", targetTypes: ["REVIEW"], defaultSeverity: "CRITICAL", description: "Illegal or prohibited content." },
];

export function ReportContentModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
  relatedBookingId,
  onReportSubmitted,
}: ReportContentModalProps) {
  const [policies, setPolicies] = useState<ModerationPolicy[]>(DEFAULT_REVIEW_REASONS);
  const [reasonCode, setReasonCode] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [bookingId, setBookingId] = useState(relatedBookingId || "");
  const [error, setError] = useState<string | null>(null);
  const [successReference, setSuccessReference] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccessReference(null);

    // Fetch up-to-date policies for this target type
    fetch(`/api/v1/moderation/policies?targetType=${encodeURIComponent(targetType)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
          setPolicies(data.data);
          if (!reasonCode) {
            setReasonCode(data.data[0].code);
          }
        }
      })
      .catch(() => {
        // Fall back to built-in list
      });
  }, [isOpen, targetType]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonCode) {
      setError("Please select a report reason.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const fullDescription = [
          description.trim(),
          evidenceNote.trim() ? `Supporting evidence/context: ${evidenceNote.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        const response = await fetch("/api/v1/moderation/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType,
            targetId,
            category: "CONTENT_POLICY",
            reasonCode,
            description: fullDescription || undefined,
            relatedBookingId: bookingId.trim() || undefined,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error?.message || "Failed to submit report");
        }

        const caseRef = result.data?.caseReference || "Submitted";
        setSuccessReference(caseRef);
        if (onReportSubmitted) {
          onReportSubmitted(caseRef);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit report. Please try again.");
      }
    });
  };

  const handleClose = () => {
    if (isPending) return;
    setReasonCode("");
    setDescription("");
    setEvidenceNote("");
    setError(null);
    setSuccessReference(null);
    onClose();
  };

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          handleClose();
        }
      }}
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl transition-all">
        {successReference ? (
          <div className="text-center py-4 space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 id="report-modal-title" className="text-xl font-bold text-slate-900">
              Report Submitted
            </h2>
            <p className="text-sm text-slate-600">
              Thank you for helping keep the Homyz community safe and honest. Our trust & safety team has received your report.
            </p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
              <span className="font-semibold">Case Reference: </span>
              <code className="font-mono text-indigo-700">{successReference}</code>
            </div>
            <p className="text-xs text-slate-500">
              Negative feedback alone does not qualify a review for removal. Genuine stays and honest opinions are protected under our marketplace policy.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 id="report-modal-title" className="text-xl font-bold text-slate-900">
                  {targetType === "LISTING_PHOTO"
                    ? "Report Photo"
                    : targetType === "LISTING"
                      ? "Report Listing"
                      : targetType === "PROFILE" || targetType === "USER"
                        ? "Report Profile"
                        : "Report Review"}
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
                >
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {targetTitle ? `Reporting: “${targetTitle}”` : "Submit a formal content violation report."}
              </p>
            </div>

            {targetType === "LISTING_PHOTO" && targetId && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-slate-300">
                  <Image
                    src={targetId}
                    alt={targetTitle || "Reported photo"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-semibold text-slate-800 truncate">{targetTitle || "Property Photo"}</p>
                  <p className="text-slate-500 truncate mt-0.5">{targetId}</p>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="report-reason" className="block text-xs font-semibold text-slate-700">
                Why are you reporting this {targetType === "LISTING_PHOTO" ? "photo" : targetType === "LISTING" ? "listing" : targetType === "PROFILE" ? "profile" : "content"}? <span className="text-red-500">*</span>
              </label>
              <select
                id="report-reason"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                disabled={isPending}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-slate-900 focus:outline-none"
                required
              >
                <option value="">Select a policy reason</option>
                {policies.map((policy) => (
                  <option key={policy.code} value={policy.code}>
                    {policy.code.replaceAll("_", " ")} — {policy.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-description" className="block text-xs font-semibold text-slate-700">
                Detailed Explanation <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="report-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                rows={3}
                maxLength={2000}
                placeholder="Explain why this review violates Homyz policies..."
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="report-evidence" className="block text-xs font-semibold text-slate-700">
                Supporting Evidence &amp; Documentation <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="report-evidence"
                value={evidenceNote}
                onChange={(e) => setEvidenceNote(e.target.value)}
                disabled={isPending}
                rows={2}
                maxLength={2000}
                placeholder="Reference message timestamps, checkout records, or incident numbers..."
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>

            {relatedBookingId ? (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Booking Reference: </span>
                <span className="font-mono">{relatedBookingId}</span>
              </div>
            ) : (
              <div>
                <label htmlFor="report-booking" className="block text-xs font-semibold text-slate-700">
                  Related Reservation ID <span className="text-slate-400 font-normal">(if available)</span>
                </label>
                <input
                  id="report-booking"
                  type="text"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. bk_123456"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                />
              </div>
            )}

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <span className="font-semibold">Review Moderation Policy: </span>
              Submitting a report opens an investigation. Reviews remain published during review unless a severe policy violation is confirmed by our moderators.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !reasonCode}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {isPending ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalOverlay>
  );
}

