"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type CategoryKey = "checkIn" | "cleanliness" | "accuracy" | "communication" | "location" | "value";

type ReviewWizardProps = {
  bookingId: string;
  listingId: string;
  listingName: string;
  listingPhoto: string | null;
  location: string | null;
  stayDates: string;
  totalPaid: string;
};

type ReviewDraft = {
  step: number;
  rating: number;
  categoryRatings: Partial<Record<CategoryKey, number>>;
  comment: string;
};

const steps: Array<{ key: "intro" | "overall" | CategoryKey | "comment"; title: (listingName: string) => string; subtitle: string }> = [
  { key: "intro", title: (listingName) => `Write a review for ${listingName}`, subtitle: "Your feedback helps hosts improve and helps future guests choose with confidence." },
  { key: "overall", title: () => "How was your stay?", subtitle: "Your overall rating will appear with your public review." },
  { key: "checkIn", title: (listingName) => `How was check-in at ${listingName}?`, subtitle: "Consider how easy it was to arrive and get settled." },
  { key: "cleanliness", title: (listingName) => `How clean was ${listingName}?`, subtitle: "Your rating helps keep stays comfortable for everyone." },
  { key: "accuracy", title: (listingName) => `How accurately did ${listingName} match its listing?`, subtitle: "Think about the photos, description, and amenities." },
  { key: "communication", title: () => "How was host communication?", subtitle: "Consider clarity, helpfulness, and responsiveness." },
  { key: "location", title: () => "What did you think of the location?", subtitle: "Think about convenience, surroundings, and access." },
  { key: "value", title: () => "Was this stay worth what you paid?", subtitle: "Your feedback helps guests understand the value of a stay." },
  { key: "comment", title: () => "Write a public review", subtitle: "Share a few words about your stay. This will be visible on the property page." },
];

const ratingLabels = ["", "Needs improvement", "Not great", "Good", "Great stay", "Excellent"];

