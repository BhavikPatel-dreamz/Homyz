"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useLanguage } from "@/lib/i18n/language-context";

type FileBookingDisputeProps = {
  bookingId: string;
  variant?: "guest" | "host";
};

const CATEGORIES = [
  ["PROPERTY_CONDITION", "booking_dispute_cat_prop_cond", "Property condition"],
  ["CLEANLINESS", "booking_dispute_cat_cleanliness", "Cleanliness"],
  ["LISTING_ACCURACY", "booking_dispute_cat_accuracy", "Listing accuracy"],
  ["SAFETY_HAZARD", "booking_dispute_cat_safety", "Safety concern"],
  ["HOST_SERVICE", "booking_dispute_cat_service", "Service issue"],
  ["OTHER", "booking_dispute_cat_other", "Other"],
] as const;

/** A booking-scoped intake form. Authorization and booking ownership are enforced by the server. */
export function FileBookingDispute({ bookingId, variant = "guest" }: FileBookingDisputeProps) {
  const router = useRouter();
  const { t } = useLanguage();
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
      if (!response.ok) throw new Error(payload.error?.message || t("booking_dispute_err_fallback", "We could not submit your report."));
      setSubmitted(true);
      setDescription("");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("booking_dispute_err_fallback", "We could not submit your report."));
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
        className="inline-flex min-h-10 items-center justify-center sm:justify-start text-sm font-medium text-[#727272] underline underline-offset-4 transition-colors hover:text-[#1f1f1f] whitespace-nowrap"
      >
        {t("booking_dispute_report_issue", "Report an issue with this reservation")}
      </button>

      {open && (
        <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 text-[#1F1F1F] shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4">
              <div>
                <h2 className="text-xl font-medium tracking-tight text-[#1F1F1F]">{t("booking_dispute_modal_title", "Report a reservation issue")}</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#727272]">{t("booking_dispute_modal_subtitle", "Your report is shared with Homyz Support for review.")}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#727272] hover:bg-[#F3F4F5] hover:text-[#1F1F1F] transition-colors cursor-pointer"
                aria-label={t("booking_dispute_close_aria", "Close report form")}
              >
                ✕
              </button>
            </div>

            {submitted ? (
              <div className="py-6">
                <div className="inline-flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold mb-3">✓</div>
                <p className="text-base font-medium text-emerald-800">{t("booking_dispute_submitted_title", "Your report has been submitted.")}</p>
                <p className="mt-1 text-sm text-[#727272]">{t("booking_dispute_submitted_desc", "We will review the case and may contact you for more information.")}</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#1F1F1F] px-6 text-sm font-medium text-white transition-all duration-300 hover:bg-[#FCDF9C] hover:text-[#1F1F1F] cursor-pointer"
                >
                  {t("booking_dispute_btn_done", "Done")}
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4 pt-4">
                {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <label className="block text-sm font-medium text-[#1F1F1F]">
                  {t("booking_dispute_what_happened", "What happened?")}
                  <div className="relative mt-1.5">
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value as typeof category)}
                      className="block w-full appearance-none rounded-xl border border-zinc-300 bg-white py-2.5 pl-3.5 pr-10 text-sm font-normal text-[#1F1F1F] transition-all focus:border-[#1F1F1F] focus:outline-hidden cursor-pointer"
                    >
                      {CATEGORIES.map(([value, key, label]) => <option key={value} value={value}>{t(key, label)}</option>)}
                    </select>
                    <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#727272]">
                      <svg
                        className="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                </label>
                <label className="block text-sm font-medium text-[#1F1F1F]">
                  {t("booking_dispute_describe_issue", "Describe the issue")}
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={5}
                    maxLength={4000}
                    required
                    placeholder={t("booking_dispute_placeholder", { reporter }, `Tell us what happened with the ${reporter} and when.`)}
                    className="mt-1.5 block w-full rounded-xl border border-zinc-300 p-3 text-sm font-normal text-[#1F1F1F] placeholder:text-[#727272] focus:border-[#1F1F1F] focus:outline-hidden transition-all resize-none"
                  />
                </label>
                <p className="text-xs leading-relaxed text-[#727272]">{t("booking_dispute_security_notice", "Do not include payment-card details or access codes. Evidence upload is not available in this form yet.")}</p>
                <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={close}
                    disabled={submitting}
                    className="flex min-h-11 items-center justify-center rounded-full border border-[#1F1F1F] bg-white px-6 text-sm font-medium text-[#1F1F1F] transition-all duration-300 hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    {t("booking_dispute_btn_cancel", "Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !description.trim()}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-transparent bg-[#FCDF9C] px-6 text-sm font-medium text-[#1F1F1F] shadow-xs transition-all duration-300 hover:bg-[#1F1F1F] hover:text-white hover:border-[#1F1F1F] disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 disabled:border-transparent disabled:opacity-70 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <svg className="size-4 animate-spin text-current" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{t("booking_dispute_submitting", "Submitting…")}</span>
                      </>
                    ) : (
                      <span>{t("booking_dispute_btn_submit", "Submit report")}</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
