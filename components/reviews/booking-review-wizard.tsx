"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { BackButton } from "@/components/ui/back-button";

type CategoryKey = "checkIn" | "cleanliness" | "accuracy" | "communication" | "location" | "value";

export type ReviewWizardProps = {
  bookingId: string;
  listingId: string;
  listingName: string;
  listingDescription?: string;
  hostName?: string | null;
  listingPhoto: string | null;
  location: string | null;
  stayDates: string;
  currencyCode?: string;
  averageRating?: number | null;
  reviewsCount?: number;
  isGuestFavorite?: boolean;
  totalPaid: ReactNode;
};

type ReviewDraft = {
  step: number;
  rating: number;
  categoryRatings: Partial<Record<CategoryKey, number>>;
  comment: string;
  privateNoteToHost: string;
  requestId?: string;
};

function StarRating({ value, onChange, label }: { value: number; onChange: (rating: number) => void; label: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const { t } = useLanguage();
  const getRatingLabel = (val: number) => {
    switch (val) {
      case 1: return t("review_rating_1", "Needs improvement");
      case 2: return t("review_rating_2", "Not great");
      case 3: return t("review_rating_3", "Good");
      case 4: return t("review_rating_4", "Great stay");
      case 5: return t("review_rating_5", "Excellent");
      default: return t("review_select_rating", "Select a rating");
    }
  };

  const activeValue = hovered ?? value;

  return (
    <div className="mt-8" role="radiogroup" aria-label={label} onMouseLeave={() => setHovered(null)}>
      <div className="flex justify-start gap-2 sm:gap-5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} out of 5 stars`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            className="cursor-pointer transition-transform"
          >
            <Image
              src={star <= activeValue ? "/images/icons/star-fill-icon.svg" : "/images/icons/star-icon.svg"}
              alt=""
              width={33}
              height={32}
              className="size-9 sm:size-10 object-contain"
            />
          </button>
        ))}
      </div>
      <p className="mt-3 min-h-5 text-left text-sm font-normal text-[#1f1f1f]" aria-live="polite">
        {getRatingLabel(activeValue)}
      </p>
    </div>
  );
}

