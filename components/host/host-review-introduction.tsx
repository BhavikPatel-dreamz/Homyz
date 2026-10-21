"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StarRating } from "@/components/reviews/star-rating";
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
    <div className="mt-8 text-left sm:text-center">
      <h2 className="text-lg sm:text-2xl font-medium text-[#1F1F1F] text-left sm:text-center">
        Tell them what went well
      </h2>
      <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-start sm:justify-center gap-2 sm:gap-3" aria-label={label}>
        {tags.map((tag) => {
          const selected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(tag)}
              className={`min-h-[46px] sm:min-h-[48px] rounded-lg sm:rounded-xl px-5 py-3 sm:px-6 sm:py-3.5 text-sm sm:text-base font-normal sm:font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${selected
                ? "border border-white bg-[#E9EBFF] text-[#1F1F1F] shadow-none"
                : "border border-white bg-white text-[#1F1F1F] shadow-[0_2px_4px_rgba(0,0,0,0.25)] hover:bg-[#E9EBFF]"
                }`}
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
  const step = draft.step as ReviewStep;
  const cleanlinessValid = isHostReviewRating(draft.cleanlinessRating);
  const houseRulesValid = isHostReviewRating(draft.houseRulesRating);
  const communicationValid = isHostReviewRating(draft.communicationRating);
  const recommendationValid = isHostRecommendation(draft.recommendGuest);
  const privateNoteValid = isHostPrivateNoteText(draft.privateNote);
  const TOTAL_REVIEW_SEGMENTS = 6;
  const activePillsCount = Math.min(TOTAL_REVIEW_SEGMENTS, Math.max(1, step));

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
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-normal text-emerald-800">
          ✓
        </span>
        <h1 className="mt-4">
          Review submitted
        </h1>
        <p className="mt-3 text-base leading-6 text-[#727272]">
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
    <div
      className={`mx-auto flex w-full ${step === 0 ? "max-w-155" : "max-w-[490px]"
        } flex-1 flex-col`}
    >
      {step === 0 ? (
        <section
          className="flex flex-1 min-h-[calc(100dvh-6.5rem)] sm:min-h-0 flex-col justify-between sm:justify-center px-0 sm:px-8 py-2 sm:py-8"
          aria-labelledby="host-review-step-title"
        >
          {/* Top content block */}
          <div>
            {/* Mobile top circular back button matching Figma mobile */}
            <div className="flex items-center justify-start sm:hidden pt-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={goBack}
                className="inline-flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-[#F3F4F6] text-[#1F1F1F] transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                aria-label="Back to reservations"
                title="Back to reservations"
              >
                <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            </div>

            {/* Desktop step counter */}
            <p className="hidden sm:block w-fit mx-auto text-center md:text-base text-sm font-normal text-[#1f1f1f] bg-[#DDDDDE] rounded-full px-4 py-3">
              Step 1 of {REVIEW_STEPS.length}
            </p>

            {/* Title matching Figma */}
            <h1
              id="host-review-step-title"
              className="mt-6 sm:mt-6 text-center text-2xl sm:text-4xl md:text-[44px] lg:text-[48px] font-medium leading-tight sm:leading-[1.15] tracking-tight"
            >
              <span className="block text-[#727272]">Write a review for</span>
              <span className="mt-2 sm:mt-1.5 block font-medium text-[#1F1F1F]">{context.guest.name}</span>
            </h1>

            {/* Description matching Figma */}
            <div className="mx-auto mt-6 max-w-[342px] sm:max-w-[619px] text-center text-sm sm:text-base leading-relaxed text-[#727272]">
              <p>Honest feedback helps other hosts assess guest reliability and strengthens trust across Homyz.</p>
              <p className="mt-2">Some submitted feedback will be shared with the guest and other hosts.</p>
            </div>

            {/* Desktop action buttons: side-by-side Back + Continue */}
            <div className="hidden sm:flex mt-10 w-full items-center justify-center gap-4">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={goBack}
                className="inline-flex h-[48px] items-center justify-center rounded-full border border-[#1F1F1F] px-8 sm:text-base text-sm font-normal text-[#1F1F1F] transition-colors duration-300 hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={continueReview}
                className="inline-flex h-[48px] items-center justify-center rounded-full bg-[#1F1F1F] px-10 py-3.5 sm:text-base text-sm font-normal text-white hover:text-[#1f1f1f] transition-colors duration-300 hover:bg-[#FCDF9C]"
              >
                Continue
              </button>
            </div>
          </div>

          {/* Mobile bottom action: Pinned at bottom matching Figma mobile */}
          <div className="mt-auto pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:hidden w-full">
            <button
              type="button"
              onClick={continueReview}
              className="inline-flex h-[48px] w-full items-center justify-center rounded-full bg-[#1F1F1F] px-6 sm:text-base text-sm font-normal text-white transition-colors duration-300 hover:bg-[#FCDF9C] focus-visible:outline-none"
            >
              Continue
            </button>
          </div>
        </section>
      ) : (
        <div className="flex flex-1 flex-col">
          {/* Mobile top circular back button */}
          <div className="flex items-center justify-start sm:hidden pt-3 mb-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={goBack}
              className="inline-flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-[#F3F4F6] text-[#1F1F1F] transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              aria-label="Previous step"
              title="Previous step"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          </div>

          <section className="flex flex-1 min-h-[calc(100dvh-12rem)] sm:min-h-[460px] flex-col justify-between sm:justify-center" aria-labelledby="host-review-step-title">
            <div className="mx-auto flex w-full max-w-[490px] flex-1 flex-col md:justify-center justify-baseline text-left sm:text-center">
                <p className="hidden sm:block w-fit mx-auto text-center md:text-base text-sm font-normal text-[#1f1f1f] bg-[#DDDDDE] rounded-full px-4 md:py-3 py-2">
                Step {step + 1} of {REVIEW_STEPS.length}
              </p>
              {step === 1 && (
                <>
                  <h1 id="host-review-step-title" className="mt-6 sm:mt-6 text-left sm:text-center text-2xl sm:text-4xl md:text-[44px] lg:text-[48px] font-medium leading-tight sm:leading-[1.2] tracking-tight">How clean did <span className="capitalize">&ldquo;{context.guest.name}&rdquo;</span> leave your place?</h1>
                  <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#727272] text-left sm:text-center font-normal">We&apos;ll share this with &ldquo;{context.guest.name}&rdquo; and other Hosts.</p>
                  <StarRating value={draft.cleanlinessRating} onChange={(cleanlinessRating) => setDraft((current) => ({ ...current, cleanlinessRating }))} label={`Cleanliness rating for ${context.guest.name}`} ratingLabels={CLEANLINESS_RATING_LABELS} />
                  {!cleanlinessValid && (
                    <p className="mt-2 text-left sm:text-center text-sm font-normal text-[#DF4557]" role="status">
                      Please select a rating.
                    </p>
                  )}
                  <FeedbackTagSelector label="Cleanliness feedback tags" tags={CLEANLINESS_FEEDBACK_TAGS} selectedTags={draft.cleanlinessTags} onToggle={toggleCleanlinessTag} />
                </>
              )}
              {step === 2 && (
                <>
                  <h1 id="host-review-step-title" className="mt-6 sm:mt-6 text-left sm:text-center text-2xl sm:text-4xl md:text-[44px] lg:text-[48px] font-medium leading-tight sm:leading-[1.2] tracking-tight">How well did {context.guest.name} follow your house rules?</h1>
                  <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#727272] text-left sm:text-center font-normal">We&apos;ll share this with &ldquo;{context.guest.name}&rdquo; and other Hosts.</p>
                  <StarRating value={draft.houseRulesRating} onChange={(houseRulesRating) => setDraft((current) => ({ ...current, houseRulesRating }))} label={`House rules rating for ${context.guest.name}`} ratingLabels={HOUSE_RULES_RATING_LABELS} />
                  {!houseRulesValid && (
                    <p className="mt-2 text-left sm:text-center text-sm font-normal text-[#DF4557]" role="status">
                      Please select a rating.
                    </p>
                  )}
                </>
              )}
              {step === 3 && (
                <>
                  <h1 id="host-review-step-title" className="mt-6 sm:mt-6 text-left sm:text-center text-2xl sm:text-4xl md:text-[44px] lg:text-[48px] font-medium leading-tight sm:leading-[1.2] tracking-tight">How well did {context.guest.name} communicate?</h1>
                  <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#727272] text-left sm:text-center font-normal">We&apos;ll share this with &ldquo;{context.guest.name}&rdquo; and other Hosts.</p>
                  <StarRating value={draft.communicationRating} onChange={(communicationRating) => setDraft((current) => ({ ...current, communicationRating }))} label={`Communication rating for ${context.guest.name}`} ratingLabels={COMMUNICATION_RATING_LABELS} />
                  {!communicationValid && (
                    <p className="mt-2 text-left sm:text-center text-sm font-normal text-[#DF4557]" role="status">
                      Please select a rating.
                    </p>
                  )}
                  <FeedbackTagSelector label="Communication feedback tags" tags={COMMUNICATION_FEEDBACK_TAGS} selectedTags={draft.communicationTags} onToggle={toggleCommunicationTag} />
                </>
              )}
              {step === 4 && (
                <>
                  <h1 id="host-review-step-title" className="mt-6 sm:mt-6 text-left sm:text-center text-2xl sm:text-4xl md:text-[44px] lg:text-[48px] font-medium leading-tight sm:leading-[1.2] tracking-tight">Write a public review</h1>
                  <p className="mt-2 sm:mt-3 md:text-center text-left text-sm sm:text-base leading-relaxed text-[#727272] font-normal">We&apos;ll share this with &ldquo;{context.guest.name}&rdquo; and other Hosts.</p>
                  <div className="mx-auto mt-8 sm:mt-12 w-full max-w-[490px] rounded-lg sm:rounded-xl bg-[#F3F4F5] p-4 sm:px-6 text-left shadow-[0_2px_4px_rgb(0,0,0,0.25)]">
                    <h2 className="text-lg font-medium text-[#1F1F1F]">Your review</h2>
                    <p className="mt-3 text-xs text-[#727272]" aria-live="polite">
                      <span className="font-medium text-[#1F1F1F]">{HOST_PUBLIC_REVIEW_MAX_LENGTH - draft.publicReview.length}</span>/{HOST_PUBLIC_REVIEW_MAX_LENGTH} available
                    </p>
                    <div className="mt-4 leading-0">
                      <label htmlFor="host-public-review" className="sr-only">Public review of {context.guest.name}</label>
                      <textarea
                        id="host-public-review"
                        value={draft.publicReview}
                        onChange={(event) => setDraft((current) => ({ ...current, publicReview: event.target.value.slice(0, HOST_PUBLIC_REVIEW_MAX_LENGTH) }))}
                        maxLength={HOST_PUBLIC_REVIEW_MAX_LENGTH}
                        placeholder="Say a few words about your stay"
                        className="min-h-[126px] sm:min-h-[150px] w-full resize-none rounded-lg bg-white p-3 sm:px-4 sm:py-3 text-sm sm:text-base font-normal leading-relaxed text-[#1F1F1F] outline-none placeholder:text-[#727272] border-0 focus:ring-0 focus-visible:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}
              {step === 5 && (
                <>
                  <h1 id="host-review-step-title" className="mt-6 sm:mt-6 md:text-center text-left text-2xl sm:text-4xl md:text-[44px] lg:text-[48px] font-medium leading-tight sm:leading-[1.15] tracking-tight">Would you recommend {context.guest.name} to other hosts?</h1>
                  <p className="mx-auto mt-4 text-base leading-6 text-[#727272] font-normal">Your recommendation helps other hosts evaluate this guest and strengthens trust across the community.</p>
                  <div className="mx-auto mt-8 flex sm:flex-row flex-col w-full md:max-w-xs max-w-full justify-center gap-4"
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
                      className={`flex min-h-12 min-w-31 items-center justify-center rounded-full border text-base font-normal transition-colors focus-visible:outline-none ${draft.recommendGuest === true
                        ? "border-[#1F1F1F] bg-[#1F1F1F] hover:bg-white text-white hover:text-[#1f1f1f]"
                        : "border-[#1F1F1F] bg-white text-[#1f1f1f] hover:text-white hover:border-[#1f1f1f] hover:bg-[#1f1f1f]"
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
                      className={`flex min-h-12 min-w-31 items-center justify-center rounded-full border text-base font-normal transition-colors focus-visible:outline-none ${draft.recommendGuest === false
                        ? "border-[#1F1F1F] bg-[#1F1F1F] text-white"
                        : "border-[#1F1F1F] bg-white text-[#1f1f1f] hover:text-white hover:border-[#1f1f1f] hover:bg-[#1f1f1f]"
                        }`}
                    >
                      No
                    </button>
                  </div>
                  {!recommendationValid && (
                    <p className="mt-3 text-center text-xs font-medium text-[#DF4557]" role="status">
                      Please choose Yes or No.
                    </p>
                  )}
                </>
              )}
              {step === 6 && (
                <>
                  <h1 id="host-review-step-title" className="mt-6 sm:mt-6 text-center text-2xl sm:text-4xl md:text-[44px] lg:text-[48px] font-medium leading-tight sm:leading-[1.15] tracking-tight">Write a private note</h1>
                  <p className="mx-auto mt-4 text-base leading-6 text-[#727272] font-normal">Is there anything else you&apos;d like to share with {context.guest.name}?</p>
                  <div className="mx-auto mt-8 sm:mt-12 w-full max-w-[490px] rounded-lg sm:rounded-xl bg-[#F3F4F5] p-4 sm:px-6 text-left shadow-[0_2px_4px_rgb(0,0,0,0.25)]">
                    <h2 className="text-lg font-medium text-[#1F1F1F]">Your note</h2>
                    <p className="mt-3 text-xs text-[#727272]" aria-live="polite">
                      <span className="font-medium text-[#1F1F1F]">{HOST_PUBLIC_REVIEW_MAX_LENGTH - draft.publicReview.length}</span>/{HOST_PUBLIC_REVIEW_MAX_LENGTH} available
                    </p>
                    <label htmlFor="host-private-note" className="sr-only">Private note to {context.guest.name}</label>
                    <div className="mt-4 leading-0">
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
                        className="min-h-[126px] sm:min-h-[150px] w-full resize-none rounded-lg bg-white p-3 sm:px-4 sm:py-3 text-sm sm:text-base font-normal leading-relaxed text-[#1F1F1F] outline-none placeholder:text-[#727272] border-0 focus:ring-0 focus-visible:outline-none"
                      />
                    </div>
                    <p className="mt-2 text-right text-xs text-[#727272]" aria-live="polite">
                      {draft.privateNote.length} / {HOST_PRIVATE_NOTE_MAX_LENGTH}
                    </p>
                  </div>
                </>
              )}
              {step === 7 && (
                <>
                  <h1 id="host-review-step-title" className="mt-6 sm:mt-6 text-center text-2xl sm:text-4xl md:text-[44px] lg:text-[48px] font-medium leading-tight sm:leading-[1.15] tracking-tight">Submit review</h1>
                  <p className="mx-auto mt-4 text-base leading-6 text-[#727272] font-normal">Please review your feedback before submitting.</p>
                  <p className="mx-auto mt-2 text-sm leading-6 text-[#727272] font-normal">Once submitted, this review is final and cannot be edited. Your feedback helps other hosts make informed decisions.</p>
                  {submitError && (
                    <div role="alert" className="mx-auto mt-6 flex w-full flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
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

            <div className="sticky bottom-0 z-20 mt-12 -mx-2 -mb-3 bg-white/95 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mb-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <div className="mx-auto flex w-full max-w-[490px] items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={goBack}
                  className="inline-flex h-[48px] items-center justify-center rounded-full border border-[#1F1F1F] px-8 md:text-base text-sm font-normal text-[#1F1F1F] transition-colors duration-300 hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Back
                </button>
                {step < 7 ? (
                  <button
                    type="button"
                    disabled={!canContinue}
                    onClick={continueReview}
                    className="inline-flex h-[48px] items-center justify-center rounded-full bg-[#1F1F1F] px-10 py-3.5 md:text-base text-sm font-normal text-white hover:text-[#1f1f1f] transition-colors duration-300 hover:bg-[#FCDF9C]"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canSubmit || isSubmitting}
                    onClick={handleSubmit}
                    className="inline-flex h-[48px] items-center justify-center rounded-full bg-[#1F1F1F] px-10 py-3.5 md:text-base text-sm font-normal text-white hover:text-[#1f1f1f] transition-colors duration-300 hover:bg-[#FCDF9C]"
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

              {/* Segmented progress bar matching Figma */}
              <div
                className="mx-auto mt-4 sm:mt-14 md:mt-20 lg:mt-[100px] mb-1 sm:mb-4 md:flex hidden w-full max-w-[490px] items-center gap-1"
                role="progressbar"
                aria-label="Host review progress"
                aria-valuemin={1}
                aria-valuemax={REVIEW_STEPS.length}
                aria-valuenow={step + 1}
              >
                {Array.from({ length: activePillsCount }, (_, index) => (
                  <div
                    key={index}
                    className="h-2 rounded-full bg-[#727272] shrink-0 transition-all duration-300"
                    style={{ width: `calc((100% - ${TOTAL_REVIEW_SEGMENTS - 1} * 4px) / ${TOTAL_REVIEW_SEGMENTS})` }}
                  />
                ))}
                {activePillsCount < TOTAL_REVIEW_SEGMENTS && (
                  <div className="h-1 flex-1 rounded-full bg-[#DDDDDE]" />
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
