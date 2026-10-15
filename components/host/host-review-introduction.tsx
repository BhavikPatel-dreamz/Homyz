"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StarRating } from "@/components/reviews/star-rating";
import { CurrencyPrice } from "@/components/ui/currency-price";
import { formatBookingDateRange } from "@/lib/booking/booking-date";
import {
  CLEANLINESS_FEEDBACK_TAGS,
  CLEANLINESS_RATING_LABELS,
  COMMUNICATION_FEEDBACK_TAGS,
  COMMUNICATION_RATING_LABELS,
  HOST_PUBLIC_REVIEW_MAX_LENGTH,
  HOUSE_RULES_RATING_LABELS,
  HOST_PRIVATE_NOTE_MAX_LENGTH,
  isCleanlinessFeedbackTag,
  isCommunicationFeedbackTag,
  isHostPrivateNoteText,
  isHostPublicReviewText,
  isHostRecommendation,
  isHostReviewRating,
  type HostReviewDraft,
} from "@/lib/booking/host-review-draft";
import type { HostReviewContext } from "@/services/host-review.service";

const REVIEW_STEPS = [
  "Introduction",
  "Cleanliness",
  "House Rules",
  "Communication",
  "Public Review",
  "Recommendation",
  "Private Note",
  "Submit",
] as const;

type ReviewStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

function initialDraft(context: HostReviewContext): HostReviewDraft {
  return {
    bookingId: context.bookingId,
    hostId: context.hostId,
    step: 0,
    cleanlinessRating: 0,
    cleanlinessTags: [],
    houseRulesRating: 0,
    communicationRating: 0,
    communicationTags: [],
    publicReview: "",
    recommendGuest: null,
    privateNote: "",
  };
}

function restoreDraft(context: HostReviewContext, value: unknown): HostReviewDraft {
  const fallback = initialDraft(context);
  if (!value || typeof value !== "object") return fallback;
  const saved = value as Partial<HostReviewDraft>;
  if (saved.bookingId !== context.bookingId || saved.hostId !== context.hostId) return fallback;

  const cleanlinessRating = isHostReviewRating(saved.cleanlinessRating) ? saved.cleanlinessRating : 0;
  const houseRulesRating = isHostReviewRating(saved.houseRulesRating) ? saved.houseRulesRating : 0;
  const communicationRating = isHostReviewRating(saved.communicationRating) ? saved.communicationRating : 0;
  const cleanlinessTags = Array.isArray(saved.cleanlinessTags)
    ? saved.cleanlinessTags.filter(isCleanlinessFeedbackTag)
    : [];
  const communicationTags = Array.isArray(saved.communicationTags)
    ? saved.communicationTags.filter(isCommunicationFeedbackTag)
    : [];
  const publicReview = isHostPublicReviewText(saved.publicReview) ? saved.publicReview : "";
  const recommendGuest = isHostRecommendation(saved.recommendGuest) ? saved.recommendGuest : null;
  const privateNote = isHostPrivateNoteText(saved.privateNote) ? saved.privateNote : "";
  const requestedStep = typeof saved.step === "number" ? saved.step : 0;
  // A persisted draft cannot skip required rating steps by modifying storage.
  const hasRatings = cleanlinessRating && houseRulesRating && communicationRating;
  const hasRecommendation = isHostRecommendation(recommendGuest);

  const step: ReviewStep = requestedStep >= 7 && hasRatings && hasRecommendation
    ? 7
    : requestedStep >= 6 && hasRatings && hasRecommendation
      ? 6
      : requestedStep >= 5 && cleanlinessRating && houseRulesRating && communicationRating
        ? 5
        : requestedStep >= 4 && cleanlinessRating && houseRulesRating && communicationRating
          ? 4
          : requestedStep >= 3 && cleanlinessRating && houseRulesRating
            ? 3
            : requestedStep >= 2 && cleanlinessRating
              ? 2
              : requestedStep >= 1
                ? 1
                : 0;

  return {
    ...fallback,
    cleanlinessRating,
    cleanlinessTags,
    houseRulesRating,
    communicationRating,
    communicationTags,
    publicReview,
    recommendGuest,
    privateNote,
    step,
  };
}

