"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { PublicListingDTO } from "@/services/mappers";
import { getCurrencyForCountry } from "@/lib/currency";

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
}

interface QuoteData {
  nights: number;
  baseNightlyPrice: number; // minor units
  nightlySubtotal: number;
  cleaningFee: number;
  extraGuestFee: number;
  taxes: Array<{ taxName: string; amount: number }>;
  taxTotal: number;
  subtotal: number;
  guestTotal: number;
  currency: string;
  cancellationPolicy: string;
}

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
}: BookingCheckoutClientProps) {
  const router = useRouter();
  const { data: session } = useSession();

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
  const currencySymbol = currencyCode === "SAR" ? "SR" : currencyCode;

  // Format currency helpers
  const formatMoney = (minorAmount: number, withDecimals = false) => {
    const value = minorAmount / 100;
    return `${currencySymbol} ${value.toLocaleString("en-US", {
      minimumFractionDigits: withDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    })}`;
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

    fetch(
      `/api/v1/listings/${listing.id}/quote?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guestsCount}&pets=${petsCount}&nonRefundable=${isNonRefundable}`,
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
      })
      .finally(() => {
        if (isCurrent) setIsQuoteLoading(false);
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [listing.id, checkIn, checkOut, guestsCount, petsCount, isNonRefundable]);

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
      const returnUrl = encodeURIComponent(
        `/book/${listing.customSlug || listing.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guestsCount}&pets=${petsCount}`,
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
          message: hostMessage.trim() || undefined,
          paymentPlan: paymentPlan.toUpperCase(),
          paymentMethod: paymentMethod.toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        if (res.status === 401) {
          const returnUrl = encodeURIComponent(
            `/book/${listing.customSlug || listing.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guestsCount}&pets=${petsCount}`,
          );
          router.push(`/login?returnUrl=${returnUrl}`);
          return;
        }
        setSubmitError(data.error?.message || "Failed to confirm reservation. Please try again.");
      } else {
        setBookingSuccess(true);
        setTimeout(() => {
          router.push("/bookings");
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

      <main className="w-full flex-1 pb-24 pt-6 sm:pt-8">
        <Container>
          <div className="mx-auto max-w-[1140px]">
            {/* Top Navigation Bar: Back Button & Page Title */}
            <div className="flex items-center gap-4 mb-8">
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
              <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-zinc-900">
                Request to book
              </h1>
            </div>

            {/* Main Content Layout: 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* ======================================================== */}
              {/* LEFT COLUMN: 4 PROGRESSIVE ACCORDION STEPS (lg:col-span-7) */}
              {/* ======================================================== */}
              <div className="lg:col-span-7 space-y-6">
                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 1: Choose when to pay */}
                {/* ────────────────────────────────────────────────────────── */}
                <div className="relative">
                  {/* Step Number Badge */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs font-semibold text-zinc-800 shadow-2xs">
                    1
                  </div>

                  {activeStep === 1 ? (
                    // OPEN / ACTIVE STATE
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-6 pt-7 shadow-xs">
                      <h2 className="text-base sm:text-lg font-bold text-zinc-900 mb-6 text-center">
                        Choose when to pay
                      </h2>

                      <div className="space-y-4">
                        {/* Option 1: Pay now */}
                        <label
                          className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                            paymentPlan === "now"
                              ? "border-zinc-900 bg-zinc-50/50 ring-1 ring-zinc-900"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentPlan"
                            value="now"
                            checked={paymentPlan === "now"}
                            onChange={() => setPaymentPlan("now")}
                            className="mt-1 h-4 w-4 text-zinc-900 focus:ring-zinc-900 accent-zinc-900 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-zinc-900">
                              Pay {formatMoney(effectiveTotalMinor)} now
                            </span>
                          </div>
                        </label>

                        {/* Option 2: Pay part now, part later */}
                        <label
                          className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                            paymentPlan === "part"
                              ? "border-zinc-900 bg-zinc-50/50 ring-1 ring-zinc-900"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentPlan"
                            value="part"
                            checked={paymentPlan === "part"}
                            onChange={() => setPaymentPlan("part")}
                            className="mt-1 h-4 w-4 text-zinc-900 focus:ring-zinc-900 accent-zinc-900 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-zinc-900 block">
                              Pay part now, part lather
                            </span>
                            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                              {formatMoney(partNowMinor)} now, {formatMoney(partLaterMinor)} will be charged on {formatPartPaymentDate(checkIn)}. No extra fees.{" "}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIsBreakdownModalOpen(true);
                                }}
                                className="underline font-medium text-zinc-700 hover:text-zinc-900"
                              >
                                More info
                              </button>
                            </p>
                          </div>
                        </label>

                        {/* Option 3: Klarna */}
                        <label
                          className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                            paymentPlan === "klarna"
                              ? "border-zinc-900 bg-zinc-50/50 ring-1 ring-zinc-900"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentPlan"
                            value="klarna"
                            checked={paymentPlan === "klarna"}
                            onChange={() => setPaymentPlan("klarna")}
                            className="mt-1 h-4 w-4 text-zinc-900 focus:ring-zinc-900 accent-zinc-900 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-zinc-900 block">
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
                                className="underline font-medium text-zinc-700 hover:text-zinc-900"
                              >
                                More info
                              </button>
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Next Button */}
                      <div className="flex justify-end mt-6">
                        <button
                          type="button"
                          onClick={handleStep1Next}
                          className="rounded-full bg-[#fee09a] hover:bg-[#fbd775] text-zinc-900 font-bold px-8 py-2.5 text-sm transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : completedSteps.has(1) ? (
                    // COMPLETED / COLLAPSED STATE
                    <div className="rounded-[28px] border border-zinc-200 bg-white px-6 py-4.5 pt-5 flex items-center justify-between shadow-2xs">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-zinc-900">
                          Choose when to pay
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5 font-medium">
                          {paymentPlan === "now"
                            ? `Pay ${formatMoney(effectiveTotalMinor)} now`
                            : paymentPlan === "part"
                            ? `Pay part now (${formatMoney(partNowMinor)}), part later`
                            : "Pay over time, with Klarna"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveStep(1)}
                        className="rounded-full border border-zinc-300 bg-white px-5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-800 hover:border-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-4.5 pt-5 text-center shadow-2xs">
                      <span className="text-sm sm:text-base font-semibold text-zinc-700">
                        Choose when to pay
                      </span>
                    </div>
                  )}
                </div>

                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 2: Payment method */}
                {/* ────────────────────────────────────────────────────────── */}
                <div className="relative">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs font-semibold text-zinc-800 shadow-2xs">
                    2
                  </div>

                  {activeStep === 2 ? (
                    // OPEN / ACTIVE STATE
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-6 pt-7 shadow-xs">
                      <h2 className="text-base sm:text-lg font-bold text-zinc-900 mb-6 text-center">
                        Payment method
                      </h2>

                      <div className="space-y-4">
                        {/* Option 1: Credit / debit card */}
                        <div
                          className={`rounded-2xl border p-4 transition-all ${
                            paymentMethod === "card"
                              ? "border-zinc-900 bg-zinc-50/50 ring-1 ring-zinc-900"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <label className="flex items-center gap-4 cursor-pointer">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="card"
                              checked={paymentMethod === "card"}
                              onChange={() => setPaymentMethod("card")}
                              className="h-4 w-4 text-zinc-900 focus:ring-zinc-900 accent-zinc-900 cursor-pointer"
                            />
                            <span className="text-sm font-bold text-zinc-900">
                              Credit / debit card
                            </span>
                          </label>

                          {/* Card Inputs Form (shown when Credit card is active) */}
                          {paymentMethod === "card" && (
                            <div className="mt-4 pt-4 border-t border-zinc-200/80 space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-zinc-700 mb-1">
                                  Card Number *
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="1234 1234 1234 1234"
                                    value={cardNumber}
                                    onChange={handleCardNumberChange}
                                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none transition-colors"
                                  />
                                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                                    💳
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                                    Expiry Date *
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="mm/yy"
                                    value={expiryDate}
                                    onChange={handleExpiryChange}
                                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none transition-colors"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                                    Card Code (CVC) *
                                  </label>
                                  <input
                                    type="password"
                                    inputMode="numeric"
                                    placeholder="CVC"
                                    value={cardCvc}
                                    onChange={handleCvcChange}
                                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none transition-colors"
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

                        {/* Option 2: Apple Pay */}
                        <label
                          className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                            paymentMethod === "apple_pay"
                              ? "border-zinc-900 bg-zinc-50/50 ring-1 ring-zinc-900"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="apple_pay"
                            checked={paymentMethod === "apple_pay"}
                            onChange={() => setPaymentMethod("apple_pay")}
                            className="h-4 w-4 text-zinc-900 focus:ring-zinc-900 accent-zinc-900 cursor-pointer"
                          />
                          <div className="flex items-center gap-2">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.85c.67-.82 1.13-1.96 1-3.1-.98.04-2.17.65-2.87 1.47-.62.72-1.16 1.88-1.01 2.99 1.1.08 2.22-.54 2.88-1.36z" />
                            </svg>
                            <span className="text-sm font-bold text-zinc-900">Apple Pay</span>
                          </div>
                        </label>

                        {/* Option 3: Google Pay */}
                        <label
                          className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                            paymentMethod === "google_pay"
                              ? "border-zinc-900 bg-zinc-50/50 ring-1 ring-zinc-900"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="google_pay"
                            checked={paymentMethod === "google_pay"}
                            onChange={() => setPaymentMethod("google_pay")}
                            className="h-4 w-4 text-zinc-900 focus:ring-zinc-900 accent-zinc-900 cursor-pointer"
                          />
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-900 flex items-center gap-1">
                              <span className="text-blue-500 font-extrabold">G</span>
                              <span>Pay</span>
                            </span>
                          </div>
                        </label>

                        {/* Option 4: Local gateways */}
                        <label
                          className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                            paymentMethod === "local"
                              ? "border-zinc-900 bg-zinc-50/50 ring-1 ring-zinc-900"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="local"
                            checked={paymentMethod === "local"}
                            onChange={() => setPaymentMethod("local")}
                            className="h-4 w-4 text-zinc-900 focus:ring-zinc-900 accent-zinc-900 cursor-pointer"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-900">Local gateways</span>
                            <span className="text-xs text-zinc-400">(Mada, STC Pay, Tamara)</span>
                          </div>
                        </label>
                      </div>

                      {/* Next Button */}
                      <div className="flex justify-end mt-6">
                        <button
                          type="button"
                          onClick={handleStep2Next}
                          className="rounded-full bg-[#fee09a] hover:bg-[#fbd775] text-zinc-900 font-bold px-8 py-2.5 text-sm transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : completedSteps.has(2) ? (
                    // COMPLETED / COLLAPSED STATE
                    <div className="rounded-[28px] border border-zinc-200 bg-white px-6 py-4.5 pt-5 flex items-center justify-between shadow-2xs">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-zinc-900">
                          Payment method
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5 font-medium">
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
                        className="rounded-full border border-zinc-300 bg-white px-5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-800 hover:border-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-4.5 pt-5 text-center shadow-2xs">
                      <span className="text-sm sm:text-base font-semibold text-zinc-700">
                        Payment method
                      </span>
                    </div>
                  )}
                </div>

                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 3: Write a message to the host */}
                {/* ────────────────────────────────────────────────────────── */}
                <div className="relative">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs font-semibold text-zinc-800 shadow-2xs">
                    3
                  </div>

                  {activeStep === 3 ? (
                    // OPEN / ACTIVE STATE
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-6 pt-7 shadow-xs">
                      <h2 className="text-base sm:text-lg font-bold text-zinc-900 mb-2 text-center">
                        Write a message to the host
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-500 text-center max-w-md mx-auto mb-6">
                        Before you can continue, let {hostName} know a little about your trip and why their place is a good fit.
                      </p>

                      {/* Host Snippet Card */}
                      <div className="flex items-center gap-3.5 mb-5 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-100">
                        <div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden bg-zinc-200 border border-zinc-200">
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
                          <h4 className="text-sm font-bold text-zinc-900">
                            Hosted by {hostName}
                          </h4>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Superhost · {listing.host?.createdAt ? `${new Date().getFullYear() - new Date(listing.host.createdAt).getFullYear() || 1} years hosting` : "3 years hosting"}
                          </p>
                        </div>
                      </div>

                      {/* Message Textarea */}
                      <div>
                        <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
                          Write a message
                        </label>
                        <textarea
                          rows={4}
                          value={hostMessage}
                          onChange={(e) => setHostMessage(e.target.value)}
                          placeholder={`Example: "Hi ${hostName}, I'm going to visit your place."`}
                          className="w-full rounded-2xl border border-zinc-300 bg-white p-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none transition-colors resize-none"
                        />
                      </div>

                      {/* Next Button */}
                      <div className="flex justify-end mt-6">
                        <button
                          type="button"
                          onClick={handleStep3Next}
                          className="rounded-full bg-[#fee09a] hover:bg-[#fbd775] text-zinc-900 font-bold px-8 py-2.5 text-sm transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : completedSteps.has(3) ? (
                    // COMPLETED / COLLAPSED STATE
                    <div className="rounded-[28px] border border-zinc-200 bg-white px-6 py-4.5 pt-5 flex items-center justify-between shadow-2xs">
                      <div className="min-w-0 pr-4">
                        <h3 className="text-sm sm:text-base font-bold text-zinc-900">
                          Write a message to the host
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5 font-medium truncate max-w-sm">
                          {hostMessage ? `"${hostMessage}"` : `“Hi ${hostName}, I'm going to visit your place.”`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveStep(3)}
                        className="rounded-full border border-zinc-300 bg-white px-5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-800 hover:border-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-4.5 pt-5 text-center shadow-2xs">
                      <span className="text-sm sm:text-base font-semibold text-zinc-700">
                        Write a message to the host
                      </span>
                    </div>
                  )}
                </div>

                {/* ────────────────────────────────────────────────────────── */}
                {/* STEP 4: Review your request */}
                {/* ────────────────────────────────────────────────────────── */}
                <div className="relative">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs font-semibold text-zinc-800 shadow-2xs">
                    4
                  </div>

                  {activeStep === 4 ? (
                    // OPEN / ACTIVE STATE
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-6 pt-7 shadow-xs">
                      <h2 className="text-base sm:text-lg font-bold text-zinc-900 mb-3 text-center">
                        Review your request
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-600 text-center max-w-md mx-auto leading-relaxed">
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
                        <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-bold text-emerald-800 text-center animate-in fade-in">
                          🎉 Reservation request submitted successfully! Redirecting to your bookings...
                        </div>
                      )}

                      {/* Pay CTA */}
                      <button
                        type="button"
                        onClick={handleFinalBooking}
                        disabled={isSubmitting || bookingSuccess || isQuoteLoading || !quote || Boolean(quoteError)}
                        className="w-full rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3.5 text-sm sm:text-base transition-all shadow-md mt-6 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
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

                      <p className="text-[11px] text-zinc-400 mt-4 text-center leading-relaxed">
                        By selecting the button above, I agree to the Host&apos;s House Rules, Ground Rules for Guests, and Homyz&apos;s Rebooking and Refund Policy.
                      </p>
                    </div>
                  ) : (
                    // INACTIVE COLLAPSED PILL
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-4.5 pt-5 text-center shadow-2xs">
                      <span className="text-sm sm:text-base font-semibold text-zinc-700">
                        Review your request
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ======================================================== */}
              {/* RIGHT COLUMN: STICKY PROPERTY & PRICE SUMMARY (lg:col-span-5) */}
              {/* ======================================================== */}
              <div className="lg:col-span-5 lg:sticky lg:top-24">
                <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
                  {/* Property Header */}
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">
                      {propertyCategory} – {locationLabel}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 mt-1">
                      <span className="flex items-center gap-1 font-semibold text-zinc-800">
                        ★ {typeof listing.rating === "number" && listing.rating > 0 ? listing.rating.toFixed(2) : "4.96"}
                        <span className="text-zinc-500 font-normal">
                          ({listing.reviewsCount || "xx"} review)
                        </span>
                      </span>
                      <span>|</span>
                      <span className="font-semibold text-zinc-800 flex items-center gap-1">
                        <span>🌿</span> Guest favorite
                      </span>
                    </div>
                  </div>

                  {/* Property Photo */}
                  <div className="relative mt-4 h-48 sm:h-52 w-full rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-100 shadow-2xs">
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
                  <div className="mt-5 pb-5 border-b border-zinc-200/80">
                    <h4 className="text-sm font-bold text-zinc-900">
                      Free cancellation
                    </h4>
                    <p className="text-xs text-zinc-500 mt-1">
                      Cancel before {formatCancellationCutoff(checkIn)} for a full refund.{" "}
                      <button
                        type="button"
                        onClick={() => setIsPolicyModalOpen(true)}
                        className="underline font-medium text-zinc-800 hover:text-zinc-950 cursor-pointer"
                      >
                        Full policy
                      </button>
                    </p>
                  </div>

                  {/* Dates Row */}
                  <div className="py-4 border-b border-zinc-200/80 flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-zinc-900">
                        Dates
                      </span>
                      <span className="text-xs text-zinc-500 mt-0.5 block">
                        {formatDateRange(checkIn, checkOut)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDatesModalOpen(true)}
                      className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-semibold text-zinc-800 hover:border-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* Guests Row */}
                  <div className="py-4 border-b border-zinc-200/80 flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-zinc-900">
                        Guests
                      </span>
                      <span className="text-xs text-zinc-500 mt-0.5 block">
                        {guestsCount} adult{guestsCount > 1 ? "s" : ""}
                        {petsCount > 0 ? `, ${petsCount} pet${petsCount > 1 ? "s" : ""}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsGuestsModalOpen(true)}
                      className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-semibold text-zinc-800 hover:border-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* Price details */}
                  <div className="pt-5 pb-5 border-b border-zinc-200/80 space-y-2.5">
                    <h4 className="text-sm font-bold text-zinc-900 mb-1">
                      Price details
                    </h4>

                    {isQuoteLoading ? (
                      <div className="space-y-2 py-2 animate-pulse">
                        <div className="h-4 bg-zinc-100 rounded w-full" />
                        <div className="h-4 bg-zinc-100 rounded w-3/4" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs text-zinc-700">
                          <span>
                            {nightsCount} night{nightsCount > 1 ? "s" : ""} x {formatMoney(effectiveBaseNightlyMinor)}
                          </span>
                          <span className="font-medium text-zinc-900">
                            {formatMoney(effectiveNightlySubtotalMinor, true)}
                          </span>
                        </div>

                        {quote?.cleaningFee ? (
                          <div className="flex items-center justify-between text-xs text-zinc-700">
                            <span>Cleaning fee</span>
                            <span className="font-medium text-zinc-900">
                              {formatMoney(quote.cleaningFee, true)}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between text-xs text-zinc-700">
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
                    <span className="text-sm sm:text-base font-bold text-zinc-900">
                      Total <span className="underline decoration-zinc-400">{currencySymbol}</span>
                    </span>
                    <span className="text-sm sm:text-base font-bold text-zinc-950">
                      {formatMoney(effectiveTotalMinor, true)}
                    </span>
                  </div>

                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => setIsBreakdownModalOpen(true)}
                      className="text-xs font-semibold text-zinc-800 underline hover:text-zinc-950 transition-colors cursor-pointer"
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
            className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-900">Change dates</h3>
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
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Check-in date
                  </label>
                  <input
                    type="date"
                    value={checkIn}
                    min={dateKey(new Date())}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Check-out date
                  </label>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn || dateKey(new Date())}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Minimum stay: {listing.minNights || 1} {listing.minNights === 1 ? "night" : "nights"}. Price and availability update automatically.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsDatesModalOpen(false)}
                className="rounded-full bg-zinc-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-zinc-800 transition-colors cursor-pointer"
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
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-900">Guests</h3>
              <button
                type="button"
                onClick={() => setIsGuestsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-5 divide-y divide-zinc-100">
              {/* Adults */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900">Adults</h4>
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
              <div className="flex items-center justify-between pt-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900">Pets</h4>
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

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsGuestsModalOpen(false)}
                className="rounded-full bg-zinc-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-zinc-800 transition-colors cursor-pointer"
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
            className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-900">Cancellation policy</h3>
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
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-900">Price breakdown</h3>
              <button
                type="button"
                onClick={() => setIsBreakdownModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-3 text-sm text-zinc-700">
              <div className="flex justify-between">
                <span>Accommodation ({nightsCount} nights)</span>
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

              <div className="flex justify-between">
                <span>Estimated taxes (VAT 10%)</span>
                <span className="font-semibold text-zinc-900">
                  {formatMoney(effectiveTaxesMinor, true)}
                </span>
              </div>

              <div className="pt-3 border-t border-zinc-200 flex justify-between font-bold text-base text-zinc-950">
                <span>Total ({currencySymbol})</span>
                <span>{formatMoney(effectiveTotalMinor, true)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsBreakdownModalOpen(false)}
                className="rounded-full bg-zinc-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-zinc-800 transition-colors cursor-pointer"
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