function StarRating({ value, onChange, label }: { value: number; onChange: (rating: number) => void; label: string }) {
  return <div className="mt-8" role="radiogroup" aria-label={label}>
    <div className="flex justify-center gap-2 sm:gap-3">
      {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" role="radio" aria-checked={value === star} aria-label={`${star} out of 5 stars`} onClick={() => onChange(star)} className={`text-4xl leading-none transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 sm:text-5xl ${star <= value ? "text-[#4D7CFE]" : "text-zinc-200"}`}>★</button>)}
    </div>
    <p className="mt-3 min-h-5 text-center text-sm font-medium text-zinc-600" aria-live="polite">{value > 0 ? ratingLabels[value] : "Select a rating"}</p>
  </div>;
}

export function BookingReviewWizard(props: ReviewWizardProps) {
  const storageKey = `homyz:review-draft:${props.bookingId}`;
  const [draft, setDraft] = useState<ReviewDraft>({ step: 0, rating: 0, categoryRatings: {}, comment: "" });
  const hasLoadedDraft = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const active = steps[draft.step];

  useEffect(() => {
    const restoreDraft = window.setTimeout(() => {
      try {
        const stored = window.sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<ReviewDraft>;
          if (typeof parsed.step === "number" && parsed.step >= 0 && parsed.step < steps.length) {
            setDraft({ step: parsed.step, rating: parsed.rating || 0, categoryRatings: parsed.categoryRatings || {}, comment: typeof parsed.comment === "string" ? parsed.comment : "" });
          }
        }
      } catch { /* A review draft is optional; storage failures should not block reviewing. */ }
      hasLoadedDraft.current = true;
    }, 0);
    return () => window.clearTimeout(restoreDraft);
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedDraft.current || submitted) return;
    window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, storageKey, submitted]);

  const activeRating = active.key === "overall" ? draft.rating : active.key !== "intro" && active.key !== "comment" ? draft.categoryRatings[active.key] || 0 : 0;
  const canContinue = active.key === "intro" || active.key === "comment" || activeRating > 0;
  const progress = Math.round((draft.step / (steps.length - 1)) * 100);
  const summary = useMemo(() => [props.stayDates, props.location].filter(Boolean).join(" · "), [props.location, props.stayDates]);

  const setRating = (value: number) => {
    if (active.key === "overall") setDraft((current) => ({ ...current, rating: value }));
    else if (active.key !== "intro" && active.key !== "comment") setDraft((current) => ({ ...current, categoryRatings: { ...current.categoryRatings, [active.key]: value } }));
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/listings/${props.listingId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: props.bookingId, rating: draft.rating, categoryRatings: draft.categoryRatings, comment: draft.comment }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || payload?.message || "Unable to submit your review right now.");
      window.sessionStorage.removeItem(storageKey);
      setSubmitted(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit your review right now.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return <section className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center text-center"><span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</span><h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-900">Thanks for sharing your stay</h1><p className="mt-3 max-w-md text-sm leading-6 text-zinc-600">Your review has been submitted and will help future guests.</p><Link href={`/bookings/${props.bookingId}`} className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-[#1F1F1F] px-6 text-sm font-semibold text-white hover:bg-zinc-700">Back to reservation</Link></section>;

  return <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
    <aside className="h-fit rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-28">
      {props.listingPhoto ? <img src={props.listingPhoto} alt={props.listingName} className="aspect-[4/3] w-full rounded-2xl object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-zinc-100 text-sm text-zinc-500">Photo unavailable</div>}
      <h2 className="mt-4 text-lg font-semibold text-zinc-900">{props.listingName}</h2>
      {summary && <p className="mt-2 text-sm leading-5 text-zinc-600">{summary}</p>}
      <p className="mt-4 border-t border-zinc-200 pt-4 text-sm font-medium text-zinc-900">{props.totalPaid}</p>
    </aside>

    <section className="flex min-h-[560px] flex-col rounded-3xl bg-white px-2 py-3 sm:px-8 sm:py-8" aria-labelledby="review-step-title">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center text-center">
        <p className="text-xs font-medium text-zinc-500">Step {draft.step + 1} of {steps.length}</p>
        <h1 id="review-step-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-4xl">{active.title(props.listingName)}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-600">{active.subtitle}</p>
        {active.key !== "intro" && active.key !== "comment" && <StarRating value={activeRating} onChange={setRating} label={active.title(props.listingName)} />}
        {active.key === "comment" && <textarea value={draft.comment} onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value.slice(0, 5000) }))} maxLength={5000} placeholder="Say a few words about your stay" className="mt-8 min-h-40 w-full resize-y rounded-2xl border border-zinc-300 p-4 text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-900" />}
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </div>
      <div className="mx-auto mt-8 w-full max-w-xl">
        <div className="h-1 overflow-hidden rounded-full bg-zinc-200"><div className="h-full rounded-full bg-zinc-700 transition-all" style={{ width: `${progress}%` }} /></div>
        <div className="mt-5 flex items-center justify-between gap-3">
          {draft.step > 0 ? <button type="button" onClick={() => setDraft((current) => ({ ...current, step: current.step - 1 }))} className="min-h-11 rounded-xl px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">Back</button> : <Link href={`/bookings/${props.bookingId}`} className="inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">Cancel</Link>}
          {draft.step < steps.length - 1 ? <button type="button" disabled={!canContinue} onClick={() => setDraft((current) => ({ ...current, step: current.step + 1 }))} className="min-h-11 rounded-xl bg-[#1F1F1F] px-8 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300">Continue</button> : <button type="button" disabled={!draft.rating || submitting} onClick={submit} className="min-h-11 rounded-xl bg-[#1F1F1F] px-8 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300">{submitting ? "Submitting…" : "Submit review"}</button>}
        </div>
      </div>
    </section>
  </div>;
}