function FeedbackTagSelector<Tag extends string>({
  label,
  tags,
  selectedTags,
  onToggle,
}: {
  label: string;
  tags: readonly Tag[];
  selectedTags: readonly Tag[];
  onToggle: (tag: Tag) => void;
}) {
  return (
    <div className="mt-7 text-left">
      <p className="text-sm font-semibold text-[#1F1F1F]">What went well? <span className="font-normal text-[#727272]">Optional</span></p>
      <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label={label}>
        {tags.map((tag) => {
          const selected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(tag)}
              className={`min-h-10 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${selected ? "border-[#1F1F1F] bg-[#FCDF9C] text-[#1F1F1F]" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HostReviewIntroduction({
  context,
  returnHref,
}: {
  context: HostReviewContext;
  returnHref: string;
}) {
  const router = useRouter();
  const draftKey = `homyz:host-review-draft:${context.hostId}:${context.bookingId}`;
  const [draft, setDraft] = useState(() => initialDraft(context));
  const [draftReady, setDraftReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const stayDates = useMemo(
    () => formatBookingDateRange(context.stay.startDate, context.stay.endDate),
    [context.stay.endDate, context.stay.startDate],
  );
  const step = draft.step as ReviewStep;
  const cleanlinessValid = isHostReviewRating(draft.cleanlinessRating);
  const houseRulesValid = isHostReviewRating(draft.houseRulesRating);
  const communicationValid = isHostReviewRating(draft.communicationRating);
  const recommendationValid = isHostRecommendation(draft.recommendGuest);
  const privateNoteValid = isHostPrivateNoteText(draft.privateNote);

  useEffect(() => {
    const restoreId = window.setTimeout(() => {
      try {
        const stored = window.sessionStorage.getItem(draftKey);
        if (stored) setDraft(restoreDraft(context, JSON.parse(stored)));
      } catch {
        // Draft persistence is an enhancement; the server remains the source of truth.
      } finally {
        setDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreId);
  }, [context, draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    const saveId = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // Storage cleanup best effort
      }
    }, 100);

    const flushDraft = () => {
      try {
        window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // best effort
      }
    };
    window.addEventListener("beforeunload", flushDraft);
    return () => {
      window.clearTimeout(saveId);
      window.removeEventListener("beforeunload", flushDraft);
    };
  }, [draft, draftKey, draftReady]);

  const goBack = () => {
    if (step > 0) {
      setDraft((current) => ({ ...current, step: (step - 1) as ReviewStep }));
      return;
    }
    router.push(returnHref);
  };

  const continueReview = () => {
    if (step === 0) {
      setDraft((current) => ({ ...current, step: 1 }));
    } else if (step === 1 && cleanlinessValid) {
      setDraft((current) => ({ ...current, step: 2 }));
    } else if (step === 2 && houseRulesValid) {
      setDraft((current) => ({ ...current, step: 3 }));
    } else if (step === 3 && communicationValid) {
      setDraft((current) => ({ ...current, step: 4 }));
    } else if (step === 4) {
      setDraft((current) => ({ ...current, step: 5 }));
    } else if (step === 5 && recommendationValid) {
      setDraft((current) => ({ ...current, step: 6 }));
    } else if (step === 6 && privateNoteValid) {
      setDraft((current) => ({ ...current, step: 7 }));
    }
  };

  const toggleCleanlinessTag = (tag: (typeof CLEANLINESS_FEEDBACK_TAGS)[number]) => {
    setDraft((current) => ({
      ...current,
      cleanlinessTags: current.cleanlinessTags.includes(tag)
        ? current.cleanlinessTags.filter((currentTag) => currentTag !== tag)
        : [...current.cleanlinessTags, tag],
    }));
  };

  const toggleCommunicationTag = (tag: (typeof COMMUNICATION_FEEDBACK_TAGS)[number]) => {
    setDraft((current) => ({
      ...current,
      communicationTags: current.communicationTags.includes(tag)
        ? current.communicationTags.filter((currentTag) => currentTag !== tag)
        : [...current.communicationTags, tag],
    }));
  };

  const canContinue = step === 0
    || (step === 1 && cleanlinessValid)
    || (step === 2 && houseRulesValid)
    || (step === 3 && communicationValid)
    || step === 4
    || (step === 5 && recommendationValid)
    || (step === 6 && privateNoteValid);

  const canSubmit =
    cleanlinessValid &&
    houseRulesValid &&
    communicationValid &&
    recommendationValid &&
    privateNoteValid;

  const handleSubmit = async () => {
    if (isSubmitting || !canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/v1/host/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: context.bookingId,
          cleanlinessRating: draft.cleanlinessRating,
          cleanlinessTags: draft.cleanlinessTags,
          houseRulesRating: draft.houseRulesRating,
          communicationRating: draft.communicationRating,
          communicationTags: draft.communicationTags,
          publicReview: draft.publicReview,
          recommendGuest: draft.recommendGuest,
          privateNote: draft.privateNote,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 409) {
          // If already submitted (e.g. earlier request was saved but network response dropped),
          // clean up draft and treat as successfully submitted.
          try {
            window.sessionStorage.removeItem(draftKey);
            window.localStorage.setItem("homyz:reservations-updated", Date.now().toString());
            window.dispatchEvent(new Event("homyz:reservations-updated"));
          } catch {
            // Storage cleanup best effort
          }
          setIsSubmitted(true);
          return;
        }
        setSubmitError(payload?.error?.message || payload?.message || "Unable to submit your review right now.");
        return;
      }

      try {
        window.sessionStorage.removeItem(draftKey);
        window.localStorage.setItem("homyz:reservations-updated", Date.now().toString());
        window.dispatchEvent(new Event("homyz:reservations-updated"));
      } catch {
        // Storage cleanup best effort
      }
      setIsSubmitted(true);
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-800">
          ✓
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#1F1F1F] sm:text-3xl">
          Review submitted
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Thank you for sharing your feedback about {context.guest.name}. Your review has been saved and submitted successfully.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href={returnHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1F1F1F] px-6 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Back to reservations
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
      <aside className="h-fit rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-28">
        {context.listing.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={context.listing.photos[0]} alt={context.listing.title} className="aspect-[4/3] w-full rounded-2xl object-cover" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-zinc-100 text-sm text-[#727272]">Photo unavailable</div>
        )}
        <h2 className="mt-4 text-lg font-semibold text-[#1F1F1F]">{context.listing.title}</h2>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-600">
          {context.listing.overallRating !== null ? <span>★ {context.listing.overallRating.toFixed(2)} overall</span> : <span>No property rating yet</span>}
          {context.listing.isGuestFavorite && <span className="font-medium text-[#1F1F1F]">Guest favorite</span>}
        </div>
        <p className="mt-3 text-sm leading-5 text-zinc-600">{stayDates}</p>
        <div className="mt-4 border-t border-zinc-200 pt-4 text-sm font-medium text-[#1F1F1F]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Total payout</p>
          <p className="mt-1">{context.payout ? <CurrencyPrice amountMinorUnits={context.payout.amount} sourceCurrency={context.payout.currency} fractionDigits={2} /> : "Payout unavailable"}</p>
        </div>
      </aside>

      <section className="flex min-h-[560px] flex-col rounded-3xl bg-white px-2 py-3 sm:px-8 sm:py-8 pb-20 sm:pb-8" aria-labelledby="host-review-step-title">
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center text-center">
          <p className="text-xs font-medium text-[#727272]">Step {step + 1} of {REVIEW_STEPS.length}</p>
          {step === 0 && (
            <>
              <h1 id="host-review-step-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-[#1F1F1F] sm:text-4xl">Write a review for {context.guest.name}</h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-600">Honest feedback helps other hosts assess guest reliability and strengthens trust across Homyz.</p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-600">Some submitted feedback will be shared with the guest and other hosts.</p>
            </>
          )}
          {step === 1 && (
            <>
              <h1 id="host-review-step-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-[#1F1F1F] sm:text-4xl">How clean did {context.guest.name} leave your place?</h1>
              <StarRating value={draft.cleanlinessRating} onChange={(cleanlinessRating) => setDraft((current) => ({ ...current, cleanlinessRating }))} label={`Cleanliness rating for ${context.guest.name}`} ratingLabels={CLEANLINESS_RATING_LABELS} />
              {!cleanlinessValid && (
                <p className="mt-2 text-center text-xs font-medium text-amber-700" role="status">
                  Please select a rating.
                </p>
              )}
              <FeedbackTagSelector label="Cleanliness feedback tags" tags={CLEANLINESS_FEEDBACK_TAGS} selectedTags={draft.cleanlinessTags} onToggle={toggleCleanlinessTag} />
            </>
          )}
          {step === 2 && (
            <>
              <h1 id="host-review-step-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-[#1F1F1F] sm:text-4xl">How well did {context.guest.name} follow your house rules?</h1>
              <StarRating value={draft.houseRulesRating} onChange={(houseRulesRating) => setDraft((current) => ({ ...current, houseRulesRating }))} label={`House rules rating for ${context.guest.name}`} ratingLabels={HOUSE_RULES_RATING_LABELS} />
              {!houseRulesValid && (
                <p className="mt-2 text-center text-xs font-medium text-amber-700" role="status">
                  Please select a rating.
                </p>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <h1 id="host-review-step-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-[#1F1F1F] sm:text-4xl">How well did {context.guest.name} communicate?</h1>
              <StarRating value={draft.communicationRating} onChange={(communicationRating) => setDraft((current) => ({ ...current, communicationRating }))} label={`Communication rating for ${context.guest.name}`} ratingLabels={COMMUNICATION_RATING_LABELS} />
              {!communicationValid && (
                <p className="mt-2 text-center text-xs font-medium text-amber-700" role="status">
                  Please select a rating.
                </p>
              )}
              <FeedbackTagSelector label="Communication feedback tags" tags={COMMUNICATION_FEEDBACK_TAGS} selectedTags={draft.communicationTags} onToggle={toggleCommunicationTag} />
            </>
          )}
          {step === 4 && (
            <>
              <h1 id="host-review-step-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-[#1F1F1F] sm:text-4xl">Write a public review</h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-600">The guest and other hosts can see this review. It helps build trust in the community and is not shown on public property or profile pages.</p>
              <div className="mx-auto mt-8 w-full max-w-xl text-left">
                <label htmlFor="host-public-review" className="sr-only">Public review of {context.guest.name}</label>
                <textarea id="host-public-review" value={draft.publicReview} onChange={(event) => setDraft((current) => ({ ...current, publicReview: event.target.value.slice(0, HOST_PUBLIC_REVIEW_MAX_LENGTH) }))} maxLength={HOST_PUBLIC_REVIEW_MAX_LENGTH} placeholder="Say a few words about your experience hosting this guest" className="min-h-40 w-full resize-y rounded-2xl border border-zinc-300 p-4 text-sm leading-6 text-[#1F1F1F] outline-none placeholder:text-[#727272] focus:border-zinc-900" />
                <p className="mt-2 text-right text-xs text-[#727272]" aria-live="polite">{draft.publicReview.length} / {HOST_PUBLIC_REVIEW_MAX_LENGTH}</p>
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <h1 id="host-review-step-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-[#1F1F1F] sm:text-4xl">Would you recommend {context.guest.name} to other hosts?</h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-600">Your recommendation helps other hosts evaluate this guest and strengthens trust across the community.</p>
              <div
                className="mx-auto mt-8 flex w-full max-w-xs justify-center gap-4"
                role="radiogroup"
                aria-label={`Would you recommend ${context.guest.name} to other hosts?`}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    setDraft((current) => ({ ...current, recommendGuest: false }));
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setDraft((current) => ({ ...current, recommendGuest: true }));
                  }
                }}
              >
                <button
                  type="button"
                  role="radio"
                  tabIndex={draft.recommendGuest === true || draft.recommendGuest === null ? 0 : -1}
                  aria-checked={draft.recommendGuest === true}
                  onClick={() => setDraft((current) => ({ ...current, recommendGuest: true }))}
                  className={`flex min-h-14 flex-1 items-center justify-center rounded-2xl border text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
                    draft.recommendGuest === true
                      ? "border-[#1F1F1F] bg-[#1F1F1F] text-white shadow-sm"
                      : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  role="radio"
                  tabIndex={draft.recommendGuest === false ? 0 : -1}
                  aria-checked={draft.recommendGuest === false}
                  onClick={() => setDraft((current) => ({ ...current, recommendGuest: false }))}
                  className={`flex min-h-14 flex-1 items-center justify-center rounded-2xl border text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
                    draft.recommendGuest === false
                      ? "border-[#1F1F1F] bg-[#1F1F1F] text-white shadow-sm"
                      : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
                  }`}
                >
                  No
                </button>
              </div>
              {!recommendationValid && (
                <p className="mt-3 text-center text-xs font-medium text-amber-700" role="status">
                  Please choose Yes or No.
                </p>
              )}
            </>
          )}
          {step === 6 && (
            <>
              <h1 id="host-review-step-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-[#1F1F1F] sm:text-4xl">Write a private note</h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-600">Is there anything else you&apos;d like to share with {context.guest.name}?</p>
              <div className="mx-auto mt-8 w-full max-w-xl text-left">
                <label htmlFor="host-private-note" className="sr-only">Private note to {context.guest.name}</label>
                <textarea
                  id="host-private-note"
                  value={draft.privateNote}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      privateNote: event.target.value.slice(0, HOST_PRIVATE_NOTE_MAX_LENGTH),
                    }))
                  }
                  maxLength={HOST_PRIVATE_NOTE_MAX_LENGTH}
                  placeholder={`Share private feedback with ${context.guest.name} (optional)`}
                  className="min-h-40 w-full resize-y rounded-2xl border border-zinc-300 p-4 text-sm leading-6 text-[#1F1F1F] outline-none placeholder:text-[#727272] focus:border-zinc-900"
                />
                <p className="mt-2 text-right text-xs text-[#727272]" aria-live="polite">
                  {draft.privateNote.length} / {HOST_PRIVATE_NOTE_MAX_LENGTH}
                </p>
              </div>
            </>
          )}
          {step === 7 && (
            <>
              <h1 id="host-review-step-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-[#1F1F1F] sm:text-4xl">Submit review</h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-600">Please review your feedback before submitting.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">Once submitted, this review is final and cannot be edited. Your feedback helps other hosts make informed decisions.</p>
              {submitError && (
                <div role="alert" className="mx-auto mt-6 flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
                  <p>{submitError}</p>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="inline-flex min-h-9 items-center justify-center rounded-xl bg-red-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-50"
                  >
                    Try again
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mx-auto mt-8 w-full max-w-xl">
          <div className="h-1 overflow-hidden rounded-full bg-zinc-200" role="progressbar" aria-label="Host review progress" aria-valuemin={1} aria-valuemax={REVIEW_STEPS.length} aria-valuenow={step + 1}>
            <div className="h-full rounded-full bg-zinc-700 transition-all" style={{ width: `${((step + 1) / REVIEW_STEPS.length) * 100}%` }} />
          </div>
        </div>

        <div className="sticky bottom-0 z-20 mt-8 -mx-2 -mb-3 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={goBack}
              className="min-h-11 rounded-xl px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            {step < 7 ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={continueReview}
                className="min-h-11 rounded-xl bg-[#1F1F1F] px-8 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmit}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1F1F1F] px-8 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Submitting...</span>
                  </span>
                ) : (
                  "Submit"
                )}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
