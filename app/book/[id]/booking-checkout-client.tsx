"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { PublicListingDTO } from "@/services/mappers";
import { getCurrencyForCountry } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";

interface BookingCheckoutClientProps {
  listing: PublicListingDTO & {
    host?: {
      id?: string;
      name?: string | null;
      image?: string | null;
      createdAt?: Date | string;
      publicProfile?: Record<string, unknown> | null;
    };
  };
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  initialPets?: number;
  initialNonRefundable?: boolean;
  initialSpecialOfferId?: string;
}

interface QuoteData {
  nights: number;
  baseNightlyPrice: number; // minor units
  nightlySubtotal: number;
  cleaningFee: number;
  extraGuestFee: number;
  petFee?: number;
  hostServiceFee: number;
  taxes: Array<{ taxName: string; amount: number }>;
  taxTotal: number;
  subtotal: number;
  guestTotal: number;
  currency: string;
  cancellationPolicy: string;
  isSpecialOffer?: boolean;
  specialOfferId?: string | null;
  specialOfferAmount?: number | null;
}

const PAYMENT_PLAN_API_VALUES = {
  now: "FULL",
  part: "SPLIT",
  klarna: "KLARNA",
} as const;

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateRange(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return "Select dates";
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Select dates";

  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}–${endDay}, ${startYear}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`;
  }
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
}

function formatCancellationCutoff(checkInStr: string): string {
  if (!checkInStr) return "soon";
  const checkIn = new Date(checkInStr);
  if (isNaN(checkIn.getTime())) return "soon";
  const cutoff = new Date(checkIn);
  cutoff.setDate(cutoff.getDate() - 3);
  return cutoff.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPartPaymentDate(checkInStr: string): string {
  if (!checkInStr) return "xx.xx.xxxx";
  const checkIn = new Date(checkInStr);
  if (isNaN(checkIn.getTime())) return "xx.xx.xxxx";
  const date = new Date(checkIn);
  date.setDate(date.getDate() - 7);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function BookingCheckoutClient({
  listing,
  initialCheckIn,
  initialCheckOut,
  initialGuests = 1,
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
  const defaultTomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dateKey(d);
  }, []);
  const defaultDayAfter = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return dateKey(d);
  }, []);

  const [checkIn, setCheckIn] = useState<string>(initialCheckIn || defaultTomorrow);
  const [checkOut, setCheckOut] = useState<string>(initialCheckOut || defaultDayAfter);
  const [guestsCount, setGuestsCount] = useState<number>(initialGuests);
  const [petsCount, setPetsCount] = useState<number>(initialPets);
  const [isNonRefundable] = useState<boolean>(initialNonRefundable);

  // Progressive Accordion Steps (1 | 2 | 3 | 4)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1: Choose when to pay
  const [paymentPlan, setPaymentPlan] = useState<"now" | "part" | "klarna">("now");

  // Step 2: Payment method
  const [paymentMethod, setPaymentMethod] = useState<"card" | "apple_pay" | "google_pay" | "local">("card");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);

  // Step 3: Write a message to the host
  const [hostMessage, setHostMessage] = useState("");

  // Step 4: Submission & State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Modals state
  const [isDatesModalOpen, setIsDatesModalOpen] = useState(false);
  const [isGuestsModalOpen, setIsGuestsModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

  // Live Quote state
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const currencyCode = getCurrencyForCountry(listing.country);
  const currencySymbol = displayCurrency;

  // Format currency helpers
  const formatMoney = (minorAmount: number, withDecimals = false) => {
    return formatPrice(minorAmount, currencyCode, withDecimals ? 2 : 0);
  };

  // Fetch Authoritative Live Quote whenever dates or guests change
  useEffect(() => {
    if (!checkIn || !checkOut || checkIn >= checkOut) {
      setQuote(null);
      setIsQuoteLoading(false);
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();
    setIsQuoteLoading(true);
    setQuoteError(null);

    const specialOfferParam = specialOfferId ? `&specialOfferId=${encodeURIComponent(specialOfferId)}` : "";

    fetch(
      `/api/v1/listings/${listing.id}/quote?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guestsCount}&pets=${petsCount}&nonRefundable=${isNonRefundable}${specialOfferParam}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!isCurrent) return;
        if (!ok || data.error || !data.data) {
          setQuoteError(data.error?.message || "Selected dates are not available.");
          setQuote(null);
          return;
        }
        setQuote(data.data);
        setQuoteError(null);
      })
      .catch((err) => {
        if (!isCurrent || err?.name === "AbortError") return;
        setQuoteError("Unable to calculate price quotation.");
        setQuote(null);
      })
      .finally(() => {
        if (isCurrent) setIsQuoteLoading(false);
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [listing.id, checkIn, checkOut, guestsCount, petsCount, isNonRefundable, specialOfferId]);

  // Fallback calculations if quote is loading or estimated
  const nightsCount = useMemo(() => {
    if (!checkIn || !checkOut) return 1;
    const s = new Date(checkIn);
    const e = new Date(checkOut);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [checkIn, checkOut]);

  const effectiveTotalMinor = quote?.guestTotal ?? (listing.price * nightsCount);
  const effectiveBaseNightlyMinor = quote?.baseNightlyPrice ?? listing.price;
  const effectiveNightlySubtotalMinor = quote?.nightlySubtotal ?? (effectiveBaseNightlyMinor * nightsCount);
  const effectiveTaxesMinor = quote?.taxTotal ?? Math.round(effectiveNightlySubtotalMinor * 0.1);

  // Split payment calculations (e.g. 20% now, 80% later)
  const partNowMinor = Math.round(effectiveTotalMinor * 0.2);
  const partLaterMinor = effectiveTotalMinor - partNowMinor;
  const checkoutTotalLabel = isQuoteLoading
    ? "Calculating…"
    : quote
      ? formatMoney(quote.guestTotal, true)
      : "Unavailable";
  const partNowLabel = !isQuoteLoading && quote ? formatMoney(partNowMinor, true) : checkoutTotalLabel;
  const partLaterLabel = !isQuoteLoading && quote ? formatMoney(partLaterMinor, true) : checkoutTotalLabel;

  // Step 1 Submit
  const handleStep1Next = () => {
    setCompletedSteps((prev) => new Set([...prev, 1]));
    setActiveStep(2);
  };

  // Step 2 Submit
  const handleStep2Next = () => {
    if (paymentMethod === "card") {
      const cleanCard = cardNumber.replace(/\s+/g, "");
      if (cleanCard.length < 13) {
        setCardError("Please enter a valid card number.");
        return;
      }
      if (!expiryDate || expiryDate.length < 4) {
        setCardError("Please enter a valid expiry date (MM/YY).");
        return;
      }
      if (!cardCvc || cardCvc.length < 3) {
        setCardError("Please enter a valid 3 or 4-digit CVC.");
        return;
      }
    }
    setCardError(null);
    setCompletedSteps((prev) => new Set([...prev, 2]));
    setActiveStep(3);
  };

  // Step 3 Submit
  const handleStep3Next = () => {
    setCompletedSteps((prev) => new Set([...prev, 3]));
    setActiveStep(4);
  };

  // Step 4: Pay / Confirm & Pay
  const handleFinalBooking = async () => {
    setSubmitError(null);

    // If user is not authenticated, redirect to login preserving intent
    if (!session?.user) {
      const specialOfferQuery = specialOfferId ? `&specialOfferId=${encodeURIComponent(specialOfferId)}` : "";
      const returnUrl = encodeURIComponent(
        `/book/${listing.customSlug || listing.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guestsCount}&pets=${petsCount}${specialOfferQuery}`,
      );
      router.push(`/login?returnUrl=${returnUrl}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          startDate: checkIn,
          endDate: checkOut,
          guests: guestsCount,
          pets: petsCount || 0,
          nonRefundable: isNonRefundable,
          specialOfferId: specialOfferId || undefined,
          message: hostMessage.trim() || undefined,
          paymentPlan: PAYMENT_PLAN_API_VALUES[paymentPlan],
          paymentMethod: paymentMethod.toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        if (res.status === 401) {
          const specialOfferQuery = specialOfferId ? `&specialOfferId=${encodeURIComponent(specialOfferId)}` : "";
          const returnUrl = encodeURIComponent(
            `/book/${listing.customSlug || listing.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guestsCount}&pets=${petsCount}${specialOfferQuery}`,
          );
          router.push(`/login?returnUrl=${returnUrl}`);
          return;
        }
        setSubmitError(data.error?.message || "Failed to confirm reservation. Please try again.");
      } else {
        setBookingSuccess(true);
        setTimeout(() => {
          router.push("/profile/tab/upcoming");
        }, 1500);
      }
    } catch {
      setSubmitError("An unexpected network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format Card input
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardNumber(formatted);
    if (cardError) setCardError(null);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setExpiryDate(raw);
    if (cardError) setCardError(null);
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardCvc(raw);
    if (cardError) setCardError(null);
  };

  const hostName = listing.host?.name || "Host";
  const hostAvatar = listing.host?.image || "/images/placeholder-avatar.png";
  const propertyCategory = listing.propertyType
    ? listing.propertyType.charAt(0) + listing.propertyType.slice(1).toLowerCase()
    : "Private stay";
  const locationLabel = [listing.city, listing.country].filter(Boolean).join(", ") || "Saudi Arabia";

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 antialiased selection:bg-amber-100">
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
                Request to book
              </h1>
            </div>

            {/* Main Content Layout: 2 Columns */}
            <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[618px_571px] lg:gap-18.5">
              {/* ======================================================== */}
              {/* LEFT COLUMN: 4 PROGRESSIVE ACCORDION STEPS (lg:col-span-7) */}
              {/* ======================================================== */}
              <div className="order-2 space-y-12 lg:order-1">
                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 1: Choose when to pay */}
                {/* ────────────────────────────────────────────────────────── */}
                <div className="relative isolate">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-visible [filter:drop-shadow(0_2px_4px_rgb(0_0_0_/_20%))_drop-shadow(1px_0_3px_rgb(0_0_0_/_14%))]">
                    <div className="size-full rounded-[10px] bg-white [-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:100%_100%] sm:rounded-[30px] sm:[-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] sm:[mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)]" />
                  </div>
                  {/* Step Number Badge */}
                  <div className={activeStep === 1 ? "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-[#E9EBFF] text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold" : "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold"}>
                    1
                  </div>

                  {activeStep === 1 ? (
                    // OPEN / ACTIVE STATE
                    <div className="relative z-10 px-4 sm:pb-8 pb-6 pt-10 sm:px-10">
                      <h2 className="mb-5 text-center font-medium text-[#1f1f1f] text-lg">
                        Choose when to pay
                      </h2>

                      <div>
                        {/* Option 1: Pay now */}
                        <label
                          className="flex cursor-pointer items-center gap-5 border-b border-[#727272] py-4 first:pt-2"
                        >
                          <input
                            type="radio"
                            name="paymentPlan"
                            value="now"
                            checked={paymentPlan === "now"}
                            onChange={() => setPaymentPlan("now")}
                            className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-normal text-zinc-900" aria-live="polite">
                              Pay <strong className="font-semibold">{checkoutTotalLabel}</strong> now
                            </span>
                          </div>
                        </label>

                        {/* Option 2: Pay part now, part later */}
                        <label
                          className="flex cursor-pointer items-start gap-5 border-b border-[#727272] py-5"
                        >
                          <input
                            type="radio"
                            name="paymentPlan"
                            value="part"
                            checked={paymentPlan === "part"}
                            onChange={() => setPaymentPlan("part")}
                            className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="block text-sm font-normal text-zinc-900">
                              Pay <strong className="font-semibold">part now, part later</strong>
                            </span>
                            <p className="text-xs text-zinc-500 mt-1 leading-relaxed" aria-live="polite">
                              {partNowLabel} now, {partLaterLabel} will be charged on {formatPartPaymentDate(checkIn)}. No extra fees.{" "}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIsBreakdownModalOpen(true);
                                }}
                                className="underline font-normal text-[#727272] hover:text-[#1f1f1f]"
                              >
                                More info
                              </button>
                            </p>
                          </div>
                        </label>

                        {/* Option 3: Klarna */}
                        <label
                          className="flex cursor-pointer items-start gap-5 py-5 pb-3"
                        >
                          <input
                            type="radio"
                            name="paymentPlan"
                            value="klarna"
                            checked={paymentPlan === "klarna"}
                            onChange={() => setPaymentPlan("klarna")}
                            className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="block text-sm font-normal text-zinc-900">
                              Pay over time, with Klarna
                            </span>
                            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                              Choose a flexible payment option that works for you.{" "}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIsBreakdownModalOpen(true);
                                }}
                                className="underline font-normal text-[#727272] hover:text-[#1f1f1f]"
                              >
                                More info
                              </button>
                            </p>
                          </div>
                        </label>
                      </div>

                      {quoteError && (
                        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 text-center">
                          {quoteError}
                        </div>
                      )}

                      {/* Next Button */}
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleStep1Next}
                          disabled={isQuoteLoading || Boolean(quoteError) || !quote}
                          className="rounded-full bg-[#fee09a] hover:bg-[#fbd775] text-zinc-900 font-bold px-8 py-2.5 text-sm transition-all shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)] cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : completedSteps.has(1) ? (
                    // COMPLETED / COLLAPSED STATE
                    <div className="relative z-10 flex sm:flex-nowrap flex-wrap sm:gap-0 gap-5 items-center justify-between px-6 pb-7.5 sm:pt-15 pt-10 min-h-[143px]">
                      <div>
                        <h3 className="text-lg sm:text-xl font-medium text-[#1f1f1f]">
                          Choose when to pay
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5 font-medium">
                          {paymentPlan === "now"
                            ? `Pay ${checkoutTotalLabel} now`
                            : paymentPlan === "part"
                            ? `Pay part now (${partNowLabel}), part later`
                            : "Pay over time, with Klarna"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveStep(1)}
                        className="rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-4 py-1.5 sm:text-lg text-base font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors duration-300 cursor-pointer min-w-[121px] min-h-[48px] ml-auto"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="relative z-10 px-6 py-6 text-center">
                      <span className="text-lg sm:text-base sm:font-medium font-normal text-[#1F1F1F]">
                        Choose when to pay
                      </span>
                    </div>
                  )}
                </div>

                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 2: Payment method */}
                {/* ────────────────────────────────────────────────────────── */}
                <div className="relative isolate">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-visible [filter:drop-shadow(0_2px_4px_rgb(0_0_0_/_20%))_drop-shadow(1px_0_3px_rgb(0_0_0_/_14%))]"><div className="size-full rounded-[10px] bg-white [-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:100%_100%] sm:rounded-[30px] sm:[-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] sm:[mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)]" /></div>
                  <div className={activeStep === 2 ? "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-[#E9EBFF] text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold" : "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold"}>
                    2
                  </div>

                  {activeStep === 2 ? (
                    // OPEN / ACTIVE STATE
                    <div className="relative z-10 px-4 sm:pb-8 pb-6 pt-10 sm:px-10">
                      <h2 className="text-lg sm:text-xl sm:font-medium font-normal text-[#1f1f1f] mb-6 text-center">
                        Payment method
                      </h2>

                      <div className="card-options">
                        {/* Option 1: Credit / debit card */}
                        <div
                          className={`${paymentMethod === "card"}`}
                        >
                          <label className="flex items-center sm:gap-8 gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="card"
                              checked={paymentMethod === "card"}
                              onChange={() => setPaymentMethod("card")}
                              className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                            />
                            <span className="text-base font-semibold text-[#1f1f1f]">
                              Credit / debit card
                            </span>
                          </label>

                          {/* Card Inputs Form (shown when Credit card is active) */}
                          {paymentMethod === "card" && (
                            <div className="mt-6">
                              <div>
                                <label className="block text-sm font-normal text-[#1f1f1f] mb-2">
                                  Card Number *
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="1234 1234 1234 1234"
                                    value={cardNumber}
                                    onChange={handleCardNumberChange}
                                    className="w-full rounded-[8px] border border-[#727272] bg-white px-4 py-2.5 text-base text-[#1f1f1f] placeholder:text-[rgba(31, 31, 31, 0.5)] focus:border-zinc-900 focus:outline-none transition-colors sm:min-h-[56px]  min-h-[45px] "
                                  />
                                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                                    💳
                                  </span>
                                </div>
                              </div>

                              <div className="grid md:grid-cols-2 grid-cols-1 gap-3 mt-5">
                                <div>
                                  <label className="block text-sm font-normal text-[#1f1f1f] mb-2">
                                    Expiry Date *
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="mm/yy"
                                    value={expiryDate}
                                    onChange={handleExpiryChange}
                                    className="w-full rounded-[8px] border border-[#727272] bg-white px-4 py-2.5 text-base text-[#1f1f1f] placeholder:text-[rgba(31, 31, 31, 0.5)] focus:border-zinc-900 focus:outline-none transition-colors sm:min-h-[56px]  min-h-[45px] "
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-normal text-[#1f1f1f] mb-2">
                                    Card Code (CVC) *
                                  </label>
                                  <input
                                    type="password"
                                    inputMode="numeric"
                                    placeholder="CVC"
                                    value={cardCvc}
                                    onChange={handleCvcChange}
                                    className="w-full rounded-[8px] border border-[#727272] bg-white px-4 py-2.5 text-base text-[#1f1f1f] placeholder:text-[rgba(31, 31, 31, 0.5)] focus:border-zinc-900 focus:outline-none transition-colors sm:min-h-[56px]  min-h-[45px] "
                                  />
                                </div>
                              </div>

                              {cardError && (
                                <p className="text-xs font-medium text-red-600 mt-1">
                                  {cardError}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-6">
                          {/* Option 2: Apple Pay */}
                          <label
                            className={`flex items-center sm:gap-8 gap-3 sm:py-6 py-5 border-t border-[#727272] transition-all cursor-pointer ${paymentMethod === "apple_pay"}`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="apple_pay"
                              checked={paymentMethod === "apple_pay"}
                              onChange={() => setPaymentMethod("apple_pay")}
                              className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                            />
                            <div className="flex sm:flex-row flex-row-reverse items-center gap-3">
                              <Image src="/images/icons/ApplePay.svg" alt="" width={19} height={24} className="h-6 w-[19px]" />
                              <span className="text-base font-semibold text-[#1f1f1f]">Apple Pay</span>
                            </div>
                          </label>

                          {/* Option 3: Google Pay */}
                          <label
                            className={`flex items-center sm:gap-8 gap-3 sm:py-6 py-5 border-t border-[#727272] transition-all cursor-pointer ${paymentMethod === "google_pay"
                              }`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="google_pay"
                              checked={paymentMethod === "google_pay"}
                              onChange={() => setPaymentMethod("google_pay")}
                              className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                            />
                            <div className="flex sm:flex-row flex-row-reverse items-center gap-3">
                              <Image src="/images/icons/G.svg" alt="" width={20} height={20} className="size-5" />
                              <span className="text-base font-semibold text-[#1f1f1f]">Google Pay</span>
                            </div>
                          </label>

                          {/* Option 4: Local gateways */}
                          <label
                            className={`flex items-center sm:gap-8 gap-3 sm:py-6 py-5 border-t border-[#727272] transition-all cursor-pointer ${paymentMethod === "local"}`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="local"
                              checked={paymentMethod === "local"}
                              onChange={() => setPaymentMethod("local")}
                              className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[7px] checked:border-[#1F1F1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
                            />
                            <div className="flex sm:flex-row flex-col sm:items-center items-start sm:gap-3">
                              <span className="text-base font-semibold text-[#1f1f1f]">Local gateways</span>
                              <span className="text-xs text-zinc-400">(Mada, STC Pay, Tamara)</span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Next Button */}
                      <div className="flex justify-end mt-6">
                        <button
                          type="button"
                          onClick={handleStep2Next}
                          className="rounded-full bg-[#FCDF9C] hover:bg-[#1f1f1f] text-[#1f1f1f] border border-[#1f1f1f] hover:text-white font-medium px-8 py-2.5 sm:text-lg text-base transition-all duration-300 cursor-pointer sm:min-w-[136px] min-w-[100px] sm:min-h-[56px] min-h-[45px]"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : completedSteps.has(2) ? (
                    // COMPLETED / COLLAPSED STATE
                    <div className="relative z-10 flex sm:flex-nowrap flex-wrap sm:gap-0 gap-5 items-center justify-between px-6 pb-7.5 sm:pt-15 pt-10 min-h-[143px]">
                      <div>
                        <h3 className="text-lg sm:text-xl font-medium text-[#1f1f1f]">
                          Payment method
                        </h3>
                        <p className="text-base text-[#1f1f1f] mt-0.5 font-normal mt-1">
                          {paymentMethod === "card"
                            ? "Credit / debit card"
                            : paymentMethod === "apple_pay"
                              ? "Apple Pay"
                              : paymentMethod === "google_pay"
                                ? "Google Pay"
                                : "Local gateways"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveStep(2)}
                        className="rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-4 py-1.5 sm:text-lg text-base font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors duration-300 cursor-pointer min-w-[121px] min-h-[48px] ml-auto"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="relative z-10 flex min-h-[91px] items-center justify-center px-6 pt-10 pb-6 text-center sm:min-h-[108px]">
                      <span className="text-lg sm:text-base sm:font-medium font-normal text-[#1F1F1F]">
                        Payment method
                      </span>
                    </div>
                  )}
                </div>

                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 3: Write a message to the host */}
                {/* ────────────────────────────────────────────────────────── */}
                <div className="relative isolate">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-visible [filter:drop-shadow(0_2px_4px_rgb(0_0_0_/_20%))_drop-shadow(1px_0_3px_rgb(0_0_0_/_14%))]"><div className="size-full rounded-[10px] bg-white [-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:100%_100%] sm:rounded-[30px] sm:[-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] sm:[mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)]" /></div>
                  <div className={activeStep === 3 ? "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-[#E9EBFF] text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold" : "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold"}>
                    3
                  </div>

                  {activeStep === 3 ? (
                    // OPEN / ACTIVE STATE
                    <div className="relative z-10 px-4 sm:pb-8 pb-6 pt-10 sm:px-10">
                      <h2 className="text-lg sm:text-xl font-medium text-[#1F1F1F] mb-2 text-center">
                        Write a message to the host
                      </h2>
                      <p className="text-sm sm:text-base text-[#727272] text-left mb-4">
                        Before you can continue, let {hostName} know a little about your trip and why their place is a good fit.
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
                          <p className="text-sm text-[#1f1f1f] mt-1">
                            Superhost · {listing.host?.createdAt ? `${new Date().getFullYear() - new Date(listing.host.createdAt).getFullYear() || 1} years hosting` : "3 years hosting"}
                          </p>
                        </div>
                      </div>

                      {/* Message Textarea */}
                      <div>
                        <label className="block text-sm font-normal text-[#1f1f1f] mb-2">
                          Write a message
                        </label>
                        <textarea
                          rows={4}
                          value={hostMessage}
                          onChange={(e) => setHostMessage(e.target.value)}
                          placeholder={`Example: "Hi ${hostName}, I'm going to visit your place."`}
                          className="w-full sm:rounded-[20px] rounded-[10px] border border-[#727272] bg-white sm:p-4 p-3 sm:text-base text-sm text-[#1f1f1f] placeholder:text-[rgba(31,31,31,0.5)] focus:border-zinc-900 focus:outline-none transition-colors resize-none"
                        />
                      </div>

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
                        <h3 className="text-lg sm:text-xl font-medium text-[#1f1f1f]">
                          Write a message to the host
                        </h3>
                        <p className="text-base text-[#1f1f1f] mt-0.5 font-normal mt-1">
                          {hostMessage ? `"${hostMessage}"` : `“Hi ${hostName}, I'm going to visit your place.”`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveStep(3)}
                        className="rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-4 py-1.5 sm:text-lg text-base font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors duration-300 cursor-pointer min-w-[121px] min-h-[48px] ml-auto"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="relative z-10 flex min-h-[91px] items-center justify-center px-6 pt-10 pb-6 text-center sm:min-h-[108px]">
                      <span className="text-lg sm:text-base sm:font-medium font-normal text-[#1F1F1F]">
                        Write a message to the host
                      </span>
                    </div>
                  )}
                </div>

                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 4: Review your request */}
                {/* ────────────────────────────────────────────────────────── */}
                <div className="relative isolate">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-visible [filter:drop-shadow(0_2px_4px_rgb(0_0_0_/_20%))_drop-shadow(1px_0_3px_rgb(0_0_0_/_14%))]"><div className="size-full rounded-[10px] bg-white [-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:100%_100%] sm:rounded-[30px] sm:[-webkit-mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)] sm:[mask-image:radial-gradient(circle_30px_at_50%_0,transparent_29px,#000_30px)]" /></div>
                  <div className={activeStep === 4 ? "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-[#E9EBFF] text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold" : "absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-white text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold"}>
                    4
                  </div>

                  {activeStep === 4 ? (
                    // OPEN / ACTIVE STATE
                    <div className="relative z-10 px-4 sm:pb-8 pb-6 pt-10 sm:px-10">
                      <h2 className="text-lg sm:text-xl font-medium text-[#1f1f1f] mb-3 text-center">
                        Review your request
                      </h2>
                      <p className="text-base text-[#1f1f1f] mt-1 font-normal text-left leading-relaxed">
                        {listing.instantBook
                          ? "Your reservation will be confirmed instantly. You'll be charged now."
                          : "The host has 24 hours to confirm your booking. You'll be charged after the request is accepted."}
                      </p>

                      {quoteError && (
                        <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 text-center">
                          {quoteError}
                        </div>
                      )}

                      {submitError && (
                        <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 text-center">
                          {submitError}
                        </div>
                      )}

                      {bookingSuccess && (
                        <div role="status" className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-left animate-in fade-in">
                          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                            <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25"><path d="m3.25 8.25 2.8 2.8 6.7-6.7" /></svg>
                          </span>
                          <div className="min-w-0 pt-0.5">
                            <p className="text-sm font-semibold text-emerald-950">Reservation request submitted</p>
                            <p className="mt-0.5 text-xs leading-5 text-emerald-800">Taking you to your bookings now.</p>
                          </div>
                        </div>
                      )}

                      {!bookingSuccess && (
                        <>
                          {/* Pay CTA */}
                          <button
                            type="button"
                            onClick={handleFinalBooking}
                            disabled={isSubmitting || isQuoteLoading || !quote || Boolean(quoteError)}
                            className="w-full rounded-full bg-[#1f1f1f] hover:bg-[#FCDF9C] text-white hover:text-[#1f1f1f] border border-[#1f1f1f] font-semibold py-3.5 text-base sm:text-[18px] transition-all sm:mt-6 mt-5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? (
                              <>
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Processing payment...</span>
                              </>
                            ) : (
                              <span>Pay</span>
                            )}
                          </button>

                          <p className="text-sm text-[#727272] mt-4 text-center leading-relaxed">
                            By selecting the button above, I agree to the Host&apos;s House Rules, Ground Rules for Guests, and Homyz&apos;s Rebooking and Refund Policy.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="relative z-10 flex min-h-[91px] items-center justify-center px-6 pt-10 pb-6 text-center sm:min-h-[108px]">
                      <span className="text-lg sm:text-xl sm:font-medium font-normal text-[#1F1F1F]">
                        Review your request
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ======================================================== */}
              {/* RIGHT COLUMN: STICKY PROPERTY & PRICE SUMMARY (lg:col-span-5) */}
              {/* ======================================================== */}
              <div className="order-1 lg:order-2 lg:sticky lg:top-24">
                <div className="sm:rounded-[30px] rounded-[10px] border border-zinc-200 bg-white p-6 shadow-[0px_2px_4px_0px_#00000040,2px_0px_4px_0px_#00000040] sm:p-8">
                  {/* Property Header */}
                  <div>
                    <h3 className="text-xl font-medium text-[#1f1f1f]">
                      {propertyCategory} – {locationLabel}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-[#1f1f1f] mt-1">
                      <span className="flex items-center gap-2 font-normal text-[#1f1f1f]">
                        <Image src="/images/icons/star-fill.svg" alt="star-fill.svg" width={20} height={20} className="sm:w-5 sm:h-5 w-4 h-4" /> {typeof listing.rating === "number" && listing.rating > 0 ? listing.rating.toFixed(2) : "4.96"}
                        <span>
                          ({listing.reviewsCount || "xx"} review)
                        </span>
                      </span>
                      <span>|</span>
                      <span className="font-normal text-zinc-800 flex items-center sm:gap-1">
                        <Image src="/images/icons/leaves-fill-left.svg" alt="" width={15} height={23} className="h-4 w-auto" aria-hidden="true" />
                        <span>Guest favorite</span>
                        <Image src="/images/icons/leaves-fill-right.svg" alt="" width={15} height={23} className="h-4 w-auto" aria-hidden="true" />
                      </span>
                    </div>
                  </div>

                  {/* Property Photo */}
                  <div className="relative mt-4 h-48 sm:h-52 w-full sm:rounded-2xl rounded-[10px] overflow-hidden bg-zinc-100 border border-zinc-100 shadow-2xs">
                    {listing.photos && listing.photos.length > 0 ? (
                      <Image
                        src={listing.photos[0]}
                        alt={listing.title}
                        fill
                        className="object-cover"
                        priority
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-4xl">
                        🏡
                      </div>
                    )}
                  </div>

                  {/* Free cancellation */}
                  <div className="mt-5 pb-5 border-b border-[#727272]">
                    <h4 className="text-base font-semibold text-[#1f1f1f]">
                      Free cancellation
                    </h4>
                    <p className="text-sm font-normal text-[#727272] mt-1">
                      Cancel before {formatCancellationCutoff(checkIn)} for a full refund.{" "}
                      <button
                        type="button"
                        onClick={() => setIsPolicyModalOpen(true)}
                        className="underline font-normal text-[#1f1f1f] hover:text-[#727272] cursor-pointer"
                      >
                        Full policy
                      </button>
                    </p>
                  </div>

                  {/* Dates Row */}
                  <div className="sm:py-6 py-3.75 border-b border-[#727272] flex items-center justify-between">
                    <div>
                      <span className="block text-base font-semibold text-[#1f1f1f]">
                        Dates
                      </span>
                      <span className="text-sm text-[#727272] mt-0.5 block">
                        {formatDateRange(checkIn, checkOut)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDatesModalOpen(true)}
                      className="rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-4 py-1.5 sm:text-lg text-base font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors duration-300 cursor-pointer min-w-[121px] min-h-[48px]"
                    >
                      Change
                    </button>
                  </div>

                  {/* Guests Row */}
                  <div className="sm:py-6 py-3.75 border-b border-[#727272] flex items-center justify-between">
                    <div>
                      <span className="block text-base font-semibold text-[#1f1f1f]">
                        Guests
                      </span>
                      <span className="text-sm text-[#727272] mt-0.5 block">
                        {guestsCount} adult{guestsCount > 1 ? "s" : ""}
                        {petsCount > 0 ? `, ${petsCount} pet${petsCount > 1 ? "s" : ""}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsGuestsModalOpen(true)}
                      className="rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-4 py-1.5 sm:text-lg text-base font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors duration-300 cursor-pointer min-w-[121px] min-h-[48px]"
                    >
                      Change
                    </button>
                  </div>

                  {/* Price details */}
                  <div className="pt-5 pb-5 border-b border-[#727272] space-y-2.5">
                    <h4 className="text-base font-semibold text-[#1f1f1f] mb-1">
                      Price details
                    </h4>

                    {isQuoteLoading ? (
                      <div className="space-y-2 py-2 animate-pulse">
                        <div className="h-4 bg-zinc-100 rounded w-full" />
                        <div className="h-4 bg-zinc-100 rounded w-3/4" />
                      </div>
                    ) : quoteError ? (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                        {quoteError}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-sm text-[#727272]">
                          {quote?.isSpecialOffer ? (
                            <>
                              <span className="flex items-center gap-1.5 font-medium text-zinc-800">
                                <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                                  Special offer
                                </span>
                                <span>Accommodation ({nightsCount} night{nightsCount > 1 ? "s" : ""})</span>
                              </span>
                              <span className="font-medium text-zinc-900">
                                {formatMoney(effectiveNightlySubtotalMinor, true)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span>
                                {nightsCount} night{nightsCount > 1 ? "s" : ""} x {formatMoney(effectiveBaseNightlyMinor)}
                              </span>
                              <span className="font-medium text-zinc-900">
                                {formatMoney(effectiveNightlySubtotalMinor, true)}
                              </span>
                            </>
                          )}
                        </div>

                        {quote?.cleaningFee ? (
                          <div className="flex items-center justify-between text-sm text-[#727272]">
                            <span>Cleaning fee</span>
                            <span className="font-medium text-zinc-900">
                              {formatMoney(quote.cleaningFee, true)}
                            </span>
                          </div>
                        ) : null}

                        {quote?.extraGuestFee ? (
                          <div className="flex items-center justify-between text-sm text-[#727272]">
                            <span>Extra guest fee</span>
                            <span className="font-medium text-zinc-900">
                              {formatMoney(quote.extraGuestFee, true)}
                            </span>
                          </div>
                        ) : null}

                        {quote?.petFee ? (
                          <div className="flex items-center justify-between text-sm text-[#727272]">
                            <span>Pet fee</span>
                            <span className="font-medium text-zinc-900">
                              {formatMoney(quote.petFee, true)}
                            </span>
                          </div>
                        ) : null}

                        {quote?.hostServiceFee ? (
                          <div className="flex items-center justify-between text-sm text-[#727272]">
                            <span>Service fee</span>
                            <span className="font-medium text-zinc-900">
                              {formatMoney(quote.hostServiceFee, true)}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between text-sm text-[#727272]">
                          <span>Taxes</span>
                          <span className="font-medium text-zinc-900">
                            {formatMoney(effectiveTaxesMinor, true)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Total Row */}
                  <div className="pt-4 flex items-center justify-between">
                    <span className="text-sm sm:text-base font-semibold text-[#1f1f1f]">
                      Total <span className="underline decoration-zinc-400">{currencySymbol}</span>
                    </span>
                    <span className="text-sm sm:text-base font-bold text-zinc-950" aria-live="polite">
                      {checkoutTotalLabel}
                    </span>
                  </div>

                  <div className="mt-5 text-left">
                    <button
                      type="button"
                      onClick={() => setIsBreakdownModalOpen(true)}
                      className="text-base font-semibold text-[#1f1f1f] underline hover:text-[#727272] transition-colors cursor-pointer"
                    >
                      Price breakdown
                    </button>
                  </div>
                </div>
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
            className="w-full max-w-lg rounded-[30px] bg-white p-6 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[$727272]">
              <h3 className="text-lg font-medium text-[#1f1f1f]">Change dates</h3>
              <button
                type="button"
                onClick={() => setIsDatesModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-normal text-[#1f1f1f] mb-2">
                    Check-in date
                  </label>
                  <input
                    type="date"
                    value={checkIn}
                    min={dateKey(new Date())}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full rounded-[8px] border border-[#727272] p-2.5 text-sm font-semibold text-[#1f1f1f] focus:border-zinc-900 focus:outline-none sm:min-h-[56px] min-h-[45px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-normal text-[#1f1f1f] mb-2">
                    Check-out date
                  </label>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn || dateKey(new Date())}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full rounded-[8px] border border-[#727272] p-2.5 text-sm font-semibold text-[#1f1f1f] focus:border-zinc-900 focus:outline-none sm:min-h-[56px] min-h-[45px]"
                  />
                </div>
              </div>
              <p className="text-xs text-[#727272]">
                Minimum stay: {listing.minNights || 1} {listing.minNights === 1 ? "night" : "nights"}. Price and availability update automatically.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#727272]">
              <button
                type="button"
                onClick={() => setIsDatesModalOpen(false)}
                className="rounded-full border border-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white text-[#1f1f1f] font-semibold px-6 py-2.5 text-sm bg-[#FCDF9C] transition-colors cursor-pointer"
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
            className="w-full max-w-md rounded-[30px] bg-white p-6 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[$727272]">
              <h3 className="text-lg font-medium text-[#1f1f1f]">Guests</h3>
              <button
                type="button"
                onClick={() => setIsGuestsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="divide-y divide-[#727272]">
              {/* Adults */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="text-sm font-normal text-zinc-900">Adults</h4>
                  <p className="text-xs text-zinc-500">Age 13+</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={guestsCount <= 1}
                    onClick={() => setGuestsCount((g) => Math.max(1, g - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 hover:border-zinc-900 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums">
                    {guestsCount}
                  </span>
                  <button
                    type="button"
                    disabled={guestsCount >= (listing.guests || 16)}
                    onClick={() => setGuestsCount((g) => g + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 hover:border-zinc-900 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Pets */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="text-sm font-normal text-zinc-900">Pets</h4>
                  <p className="text-xs text-zinc-500">Service animals welcome</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={petsCount <= 0}
                    onClick={() => setPetsCount((p) => Math.max(0, p - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 hover:border-zinc-900 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums">
                    {petsCount}
                  </span>
                  <button
                    type="button"
                    disabled={petsCount >= 5}
                    onClick={() => setPetsCount((p) => p + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 hover:border-zinc-900 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#727272]">
              <button
                type="button"
                onClick={() => setIsGuestsModalOpen(false)}
                className="rounded-full border border-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white text-[#1f1f1f] font-semibold px-6 py-2.5 text-sm bg-[#FCDF9C] transition-colors cursor-pointer"
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
            className="w-full max-w-lg rounded-[30px] bg-white p-6 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[$727272]">
              <h3 className="text-lg font-medium text-[#1f1f1f]">Cancellation policy</h3>
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-4 text-sm text-zinc-700 leading-relaxed">
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                <h4 className="font-bold text-zinc-900 mb-1">
                  Full refund before {formatCancellationCutoff(checkIn)}
                </h4>
                <p className="text-xs text-zinc-500">
                  Cancel up to 72 hours before check-in for a full refund minus processing fees.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-zinc-900 text-xs uppercase tracking-wider mb-2">
                  Standard Terms
                </h5>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600">
                  <li>If you cancel less than 72 hours before check-in, the first night is non-refundable.</li>
                  <li>Cleanings fees are always refunded if the reservation is cancelled before check-in.</li>
                  <li>In the event of extenuating circumstances, special refund considerations may apply.</li>
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

      {/* ======================================================== */}
      {/* MODAL 4: PRICE BREAKDOWN MODAL (using ModalOverlay) */}
      {/* ======================================================== */}
      {isBreakdownModalOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsBreakdownModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[30px] bg-white p-6 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#727272]">
              <h3 className="text-lg font-medium text-[#1f1f1f]">Price breakdown</h3>
              <button
                type="button"
                onClick={() => setIsBreakdownModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 text-[#1f1f1f] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-3 text-sm text-zinc-700">
              <div className="flex justify-between">
                <span>
                  {quote?.isSpecialOffer
                    ? `Special offer accommodation (${nightsCount} night${nightsCount > 1 ? "s" : ""})`
                    : `Accommodation (${nightsCount} nights)`}
                </span>
                <span className="font-semibold text-zinc-900">
                  {formatMoney(effectiveNightlySubtotalMinor, true)}
                </span>
              </div>

              {quote?.cleaningFee ? (
                <div className="flex justify-between">
                  <span>Cleaning fee</span>
                  <span className="font-semibold text-zinc-900">
                    {formatMoney(quote.cleaningFee, true)}
                  </span>
                </div>
              ) : null}

              {quote?.extraGuestFee ? (
                <div className="flex justify-between">
                  <span>Extra guest fee</span>
                  <span className="font-semibold text-zinc-900">
                    {formatMoney(quote.extraGuestFee, true)}
                  </span>
                </div>
              ) : null}

              {quote?.petFee ? (
                <div className="flex justify-between">
                  <span>Pet fee</span>
                  <span className="font-semibold text-zinc-900">
                    {formatMoney(quote.petFee, true)}
                  </span>
                </div>
              ) : null}

              {quote?.hostServiceFee ? (
                <div className="flex justify-between">
                  <span>Service fee</span>
                  <span className="font-semibold text-zinc-900">
                    {formatMoney(quote.hostServiceFee, true)}
                  </span>
                </div>
              ) : null}

              <div className="flex justify-between">
                <span>Taxes</span>
                <span className="font-semibold text-zinc-900">
                  {formatMoney(effectiveTaxesMinor, true)}
                </span>
              </div>

              <div className="pt-3 border-t border-[#727272] flex justify-between font-semibold text-base text-[#1f1f1f]">
                <span>Total ({currencySymbol})</span>
                <span>{checkoutTotalLabel}</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[#727272]">
              <button
                type="button"
                onClick={() => setIsBreakdownModalOpen(false)}
                className="rounded-full border border-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white text-[#1f1f1f] font-semibold px-6 py-2.5 text-sm bg-[#FCDF9C] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
