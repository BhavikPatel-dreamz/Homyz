"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { BookingSummary } from "@/components/checkout/booking-summary";
import { BookingConfirmation } from "@/components/checkout/booking-confirmation";
import { ReviewRequestStep } from "@/components/checkout/review-request-step";
import type { PublicListingDTO } from "@/services/mappers";
import { formatListingPrice, getCurrencyForCountry } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import { buildBookingCheckoutUrl, getLastSearch, saveLastSearch, isDateKey } from "@/lib/storage/client-history";
import {
  REQUEST_BOOK_STEPS,
  canActivateCheckoutStep,
  checkoutDraftStorageKey,
  createRequestSubmissionId,
  getCheckoutStepStatus,
  parseSafeCheckoutDraft,
  type CheckoutStepNumber,
  type SafeCheckoutDraft,
} from "@/lib/booking/checkout-wizard";
import { getCheckoutPriceRows, type CheckoutSummaryQuote } from "@/lib/booking/checkout-summary";
import {
  FULL_PAYMENT_TIMING,
  PARTIAL_PAYMENT_TIMING,
  PAY_OVER_TIME_PAYMENT_TIMING,
  getAvailablePaymentTimingOptions,
  getBookingApiPaymentPlan,
  getPaymentTimingSummary,
  type PaymentTiming,
} from "@/lib/booking/payment-timing";
import {
  validateMockCard,
  createSafePaymentSelection,
  detectCardBrand,
  type SafePaymentSummary,
} from "@/lib/booking/payment-method";
import {
  formatHostMessagePreview,
  HOST_MESSAGE_MAX_LENGTH,
  validateHostMessage,
} from "@/lib/booking/host-message";
import { createReviewRequestData } from "@/lib/booking/review-request";
import { readBookingQuote } from "@/lib/booking/quote-cache";

interface BookingCheckoutClientProps {
  listing: PublicListingDTO & {
    isGuestFavorite?: boolean;
    host?: {
      id?: string;
      name?: string | null;
      image?: string | null;
      createdAt?: Date | string;
      publicProfile?: Record<string, unknown> | null;
      isSuperhost?: boolean;
    };
  };
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  initialAdults?: number;
  initialChildren?: number;
  initialInfants?: number;
  initialPets?: number;
  initialNonRefundable?: boolean;
  initialSpecialOfferId?: string;
}

interface QuoteData extends CheckoutSummaryQuote {
  bookingMode: "INSTANT_BOOK" | "REQUEST_TO_BOOK";
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  subtotal: number;
  cancellationPolicy: string;
  isSpecialOffer?: boolean;
  specialOfferId?: string | null;
  specialOfferAmount?: number | null;
}

