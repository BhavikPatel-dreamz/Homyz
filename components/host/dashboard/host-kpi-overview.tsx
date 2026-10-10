"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { HostDashboardData } from "@/services/host-dashboard.service";
import type { ListingDTO } from "@/services/mappers";
import { useLanguage } from "@/lib/i18n/language-context";

interface HostKpiOverviewProps {
  initialData?: HostDashboardData | null;
  appliedPropertyId?: string | null;
  listings?: ListingDTO[];
  onSelectBookingId?: (bookingId: string) => void;
}

const primaryKpiGridClass =
  "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4";
const secondaryKpiGridClass =
  "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
const cardClass =
  "flex flex-col justify-between rounded-[12px] border border-white bg-[#F3F4F5] shadow-[0_2px_4px_0px_#00000040]";
const insetSurfaceClass = "rounded-[10px] bg-white/70";
const dashboardDataCache = new Map<string, HostDashboardData>();

function dashboardScopeKey(listingId: string | null | undefined) {
  return listingId ?? "all-properties";
}

function formatCurrency(cents: number, currency = "SAR") {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatResponseTime(minutes: number | null, t: (key: any, fallback?: string) => string) {
  if (minutes === null) return t("host_dash_no_inquiries", "No inquiries yet");
  if (minutes < 60) return `${minutes} ${t("host_dash_time_min", "min")}`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins
    ? `${hours}${t("host_dash_time_h", "h")} ${remainingMins}${t("host_dash_time_m", "m")}`
    : `${hours}${t("host_dash_time_h", "h")}`;
}

export function HostKpiOverview({
  initialData,
  appliedPropertyId,
  listings = [],
  onSelectBookingId,
}: HostKpiOverviewProps) {
  const { t } = useLanguage();
  const [data, setData] = useState<HostDashboardData | null>(
    initialData || null,
  );
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    appliedPropertyId || null,
  );
  const [loading, setLoading] = useState(() => !initialData);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [dataScopeKey, setDataScopeKey] = useState(() =>
    dashboardScopeKey(appliedPropertyId),
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitialMount = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const scopeKey = dashboardScopeKey(selectedPropertyId);
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialData) {
        dashboardDataCache.set(scopeKey, initialData);
        return;
      }
    }

    abortControllerRef.current?.abort();
    const cachedData = dashboardDataCache.get(scopeKey);
    if (cachedData) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    const query = selectedPropertyId
      ? `?listingId=${encodeURIComponent(selectedPropertyId)}`
      : "";

    fetch(`/api/v1/host/dashboard${query}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error?.message || "Failed to load dashboard metrics",
          );
        }
        return res.json();
      })
      .then((payload) => {
        if (
          requestId !== requestIdRef.current ||
          !payload?.success ||
          !payload?.data
        )
          return;
        dashboardDataCache.set(scopeKey, payload.data);
        setData(payload.data);
        setDataScopeKey(scopeKey);
      })
      .catch((err) => {
        if (requestId === requestIdRef.current && err.name !== "AbortError") {
          setError(err.message || "Unable to refresh dashboard metrics");
        }
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });

    return () => controller.abort();
  }, [selectedPropertyId, initialData, reloadVersion]);

  const kpis = data?.kpis;
  const propertyOptions =
    listings.length > 0
      ? listings.map((listing) => ({ id: listing.id, title: listing.title }))
      : (initialData?.listingHealth.listings ?? []).map((listing) => ({
          id: listing.listingId,
          title: listing.title,
        }));
  const currentListing = selectedPropertyId
    ? propertyOptions.find((listing) => listing.id === selectedPropertyId)
    : null;
  const selectedScopeKey = dashboardScopeKey(selectedPropertyId);
  const isRefreshing = loading || dataScopeKey !== selectedScopeKey;
  const retryPropertyAnalytics = () => {
    dashboardDataCache.delete(selectedScopeKey);
    setError(null);
    setLoading(true);
    setReloadVersion((version) => version + 1);
  };

  if (!kpis && loading) return <HostDashboardOverviewSkeleton />;
  if (!kpis && error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        <p className="font-medium">Could not load performance metrics</p>
        <p className="mt-1 text-xs text-red-700">{error}</p>
      </div>
    );
  }
  if (!kpis || !data) return null;

  const {
    earnings,
    guestAnalytics,
    guestFavoriteSummary,
    listingHealth,
    reviews,
    superhostEvaluation,
  } = data;
  const selectedHealthListing = selectedPropertyId
    ? listingHealth.listings.find(
        (listing) => listing.listingId === selectedPropertyId,
      )
    : listingHealth.listings[0];
  const selectedFavorite = selectedPropertyId
    ? guestFavoriteSummary.find(
        (listing) => listing.listingId === selectedPropertyId,
      )
    : guestFavoriteSummary[0];
  const officialGuestFavorites = guestFavoriteSummary.filter(
    (listing) => listing.officialStatus,
  ).length;

  return (
    <section
      aria-label="Host performance and earnings summary"
      className="mx-auto mb-10 w-full font-sans"
    >
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[#1F1F1F]/10 pb-5 sm:mb-8">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#727272]">
            Hosting dashboard
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#1F1F1F] sm:text-4xl">
            {t("host_dash_header_title", "Performance overview")}
          </h1>
          <p className="mt-1.5 text-sm text-[#727272] sm:text-base">
            {currentListing ? currentListing.title : t("host_dash_all_properties", "All properties")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {propertyOptions.length > 1 && (
            <label className="text-xs font-medium text-[#727272]">
              <span className="sr-only">Property</span>
              <select
                aria-label="Filter dashboard by property"
                value={selectedPropertyId ?? ""}
                onChange={(event) => {
                  const nextPropertyId = event.target.value || null;
                  const cachedData = dashboardDataCache.get(
                    dashboardScopeKey(nextPropertyId),
                  );
                  setError(null);
                  setSelectedPropertyId(nextPropertyId);
                  if (cachedData) {
                    setData(cachedData);
                    setDataScopeKey(dashboardScopeKey(nextPropertyId));
                    setLoading(false);
                  } else {
                    setLoading(true);
                  }
                }}
                className="h-10 min-w-40 rounded-full border border-[#1F1F1F] bg-white px-4 text-sm font-medium text-[#1F1F1F] outline-none transition-colors hover:bg-[#FCDF9C] focus:border-[#1F1F1F] focus:ring-2 focus:ring-[#FCDF9C]"
              >
                <option value="">All properties</option>
                {propertyOptions.map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {loading && (
            <span
              role="status"
              aria-label="Updating property analytics"
              className="size-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"
            />
          )}
        </div>
      </header>

      {error && dataScopeKey !== selectedScopeKey && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <span>Couldn’t refresh analytics for this property.</span>
          <button
            type="button"
            onClick={retryPropertyAnalytics}
            className="font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      <div className={primaryKpiGridClass}>
        <PrimaryKpi
          refreshing={isRefreshing}
          label="Monthly earnings"
          period={kpis.monthlyEarnings.periodLabel}
          value={formatCurrency(
            kpis.monthlyEarnings.amountCents,
            kpis.monthlyEarnings.currency,
          )}
          detail={
            kpis.monthlyEarnings.changePercentage === null
              ? "Completed stays this month"
              : `${kpis.monthlyEarnings.changePercentage >= 0 ? "↑" : "↓"} ${Math.abs(kpis.monthlyEarnings.changePercentage)}% vs last month`
          }
          detailTone={
            kpis.monthlyEarnings.changePercentage === null
              ? undefined
              : kpis.monthlyEarnings.changePercentage >= 0
                ? "positive"
                : "negative"
          }
        />
        <PrimaryKpi
          refreshing={isRefreshing}
          label="Year-to-date earnings"
          period={kpis.ytdEarnings.periodLabel}
          value={formatCurrency(
            kpis.ytdEarnings.amountCents,
            kpis.ytdEarnings.currency,
          )}
          detail="Completed stay payouts"
        />
        <PrimaryKpi
          refreshing={isRefreshing}
          label="Upcoming payouts"
          period={`${kpis.upcomingPayout.count} ${kpis.upcomingPayout.count === 1 ? "reservation" : "reservations"}`}
          value={formatCurrency(
            kpis.upcomingPayout.totalUpcomingAmountCents,
            kpis.upcomingPayout.currency,
          )}
          detail={
            kpis.upcomingPayout.nextPayoutAmountCents === null
              ? "No eligible upcoming payout"
              : `Next: ${formatCurrency(kpis.upcomingPayout.nextPayoutAmountCents, kpis.upcomingPayout.currency)}`
          }
        />
        <PrimaryKpi
          refreshing={isRefreshing}
          label="Occupancy"
          period={kpis.occupancy.periodLabel}
          value={`${kpis.occupancy.ratePercentage}%`}
          detail={`${kpis.occupancy.bookedNights} booked of ${kpis.occupancy.totalBookableNights} nights`}
          progress={kpis.occupancy.ratePercentage}
        />
      </div>

      <div className={`mt-3 ${secondaryKpiGridClass}`}>
        <SecondaryKpi
          refreshing={isRefreshing}
          label="Booked vs available"
          value={`${kpis.occupancy.bookedNights} / ${kpis.occupancy.availableNights}`}
          detail="Last 30 days"
        />
        <SecondaryKpi
          refreshing={isRefreshing}
          label="Avg booking value"
          value={formatCurrency(
            kpis.averageBookingValue.hostPayoutCents ?? 0,
            kpis.averageBookingValue.currency,
          )}
          detail="Net payout per stay"
        />
        <SecondaryKpi
          refreshing={isRefreshing}
          label="Avg stay"
          value={`${kpis.averageStayLength.nights} ${kpis.averageStayLength.nights === 1 ? "night" : "nights"}`}
          detail="Completed stays"
        />
        <SecondaryKpi
          refreshing={isRefreshing}
          label="Cancellation rate"
          value={`${kpis.cancellationRate.overallPercentage}%`}
          detail={`Host: ${kpis.cancellationRate.hostPercentage}%`}
        />
        <SecondaryKpi
          refreshing={isRefreshing}
          label="Guest rating"
          value={
            kpis.averageRating.overallRating === null
              ? "—"
              : `★ ${kpis.averageRating.overallRating.toFixed(2)}`
          }
          detail={`${kpis.averageRating.totalReviewsCount} ${kpis.averageRating.totalReviewsCount === 1 ? "review" : "reviews"}`}
        />
      </div>

      <details className={`group mt-4 ${cardClass} px-4 py-3.5 sm:px-5`}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-base font-medium text-[#1F1F1F] sm:items-center sm:gap-4 [&::-webkit-details-marker]:hidden">
          <span>Detailed earnings</span>
          <span className="ml-auto flex shrink-0 items-center gap-2 text-xs font-normal text-[#727272] sm:gap-3">
            {isRefreshing ? (
              <span className="h-3 w-28 animate-pulse rounded bg-zinc-100" />
            ) : (
              <span className="hidden min-[400px]:inline">
                Net payout{" "}
                {formatCurrency(
                  earnings.itemizedBreakdown.netHostPayoutCents,
                  earnings.currency,
                )}
              </span>
            )}
            <span className="flex size-8 items-center justify-center rounded-full bg-white text-xl shadow-sm transition-all duration-200 group-open:rotate-45 group-hover:bg-[#1F1F1F] group-hover:text-white">
              +
            </span>
          </span>
        </summary>
        <div className="mt-3 border-t border-[#1F1F1F]/10 pt-4">
          {isRefreshing ? (
            <EarningsDetailsSkeleton />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                {[
                  [
                    "Accommodation",
                    earnings.itemizedBreakdown.accommodationSubtotalCents,
                  ],
                  [
                    "Cleaning fees",
                    earnings.itemizedBreakdown.cleaningFeeCents,
                  ],
                  [
                    "Extra guest fees",
                    earnings.itemizedBreakdown.extraGuestFeeCents,
                  ],
                  ["Pet fees", earnings.itemizedBreakdown.petFeeCents],
                  [
                    "Host service fee",
                    -earnings.itemizedBreakdown.hostServiceFeeCents,
                  ],
                  [
                    "Host-collected taxes",
                    earnings.itemizedBreakdown.taxesCollectedForHostCents,
                  ],
                ].map(([label, amount]) => (
                  <div key={String(label)}>
                    <dt className="text-xs text-[#727272]">{label}</dt>
                    <dd className="mt-0.5 font-semibold text-[#1F1F1F]">
                      {formatCurrency(Number(amount), earnings.currency)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-[#727272]">
                Recorded refunds:{" "}
                {formatCurrency(
                  earnings.refunds.amountCents,
                  earnings.currency,
                )}{" "}
                ({earnings.refunds.count}) · Payment-pending bookings excluded:{" "}
                {earnings.bookingsExcludedForPaymentStatusCount} · Adjustments:{" "}
                {earnings.adjustments.status === "DATA_UNAVAILABLE"
                  ? "unavailable"
                  : "recorded"}
              </p>
            </>
          )}
        </div>
      </details>

      {data.recommendations.length > 0 && (
        <section
          className={`mt-6 ${cardClass} p-4 sm:p-5`}
          aria-labelledby="host-recommendations-heading"
        >
          <div>
            <h2
              id="host-recommendations-heading"
              className="text-base font-medium text-[#1F1F1F]"
            >
              Actionable insights
            </h2>
            <p className="mt-1 text-sm text-[#727272]">
              Based on recorded dashboard metrics. No projected revenue or market data is inferred.
            </p>
          </div>
          <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-2">
            {isRefreshing ? (
              <SectionRowSkeleton
                count={Math.min(2, Math.max(1, data.recommendations.length))}
              />
            ) : (
              data.recommendations.map((recommendation) => (
                <article
                  key={recommendation.id}
                  className={`${insetSurfaceClass} border border-white/80 px-4 py-3.5 transition-shadow hover:shadow-[0_2px_8px_rgba(31,31,31,0.08)]`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-medium text-[#1F1F1F]">
                        {recommendation.title}
                      </h3>
                      <p className="mt-1 text-sm text-[#727272]">
                        {recommendation.description}
                      </p>
                    </div>
                    <PriorityTag priority={recommendation.priority} />
                  </div>
                  <Link
                    href={recommendation.actionHref}
                    className="mt-3 inline-flex text-sm font-normal text-[#1F1F1F] underline underline-offset-2 transition-colors hover:text-[#727272] focus-within:outline-0"
                  >
                    {recommendation.actionLabel}
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      <section
        className={`mt-4 ${cardClass} p-4 sm:p-5`}
        aria-labelledby="upcoming-reservation-heading"
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="upcoming-reservation-heading"
              className="text-base font-semibold text-[#1F1F1F]"
            >
              Upcoming reservation
            </h2>
            <p className="mt-1 text-sm text-[#727272]">
              The next confirmed reservation in this scope.
            </p>
          </div>
          <Link
            href="/host/today"
            className="shrink-0 rounded-full bg-[#FCDF9C] px-3.5 py-2 text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#1F1F1F] hover:text-white"
          >
            View reservations
          </Link>
        </div>
        {isRefreshing ? (
          <ReservationSkeleton />
        ) : kpis.nextUpcomingReservation ? (
          <UpcomingReservation
            reservation={kpis.nextUpcomingReservation}
            onSelectBookingId={onSelectBookingId}
          />
        ) : (
          <p className="mt-4 border-t border-zinc-100 pt-4 text-sm text-[#727272]">
            No upcoming reservations scheduled. Manage availability in the{" "}
            <Link
              href="/host/calendar"
              className="font-medium underline underline-offset-2 text-[#1F1F1F]"
            >
              Host Calendar
            </Link>
            .
          </p>
        )}
      </section>

      <section
        className={`mt-4 ${cardClass} p-4 sm:p-5`}
        aria-labelledby="guest-information-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="guest-information-heading"
              className="text-lg font-semibold tracking-[-0.02em] text-[#1F1F1F]"
            >
              Guest insights
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#727272]">
              Completed stays over the last 6 months.
            </p>
          </div>
          {isRefreshing ? (
            <span className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
          ) : (
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-[#727272]">
              {guestAnalytics.completedGuestStaysCount} completed stays
            </span>
          )}
        </div>
        {isRefreshing ? (
          <GuestInsightsSkeleton />
        ) : (
          <>
            <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-3">
              <MetricCell
                label="Unique guests"
                value={String(guestAnalytics.uniqueGuestsCount)}
              />
              <MetricCell
                label="Returning guests"
                value={String(guestAnalytics.returningGuestsCount)}
                detail={`${guestAnalytics.returningGuestsPercentage}% of guests`}
              />
              <MetricCell
                label="Average rating"
                value={
                  reviews.overallRating === null
                    ? "—"
                    : `★ ${reviews.overallRating.toFixed(2)}`
                }
                detail={`${reviews.totalReviewsCount} published reviews`}
              />
            </div>
            {guestAnalytics.guestOrigins.length > 0 ? (
              <div className="mt-4 border-t border-zinc-100 pt-4">
                <p className="text-base font-medium text-[#1f1f1f]">
                  Top guest origins
                </p>
                <div className="mt-3 space-y-2.5">
                  {guestAnalytics.guestOrigins.slice(0, 5).map((origin) => (
                    <div
                      key={`${origin.country}-${origin.city ?? "country"}`}
                      className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 text-xs"
                    >
                      <div>
                        <div className="mb-1 flex justify-between gap-3 text-[#727272]">
                          <span className="truncate">
                            {origin.city
                              ? `${origin.city}, ${origin.country}`
                              : origin.country}
                          </span>
                          <span>{origin.stayCount} stays</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-zinc-700"
                            style={{
                              width: `${Math.min(100, Math.max(0, origin.sharePercentage))}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-right text-[#727272]">
                        {origin.sharePercentage}%
                      </span>
                    </div>
                  ))}
                </div>
                {guestAnalytics.staysWithoutRecordedOriginCount > 0 && (
                  <p className="mt-3 text-xs text-[#727272]">
                    {guestAnalytics.staysWithoutRecordedOriginCount} stays
                    without a recorded origin are omitted.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 border-t border-[#1F1F1F]/10 pt-4 text-sm leading-5 text-[#727272]">
                No completed-stay origin data is available yet.
              </p>
            )}
          </>
        )}
      </section>

      <section
        className={`mt-4 ${cardClass} p-4 sm:p-5`}
        aria-labelledby="reviews-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="reviews-heading"
              className="text-lg font-semibold tracking-[-0.02em] text-[#1F1F1F]"
            >
              Reviews and ratings
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#727272]">
              Published reviews across the selected properties.
            </p>
          </div>
          {isRefreshing ? (
            <div>
              <div className="h-5 w-12 animate-pulse rounded bg-zinc-100" />
              <div className="mt-2 h-3 w-16 animate-pulse rounded bg-zinc-100" />
            </div>
          ) : (
            <div className="text-right">
              <p className="text-2xl font-semibold tracking-[-0.04em] text-[#1F1F1F]">
                {reviews.overallRating === null
                  ? "—"
                  : `★ ${reviews.overallRating.toFixed(2)}`}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#727272]">
                {reviews.totalReviewsCount}{" "}
                {reviews.totalReviewsCount === 1 ? "review" : "reviews"}
              </p>
            </div>
          )}
        </div>
        {isRefreshing ? (
          <ReviewRefreshSkeleton />
        ) : (
          <>
            <div className="mt-5 grid gap-4 border-t border-[#1F1F1F]/10 pt-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
              <div className="rounded-[10px] bg-white/45 p-4 sm:p-5">
                  <p className="text-base font-medium text-[#1f1f1f]">
                  Review trend
                </p>
                <ReviewTrendChart trend={reviews.trend} />
              </div>
              {reviews.totalReviewsCount > 0 ? (
                <div className="rounded-[10px] bg-white/45 p-4 sm:p-5">
                    <p className="text-base font-medium text-[#1f1f1f]">
                    Rating details
                  </p>
                  <div className="mt-4 space-y-3">
                    {[
                      ["Cleanliness", reviews.categoryRatings.cleanliness],
                      ["Accuracy", reviews.categoryRatings.accuracy],
                      ["Check-in", reviews.categoryRatings.checkIn],
                      ["Communication", reviews.categoryRatings.communication],
                      ["Location", reviews.categoryRatings.location],
                      ["Value", reviews.categoryRatings.value],
                    ].map(([label, rating]) => (
                      <RatingBar
                        key={String(label)}
                        label={String(label)}
                        rating={rating as number | null}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[250px] items-center rounded-[10px] bg-white/45 px-5 text-sm text-[#727272]">
                  No published reviews yet.
                </div>
              )}
            </div>
            {reviews.totalReviewsCount > 0 &&
              reviews.recentReviews.length > 0 && (
                <div className="mt-5 border-t border-[#1F1F1F]/10 pt-4">
                  <p className="text-base font-medium text-[#1f1f1f]">
                    Recent reviews
                  </p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    {reviews.recentReviews.slice(0, 3).map((review) => (
                      <article
                        key={review.id}
                        className={`${insetSurfaceClass} min-h-29 border border-white/80 p-4 transition-shadow hover:shadow-[0_2px_8px_rgba(31,31,31,0.08)]`}
                      >
                        <p className="text-base font-semibold leading-5 text-[#1F1F1F]">
                          {review.guestName}{" "}
                          <span className="font-medium text-[#727272]">
                            · ★ {review.rating}
                          </span>
                        </p>
                        <p className="mt-1 text-sm font-normal text-[#727272]">
                          {review.listingTitle}
                        </p>
                        {review.comment && (
                          <p className="mt-2 line-clamp-2 text-sm leading-normal text-[#727272]">
                            {review.comment}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}
          </>
        )}
      </section>

      <section
        className={`mt-4 ${cardClass} p-4 sm:p-5`}
        aria-labelledby="host-status-heading"
      >
        <div>
          <h2
            id="host-status-heading"
            className="text-lg font-semibold tracking-[-0.02em] text-[#1F1F1F]"
          >
            Host & listing status
          </h2>
          <p className="mt-1 text-sm leading-5 text-[#727272]">
            Official badges and listing readiness from stored evaluations.
          </p>
        </div>
        {isRefreshing ? (
          <StatusRefreshSkeleton />
        ) : (
          <div className="mt-5 grid gap-3 border-t border-[#1F1F1F]/10 pt-5 lg:grid-cols-3">
            <StatusCard
              title="Superhost"
              status={
                superhostEvaluation.officialStatus
                  ? "Official Superhost"
                  : superhostEvaluation.currentProgress.eligibleNow
                    ? "Eligible at next evaluation"
                    : "Not yet eligible"
              }
              tone={superhostEvaluation.officialStatus ? "positive" : "neutral"}
              details={[
                `${superhostEvaluation.currentProgress.completedReservationsCount} completed reservations`,
                superhostEvaluation.currentProgress.overallRating === null
                  ? "No published rating"
                  : `★ ${superhostEvaluation.currentProgress.overallRating.toFixed(2)} rating`,
                `Next evaluation: ${new Date(superhostEvaluation.nextEvaluationAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
              ]}
            />
            <StatusCard
              title="Guest Favorite"
              status={
                selectedFavorite?.officialStatus
                  ? "Guest Favorite"
                  : selectedFavorite?.eligibleNow
                    ? "Eligible at next daily evaluation"
                    : "Not yet eligible"
              }
              tone={selectedFavorite?.officialStatus ? "positive" : "neutral"}
              details={[
                `${officialGuestFavorites} of ${guestFavoriteSummary.length} listings officially awarded`,
                selectedFavorite
                  ? `${selectedFavorite.title} · ${selectedFavorite.reviewsCount} reviews`
                  : "No listing evaluation available",
                selectedFavorite?.overallRating === null || !selectedFavorite
                  ? "No published rating"
                  : `★ ${selectedFavorite.overallRating.toFixed(2)} rating`,
              ]}
            />
            <StatusCard
              title="Listing health"
              status={
                selectedHealthListing
                  ? `${selectedHealthListing.completedChecks}/${selectedHealthListing.totalChecks} details complete`
                  : "No listings"
              }
              tone={
                selectedHealthListing &&
                selectedHealthListing.missingFields.length === 0
                  ? "positive"
                  : "neutral"
              }
              details={[
                selectedHealthListing
                  ? `${selectedHealthListing.title} · ${selectedHealthListing.photoCount} photos · ${selectedHealthListing.amenityCount} amenities`
                  : "",
                selectedHealthListing?.missingFields.length
                  ? `Needs: ${selectedHealthListing.missingFields.join(", ")}`
                  : "All stored checklist details are present.",
                `Response time: ${formatResponseTime(listingHealth.averageResponseTimeMinutes, t)}`,
              ]}
            />
          </div>
        )}
      </section>
    </section>
  );
}

function PrimaryKpi({
  refreshing,
  label,
  period,
  value,
  detail,
  detailTone,
  progress,
}: {
  refreshing: boolean;
  label: string;
  period: string;
  value: string;
  detail: string;
  detailTone?: "positive" | "negative";
  progress?: number;
}) {
  return (
    <article
      aria-busy={refreshing}
      className={`${cardClass} group min-h-37.5 overflow-hidden p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_12px_rgba(31,31,31,0.16)] sm:p-5`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-medium text-[#727272]">
            {label}
          </p>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-white/80 px-2 py-1 text-right text-[11px] font-medium text-[#1F1F1F]">
            {period}
          </span>
        </div>
        {refreshing ? (
          <div className="mt-2 h-7 w-28 animate-pulse rounded bg-zinc-100" />
        ) : (
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#1F1F1F]">
            {value}
          </p>
        )}
      </div>
      <div className="mt-4 border-t border-[#1F1F1F]/10 pt-3">
        {refreshing ? (
          <>
            <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
            {progress !== undefined && (
              <div className="mt-2 h-1.5 rounded-full bg-zinc-100" />
            )}
          </>
        ) : (
          <>
            <p
              className={`text-xs ${detailTone === "positive" ? "text-emerald-700" : detailTone === "negative" ? "text-rose-700" : "text-[#727272]"}`}
            >
              {detail}
            </p>
            {progress !== undefined && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[#FCDF9C]"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function SecondaryKpi({
  refreshing,
  label,
  value,
  detail,
}: {
  refreshing: boolean;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article
      aria-busy={refreshing}
      className={`${cardClass} min-h-32 p-3.5 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_12px_rgba(31,31,31,0.14)]`}
    >
      <div>
        <p className="text-xs font-medium text-[#727272]">{label}</p>
        {refreshing ? (
          <div className="mt-2 h-5 w-16 animate-pulse rounded bg-zinc-100" />
        ) : (
          <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1F1F1F]">
            {value}
          </p>
        )}
      </div>
      {refreshing ? (
        <div className="mt-auto h-3 w-20 animate-pulse rounded bg-zinc-100" />
      ) : (
        <p className="mt-auto text-xs font-normal text-[#727272]">{detail}</p>
      )}
    </article>
  );
}

function MetricCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className={`${insetSurfaceClass} min-h-27 border border-white/80 p-3.5 sm:p-4`}>
      <p className="text-sm font-normal text-[#727272]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#1F1F1F]">
        {value}
      </p>
      {detail && (
        <p className="mt-1.5 text-xs font-normal text-[#727272]">{detail}</p>
      )}
    </div>
  );
}

function EarningsDetailsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {[...Array(6)].map((_, index) => (
          <div key={index}>
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-4 w-20 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>
      <div className="mt-4 h-3 w-3/4 animate-pulse rounded bg-zinc-100" />
    </>
  );
}

function SectionRowSkeleton({ count }: { count: number }) {
  return (
    <>
      {[...Array(count)].map((_, index) => (
        <div key={index} className="rounded-xl bg-zinc-50 px-4 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
          <div className="mt-3 h-3 w-20 animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </>
  );
}

function ReservationSkeleton() {
  return (
    <div className="mt-4 grid gap-4 border-t border-zinc-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-start gap-3">
        <div className="size-10 animate-pulse rounded-full bg-zinc-100" />
        <div className="flex-1">
          <div className="h-4 w-44 animate-pulse rounded bg-zinc-100" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-zinc-100" />
        </div>
      </div>
      <div>
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
        <div className="mt-2 h-4 w-16 animate-pulse rounded bg-zinc-100" />
      </div>
    </div>
  );
}

function GuestInsightsSkeleton() {
  return (
    <>
      <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-3">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="rounded-xl bg-zinc-50 p-3">
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-5 w-12 animate-pulse rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
        <div className="mt-3 space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index}>
              <div className="h-3 w-40 animate-pulse rounded bg-zinc-100" />
              <div className="mt-2 h-1.5 w-full animate-pulse rounded-full bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ReviewRefreshSkeleton() {
  return (
    <div className="mt-4 grid gap-6 border-t border-zinc-100 pt-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <div>
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
        <div className="mt-3 h-[250px] animate-pulse rounded-xl bg-zinc-50" />
      </div>
      <div>
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
        <div className="mt-3 space-y-4">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className="h-3 animate-pulse rounded bg-zinc-100"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusRefreshSkeleton() {
  return (
    <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-3">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="rounded-xl bg-zinc-50 p-4">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
          <div className="mt-3 h-6 w-32 animate-pulse rounded-full bg-white" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PriorityTag({
  priority,
}: {
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}) {
  const tone =
    priority === "CRITICAL"
      ? "bg-rose-100 text-rose-800"
      : priority === "HIGH"
        ? "bg-amber-100 text-amber-900"
        : "bg-zinc-200 text-zinc-700";
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium leading-tight ${tone}`}
    >
      {priority}
    </span>
  );
}

function UpcomingReservation({
  reservation,
  onSelectBookingId,
}: {
  reservation: NonNullable<
    HostDashboardData["kpis"]["nextUpcomingReservation"]
  >;
  onSelectBookingId?: (bookingId: string) => void;
}) {
  return (
    <div className="mt-4 grid gap-4 border-t border-zinc-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white border border-[#727272] text-sm font-semibold text-zinc-700">
          {reservation.guestImage ? (
            <Image
              src={reservation.guestImage}
              alt={reservation.guestName}
              width={40}
              height={40}
              unoptimized
              className="size-full object-cover"
            />
          ) : (
            reservation.guestName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium text-[#1F1F1F]">
            {reservation.guestName}{" "}
            <span className="font-normal text-[#727272] text-sm">
              · {reservation.listingTitle}
            </span>
          </p>
          <p className="mt-1 text-xs text-[#727272]">
            {reservation.startDate} at {reservation.checkInTime} ·{" "}
            {reservation.endDate} · {reservation.nights}{" "}
            {reservation.nights === 1 ? "night" : "nights"} ·{" "}
            {reservation.guests} {reservation.guests === 1 ? "guest" : "guests"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 md:text-right">
        <div>
          <p className="text-sm font-medium text-[#727272]">
            {reservation.isPayoutEligible
              ? "Eligible payout"
              : "Payment status"}
          </p>
          <p className="mt-1 text-sm font-medium text-[#1F1F1F]">
            {reservation.isPayoutEligible
              ? formatCurrency(
                  reservation.hostPayoutCents,
                  reservation.currency,
                )
              : "Pending payment"}
          </p>
        </div>
        {onSelectBookingId && (
          <button
            type="button"
            onClick={() => onSelectBookingId(reservation.id)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-[#1F1F1F] transition hover:border-zinc-500"
          >
            Details
          </button>
        )}
      </div>
    </div>
  );
}

function formatTrendMonth(month: string, includeYear = false) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) return month;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function ReviewTrendChart({
  trend,
}: {
  trend: HostDashboardData["reviews"]["trend"];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hasReviews = trend.some((point) => point.reviewCount > 0);
  const chartWidth = 560;
  const chartHeight = 250;
  const inset = { top: 18, right: 14, bottom: 34, left: 32 };
  const plotWidth = chartWidth - inset.left - inset.right;
  const plotHeight = chartHeight - inset.top - inset.bottom;

  if (!hasReviews) {
    return (
      <div className="mt-3 flex h-[250px] items-center justify-center rounded-xl bg-zinc-50 px-5 text-center text-sm text-[#727272]">
        No reviews in this period
      </div>
    );
  }

  const maxCount = Math.max(...trend.map((point) => point.reviewCount));
  const yMax = Math.max(2, Math.ceil(maxCount / 2) * 2);
  const yTicks = Array.from(new Set([0, Math.ceil(yMax / 2), yMax]));
  const xFor = (index: number) =>
    inset.left +
    (trend.length <= 1
      ? plotWidth / 2
      : (index / (trend.length - 1)) * plotWidth);
  const yFor = (count: number) =>
    inset.top + ((yMax - count) / yMax) * plotHeight;
  const linePath = trend
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(point.reviewCount)}`,
    )
    .join(" ");
  const hoveredPoint = hoveredIndex === null ? null : trend[hoveredIndex];

  return (
    <div
      className="relative mt-3 h-[250px]"
      aria-label="Monthly published review count for the last 12 months"
    >
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="size-full overflow-visible"
        role="img"
        aria-label="Review count trend"
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={inset.left}
              x2={chartWidth - inset.right}
              y1={yFor(tick)}
              y2={yFor(tick)}
              stroke="#e4e4e7"
              strokeWidth="1"
            />
            <text
              x={inset.left - 8}
              y={yFor(tick) + 4}
              textAnchor="end"
              fill="#71717a"
              fontSize="10"
            >
              {tick}
            </text>
          </g>
        ))}
        <path
          d={linePath}
          fill="none"
          stroke="#222222"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {trend.map((point, index) => (
          <g key={point.month}>
            <circle
              cx={xFor(index)}
              cy={yFor(point.reviewCount)}
              r={hoveredIndex === index ? 5 : 3.5}
              fill="#222222"
              stroke="white"
              strokeWidth="2"
            />
            <circle
              cx={xFor(index)}
              cy={yFor(point.reviewCount)}
              r="13"
              fill="transparent"
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`${formatTrendMonth(point.month, true)}: ${point.reviewCount} ${point.reviewCount === 1 ? "review" : "reviews"}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
            />
          </g>
        ))}
        {trend.map((point, index) => (
          <text
            key={`${point.month}-label`}
            x={xFor(index)}
            y={chartHeight - 8}
            textAnchor="middle"
            fill="#71717a"
            fontSize="10"
          >
            {index % 2 === 0 || trend.length <= 6
              ? formatTrendMonth(point.month)
              : ""}
          </text>
        ))}
      </svg>
      {hoveredPoint && hoveredIndex !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg bg-[#1F1F1F] px-3 py-2 text-xs text-white shadow-lg"
          style={{
            left: `${Math.min(92, Math.max(8, (hoveredIndex / Math.max(1, trend.length - 1)) * 100))}%`,
          }}
        >
          <p className="font-medium">
            {formatTrendMonth(hoveredPoint.month, true)}
          </p>
          <p className="mt-0.5 text-zinc-300">
            {hoveredPoint.reviewCount}{" "}
            {hoveredPoint.reviewCount === 1 ? "review" : "reviews"}
          </p>
        </div>
      )}
    </div>
  );
}

function RatingBar({
  label,
  rating,
}: {
  label: string;
  rating: number | null;
}) {
  return (
    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)_2.25rem] items-center gap-2 text-xs">
      <span className="font-normal text-[#727272]">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#DDDDDE]">
        <div
          className="h-full rounded-full bg-[#1F1F1F]"
          style={{
            width: `${rating === null ? 0 : Math.min(100, Math.max(0, (rating / 5) * 100))}%`,
          }}
        />
      </div>
      <span className="text-right text-xs font-medium text-[#727272]">
        {rating === null ? "—" : rating.toFixed(1)}
      </span>
    </div>
  );
}

function StatusCard({
  title,
  status,
  tone,
  details,
}: {
  title: string;
  status: string;
  tone: "positive" | "neutral";
  details: string[];
}) {
  return (
    <article className={`${insetSurfaceClass} min-h-39 border border-white/80 p-4 transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(31,31,31,0.08)] sm:p-5`}>
      <p className="text-base font-semibold tracking-[-0.02em] text-[#1F1F1F]">
        {title}
      </p>
      <p
        className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-normal ${tone === "positive" ? "bg-emerald-100 text-emerald-800" : "bg-[#FCDF9C] text-[#1F1F1F]"}`}
      >
        {status}
      </p>
      <ul className="mt-4 space-y-1.5 border-t border-[#1F1F1F]/10 pt-3">
        {details.filter(Boolean).map((detail) => (
          <li
            key={detail}
            className="flex items-start gap-2 text-sm leading-5 text-[#727272]"
          >
            <span
              aria-hidden="true"
              className="mt-2 size-1 shrink-0 rounded-full bg-[#727272]"
            />
            <span>{detail}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Route and in-component loading fallback, matched to the dashboard's visual hierarchy. */
export function HostDashboardOverviewSkeleton() {
  return (
    <section
      aria-label="Loading host performance dashboard"
      aria-busy="true"
      className="mx-auto mb-10 w-full animate-pulse font-sans"
    >
      <div className="mb-7 flex items-end justify-between gap-4 border-b border-[#1F1F1F]/10 pb-5 sm:mb-8">
        <div>
          <div className="mb-2 h-3 w-28 rounded bg-zinc-100" />
          <div className="h-9 w-60 rounded-lg bg-zinc-200" />
          <div className="mt-2 h-4 w-32 rounded bg-zinc-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-zinc-100" />
      </div>
      <div className={primaryKpiGridClass}>
        {[...Array(4)].map((_, index) => (
          <KpiCardSkeleton key={index} />
        ))}
      </div>
      <div className={`mt-3 ${secondaryKpiGridClass}`}>
        {[...Array(5)].map((_, index) => (
          <SecondaryKpiSkeleton key={index} />
        ))}
      </div>
      <div className={`mt-3 ${cardClass} h-12`} />
      <DashboardSectionSkeleton className="mt-6" bodyRows={2} />
      <DashboardSectionSkeleton className="mt-4" bodyRows={1} />
      <ReviewSectionSkeleton />
      <DashboardSectionSkeleton className="mt-4" bodyRows={2} />
      <DashboardSectionSkeleton className="mt-4" metricCount={3} />
    </section>
  );
}

function KpiCardSkeleton() {
  return (
    <div className={`${cardClass} flex min-h-36 flex-col justify-between p-5`}>
      <div className="flex justify-between gap-2">
        <div className="h-3 w-24 rounded bg-zinc-100" />
        <div className="h-3 w-14 rounded bg-zinc-100" />
      </div>
      <div className="h-8 w-28 rounded bg-zinc-200" />
      <div className="h-3 w-32 border-t border-zinc-100 pt-3" />
    </div>
  );
}
function SecondaryKpiSkeleton() {
  return (
    <div className={`${cardClass} flex min-h-36 flex-col p-3.5`}>
      <div className="h-3 w-24 rounded bg-zinc-100" />
      <div className="mt-3 h-5 w-16 rounded bg-zinc-200" />
      <div className="mt-auto h-3 w-20 rounded bg-zinc-100" />
    </div>
  );
}
function ReviewSectionSkeleton() {
  return (
    <section className={`mt-4 ${cardClass} p-5`}>
      <div className="flex justify-between gap-3">
        <div>
          <div className="h-5 w-32 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-64 max-w-full rounded bg-zinc-100" />
        </div>
        <div>
          <div className="h-5 w-12 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-16 rounded bg-zinc-100" />
        </div>
      </div>
      <div className="mt-4 grid gap-6 border-t border-zinc-100 pt-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div>
          <div className="h-3 w-20 rounded bg-zinc-100" />
          <div className="mt-3 h-[250px] rounded-xl bg-zinc-50" />
        </div>
        <div>
          <div className="h-3 w-20 rounded bg-zinc-100" />
          <div className="mt-3 space-y-4">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-3 rounded bg-zinc-100" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
function DashboardSectionSkeleton({
  className,
  metricCount = 0,
  bodyRows = 0,
}: {
  className: string;
  metricCount?: number;
  bodyRows?: number;
}) {
  return (
    <section className={`${className} ${cardClass} p-5`}>
      <div className="flex justify-between gap-3">
        <div>
          <div className="h-5 w-40 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-64 max-w-full rounded bg-zinc-100" />
        </div>
        <div className="h-5 w-20 rounded bg-zinc-100" />
      </div>
      <div className="mt-4 border-t border-zinc-100 pt-4">
        {metricCount > 0 && (
          <div
            className={`grid gap-3 ${metricCount === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}
          >
            {[...Array(metricCount)].map((_, index) => (
              <div key={index} className="rounded-xl bg-zinc-50 p-3">
                <div className="h-3 w-16 rounded bg-zinc-100" />
                <div className="mt-2 h-5 w-20 rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        )}
        {bodyRows > 0 && (
          <div className={`${metricCount ? "mt-4" : ""} space-y-3`}>
            {[...Array(bodyRows)].map((_, index) => (
              <div key={index} className="h-14 rounded-xl bg-zinc-50" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