function DesktopPropertyCard({
  listingName,
  listingPhoto,
  ratingDisplay,
  showGuestFavorite,
  stayDates,
  currencyDisplay,
  totalPaid,
}: {
  listingName: string;
  listingPhoto: string | null;
  ratingDisplay: string;
  showGuestFavorite: boolean;
  stayDates: string;
  currencyDisplay: string;
  totalPaid: ReactNode;
}) {
  return (
    <aside
      aria-label="Booking summary"
      className="w-full max-w-[570px] rounded-[30px] bg-white px-10 py-8 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)]"
    >
      <h2 className="text-lg sm:text-xl font-medium text-[#1F1F1F] tracking-tight">{listingName}</h2>
      <div className="mt-2 flex items-center gap-2 text-sm text-[#1F1F1F]">
        <span className="flex items-center gap-1.5 font-medium">
          <svg className="size-4 shrink-0 fill-[#FFB800] text-[#FFB800]" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
          <span className="text-xs sm:text-sm font-normal">{ratingDisplay}</span>
        </span>
        {showGuestFavorite && (
          <>
            <span className="text-zinc-300" aria-hidden="true">|</span>
            <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium">
              <Image src="/images/icons/leaves-left.svg" alt="" width={14} height={20} className="h-4 w-auto inline-block" />
              <span>Guest favorite</span>
              <Image src="/images/icons/leaves-right.svg" alt="" width={14} height={20} className="h-4 w-auto inline-block" />
            </span>
          </>
        )}
      </div>

      <div className="mt-5 aspect-491/319 w-full overflow-hidden rounded-[20px] bg-[#DDDDDE]">
        {listingPhoto ? (
          <img src={listingPhoto} alt={listingName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">Photo unavailable</div>
        )}
      </div>

      <div className="mt-5">
        <p className="text-base font-medium text-[#1F1F1F]">Dates</p>
        <p className="mt-1 text-sm text-[#727272]">{stayDates}</p>
      </div>

      <div className="my-5 border-t border-zinc-200" />

      <div className="flex items-center justify-between text-base font-medium text-[#1F1F1F]">
        <span>Total <span className="underline underline-offset-4">{currencyDisplay}</span></span>
        <span>{totalPaid}</span>
      </div>
    </aside>
  );
}

function MobilePropertyCard({
  listingName,
  listingPhoto,
  ratingDisplay,
  showGuestFavorite,
  stayDates,
  currencyDisplay,
  totalPaid,
}: {
  listingName: string;
  listingPhoto: string | null;
  ratingDisplay: string;
  showGuestFavorite: boolean;
  stayDates: string;
  currencyDisplay: string;
  totalPaid: ReactNode;
}) {
  return (
    <div className="w-full rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)]">
      <div className="flex items-start gap-3.5 sm:gap-4">
        <div className="aspect-square size-24 sm:size-28 shrink-0 overflow-hidden rounded-[10px] bg-[#DDDDDE]">
          {listingPhoto ? (
            <img src={listingPhoto} alt={listingName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">No photo</div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col pt-0.5">
          <h2 className="text-lg sm:text-xl sm:font-medium font-medium text-[#1F1F1F] leading-snug line-clamp-1">{listingName}</h2>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs sm:text-sm sm:font-medium font-normal text-[#727272]">
            <svg className="size-3.5 shrink-0 fill-[#FFB800] text-[#FFB800]" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            <span>{ratingDisplay}</span>
          </div>
          {showGuestFavorite && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-[#1F1F1F]">
              <Image src="/images/icons/leaves-left.svg" alt="" width={12} height={18} className="h-3.5 w-auto inline-block" />
              <span>Guest favorite</span>
              <Image src="/images/icons/leaves-right.svg" alt="" width={12} height={18} className="h-3.5 w-auto inline-block" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-1 flex items-center justify-between text-base font-medium text-[#1F1F1F]">
        <span>Dates</span>
        <span className="text-sm font-normal text-[#727272]">{stayDates}</span>
      </div>

      <div className="my-3.5 border-t border-zinc-200" />

      <div className="flex items-center justify-between text-base font-medium text-[#1F1F1F]">
        <span>Total <span className="underline underline-offset-4">{currencyDisplay}</span></span>
        <span>{totalPaid}</span>
      </div>
    </div>
  );
}

function IntroSection({
  displayName,
  description,
  onContinue,
  isMobile = false,
}: {
  displayName: string;
  description: string;
  onContinue: () => void;
  isMobile?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const fallback =
    "Lorem ipsum dolor sit amet consectetur. Fames quis facilisis dolor turpis lacus eu tellus faucibus. Blandit porttitor justo pretium ridiculus. Metus non in gravida tristique. Vitae iaculis suscipit enim el...";
  const rawText = description && description.trim().length > 30 ? description.trim() : fallback;
  const isLong = rawText.length > 175;
  const displayText = !isLong || isExpanded ? rawText : rawText.slice(0, 175) + "...";

  return (
    <div className={`flex flex-col ${isMobile ? "sm:mt-7 mt-10 flex-1" : "max-w-154.75"}`}>
      <div className="self-start inline-flex items-center rounded-full bg-[#E5E7EB] px-4 py-3 text-sm sm:text-base font-normal text-[#1F1F1F]">
        Property Logo
      </div>

      <h1 className={`${isMobile ? "mt-5" : "mt-12"} font-medium tracking-tight text-[#727272] leading-tight`}>
        Write a review for <span className="font-medium text-[#1f1f1f]">{displayName}</span>
      </h1>

      <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#727272]">
        {displayText}
        {isLong && (
          <>
            {" "}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="font-medium text-[#727272] underline underline-offset-2 hover:text-black cursor-pointer"
            >
              {isExpanded ? "read less" : "read more"}
            </button>
          </>
        )}
      </p>

      {isMobile ? (
        <button
          type="button"
          onClick={onContinue}
          className="mt-10 lg:mt-auto w-full rounded-full bg-[#1F1F1F] sm:py-4 py-3 text-base font-medium text-white text-center transition hover:bg-black focus-visible:outline-none cursor-pointer"
        >
          Next
        </button>
      ) : (
        <div>
          <button
            type="button"
            onClick={onContinue}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-[#1F1F1F] border border-transparent hover:border-[#1f1f1f] px-12 py-3 text-base font-medium text-white transition hover:bg-white hover:text-[#1f1f1f] focus-visible:outline-none cursor-pointer min-w-58.25"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function FeedbackBlock({
  value,
  onChange,
  placeholder,
  title = "Your feedback",
  maxLength = 500,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  title?: string;
  maxLength?: number;
}) {
  const available = Math.max(0, maxLength - value.length);

  return (
    <div className="mt-8 w-full rounded-[12px] bg-[#F3F4F5] border border-white shadow-[0px_2px_4px_rgba(0,0,0,0.25)] sm:px-6 sm:pt-3 sm:pb-6 p-3">
      <h3 className="text-base sm:text-lg font-medium text-[#1F1F1F]">{title}</h3>
      <p className="mt-3 text-xs font-normal text-[#727272]">
        <span className="font-medium text-[#1F1F1F]">{available}</span>/{maxLength} available
      </p>
      <div className="mt-1.5 w-full rounded-lg bg-white px-4 py-3 shadow-xs">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
          maxLength={maxLength}
          placeholder={placeholder}
          className="min-h-[140px] sm:min-h-[160px] w-full resize-none border-0 bg-transparent p-0 sm:text-base text-xs leading-6 text-[#1F1F1F] placeholder:text-[#727272] outline-none focus:outline-none focus:ring-0 font-normal"
        />
      </div>
    </div>
  );
}

function ReviewProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Step ${currentStep} of ${totalSteps}`}
      className="mt-25 md:flex hidden w-full items-center gap-1.5"
    >
      {Array.from({ length: currentStep }).map((_, index) => (
        <div
          key={index}
          style={{
            width: `calc((100% - ${(totalSteps - 1) * 6}px) / ${totalSteps})`,
          }}
          className="h-2 shrink-0 rounded-full bg-[#EBA900] transition-all duration-300"
        />
      ))}
      {currentStep < totalSteps && (
        <div className="h-1 flex-1 rounded-full bg-[#DDDDDE] transition-all duration-300" />
      )}
    </div>
  );
}

export function BookingReviewWizard(props: ReviewWizardProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const steps: Array<{ key: "intro" | "overall" | CategoryKey | "comment" | "privateNote"; title: (listingName: string) => string; subtitle: string | ((name: string) => string) }> = [
    { key: "intro", title: (listingName) => t("review_intro_title", `Write a review for ${listingName}`).replace("{name}", listingName), subtitle: t("review_intro_desc", "Your feedback helps hosts improve and helps future guests choose with confidence. Reviews remain private until both parties submit or the 14-day window closes.") },
    { key: "overall", title: () => t("review_overall_title", "How was your stay?"), subtitle: t("review_overall_desc", "Your overall rating will appear with your public review.") },
    { key: "checkIn", title: (listingName) => t("review_checkin_title", `How was check-in at ${listingName}?`).replace("{name}", listingName), subtitle: t("review_checkin_desc", "Consider how easy it was to arrive and get settled.") },
    { key: "cleanliness", title: (listingName) => t("review_cleanliness_title", `How clean was ${listingName}?`).replace("{name}", listingName), subtitle: t("review_cleanliness_desc", "Your rating helps keep stays comfortable for everyone.") },
    { key: "accuracy", title: (listingName) => t("review_accuracy_title", `How accurately did ${listingName} match its listing?`).replace("{name}", listingName), subtitle: t("review_accuracy_desc", "Think about the photos, description, and amenities.") },
    { key: "communication", title: () => t("review_communication_title", "How was host communication?"), subtitle: t("review_communication_desc", "Consider clarity, helpfulness, and responsiveness.") },
    { key: "location", title: () => t("review_location_title", "What did you think of the location?"), subtitle: t("review_location_desc", "Think about convenience, surroundings, and access.") },
    { key: "value", title: () => t("review_value_title", "Was this stay worth what you paid?"), subtitle: t("review_value_desc", "Your feedback helps guests understand the value of a stay.") },
    { key: "comment", title: () => t("review_comment_title", "Write a public review"), subtitle: t("review_comment_desc", "Share a few words about your stay. This will be visible on the property page.") },
    { key: "privateNote", title: () => t("review_private_title", "Write a private note"), subtitle: t("review_private_desc", "Share any constructive feedback that only the host will see. This is optional and private.") },
  ];
  const storageKey = `homyz:review-draft:${props.bookingId}`;
  const [draft, setDraft] = useState<ReviewDraft>({ step: 0, rating: 0, categoryRatings: {}, comment: "", privateNoteToHost: "" });
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
            setDraft({
              step: parsed.step,
              rating: parsed.rating || 0,
              categoryRatings: parsed.categoryRatings || {},
              comment: typeof parsed.comment === "string" ? parsed.comment : "",
              privateNoteToHost: typeof parsed.privateNoteToHost === "string" ? parsed.privateNoteToHost : "",
              requestId: typeof parsed.requestId === "string" ? parsed.requestId : undefined,
            });
          }
        }
      } catch (e) {
        console.warn("Failed to restore draft from sessionStorage", e);
      }
      hasLoadedDraft.current = true;
    }, 0);
    return () => window.clearTimeout(restoreDraft);
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedDraft.current || submitted) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (e) {
      console.warn("Failed to save draft to sessionStorage", e);
    }
  }, [draft, storageKey, submitted]);

  const activeRating =
    active.key === "overall"
      ? draft.rating
      : active.key !== "intro" && active.key !== "comment" && active.key !== "privateNote"
        ? draft.categoryRatings[active.key] || 0
        : 0;

  const canContinue = active.key === "intro" || active.key === "comment" || active.key === "privateNote" || activeRating > 0;
  const progress = Math.round((draft.step / (steps.length - 1)) * 100);

  const setRating = (value: number) => {
    if (active.key === "overall") setDraft((current) => ({ ...current, rating: value }));
    else if (active.key !== "intro" && active.key !== "comment") {
      setDraft((current) => ({ ...current, categoryRatings: { ...current.categoryRatings, [active.key]: value } }));
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const requestId = draft.requestId || `review-${props.bookingId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      if (!draft.requestId) {
        setDraft((current) => ({ ...current, requestId }));
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`/api/v1/listings/${props.listingId}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
          body: JSON.stringify({
            bookingId: props.bookingId,
            rating: draft.rating,
            categoryRatings: draft.categoryRatings,
            comment: draft.comment,
            privateNoteToHost: draft.privateNoteToHost,
          }),
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const errorCode = payload?.error?.code || payload?.code;
          let userMessage = t("review_err_default", "Unable to submit your review right now.");
          if (errorCode === "DUPLICATE") {
            userMessage = t("review_err_duplicate", "This review has already been submitted. Your submission was successful on the first attempt.");
          } else if (errorCode === "INVALID_RATING") {
            userMessage = t("review_err_invalid_rating", "Please select a valid rating for your stay.");
          } else if (errorCode === "BOOKING_NOT_FOUND") {
            userMessage = t("review_err_not_found", "We couldn't find your booking. Please contact support if this continues.");
          } else if (errorCode === "BOOKING_NOT_COMPLETED") {
            userMessage = t("review_err_not_completed", "You can only review stays that have been completed.");
          }
          throw new Error(userMessage);
        }
        try {
          window.sessionStorage.removeItem(storageKey);
        } catch (e) {
          console.warn("Failed to clear draft", e);
        }
        setSubmitted(true);
      } catch (fetchError) {
        window.clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          throw new Error(t("review_err_timeout", "Request timed out. Your draft has been saved. Please try again."));
        }
        throw fetchError;
      }
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : t("review_err_default", "Unable to submit your review right now.");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return <section className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center text-center"><span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</span><h1 className="mt-6 font-medium">{t("review_success_title", "Thanks for sharing your stay")}</h1><p className="mt-3 max-w-md text-sm leading-6 text-[#727272]">{t("review_success_desc", "Your review has been submitted. It will remain private until the host submits their review or the 14-day window closes, at which point both reviews will be published simultaneously.")}</p><Link href={`/bookings/${props.bookingId}`} className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-[#1F1F1F] px-6 text-sm font-medium text-white hover:bg-zinc-700">{t("review_btn_back_res", "Back to reservation")}</Link></section>;

  const displayName = props.hostName || props.listingName || "Name";
  const currencyDisplay = props.currencyCode || "SR";
  const ratingDisplay =
    typeof props.averageRating === "number" && !isNaN(props.averageRating)
      ? `${props.averageRating.toFixed(2).replace(".", ",")} (${props.reviewsCount && props.reviewsCount > 0
        ? `${props.reviewsCount} review${props.reviewsCount === 1 ? "" : "s"}`
        : "xx review"
      })`
      : "4,98 (xx review)";
  const showGuestFavorite = props.isGuestFavorite !== false;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-220px)] w-full max-w-315.5 items-center justify-center sm:py-8 lg:py-12">
      {/* ── DESKTOP VIEW ── */}
      <div className="hidden w-full items-start gap-7.5 lg:grid lg:grid-cols-[570px_1fr] lg:gap-10 xl:gap-18">
        <DesktopPropertyCard
          listingName={props.listingName}
          listingPhoto={props.listingPhoto}
          ratingDisplay={ratingDisplay}
          showGuestFavorite={showGuestFavorite}
          stayDates={props.stayDates}
          currencyDisplay={currencyDisplay}
          totalPaid={props.totalPaid}
        />

        {draft.step === 0 ? (
          <IntroSection
            displayName={displayName}
            description={props.listingDescription || ""}
            onContinue={() => setDraft((current) => ({ ...current, step: 1 }))}
          />
        ) : (
          <section className="flex flex-col justify-center max-w-xl" aria-labelledby="review-step-title">
            <div className="self-start inline-flex items-center rounded-full bg-[#E5E7EB] px-4 py-1.5 text-xs sm:text-sm font-medium text-[#1F1F1F]">
              Property Logo
            </div>
            <h1 id="review-step-title" className="mt-4 text-[#1F1F1F]">
              {active.title(props.listingName)}
            </h1>
            <p className="mt-3 max-w-md text-base font-normal leading-6 text-[#727272]">
              {typeof active.subtitle === "function" ? active.subtitle(displayName) : active.subtitle}
            </p>

            {active.key !== "intro" && active.key !== "comment" && active.key !== "privateNote" && (
              <StarRating value={activeRating} onChange={setRating} label={active.title(props.listingName)} />
            )}

            {active.key === "comment" && (
              <FeedbackBlock
                value={draft.comment}
                onChange={(val) => setDraft((current) => ({ ...current, comment: val }))}
                placeholder={t("review_comment_ph", "Say a few words about your stay")}
                title="Your feedback"
                maxLength={500}
              />
            )}

            {active.key === "privateNote" && (
              <FeedbackBlock
                value={draft.privateNoteToHost}
                onChange={(val) => setDraft((current) => ({ ...current, privateNoteToHost: val }))}
                placeholder={t("review_private_ph", "Share constructive feedback for the host (optional)")}
                title="Your feedback"
                maxLength={500}
              />
            )}

            {error && (
              <div role="alert" className="mt-5 space-y-3 rounded-xl bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {t("review_btn_try_again", "Try again")}
                </button>
              </div>
            )}

            <div className="mt-8 w-full">

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, step: current.step - 1 }))}
                    className="min-h-11 rounded-full px-7 text-base font-normal bg-[#DDDDDE] text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors cursor-pointer sm:flex-none flex-1"
                >
                  {t("review_btn_back", "Back")}
                </button>
                {draft.step < steps.length - 1 ? (
                  <button
                    type="button"
                    disabled={!canContinue}
                    onClick={() => setDraft((current) => ({ ...current, step: current.step + 1 }))}
                      className="min-h-11 rounded-full bg-[#1F1F1F] sm:px-9 px-4 text-base font-normal text-white border border-[#1f1f1f] hover:text-[#1f1f1f] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-[#1f1f1f] disabled:border-zinc-300 disabled:opacity-70 cursor-pointer sm:flex-none flex-1"
                  >
                    {t("review_btn_continue", "Next")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!draft.rating || submitting}
                    onClick={submit}
                        className="min-h-11 rounded-full bg-[#1F1F1F] sm:px-9 px-4 text-base font-normal text-white transition-colors hover:bg-black disabled:text-[#1f1f1f] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:border-zinc-300 cursor-pointer disabled:opacity-70 sm:flex-none flex-1"
                  >
                    {submitting ? t("review_btn_submitting", "Submitting…") : t("review_btn_submit", "Submit review")}
                  </button>
                )}
              </div>

              <ReviewProgressBar currentStep={draft.step} totalSteps={steps.length - 1} />

            </div>
          </section>
        )}
      </div>

      {/* ── MOBILE VIEW ── */}
      <div className="block w-full max-w-lg lg:hidden">
        <BackButton
          onClick={() => {
            if (draft.step === 0) {
              router.push(`/bookings/${props.bookingId}`);
            } else {
              setDraft((current) => ({ ...current, step: current.step - 1 }));
            }
          }}
          aria-label={draft.step === 0 ? "Back to reservation" : "Go back"}
          className="mb-4"
        />

        <MobilePropertyCard
          listingName={props.listingName}
          listingPhoto={props.listingPhoto}
          ratingDisplay={ratingDisplay}
          showGuestFavorite={showGuestFavorite}
          stayDates={props.stayDates}
          currencyDisplay={currencyDisplay}
          totalPaid={props.totalPaid}
        />

        {draft.step === 0 ? (
          <IntroSection
            displayName={displayName}
            description={props.listingDescription || ""}
            onContinue={() => setDraft((current) => ({ ...current, step: 1 }))}
            isMobile
          />
        ) : (
          <section className="mt-7 flex flex-col" aria-labelledby="review-step-title-mobile">
            <div className="self-start inline-flex items-center rounded-full bg-[#E5E7EB] px-4 py-2.5 text-sm font-normal text-[#1F1F1F]">
              Property Logo
            </div>
            <h1 id="review-step-title-mobile" className="mt-3 text-2xl font-medium leading-tight tracking-tight text-[#1F1F1F]">
              {active.title(props.listingName)}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#727272]">
              {typeof active.subtitle === "function" ? active.subtitle(displayName) : active.subtitle}
            </p>

            {active.key !== "intro" && active.key !== "comment" && active.key !== "privateNote" && (
              <StarRating value={activeRating} onChange={setRating} label={active.title(props.listingName)} />
            )}

            {active.key === "comment" && (
              <FeedbackBlock
                value={draft.comment}
                onChange={(val) => setDraft((current) => ({ ...current, comment: val }))}
                placeholder={t("review_comment_ph", "Say a few words about your stay")}
                title="Your feedback"
                maxLength={500}
              />
            )}

            {active.key === "privateNote" && (
              <FeedbackBlock
                value={draft.privateNoteToHost}
                onChange={(val) => setDraft((current) => ({ ...current, privateNoteToHost: val }))}
                placeholder={t("review_private_ph", "Share constructive feedback for the host (optional)")}
                title="Your feedback"
                maxLength={500}
              />
            )}

            {error && (
              <div role="alert" className="mt-5 space-y-3 rounded-xl bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {t("review_btn_try_again", "Try again")}
                </button>
              </div>
            )}

            <div className="mt-8 w-full">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, step: current.step - 1 }))}
                    className="min-h-11 rounded-full px-7 text-base font-normal bg-[#DDDDDE] text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors cursor-pointer sm:flex-none flex-1"
                >
                  {t("review_btn_back", "Back")}
                </button>
                {draft.step < steps.length - 1 ? (
                  <button
                    type="button"
                    disabled={!canContinue}
                    onClick={() => setDraft((current) => ({ ...current, step: current.step + 1 }))}
                      className="min-h-12 rounded-full bg-[#1F1F1F] px-8 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-300 cursor-pointer sm:flex-none flex-1"
                  >
                    {t("review_btn_continue", "Next")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!draft.rating || submitting}
                    onClick={submit}
                        className="min-h-12 rounded-full bg-[#1F1F1F] px-8 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-300 cursor-pointer sm:flex-none flex-1"
                  >
                    {submitting ? t("review_btn_submitting", "Submitting…") : t("review_btn_submit", "Submit review")}
                  </button>
                )}
              </div>

              <ReviewProgressBar currentStep={draft.step} totalSteps={steps.length - 1} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