type BookingSubmissionResult = {
  id: string;
  status: string;
};

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatCancellationCutoff(checkInStr: string): string {
  if (!checkInStr) return "soon";
  const checkIn = new Date(`${checkInStr}T00:00:00`);
  if (isNaN(checkIn.getTime())) return "soon";
  const cutoff = new Date(checkIn);
  cutoff.setDate(cutoff.getDate() - 3);
  return cutoff.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BookingCheckoutClient({
  listing,
  initialCheckIn,
  initialCheckOut,
  initialGuests = 1,
  initialAdults,
  initialChildren = 0,
  initialInfants = 0,
  initialPets = 0,
  initialNonRefundable = false,
  initialSpecialOfferId,
}: BookingCheckoutClientProps) {
  const { currency: displayCurrency, formatPrice } = useCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const specialOfferId = initialSpecialOfferId || searchParams?.get("specialOfferId") || undefined;

  // Booking details state
  const [checkIn, setCheckIn] = useState<string>(() => {
    if (initialCheckIn && isDateKey(initialCheckIn)) return initialCheckIn;
    if (typeof window !== "undefined") {
      const stored = getLastSearch();
      if (stored?.checkIn && isDateKey(stored.checkIn)) return stored.checkIn;
    }
    return "";
  });
  const [checkOut, setCheckOut] = useState<string>(() => {
    if (initialCheckOut && isDateKey(initialCheckOut)) return initialCheckOut;
    if (typeof window !== "undefined") {
      const stored = getLastSearch();
      if (stored?.checkOut && isDateKey(stored.checkOut)) return stored.checkOut;
    }
    return "";
  });
  const [adultsCount, setAdultsCount] = useState(() => Math.max(1, initialAdults ?? initialGuests));
  const [childrenCount, setChildrenCount] = useState(() => Math.max(0, initialChildren));
  const [infantsCount, setInfantsCount] = useState(() => Math.max(0, initialInfants));
  const [petsCount, setPetsCount] = useState<number>(() => {
    if (typeof initialPets === "number") return initialPets;
    if (typeof window !== "undefined") {
      const stored = getLastSearch();
      if (typeof stored?.pets === "number") return stored.pets;
    }
    return 0;
  });
  const [isNonRefundable] = useState<boolean>(initialNonRefundable);
  const guestsCount = adultsCount + childrenCount;
  const maximumGuests = Math.max(1, listing.guests || 1);
  const canAddCapacityGuest = guestsCount < maximumGuests;
  const allowsChildren = listing.childrenAllowed !== false;
  const allowsInfants = listing.infantsAllowed !== false;
  const allowsPets = listing.petsAllowed !== false;
  const maximumPets = allowsPets ? Math.max(1, listing.maxPets || 2) : 0;

  const updateAdults = (delta: number) => {
    const next = adultsCount + delta;
    if (next < 1 || (delta > 0 && !canAddCapacityGuest)) return;
    setQuoteError(null);
    setIsQuoteLoading(true);
    setAdultsCount(next);
  };
  const updateChildren = (delta: number) => {
    const next = childrenCount + delta;
    if (next < 0 || (delta > 0 && (!allowsChildren || !canAddCapacityGuest))) return;
    setQuoteError(null);
    setIsQuoteLoading(true);
    setChildrenCount(next);
  };
  const updateInfants = (delta: number) => {
    const next = infantsCount + delta;
    if (next < 0 || next > 5 || (delta > 0 && !allowsInfants)) return;
    setInfantsCount(next);
  };
  const updatePets = (delta: number) => {
    const next = petsCount + delta;
    if (next < 0 || next > maximumPets) return;
    setQuoteError(null);
    setIsQuoteLoading(true);
    setPetsCount(next);
  };

  // Synchronize URL and persistent search history whenever dates/guests/pets change in checkout
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!checkIn || !checkOut) return;

    try {
      const currentUrl = new URL(window.location.href);
      let changed = false;

      if (currentUrl.searchParams.has("checkin")) {
        currentUrl.searchParams.delete("checkin");
        changed = true;
      }
      if (currentUrl.searchParams.has("startDate")) {
        currentUrl.searchParams.delete("startDate");
        changed = true;
      }
      if (currentUrl.searchParams.get("checkIn") !== checkIn) {
        currentUrl.searchParams.set("checkIn", checkIn);
        changed = true;
      }
      if (currentUrl.searchParams.has("checkout")) {
        currentUrl.searchParams.delete("checkout");
        changed = true;
      }
      if (currentUrl.searchParams.has("endDate")) {
        currentUrl.searchParams.delete("endDate");
        changed = true;
      }
      if (currentUrl.searchParams.get("checkOut") !== checkOut) {
        currentUrl.searchParams.set("checkOut", checkOut);
        changed = true;
      }
      if (currentUrl.searchParams.get("guests") !== String(guestsCount)) {
        currentUrl.searchParams.set("guests", String(guestsCount));
        changed = true;
      }
      if (currentUrl.searchParams.get("adults") !== String(adultsCount)) {
        currentUrl.searchParams.set("adults", String(adultsCount));
        changed = true;
      }
      if (childrenCount > 0 && currentUrl.searchParams.get("children") !== String(childrenCount)) {
        currentUrl.searchParams.set("children", String(childrenCount));
        changed = true;
      } else if (childrenCount === 0 && currentUrl.searchParams.has("children")) {
        currentUrl.searchParams.delete("children");
        changed = true;
      }
      if (infantsCount > 0 && currentUrl.searchParams.get("infants") !== String(infantsCount)) {
        currentUrl.searchParams.set("infants", String(infantsCount));
        changed = true;
      } else if (infantsCount === 0 && currentUrl.searchParams.has("infants")) {
        currentUrl.searchParams.delete("infants");
        changed = true;
      }
      if (currentUrl.searchParams.get("bookingMode") !== listing.bookingMode) {
        currentUrl.searchParams.set("bookingMode", listing.bookingMode);
        changed = true;
      }
      if (petsCount > 0) {
        if (currentUrl.searchParams.get("pets") !== String(petsCount)) {
          currentUrl.searchParams.set("pets", String(petsCount));
          changed = true;
        }
      } else if (currentUrl.searchParams.has("pets")) {
        currentUrl.searchParams.delete("pets");
        changed = true;
      }
      if (specialOfferId) {
        if (currentUrl.searchParams.get("specialOfferId") !== specialOfferId) {
          currentUrl.searchParams.set("specialOfferId", specialOfferId);
          changed = true;
        }
      }

      if (changed) {
        window.history.replaceState(null, "", `${currentUrl.pathname}?${currentUrl.searchParams.toString()}`);
      }

      saveLastSearch({
        location: listing.city || "",
        checkIn,
        checkOut,
        guests: guestsCount,
        adults: adultsCount,
        children: childrenCount,
        infants: infantsCount,
        pets: petsCount,
        specialOfferId,
      });
    } catch {}
  }, [checkIn, checkOut, guestsCount, adultsCount, childrenCount, infantsCount, petsCount, listing.bookingMode, listing.city, specialOfferId]);

  // The non-sensitive checkout draft is shared by every wizard step. Card
  // fields deliberately remain separate and are never written to storage.
  const [activeStep, setActiveStep] = useState<CheckoutStepNumber>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<CheckoutStepNumber>>(new Set());
  const [checkoutDraft, setCheckoutDraft] = useState<{
    paymentTiming: PaymentTiming | null;
    paymentMethod: SafePaymentSummary | null;
    hostMessage: string;
  }>({ paymentTiming: FULL_PAYMENT_TIMING, paymentMethod: null, hostMessage: "" });
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [requestSubmissionId, setRequestSubmissionId] = useState("");
  const paymentPlan = checkoutDraft.paymentTiming;
  const hostMessage = checkoutDraft.hostMessage;
  const setPaymentPlan = (paymentTiming: PaymentTiming) => {
    setCheckoutDraft((current) => ({ ...current, paymentTiming }));
  };
  const setHostMessage = (nextHostMessage: string) => {
    setCheckoutDraft((current) => ({ ...current, hostMessage: nextHostMessage }));
  };

  // Transient mock card form state for UI simulation. Card
  // fields deliberately remain separate and are never written to storage.
  const [selectedMethodType, setSelectedMethodType] = useState<"card" | "mada" | "apple_pay" | "google_pay">("card");
  const [rawCardNumber, setRawCardNumber] = useState("");
  const [rawCardExpiry, setRawCardExpiry] = useState("");
  const [rawCardCvc, setRawCardCvc] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);

  const clearRawCardFields = () => {
    setRawCardNumber("");
    setRawCardExpiry("");
    setRawCardCvc("");
  };

  const handleCardNumberChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 19);
    setRawCardNumber(digits.replace(/(.{4})/g, "$1 ").trim());
    if (cardError) setCardError(null);
  };

  const handleExpiryChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setRawCardExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
    if (cardError) setCardError(null);
  };

  const handleCvcChange = (value: string) => {
    setRawCardCvc(value.replace(/\D/g, "").slice(0, 4));
    if (cardError) setCardError(null);
  };

  const stepHeadingRefs = useRef<Partial<Record<CheckoutStepNumber, HTMLHeadingElement | null>>>({});
  const paymentTimingGroupRef = useRef<HTMLFieldSetElement | null>(null);
  const step1FinalizingRef = useRef(false);
  const hostMessageRef = useRef<HTMLTextAreaElement | null>(null);
  const quoteErrorRef = useRef<HTMLDivElement | null>(null);
  const [paymentTimingError, setPaymentTimingError] = useState<string | null>(null);
  const [isStep1Finalizing, setIsStep1Finalizing] = useState(false);

  // Step 3: Write a message to the host
  const [hostMessageError, setHostMessageError] = useState<string | null>(null);

  // Step 4: Submission & State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<BookingSubmissionResult | null>(null);
  const bookingSuccess = bookingResult !== null;

  // Modals state
  const [isDatesModalOpen, setIsDatesModalOpen] = useState(false);
  const [isGuestsModalOpen, setIsGuestsModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

  // Live Quote state
  const [quote, setQuote] = useState<QuoteData | null>(() => readBookingQuote<QuoteData>({
    listingId: listing.id,
    checkIn,
    checkOut,
    guests: guestsCount,
    pets: petsCount,
    nonRefundable: isNonRefundable,
    specialOfferId,
  }));
  const [authoritativeBookingMode, setAuthoritativeBookingMode] = useState(listing.bookingMode);
  const [isQuoteLoading, setIsQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteNotice, setQuoteNotice] = useState<string | null>(null);
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  const isInstantBook = authoritativeBookingMode === "INSTANT_BOOK";

  const intentSignature = useMemo(() => JSON.stringify({
    listingId: listing.id,
    checkIn,
    checkOut,
    guests: guestsCount,
    adults: adultsCount,
    children: childrenCount,
    infants: infantsCount,
    pets: petsCount,
    specialOfferId: specialOfferId || null,
  }), [listing.id, checkIn, checkOut, guestsCount, adultsCount, childrenCount, infantsCount, petsCount, specialOfferId]);
  const initialDraftContextRef = useRef({
    intentSignature,
    bookingMode: listing.bookingMode,
  });
  const draftStorageKey = useMemo(() => checkoutDraftStorageKey(listing.id), [listing.id]);

  // Restore only non-sensitive choices. The intent signature prevents a draft
  // for different dates, guests, or an offer from being applied accidentally.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedValue = window.sessionStorage.getItem(draftStorageKey);
        if (storedValue) {
          const restored = parseSafeCheckoutDraft(
            JSON.parse(storedValue),
            initialDraftContextRef.current.intentSignature,
            initialDraftContextRef.current.bookingMode,
          );
          if (restored) {
            setActiveStep(restored.activeStep);
            setCompletedSteps(new Set(restored.completedSteps));
            setCheckoutDraft({
              paymentTiming: restored.paymentTiming,
              paymentMethod: restored.paymentMethod,
              hostMessage: restored.hostMessage,
            });
            setRequestSubmissionId(restored.requestSubmissionId);
          } else {
            setRequestSubmissionId(createRequestSubmissionId());
          }
        } else {
          setRequestSubmissionId(createRequestSubmissionId());
        }
      } catch {
        try {
          window.sessionStorage.removeItem(draftStorageKey);
        } catch {}
        setRequestSubmissionId(createRequestSubmissionId());
      } finally {
        setIsDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftStorageKey]);

  useEffect(() => {
    if (!isDraftReady) return;
    if (bookingSuccess) {
      try {
        window.sessionStorage.removeItem(draftStorageKey);
      } catch {}
      return;
    }
    const safeDraft: SafeCheckoutDraft = {
      version: 1,
      intentSignature,
      bookingMode: authoritativeBookingMode,
      activeStep,
      completedSteps: [...completedSteps],
      paymentTiming: checkoutDraft.paymentTiming ?? FULL_PAYMENT_TIMING,
      paymentMethod: checkoutDraft.paymentMethod,
      hostMessage: checkoutDraft.hostMessage,
      requestSubmissionId,
    };
    try {
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(safeDraft));
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts. The
      // in-memory wizard remains fully functional in that case.
    }
  }, [activeStep, authoritativeBookingMode, bookingSuccess, checkoutDraft, completedSteps, draftStorageKey, intentSignature, isDraftReady, requestSubmissionId]);

  const bookingCurrency = quote?.currency || getCurrencyForCountry(listing.country);

  // Format currency helpers
  const formatMoney = useCallback((minorAmount: number, fractionDigits = 0) => (
    formatPrice(minorAmount, bookingCurrency, fractionDigits)
  ), [bookingCurrency, formatPrice]);
  const formatBookingMoney = useCallback((minorAmount: number, fractionDigits = 0) => (
    formatPrice(minorAmount, bookingCurrency, fractionDigits)
  ), [bookingCurrency, formatPrice]);

  const updateCheckIn = (value: string) => {
    setQuoteError(null);
    setIsQuoteLoading(true);
    setCheckIn(value);
    if (checkOut && value >= checkOut) setCheckOut("");
  };
  const updateCheckOut = (value: string) => {
    setQuoteError(null);
    setIsQuoteLoading(true);
    setCheckOut(value);
  };

  // Fetch Authoritative Live Quote whenever dates or guests change
  useEffect(() => {
    if (!checkIn || !checkOut || checkIn >= checkOut) {
      const timer = window.setTimeout(() => {
        setQuote(null);
        setQuoteError(!checkIn || !checkOut
          ? "Choose valid check-in and check-out dates to continue."
          : "Checkout date must be after check-in date.");
        setIsQuoteLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let isCurrent = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!isCurrent) return;
      setIsQuoteLoading(true);
      setQuoteError(null);
    });

    const specialOfferParam = specialOfferId ? `&specialOfferId=${encodeURIComponent(specialOfferId)}` : "";

    const requestTimer = window.setTimeout(() => {
      fetch(
        `/api/v1/listings/${listing.id}/quote?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guestsCount}&pets=${petsCount}&nonRefundable=${isNonRefundable}${specialOfferParam}`,
        { signal: controller.signal, cache: "no-store" },
      )
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!isCurrent) return;
        if (!ok || data.error || !data.data) {
          setQuoteError(data.error?.message || "Selected dates are not available.");
          return;
        }
        setQuote((current) => {
          const sameSelection = current
            && current.checkIn === checkIn
            && current.checkOut === checkOut
            && current.guests === guestsCount
            && current.pets === petsCount;
          if (sameSelection && (current.guestTotal !== data.data.guestTotal || current.currency !== data.data.currency)) {
            setQuoteNotice("The price changed since the property page. Review the updated total before continuing.");
          } else {
            setQuoteNotice(null);
          }
          return data.data;
        });
        setAuthoritativeBookingMode(data.data.bookingMode);
        setQuoteError(null);
      })
      .catch((err) => {
        if (!isCurrent || err?.name === "AbortError") return;
        setQuoteError("Unable to calculate price quotation.");
      })
      .finally(() => {
        if (isCurrent) setIsQuoteLoading(false);
      });
    }, 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(requestTimer);
      controller.abort();
    };
  // Guest count is validated for capacity at the API boundary, but does not
  // change the inclusive accommodation price. Avoid refetching the full quote
  // whenever the selector moves between 1 and the listing's max capacity.
  }, [listing.id, checkIn, checkOut, petsCount, isNonRefundable, specialOfferId, quoteRefreshKey]);

  const checkoutTotalLabel = quote
    ? formatMoney(quote.guestTotal, 2)
    : isQuoteLoading
      ? "Calculating…"
      : "Unavailable";
  const partNowAmount = quote ? Math.ceil(quote.guestTotal / 2) : 0;
  const partLaterAmount = quote ? quote.guestTotal - partNowAmount : 0;
  const paymentTimingOptions = getAvailablePaymentTimingOptions();

  const stepStatus = (step: CheckoutStepNumber) => (
    getCheckoutStepStatus(step, activeStep, completedSteps)
  );

  const focusStepHeading = (step: CheckoutStepNumber) => {
    window.requestAnimationFrame(() => stepHeadingRefs.current[step]?.focus());
  };

  const completeStep = (step: CheckoutStepNumber, nextStep: CheckoutStepNumber) => {
    setCompletedSteps((current) => new Set(current).add(step));
    setActiveStep(nextStep);
    focusStepHeading(nextStep);
  };

  const openCompletedStep = (step: CheckoutStepNumber) => {
    if (!canActivateCheckoutStep(step, authoritativeBookingMode, completedSteps)) return;
    setCompletedSteps((current) => {
      const next = new Set(current);
      // Editing an upstream choice only invalidates the final review. Other
      // independent, completed answers remain intact.
      next.delete(4);
      return next;
    });
    setActiveStep(step);
    focusStepHeading(step);
  };

  const handlePaymentTimingChange = (nextTiming: PaymentTiming) => {
    if (!paymentTimingOptions.some((option) => option.type === nextTiming)) {
      setPaymentTimingError("This payment option is no longer available for this booking.");
      return;
    }
    if (paymentPlan !== nextTiming) {
      setCompletedSteps((current) => new Set([...current].filter((step) => step < 2)));
    }
    setPaymentPlan(nextTiming);
    setPaymentTimingError(null);
  };

  // Step 1 Submit
  const handleStep1Next = () => {
    if (step1FinalizingRef.current) return;
    if (!paymentPlan || !paymentTimingOptions.some((option) => option.type === paymentPlan)) {
      setPaymentTimingError("Please choose when you want to pay.");
      window.requestAnimationFrame(() => paymentTimingGroupRef.current?.focus());
      return;
    }
    if (isQuoteLoading || quoteError || !quote) {
      window.requestAnimationFrame(() => quoteErrorRef.current?.focus());
      return;
    }
    step1FinalizingRef.current = true;
    setIsStep1Finalizing(true);
    completeStep(1, 2);
    window.requestAnimationFrame(() => {
      step1FinalizingRef.current = false;
      setIsStep1Finalizing(false);
    });
  };

  const handleStep2Next = () => {
    setSubmitError(null);
    let safeSelection: SafePaymentSummary;
    if (selectedMethodType === "card") {
      const validation = validateMockCard({
        number: rawCardNumber,
        expiry: rawCardExpiry,
        cvc: rawCardCvc,
      });
      if (!validation.valid) {
        setCardError(validation.error || "Please enter valid card details.");
        return;
      }
      setCardError(null);
      safeSelection = createSafePaymentSelection("card", validation.brand, validation.last4);
    } else if (selectedMethodType === "mada") {
      setCardError(null);
      safeSelection = createSafePaymentSelection("mada");
    } else if (selectedMethodType === "google_pay") {
      setCardError(null);
      safeSelection = createSafePaymentSelection("google_pay");
    } else {
      setCardError(null);
      safeSelection = createSafePaymentSelection("apple_pay");
    }

    setCheckoutDraft((prev) => ({ ...prev, paymentMethod: safeSelection }));
    clearRawCardFields();
    completeStep(2, 3);
  };

  // Step 3 Submit
  const handleStep3Next = () => {
    if (isInstantBook && !hostMessage.trim()) {
      setHostMessage("");
      setHostMessageError(null);
      completeStep(3, 4);
      return;
    }
    const validation = validateHostMessage(hostMessage);
    if (!validation.valid) {
      setHostMessageError(validation.error);
      window.requestAnimationFrame(() => hostMessageRef.current?.focus());
      return;
    }
    setHostMessage(validation.value);
    setHostMessageError(null);
    completeStep(3, 4);
  };

  // Step 4: Pay / Confirm & Pay
  const handleFinalBooking = async () => {
    setSubmitError(null);

    const requiredSteps: CheckoutStepNumber[] = [1, 2, 3];
    const firstIncompleteStep = requiredSteps.find((step) => !completedSteps.has(step));
    if (firstIncompleteStep) {
      setActiveStep(firstIncompleteStep);
      focusStepHeading(firstIncompleteStep);
      setSubmitError("Complete each checkout step before submitting.");
      return;
    }
    const selectedPaymentTiming = paymentPlan;
    if (!selectedPaymentTiming || !paymentTimingOptions.some((option) => option.type === selectedPaymentTiming)) {
      setActiveStep(1);
      setPaymentTimingError("Please choose when you want to pay.");
      focusStepHeading(1);
      return;
    }
    if (isQuoteLoading || quoteError || !quote) {
      setSubmitError("Refresh the current price and availability before submitting your request.");
      setQuoteRefreshKey((current) => current + 1);
      return;
    }

    // If user is not authenticated, redirect to login preserving intent
    if (!session?.user) {
      const bookingPath = buildBookingCheckoutUrl(listing.customSlug || listing.id, {
        checkIn,
        checkOut,
        guests: guestsCount,
        adults: adultsCount,
        children: childrenCount,
        infants: infantsCount,
        pets: petsCount,
        specialOfferId,
      }, { bookingMode: authoritativeBookingMode, nonRefundable: isNonRefundable || undefined });
      const returnUrl = encodeURIComponent(bookingPath);
      router.push(`/login?callbackUrl=${returnUrl}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = isInstantBook
        ? {
            listingId: listing.id,
            startDate: checkIn,
            endDate: checkOut,
            guests: guestsCount,
            pets: petsCount || 0,
            nonRefundable: isNonRefundable,
            paymentPlan: getBookingApiPaymentPlan(selectedPaymentTiming),
            message: hostMessage.trim() || undefined,
            specialOfferId: specialOfferId || undefined,
            requestSubmissionId,
            expectedGuestTotal: quote.guestTotal,
            expectedCurrency: quote.currency,
          }
        : {
            listingId: listing.id,
            startDate: checkIn,
            endDate: checkOut,
            guests: guestsCount,
            adults: adultsCount,
            children: childrenCount,
            infants: infantsCount,
            pets: petsCount || 0,
            nonRefundable: isNonRefundable,
            specialOfferId: specialOfferId || undefined,
            message: hostMessage.trim() || undefined,
            paymentPlan: getBookingApiPaymentPlan(selectedPaymentTiming),
            requestSubmissionId,
            expectedGuestTotal: quote.guestTotal,
            expectedCurrency: quote.currency,
          };

      const res = isInstantBook
        ? await fetch("/api/v1/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/v1/bookings/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await res.json();
      if (!res.ok || data.error) {
        if (res.status === 401) {
          const bookingPath = buildBookingCheckoutUrl(listing.customSlug || listing.id, {
            checkIn,
            checkOut,
            guests: guestsCount,
            adults: adultsCount,
            children: childrenCount,
            infants: infantsCount,
            pets: petsCount,
            specialOfferId,
          }, { bookingMode: authoritativeBookingMode, nonRefundable: isNonRefundable || undefined });
          const returnUrl = encodeURIComponent(bookingPath);
          router.push(`/login?callbackUrl=${returnUrl}`);
          return;
        }
        if (data.error?.code === "PRICE_CHANGED") {
          setQuoteRefreshKey((current) => current + 1);
        } else if (data.error?.code === "DATES_NO_LONGER_AVAILABLE") {
          setIsDatesModalOpen(true);
        } else if (data.error?.code === "BOOKING_MODE_CHANGED") {
          setQuoteRefreshKey((current) => current + 1);
        }
        setSubmitError(data.error?.message || "Failed to submit the booking request. Please try again.");
      } else if (!data.data?.id) {
        setSubmitError("The booking was created, but its confirmation details were unavailable. View your bookings to continue.");
      } else if (isInstantBook && data.data.status !== "CONFIRMED") {
        setSubmitError("Instant Book did not return a confirmed reservation. Please review your bookings before trying again.");
      } else {
        setCompletedSteps((current) => new Set(current).add(4));
        try {
          window.sessionStorage.removeItem(draftStorageKey);
        } catch {}
        setBookingResult({ id: data.data.id, status: data.data.status });
      }
    } catch {
      setSubmitError("An unexpected network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hostName = listing.host?.name || "Host";
  const hostCreatedAt = listing.host?.createdAt ? new Date(listing.host.createdAt) : null;
  const hostYears = hostCreatedAt && !Number.isNaN(hostCreatedAt.getTime())
    ? Math.max(0, new Date().getFullYear() - hostCreatedAt.getFullYear())
    : null;
  const hostMetadata = [
    listing.host?.isSuperhost === true ? "Superhost" : null,
    hostYears === null ? null : hostYears === 0 ? "New host" : `${hostYears} ${hostYears === 1 ? "year" : "years"} hosting`,
  ].filter(Boolean).join(" · ");
  const propertyLocation = [listing.city, listing.country].filter(Boolean).join(", ") || "Location unavailable";
  const summaryState = useMemo(() => ({
    property: {
      title: listing.title,
      imageUrl: listing.photos?.[0] || null,
      rating: typeof listing.rating === "number" && listing.rating > 0 ? listing.rating : null,
      reviewsCount: Math.max(0, listing.reviewsCount || 0),
      isGuestFavorite: listing.isGuestFavorite === true,
    },
    stay: {
      checkIn,
      checkOut,
      adults: adultsCount,
      children: childrenCount,
      infants: infantsCount,
      pets: petsCount,
    },
    pricing: {
      status: isQuoteLoading ? "loading" as const : quoteError ? "error" as const : quote ? "success" as const : "error" as const,
      quote,
      error: quoteError,
    },
    displayCurrency,
  }), [listing.title, listing.photos, listing.rating, listing.reviewsCount, listing.isGuestFavorite, checkIn, checkOut, adultsCount, childrenCount, infantsCount, petsCount, isQuoteLoading, quote, quoteError, displayCurrency]);
  const summaryActions = useMemo(() => ({
    formatMoney,
    onChangeDates: () => setIsDatesModalOpen(true),
    onChangeGuests: () => setIsGuestsModalOpen(true),
    onRetryPricing: () => setQuoteRefreshKey((current) => current + 1),
    onOpenPolicy: () => setIsPolicyModalOpen(true),
  }), [formatMoney, setIsDatesModalOpen, setIsGuestsModalOpen, setIsPolicyModalOpen, setQuoteRefreshKey]);
  const reviewData = useMemo(() => (
    quote && paymentPlan
      ? createReviewRequestData({
          paymentTiming: paymentPlan,
          paymentTimingLabel: getPaymentTimingSummary(paymentPlan, formatMoney(quote.guestTotal, 2)),
          paymentMethodLabel: checkoutDraft.paymentMethod
            ? checkoutDraft.paymentMethod.displayLabel
            : "Visa •••• 4242",
          paymentAuthorizationValid: true,
          paymentRequiredNow: false,
          hostMessage,
          checkIn,
          checkOut,
          adults: adultsCount,
          children: childrenCount,
          infants: infantsCount,
          pets: petsCount,
          quote,
        })
      : null
  ), [quote, paymentPlan, checkoutDraft.paymentMethod, hostMessage, checkIn, checkOut, adultsCount, childrenCount, infantsCount, petsCount, formatMoney]);

  if (!isDraftReady) {
    return (
      <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900">
        <AppHeader showBottomBorder={true} />
        <main className="w-full flex-1 py-12 lg:py-24" aria-busy="true" aria-label="Loading checkout">
          <Container>
            <div className="mx-auto max-w-[1263px] animate-pulse">
              <div className="mb-10 h-10 w-56 rounded-lg bg-zinc-100" />
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:gap-8 xl:grid-cols-[618px_571px] xl:gap-[74px]">
                <div className="space-y-8">
                  <div className="h-72 rounded-[30px] bg-zinc-100" />
                  <div className="h-24 rounded-[30px] bg-zinc-100" />
                </div>
                <div className="h-[560px] rounded-[30px] bg-zinc-100" />
              </div>
              <span className="sr-only">Restoring your checkout progress.</span>
            </div>
          </Container>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1F1F1F] antialiased selection:bg-amber-100">
      <AppHeader showBottomBorder={true} />

      <main className="w-full flex-1 pt-8 pb-20 sm:py-12 lg:py-24">
        <Container>
          <div className="mx-auto max-w-[1263px]">
            {/* Top Navigation Bar: Back Button & Page Title */}
            <div className="mb-10 flex items-center gap-6 lg:mb-15 lg:-ml-15">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 transition-colors cursor-pointer text-zinc-700 shadow-2xs"
                aria-label="Back to listing"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1>
                {isInstantBook ? "Confirm booking" : "Request to book"}
              </h1>
            </div>

            {/* Main Content Layout: 2 Columns */}
            <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:gap-8 xl:grid-cols-[618px_571px] xl:gap-[74px]">
              {/* ======================================================== */}
              {/* LEFT COLUMN: 4 PROGRESSIVE ACCORDION STEPS (lg:col-span-7) */}
              {/* ======================================================== */}
              <div className="order-1 space-y-12">
                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 1: Choose when to pay */}
                {/* ────────────────────────────────────────────────────────── */}
                <section
                  className="relative isolate"
                  data-step-status={stepStatus(1)}
                  aria-labelledby="checkout-step-1-title"
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-visible [filter:drop-shadow(0_2px_4px_rgb(0_0_0_/_20%))_drop-shadow(1px_0_3px_rgb(0_0_0_/_14%))]">
                    <div className="size-full rounded-[10px] bg-white [-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:100%_100%] sm:rounded-[30px] sm:[-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] sm:[mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)]" />
                  </div>
                  {/* Step Number Badge */}
                  <div aria-current={activeStep === 1 ? "step" : undefined} className={activeStep === 1 ? "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-[#E9EBFF] text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold" : "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold"}>
                    1
                    <span className="sr-only">, {stepStatus(1)}</span>
                  </div>

                  {activeStep === 1 ? (
                    // OPEN / ACTIVE STATE
                    <div id="checkout-step-1-panel" className="relative z-10 px-4 sm:pb-8 pb-6 pt-10 sm:px-10">
                      <h2
                        id="checkout-step-1-title"
                        ref={(element) => { stepHeadingRefs.current[1] = element; }}
                        tabIndex={-1}
                        className="mb-5 text-center font-medium text-[#1f1f1f] text-lg focus:outline-none"
                      >
                        {REQUEST_BOOK_STEPS[0].title}
                      </h2>

                      <fieldset
                        ref={paymentTimingGroupRef}
                        tabIndex={-1}
                        aria-describedby={paymentTimingError ? "payment-timing-error" : undefined}
                        className="focus:outline-none"
                      >
                        <legend className="sr-only">Choose when to pay</legend>
                        {paymentTimingOptions.map((option) => (
                          <label
                            key={option.type}
                            className="flex cursor-pointer items-start gap-5 border-b border-[#727272] py-5 first:pt-2 last:border-b-0 last:pb-3"
                          >
                            <input
                              type="radio"
                              name="paymentTiming"
                              value={option.type}
                              checked={paymentPlan === option.type}
                              onChange={() => handlePaymentTimingChange(option.type)}
                              className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-normal text-zinc-900">
                                {option.type === FULL_PAYMENT_TIMING ? (
                                  <>Pay <strong className="font-semibold">{checkoutTotalLabel}</strong> now</>
                                ) : option.type === PARTIAL_PAYMENT_TIMING ? (
                                  <>Pay <strong className="font-semibold">part now, part later</strong></>
                                ) : (
                                  <>Pay over time</>
                                )}
                              </span>
                              <span className="mt-1 block text-xs text-zinc-500" aria-live="polite">
                                {option.type === PARTIAL_PAYMENT_TIMING
                                  ? `${formatMoney(partNowAmount, 2)} now, ${formatMoney(partLaterAmount, 2)} later.`
                                  : option.type === PAY_OVER_TIME_PAYMENT_TIMING
                                    ? "Choose a flexible payment intent. A provider has not been selected yet."
                                    : "Full amount selected."}
                                {" "}No payment is processed in test mode.
                              </span>
                            </span>
                          </label>
                        ))}
                      </fieldset>

                      {quote && !isQuoteLoading && !quoteError && (
                        <section className="mt-5 border-t border-[#727272] pt-4" aria-labelledby="payment-price-details-heading">
                          <h3 id="payment-price-details-heading" className="text-sm font-semibold text-[#1f1f1f]">
                            Price details
                          </h3>
                          <dl className="mt-3 space-y-2 text-sm">
                            {getCheckoutPriceRows(quote, { itemizeTaxes: true }).map((row) => (
                              <div key={row.id} className="flex items-start justify-between gap-4">
                                <dt className="min-w-0 text-zinc-600">{row.label}</dt>
                                <dd className="shrink-0 font-medium text-zinc-900">
                                  {row.subtract ? "−" : ""}{formatMoney(row.amount, 2)}
                                </dd>
                              </div>
                            ))}
                            <div className="flex items-center justify-between gap-4 border-t border-zinc-300 pt-3 font-semibold text-zinc-950">
                              <dt>Total ({displayCurrency})</dt>
                              <dd>{formatMoney(quote.guestTotal, 2)}</dd>
                            </div>
                          </dl>
                        </section>
                      )}

                      {paymentTimingError && (
                        <p id="payment-timing-error" role="alert" className="mb-4 text-center text-xs font-medium text-rose-700">
                          {paymentTimingError}
                        </p>
                      )}

                      {quoteError && (
                        <div ref={quoteErrorRef} tabIndex={-1} role="alert" className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 text-center focus:outline-none">
                          {quoteError}
                        </div>
                      )}

                      {quoteNotice && (
                        <div role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-center text-xs font-medium text-amber-900">
                          {quoteNotice}
                        </div>
                      )}

                      {/* Next Button */}
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleStep1Next}
                          disabled={isQuoteLoading || isStep1Finalizing || Boolean(quoteError) || !quote}
                          className="min-h-[45px] min-w-[136px] cursor-pointer rounded-full border border-[#1f1f1f] bg-[#FCDF9C] px-8 py-2.5 text-base font-medium text-[#1f1f1f] transition-all duration-300 hover:bg-[#1f1f1f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[56px] sm:text-lg"
                        >
                          {isStep1Finalizing ? "Continuing…" : "Next"}
                        </button>
                      </div>
                    </div>
                  ) : completedSteps.has(1) ? (
                    // COMPLETED / COLLAPSED STATE
                    <div className="relative z-10 flex sm:flex-nowrap flex-wrap sm:gap-0 gap-5 items-center justify-between px-6 pb-7.5 sm:pt-15 pt-10 min-h-[143px]">
                      <div>
                        <h3 id="checkout-step-1-title" className="text-lg sm:text-xl font-medium text-[#1f1f1f]">
                          {REQUEST_BOOK_STEPS[0].title}
                        </h3>
                        <p className="mt-1 text-base font-normal text-[#1F1F1F]">
                          {paymentPlan
                            ? getPaymentTimingSummary(paymentPlan, checkoutTotalLabel)
                            : "Payment timing required"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCompletedStep(1)}
                        aria-controls="checkout-step-1-panel"
                        aria-expanded="false"
                        className="rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-4 py-1.5 sm:text-lg text-base font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors duration-300 cursor-pointer min-w-[121px] min-h-[48px] ml-auto"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="relative z-10 px-6 py-6 text-center">
                      <span id="checkout-step-1-title" className="text-lg sm:text-base sm:font-medium font-normal text-[#1F1F1F]">
                        {REQUEST_BOOK_STEPS[0].title}
                      </span>
                    </div>
                  )}
                </section>

                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 2: Payment method */}
                {/* ────────────────────────────────────────────────────────── */}
                <section
                  className="relative isolate"
                  data-step-status={stepStatus(2)}
                  aria-labelledby="checkout-step-2-title"
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-visible [filter:drop-shadow(0_2px_4px_rgb(0_0_0_/_20%))_drop-shadow(1px_0_3px_rgb(0_0_0_/_14%))]"><div className="size-full rounded-[10px] bg-white [-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:100%_100%] sm:rounded-[30px] sm:[-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] sm:[mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)]" /></div>
                  <div aria-current={activeStep === 2 ? "step" : undefined} className={activeStep === 2 ? "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-[#E9EBFF] text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold" : "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold"}>
                    2
                    <span className="sr-only">, {stepStatus(2)}</span>
                  </div>

                  {activeStep === 2 ? (
                    // OPEN / ACTIVE STATE
                    <div id="checkout-step-2-panel" className="relative z-10 px-4 sm:pb-8 pb-6 pt-10 sm:px-10">
                      <h2
                        id="checkout-step-2-title"
                        ref={(element) => { stepHeadingRefs.current[2] = element; }}
                        tabIndex={-1}
                        className="text-lg sm:text-xl sm:font-medium font-normal text-[#1f1f1f] mb-4 text-center focus:outline-none"
                      >
                        {REQUEST_BOOK_STEPS[1].title}
                      </h2>

                      {/* Development / Test Mode Banner */}
                      <div role="status" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs sm:text-sm text-amber-900 shadow-2xs">
                        <div className="flex items-center gap-2 font-semibold">
                          <span className="inline-block size-2 rounded-full bg-amber-500 animate-pulse" />
                          Test payment mode
                        </div>
                        <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                          No real payment will be processed. Do not enter a real card. Use mock test card <span className="font-mono font-semibold">4242 4242 4242 4242</span>, expiry <span className="font-mono font-semibold">12/30</span>, CVC <span className="font-mono font-semibold">123</span>.
                        </p>
                      </div>

                      {/* Payment Method Radio Selection — restored flat-row layout */}
                      <div>
                        <div>
                          <label className="flex cursor-pointer items-center gap-3 sm:gap-8">
                            <input
                              type="radio"
                              name="paymentMethodType"
                              value="card"
                              checked={selectedMethodType === "card"}
                              onChange={() => {
                                setSelectedMethodType("card");
                                if (cardError) setCardError(null);
                              }}
                              className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                            />
                            <span className="text-base font-semibold text-[#1f1f1f]">Credit / debit card</span>
                          </label>

                          {selectedMethodType === "card" && (
                            <div className="mt-6">
                              <div>
                                <label htmlFor="mock-card-number" className="mb-3 block text-base font-normal text-[#1F1F1F]">
                                  Card Number *
                                </label>
                                <div className="relative">
                                  <input
                                    id="mock-card-number"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="1234 1234 1234 1234"
                                    value={rawCardNumber}
                                    onChange={(event) => handleCardNumberChange(event.target.value)}
                                    aria-invalid={Boolean(cardError)}
                                    className="min-h-[45px] w-full rounded-[8px] border border-[#727272] bg-white px-4 py-2.5 pr-16 text-base text-[#1f1f1f] placeholder:text-[rgba(31,31,31,0.5)] focus:border-zinc-900 focus:outline-none sm:min-h-[56px]"
                                  />
                                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500">
                                    {detectCardBrand(rawCardNumber.replace(/\D/g, ""))}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div>
                                  <label htmlFor="mock-card-expiry" className="mb-3 block text-base font-normal text-[#1F1F1F]">
                                    Expiry Date *
                                  </label>
                                  <input
                                    id="mock-card-expiry"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="MM/YY"
                                    maxLength={5}
                                    value={rawCardExpiry}
                                    onChange={(event) => handleExpiryChange(event.target.value)}
                                    aria-invalid={Boolean(cardError)}
                                    className="min-h-[45px] w-full rounded-[8px] border border-[#727272] bg-white px-4 py-2.5 text-base text-[#1f1f1f] placeholder:text-[rgba(31,31,31,0.5)] focus:border-zinc-900 focus:outline-none sm:min-h-[56px]"
                                  />
                                </div>
                                <div>
                                  <label htmlFor="mock-card-cvc" className="mb-3 block text-base font-normal text-[#1F1F1F]">
                                    Card Code (CVC) *
                                  </label>
                                  <input
                                    id="mock-card-cvc"
                                    type="password"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="CVC"
                                    maxLength={4}
                                    value={rawCardCvc}
                                    onChange={(event) => handleCvcChange(event.target.value)}
                                    aria-invalid={Boolean(cardError)}
                                    className="min-h-[45px] w-full rounded-[8px] border border-[#727272] bg-white px-4 py-2.5 text-base text-[#1f1f1f] placeholder:text-[rgba(31,31,31,0.5)] focus:border-zinc-900 focus:outline-none sm:min-h-[56px]"
                                  />
                                </div>
                              </div>

                              {cardError && (
                                <p role="alert" className="mt-2 text-xs font-medium text-red-600">
                                  {cardError}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-6">
                          <label className="flex cursor-pointer items-center gap-3 border-t border-[#727272] py-5 sm:gap-8 sm:py-6">
                            <input
                              type="radio"
                              name="paymentMethodType"
                              value="apple_pay"
                              checked={selectedMethodType === "apple_pay"}
                              onChange={() => {
                                setSelectedMethodType("apple_pay");
                                if (cardError) setCardError(null);
                              }}
                              className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                            />
                            <div className="flex flex-row-reverse items-center gap-3 sm:flex-row">
                              <Image src="/images/icons/ApplePay.svg" alt="" width={19} height={24} className="h-6 w-[19px]" />
                              <span className="text-base font-semibold text-[#1f1f1f]">Apple Pay</span>
                            </div>
                          </label>

                          <label className="flex cursor-pointer items-center gap-3 border-t border-[#727272] py-5 sm:gap-8 sm:py-6">
                            <input
                              type="radio"
                              name="paymentMethodType"
                              value="google_pay"
                              checked={selectedMethodType === "google_pay"}
                              onChange={() => {
                                setSelectedMethodType("google_pay");
                                if (cardError) setCardError(null);
                              }}
                              className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                            />
                            <div className="flex flex-row-reverse items-center gap-3 sm:flex-row">
                              <Image src="/images/icons/G.svg" alt="" width={20} height={20} className="size-5" />
                              <span className="text-base font-semibold text-[#1f1f1f]">Google Pay</span>
                            </div>
                          </label>

                          <label className="flex cursor-pointer items-center gap-3 border-t border-[#727272] py-5 sm:gap-8 sm:py-6">
                            <input
                              type="radio"
                              name="paymentMethodType"
                              value="mada"
                              checked={selectedMethodType === "mada"}
                              onChange={() => {
                                setSelectedMethodType("mada");
                                if (cardError) setCardError(null);
                              }}
                              className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                            />
                            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
                              <span className="text-base font-semibold text-[#1f1f1f]">Local gateways</span>
                              <span className="text-xs text-zinc-500">(mada · mock/deferred)</span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Submit / Next Button */}
                      <div className="flex justify-end mt-6">
                        <button
                          type="button"
                          onClick={handleStep2Next}
                          className="min-h-[45px] min-w-[100px] cursor-pointer rounded-full border border-[#1f1f1f] bg-[#FCDF9C] px-8 py-2.5 text-base font-medium text-[#1f1f1f] transition-all duration-300 hover:bg-[#1f1f1f] hover:text-white sm:min-h-[56px] sm:min-w-[136px] sm:text-lg"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : completedSteps.has(2) ? (
                    // COMPLETED / COLLAPSED STATE
                    <div className="relative z-10 flex sm:flex-nowrap flex-wrap sm:gap-0 gap-5 items-center justify-between px-6 pb-7.5 sm:pt-15 pt-10 min-h-[143px]">
                      <div>
                        <h3 id="checkout-step-2-title" className="text-lg sm:text-xl font-medium text-[#1f1f1f]">
                          {REQUEST_BOOK_STEPS[1].title}
                        </h3>
                        <p className="mt-1 text-base font-normal text-[#1f1f1f]">
                          {checkoutDraft.paymentMethod ? checkoutDraft.paymentMethod.displayLabel : "Credit / debit card"}
                        </p>
                        <p className="text-xs text-zinc-500 font-medium mt-0.5">Payment status: Pending (Deferred)</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCompletedStep(2)}
                        aria-controls="checkout-step-2-panel"
                        aria-expanded="false"
                        className="rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-4 py-1.5 sm:text-lg text-base font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors duration-300 cursor-pointer min-w-[121px] min-h-[48px] ml-auto"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="relative z-10 flex min-h-[91px] items-center justify-center px-6 pt-10 pb-6 text-center sm:min-h-[108px]">
                      <span id="checkout-step-2-title" className="text-lg sm:text-base sm:font-medium font-normal text-[#1F1F1F]">
                        {REQUEST_BOOK_STEPS[1].title}
                      </span>
                    </div>
                  )}
                </section>

                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 3: Write a message to the host */}
                {/* ────────────────────────────────────────────────────────── */}
                <section
                  className="relative isolate"
                  data-step-status={stepStatus(3)}
                  aria-labelledby="checkout-step-3-title"
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-visible [filter:drop-shadow(0_2px_4px_rgb(0_0_0_/_20%))_drop-shadow(1px_0_3px_rgb(0_0_0_/_14%))]"><div className="size-full rounded-[10px] bg-white [-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:100%_100%] sm:rounded-[30px] sm:[-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] sm:[mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)]" /></div>
                  <div aria-current={activeStep === 3 ? "step" : undefined} className={activeStep === 3 ? "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-[#E9EBFF] text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold" : "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold"}>
                    3
                    <span className="sr-only">, {stepStatus(3)}</span>
                  </div>

                  {activeStep === 3 ? (
                    // OPEN / ACTIVE STATE
                    <div id="checkout-step-3-panel" className="relative z-10 px-4 sm:pb-8 pb-6 pt-10 sm:px-10">
                      <h2
                        id="checkout-step-3-title"
                        ref={(element) => { stepHeadingRefs.current[3] = element; }}
                        tabIndex={-1}
                        className="text-lg sm:text-xl font-medium text-[#1F1F1F] mb-2 text-center focus:outline-none"
                      >
                        {REQUEST_BOOK_STEPS[2].title}
                      </h2>
                      <p id="checkout-host-message-help" className="text-sm sm:text-base text-[#727272] text-left mb-4">
                        {isInstantBook
                          ? `Optionally let ${hostName} know a little about your trip before your booking is confirmed.`
                          : `Introduce yourself, share basic trip context, and let ${hostName} know why their place is a good fit.`}
                      </p>

                      {/* Host Snippet Card */}
                      <div className="flex items-center sm:gap-6 gap-4 mb-4">
                        <div className="relative h-16 w-16 shrink-0 rounded-full overflow-hidden bg-zinc-200 border border-zinc-200">
                          {listing.host?.image ? (
                            <Image
                              src={listing.host.image}
                              alt={hostName}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-lg bg-amber-100 text-amber-900 font-bold">
                              {hostName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-base font-normal text-[#1F1F1F]">
                            Hosted by {hostName}
                          </h4>
                          {hostMetadata && (
                            <p className="mt-1 text-sm text-[#1f1f1f]">{hostMetadata}</p>
                          )}
                        </div>
                      </div>

                      {/* Message Textarea */}
                      <div>
                        <label htmlFor="checkout-host-message" className="block text-sm font-normal text-[#1f1f1f] mb-2">
                          Write a message
                        </label>
                        <textarea
                          id="checkout-host-message"
                          ref={hostMessageRef}
                          rows={4}
                          maxLength={HOST_MESSAGE_MAX_LENGTH}
                          value={hostMessage}
                          onChange={(e) => {
                            setHostMessage(e.target.value);
                            if (hostMessageError) setHostMessageError(null);
                          }}
                          aria-invalid={Boolean(hostMessageError)}
                          aria-describedby={`checkout-host-message-help checkout-host-message-count${hostMessageError ? " checkout-host-message-error" : ""}`}
                          placeholder={isInstantBook
                            ? `Hi ${hostName}, I'm looking forward to staying at your place.`
                            : `Hi ${hostName}, I'm visiting the area and would love to stay at your place…`}
                          className="w-full sm:rounded-[20px] rounded-[10px] border border-[#727272] bg-white sm:p-4 p-3 sm:text-base text-sm text-[#1f1f1f] placeholder:text-[rgba(31,31,31,0.5)] focus:border-zinc-900 focus:outline-none transition-colors resize-none"
                        />
                        <p id="checkout-host-message-count" className="mt-1 text-right text-xs text-zinc-500" aria-live="polite">
                          {hostMessage.length.toLocaleString("en-US")}/{HOST_MESSAGE_MAX_LENGTH.toLocaleString("en-US")}
                        </p>
                      </div>

                      {hostMessageError && (
                        <p id="checkout-host-message-error" role="alert" className="mt-2 text-xs font-medium text-red-600">
                          {hostMessageError}
                        </p>
                      )}

                      {/* Next Button */}
                      <div className="flex justify-end sm:mt-6 mt-5">
                        <button
                          type="button"
                          onClick={handleStep3Next}
                          className="rounded-full bg-[#FCDF9C] hover:bg-[#1f1f1f] text-[#1f1f1f] border border-[#1f1f1f] hover:text-white font-medium px-8 py-2.5 text-lg transition-all duration-300 cursor-pointer min-w-[136px] sm:min-h-[56px] min-h-[45px]"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : completedSteps.has(3) ? (
                    // COMPLETED / COLLAPSED STATE
                    <div className="relative z-10 flex sm:flex-nowrap flex-wrap sm:gap-0 gap-5 items-center justify-between px-6 pb-7.5 sm:pt-15 pt-10 min-h-[143px]">
                      <div className="min-w-0 pr-4">
                        <h3 id="checkout-step-3-title" className="text-lg sm:text-xl font-medium text-[#1f1f1f]">
                          {REQUEST_BOOK_STEPS[2].title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-base font-normal text-[#1f1f1f]">
                          {hostMessage.trim() ? `“${formatHostMessagePreview(hostMessage)}”` : "No message added"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCompletedStep(3)}
                        aria-controls="checkout-step-3-panel"
                        aria-expanded="false"
                        className="rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-4 py-1.5 sm:text-lg text-base font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors duration-300 cursor-pointer min-w-[121px] min-h-[48px] ml-auto"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="relative z-10 flex min-h-[91px] items-center justify-center px-6 pt-10 pb-6 text-center sm:min-h-[108px]">
                      <span id="checkout-step-3-title" className="text-lg sm:text-base sm:font-medium font-normal text-[#1F1F1F]">
                        {REQUEST_BOOK_STEPS[2].title}
                      </span>
                    </div>
                  )}
                </section>

                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 4: Review your request */}
                {/* ────────────────────────────────────────────────────────── */}
                <section
                  className="relative isolate"
                  data-step-status={stepStatus(4)}
                  aria-labelledby="checkout-step-4-title"
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-visible [filter:drop-shadow(0_2px_4px_rgb(0_0_0_/_20%))_drop-shadow(1px_0_3px_rgb(0_0_0_/_14%))]"><div className="size-full rounded-[10px] bg-white [-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:100%_100%] sm:rounded-[30px] sm:[-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] sm:[mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)]" /></div>
                  <div aria-current={activeStep === 4 ? "step" : undefined} className={activeStep === 4 ? "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-[#E9EBFF] text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold" : "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold"}>
                    4
                    <span className="sr-only">, {stepStatus(4)}</span>
                  </div>

                  {activeStep === 4 ? (
                    // OPEN / ACTIVE STATE
                    <div id="checkout-step-4-panel" className="relative z-10 px-4 sm:pb-8 pb-6 pt-10 sm:px-10">
                      <h2
                        id="checkout-step-4-title"
                        ref={(element) => { stepHeadingRefs.current[4] = element; }}
                        tabIndex={-1}
                        className="text-lg sm:text-xl font-medium text-[#1f1f1f] mb-3 text-center focus:outline-none"
                      >
                        {isInstantBook ? "Review and confirm" : REQUEST_BOOK_STEPS[3].title}
                      </h2>
                      {submitError && (
                        <div role="alert" className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 text-center">
                          {submitError}
                        </div>
                      )}

                      {bookingSuccess && bookingResult && quote && paymentPlan && (
                        <BookingConfirmation
                          bookingId={bookingResult.id}
                          bookingMode={authoritativeBookingMode}
                          property={{
                            title: listing.title,
                            imageUrl: listing.photos?.[0] || null,
                            location: propertyLocation,
                          }}
                          hostName={hostName}
                          checkIn={checkIn}
                          checkOut={checkOut}
                          guests={{ adults: adultsCount, children: childrenCount, infants: infantsCount, pets: petsCount }}
                          message={hostMessage}
                          quote={quote}
                          paymentTiming={getPaymentTimingSummary(paymentPlan, formatMoney(quote.guestTotal, 2))}
                          paymentMethod={checkoutDraft.paymentMethod?.displayLabel || "Payment method selected"}
                          formatMoney={formatBookingMoney}
                        />
                      )}

                      {!bookingSuccess && isQuoteLoading && (
                        <div role="status" aria-live="polite" className="mt-5 space-y-3" aria-label="Refreshing review details">
                          <p className="text-sm font-medium text-zinc-600">Refreshing availability and price…</p>
                          <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
                          <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
                        </div>
                      )}

                      {!bookingSuccess && !isQuoteLoading && quoteError && (
                        <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-rose-700">
                          <p>{quoteError}</p>
                          <button type="button" onClick={() => setQuoteRefreshKey((current) => current + 1)} className="mt-3 min-h-10 rounded-full border border-rose-400 px-4 font-semibold hover:bg-rose-100">Try again</button>
                        </div>
                      )}

                      {!bookingSuccess && !isQuoteLoading && !quoteError && reviewData && (
                        <ReviewRequestStep
                          data={reviewData}
                          bookingMode={authoritativeBookingMode}
                          property={{
                            title: listing.title,
                            imageUrl: listing.photos?.[0] || null,
                            location: propertyLocation,
                          }}
                          formatMoney={formatBookingMoney}
                          isSubmitting={isSubmitting}
                          onChangePaymentTiming={() => openCompletedStep(1)}
                          onChangePaymentMethod={() => openCompletedStep(2)}
                          onChangeMessage={() => openCompletedStep(3)}
                          onChangeDates={() => setIsDatesModalOpen(true)}
                          onChangeGuests={() => setIsGuestsModalOpen(true)}
                          onSubmit={handleFinalBooking}
                        />
                      )}
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="relative z-10 flex min-h-[91px] items-center justify-center px-6 pt-10 pb-6 text-center sm:min-h-[108px]">
                      <span id="checkout-step-4-title" className="text-lg sm:text-xl sm:font-medium font-normal text-[#1F1F1F]">
                        {isInstantBook ? "Review and confirm" : REQUEST_BOOK_STEPS[3].title}
                      </span>
                    </div>
                  )}
                </section>
              </div>

              {/* ======================================================== */}
              {/* RIGHT COLUMN: STICKY PROPERTY & PRICE SUMMARY (lg:col-span-5) */}
              {/* ======================================================== */}
              <div className="order-2 lg:sticky lg:top-24">
                <BookingSummary
                  state={summaryState}
                  actions={summaryActions}
                  isBreakdownOpen={isBreakdownModalOpen}
                  onBreakdownOpenChange={setIsBreakdownModalOpen}
                  cancellationCutoff={formatCancellationCutoff(checkIn)}
                />

              </div>
            </div>
          </div>
        </Container>
      </main>

      <Footer />

      {/* ======================================================== */}
      {/* MODAL 1: CHANGE DATES MODAL (using ModalOverlay) */}
      {/* ======================================================== */}
      {isDatesModalOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsDatesModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-dates-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-[30px] bg-white p-6 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#727272]">
              <h3 id="change-dates-title" className="text-lg font-medium text-[#1f1f1f]">Change dates</h3>
              <button
                type="button"
                onClick={() => setIsDatesModalOpen(false)}
                aria-label="Close date selector"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="checkout-change-checkin" className="block text-sm font-normal text-[#1f1f1f] mb-2">
                    Check-in date
                  </label>
                  <input
                    id="checkout-change-checkin"
                    type="date"
                    value={checkIn}
                    min={dateKey(new Date())}
                    onChange={(e) => updateCheckIn(e.target.value)}
                    className="w-full rounded-[8px] border border-[#727272] p-2.5 text-sm font-semibold text-[#1f1f1f] focus:border-zinc-900 focus:outline-none sm:min-h-[56px] min-h-[45px]"
                  />
                </div>
                <div>
                  <label htmlFor="checkout-change-checkout" className="block text-sm font-normal text-[#1f1f1f] mb-2">
                    Check-out date
                  </label>
                  <input
                    id="checkout-change-checkout"
                    type="date"
                    value={checkOut}
                    min={checkIn || dateKey(new Date())}
                    onChange={(e) => updateCheckOut(e.target.value)}
                    className="w-full rounded-[8px] border border-[#727272] p-2.5 text-sm font-semibold text-[#1f1f1f] focus:border-zinc-900 focus:outline-none sm:min-h-[56px] min-h-[45px]"
                  />
                </div>
              </div>
              <p className="text-xs text-[#727272]">
                Minimum stay: {listing.minNights || 1} {listing.minNights === 1 ? "night" : "nights"}. Price and availability update automatically.
              </p>
              {isQuoteLoading ? (
                <p role="status" className="text-sm font-medium text-zinc-600">Checking availability and updating price…</p>
              ) : quoteError ? (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                  <p>{quoteError}</p>
                  <button type="button" onClick={() => setQuoteRefreshKey((current) => current + 1)} className="mt-2 min-h-9 rounded-full border border-rose-400 px-4 font-semibold hover:bg-rose-100">Try again</button>
                </div>
              ) : quote ? (
                <p role="status" className="text-sm font-medium text-emerald-700">Dates are available and the price is current.</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#727272]">
              <button
                type="button"
                onClick={() => setIsDatesModalOpen(false)}
                disabled={isQuoteLoading || Boolean(quoteError) || !quote}
                className="rounded-full border border-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white text-[#1f1f1f] font-semibold px-6 py-2.5 text-sm bg-[#FCDF9C] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply dates
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CHANGE GUESTS MODAL (using ModalOverlay) */}
      {/* ======================================================== */}
      {isGuestsModalOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsGuestsModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-guests-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-[30px] bg-white p-6 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#727272]">
              <h3 id="change-guests-title" className="text-lg font-medium text-[#1f1f1f]">Guests</h3>
              <button
                type="button"
                onClick={() => setIsGuestsModalOpen(false)}
                aria-label="Close guest selector"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="divide-y divide-[#727272]">
              {/* Adults */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="text-sm font-normal text-[#1F1F1F]">Adults</h4>
                  <p className="text-xs text-[#727272]">Age 13+</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={adultsCount <= 1}
                    onClick={() => updateAdults(-1)}
                    aria-label="Remove one adult"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 hover:border-zinc-900 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums">
                    {adultsCount}
                  </span>
                  <button
                    type="button"
                    disabled={!canAddCapacityGuest}
                    onClick={() => updateAdults(1)}
                    aria-label="Add one adult"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 hover:border-zinc-900 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="text-sm font-normal text-zinc-900">Children</h4>
                  <p className="text-xs text-zinc-500">Ages 2–12{!allowsChildren ? " · Not allowed" : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" disabled={childrenCount <= 0} onClick={() => updateChildren(-1)} aria-label="Remove one child" className="flex size-8 items-center justify-center rounded-full border border-zinc-300 hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-40">−</button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums" aria-live="polite">{childrenCount}</span>
                  <button type="button" disabled={!allowsChildren || !canAddCapacityGuest} onClick={() => updateChildren(1)} aria-label="Add one child" className="flex size-8 items-center justify-center rounded-full border border-zinc-300 hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-40">+</button>
                </div>
              </div>

              {/* Infants */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="text-sm font-normal text-zinc-900">Infants</h4>
                  <p className="text-xs text-zinc-500">Under 2{!allowsInfants ? " · Not allowed" : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" disabled={infantsCount <= 0} onClick={() => updateInfants(-1)} aria-label="Remove one infant" className="flex size-8 items-center justify-center rounded-full border border-zinc-300 hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-40">−</button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums" aria-live="polite">{infantsCount}</span>
                  <button type="button" disabled={!allowsInfants || infantsCount >= 5} onClick={() => updateInfants(1)} aria-label="Add one infant" className="flex size-8 items-center justify-center rounded-full border border-zinc-300 hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-40">+</button>
                </div>
              </div>

              {/* Pets */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="text-sm font-normal text-zinc-900">Pets</h4>
                  <p className="text-xs text-zinc-500">{allowsPets ? `Up to ${maximumPets}` : "Not allowed"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={petsCount <= 0}
                    onClick={() => updatePets(-1)}
                    aria-label="Remove one pet"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 hover:border-zinc-900 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums">
                    {petsCount}
                  </span>
                  <button
                    type="button"
                    disabled={!allowsPets || petsCount >= maximumPets}
                    onClick={() => updatePets(1)}
                    aria-label="Add one pet"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 hover:border-zinc-900 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <p className="pt-3 text-xs text-zinc-500">
              {guestsCount >= maximumGuests
                ? `Maximum property capacity of ${maximumGuests} ${maximumGuests === 1 ? "guest" : "guests"} reached.`
                : `This property accommodates up to ${maximumGuests} ${maximumGuests === 1 ? "guest" : "guests"}.`}
            </p>

            {/* {isQuoteLoading ? (
              <p role="status" className="pt-3 text-sm font-medium text-zinc-600">Updating price…</p>
            ) : quoteError ? (
              <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                <p>{quoteError}</p>
                <button type="button" onClick={() => setQuoteRefreshKey((current) => current + 1)} className="mt-2 min-h-9 rounded-full border border-rose-400 px-4 font-semibold hover:bg-rose-100">Try again</button>
              </div>
            ) : null} */}

            <div className="flex justify-end gap-3 pt-4 border-t border-[#727272]">
              <button
                type="button"
                onClick={() => setIsGuestsModalOpen(false)}
                disabled={isQuoteLoading || Boolean(quoteError) || !quote}
                className="rounded-full border border-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white text-[#1f1f1f] font-semibold px-6 py-2.5 text-sm bg-[#FCDF9C] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CANCELLATION POLICY MODAL (using ModalOverlay) */}
      {/* ======================================================== */}
      {isPolicyModalOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsPolicyModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancellation-policy-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-[30px] bg-white p-6 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#727272]">
              <h3 id="cancellation-policy-title" className="text-lg font-medium text-[#1f1f1f]">Cancellation policy</h3>
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(false)}
                aria-label="Close cancellation policy"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-4 text-sm text-zinc-700 leading-relaxed">
              {isNonRefundable ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <h4 className="font-bold text-[#1F1F1F] mb-1">
                    Non-refundable rate
                  </h4>
                  <p className="text-xs text-[#727272]">
                    This reservation is non-refundable. If you cancel or change your reservation, you will not receive a refund.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <h4 className="font-bold text-[#1F1F1F] mb-1">
                    Full refund before {formatCancellationCutoff(checkIn)}
                  </h4>
                  <p className="text-xs text-[#727272]">
                    Cancel up to 72 hours before check-in for a full refund minus processing fees.
                  </p>
                </div>
              )}

              <div>
                <h5 className="font-bold text-[#1F1F1F] text-xs uppercase tracking-wider mb-2">
                  {isNonRefundable ? "Non-refundable Terms" : "Standard Terms"}
                </h5>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600">
                  {isNonRefundable ? (
                    <>
                      <li>Non-refundable bookings receive a lower price in exchange for no refund if cancelled.</li>
                      <li>Cleaning fees may be refunded if cancelled prior to check-in, subject to host policy.</li>
                      <li>In the event of declared extenuating circumstances, special refund considerations may apply.</li>
                    </>
                  ) : (
                    <>
                      <li>If you cancel less than 72 hours before check-in, the first night is non-refundable.</li>
                      <li>Cleanings fees are always refunded if the reservation is cancelled before check-in.</li>
                      <li>In the event of extenuating circumstances, special refund considerations may apply.</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(false)}
                className="rounded-full bg-zinc-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
}
