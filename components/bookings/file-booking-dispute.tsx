"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";

type FileBookingDisputeProps = {
  bookingId: string;
  variant?: "guest" | "host";
};

const CATEGORIES = [
  ["PROPERTY_CONDITION", "Property condition"],
  ["CLEANLINESS", "Cleanliness"],
  ["LISTING_ACCURACY", "Listing accuracy"],
  ["SAFETY_HAZARD", "Safety concern"],
  ["HOST_SERVICE", "Service issue"],
  ["OTHER", "Other"],
] as const;

/** A booking-scoped intake form. Authorization and booking ownership are enforced by the server. */
export function FileBookingDispute({ bookingId, variant = "guest" }: FileBookingDisputeProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>("PROPERTY_CONDITION");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const reporter = variant === "host" ? "guest" : "host";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/bookings/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          category,
          severity: "MEDIUM",
          description: description.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "We could not submit your report.");
      setSubmitted(true);
      setDescription("");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "We could not submit your report.");
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    if (submitting) return;
    setOpen(false);
    setError(null);
    setSubmitted(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-[#1F1F1F] underline underline-offset-4 transition-colors hover:text-zinc-600 ml-4"
      >
        Report an issue with this reservation
      </button>

      {open && (
        <ModalOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-[#1F1F1F] shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-3">
              <div>
                <h2 className="text-lg font-semibold">Report a reservation issue</h2>
                <p className="mt-1 text-sm text-zinc-600">Your report is shared with Homyz Support for review.</p>
              </div>
              <button type="button" onClick={close} className="min-h-11 min-w-11 text-lg font-bold" aria-label="Close report form">×</button>
            </div>

            {submitted ? (
              <div className="py-6">
                <p className="font-semibold text-emerald-800">Your report has been submitted.</p>
                <p className="mt-1 text-sm text-zinc-600">We will review the case and may contact you for more information.</p>
                <button type="button" onClick={close} className="mt-5 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">Done</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4 pt-4">
                {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <label className="block text-sm font-semibold">
                  What happened?
                  <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-sm font-normal">
                    {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  Describe the issue
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={4000} required placeholder={`Tell us what happened with the ${reporter} and when.`} className="mt-1.5 block w-full rounded-lg border border-zinc-300 p-2.5 text-sm font-normal" />
                </label>
                <p className="text-xs leading-relaxed text-zinc-500">Do not include payment-card details or access codes. Evidence upload is not available in this form yet.</p>
                <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
                  <button type="button" onClick={close} disabled={submitting} className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold">Cancel</button>
                  <button type="submit" disabled={submitting || !description.trim()} className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit report"}</button>
                </div>
              </form>
            )}
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
