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

const primaryKpiGridClass = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4";
const secondaryKpiGridClass = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";
const cardClass = "rounded-2xl border border-zinc-200/80 bg-white";
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
  const [data, setData] = useState<HostDashboardData | null>(initialData || null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(appliedPropertyId || null);
  const [loading, setLoading] = useState(() => !initialData);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [dataScopeKey, setDataScopeKey] = useState(() => dashboardScopeKey(appliedPropertyId));
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
    const query = selectedPropertyId ? `?listingId=${encodeURIComponent(selectedPropertyId)}` : "";

    fetch(`/api/v1/host/dashboard${query}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message || "Failed to load dashboard metrics");
        }
        return res.json();
      })
      .then((payload) => {
        if (requestId !== requestIdRef.current || !payload?.success || !payload?.data) return;
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
  const propertyOptions = listings.length > 0
    ? listings.map((listing) => ({ id: listing.id, title: listing.title }))
    : (initialData?.listingHealth.listings ?? []).map((listing) => ({ id: listing.listingId, title: listing.title }));
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
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900"><p className="font-medium">{t("host_dash_error_load_metrics", "Could not load performance metrics")}</p><p className="mt-1 text-xs text-red-700">{error}</p></div>;
  }
  if (!kpis || !data) return null;

  const { earnings, guestAnalytics, guestFavoriteSummary, listingHealth, reviews, superhostEvaluation } = data;
  const selectedHealthListing = selectedPropertyId
    ? listingHealth.listings.find((listing) => listing.listingId === selectedPropertyId)
    : listingHealth.listings[0];
  const selectedFavorite = selectedPropertyId
    ? guestFavoriteSummary.find((listing) => listing.listingId === selectedPropertyId)
    : guestFavoriteSummary[0];
  const officialGuestFavorites = guestFavoriteSummary.filter((listing) => listing.officialStatus).length;

  return (
    <section aria-label={t("host_dash_aria_summary", "Host performance and earnings summary")} className="mx-auto mb-10 w-full max-w-[1240px] font-sans">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1F1F1F] sm:text-3xl">{t("host_dash_header_title", "Performance overview")}</h1>
          <p className="mt-1 text-sm text-[#727272]">{currentListing ? currentListing.title : t("host_dash_all_properties", "All properties")}</p>
        </div>
        <div className="flex items-center gap-3">
          {propertyOptions.length > 1 && (
            <label className="text-xs font-medium text-[#727272]">
              <span className="sr-only">{t("host_dash_sr_property", "Property")}</span>
              <select aria-label={t("host_dash_aria_filter_property", "Filter dashboard by property")} value={selectedPropertyId ?? ""} onChange={(event) => { const nextPropertyId = event.target.value || null; const cachedData = dashboardDataCache.get(dashboardScopeKey(nextPropertyId)); setError(null); setSelectedPropertyId(nextPropertyId); if (cachedData) { setData(cachedData); setDataScopeKey(dashboardScopeKey(nextPropertyId)); setLoading(false); } else { setLoading(true); } }} className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-[#1F1F1F] outline-none transition focus:border-zinc-600">
                <option value="">{t("host_dash_all_properties", "All properties")}</option>
                {propertyOptions.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}
              </select>
            </label>
          )}
          {loading && <span role="status" aria-label={t("host_dash_aria_updating_analytics", "Updating property analytics")} className="size-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />}
        </div>
      </header>

      {error && dataScopeKey !== selectedScopeKey && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"><span>{t("host_dash_error_refresh", "Couldn’t refresh analytics for this property.")}</span><button type="button" onClick={retryPropertyAnalytics} className="font-medium underline underline-offset-2">{t("host_dash_retry", "Retry")}</button></div>}

      <div className={primaryKpiGridClass}>
        <PrimaryKpi refreshing={isRefreshing} label={t("host_dash_kpi_monthly_earnings", "Monthly earnings")} period={kpis.monthlyEarnings.periodLabel} value={formatCurrency(kpis.monthlyEarnings.amountCents, kpis.monthlyEarnings.currency)} detail={kpis.monthlyEarnings.changePercentage === null ? t("host_dash_kpi_completed_stays_month", "Completed stays this month") : `${kpis.monthlyEarnings.changePercentage >= 0 ? "↑" : "↓"} ${Math.abs(kpis.monthlyEarnings.changePercentage)}% ${t("host_dash_kpi_vs_last_month", "vs last month")}`} detailTone={kpis.monthlyEarnings.changePercentage === null ? undefined : kpis.monthlyEarnings.changePercentage >= 0 ? "positive" : "negative"} />
        <PrimaryKpi refreshing={isRefreshing} label={t("host_dash_kpi_ytd_earnings", "Year-to-date earnings")} period={kpis.ytdEarnings.periodLabel} value={formatCurrency(kpis.ytdEarnings.amountCents, kpis.ytdEarnings.currency)} detail={t("host_dash_kpi_completed_stay_payouts", "Completed stay payouts")} />
        <PrimaryKpi refreshing={isRefreshing} label={t("host_dash_kpi_upcoming_payouts", "Upcoming payouts")} period={`${kpis.upcomingPayout.count} ${kpis.upcomingPayout.count === 1 ? t("host_dash_reservation_singular", "reservation") : t("host_dash_reservation_plural", "reservations")}`} value={formatCurrency(kpis.upcomingPayout.totalUpcomingAmountCents, kpis.upcomingPayout.currency)} detail={kpis.upcomingPayout.nextPayoutAmountCents === null ? t("host_dash_no_upcoming_payout", "No eligible upcoming payout") : `${t("host_dash_next_label", "Next:")} ${formatCurrency(kpis.upcomingPayout.nextPayoutAmountCents, kpis.upcomingPayout.currency)}`} />
        <PrimaryKpi refreshing={isRefreshing} label={t("host_dash_kpi_occupancy", "Occupancy")} period={kpis.occupancy.periodLabel} value={`${kpis.occupancy.ratePercentage}%`} detail={`${kpis.occupancy.bookedNights} ${t("host_dash_booked_of", "booked of")} ${kpis.occupancy.totalBookableNights} ${t("host_dash_nights", "nights")}`} progress={kpis.occupancy.ratePercentage} />
      </div>

      <div className={`mt-3 ${secondaryKpiGridClass}`}>
        <SecondaryKpi refreshing={isRefreshing} label={t("host_dash_kpi_booked_vs_available", "Booked vs available")} value={`${kpis.occupancy.bookedNights} / ${kpis.occupancy.availableNights}`} detail={t("host_dash_kpi_last_30_days", "Last 30 days")} />
        <SecondaryKpi refreshing={isRefreshing} label={t("host_dash_kpi_avg_booking_val", "Avg booking value")} value={formatCurrency(kpis.averageBookingValue.hostPayoutCents ?? 0, kpis.averageBookingValue.currency)} detail={t("host_dash_kpi_net_payout_stay", "Net payout per stay")} />
        <SecondaryKpi refreshing={isRefreshing} label={t("host_dash_kpi_avg_stay", "Avg stay")} value={`${kpis.averageStayLength.nights} ${kpis.averageStayLength.nights === 1 ? t("host_dash_night_singular", "night") : t("host_dash_night_plural", "nights")}`} detail={t("host_dash_kpi_completed_stays", "Completed stays")} />
        <SecondaryKpi refreshing={isRefreshing} label={t("host_dash_kpi_cancel_rate", "Cancellation rate")} value={`${kpis.cancellationRate.overallPercentage}%`} detail={`${t("host_dash_kpi_host_prefix", "Host:")} ${kpis.cancellationRate.hostPercentage}%`} />
        <SecondaryKpi refreshing={isRefreshing} label={t("host_dash_kpi_guest_rating", "Guest rating")} value={kpis.averageRating.overallRating === null ? "—" : `★ ${kpis.averageRating.overallRating.toFixed(2)}`} detail={`${kpis.averageRating.totalReviewsCount} ${kpis.averageRating.totalReviewsCount === 1 ? t("host_dash_review_singular", "review") : t("host_dash_review_plural", "reviews")}`} />
      </div>

      <details className={`group mt-3 ${cardClass} px-4 py-3 sm:px-5`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-[#1F1F1F] [&::-webkit-details-marker]:hidden">
          <span>{t("host_dash_detailed_earnings", "Detailed earnings")}</span>
          <span className="flex items-center gap-3 text-xs font-normal text-[#727272]">{isRefreshing ? <span className="h-3 w-28 animate-pulse rounded bg-zinc-100" /> : <span>{t("host_dash_net_payout", "Net payout")} {formatCurrency(earnings.itemizedBreakdown.netHostPayoutCents, earnings.currency)}</span>}<span className="text-base transition group-open:rotate-45">+</span></span>
        </summary>
        <div className="mt-4 border-t border-zinc-100 pt-4">
          {isRefreshing ? <EarningsDetailsSkeleton /> : <><dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            {[
              [t("host_dash_fee_accommodation", "Accommodation"), earnings.itemizedBreakdown.accommodationSubtotalCents],
              [t("host_dash_fee_cleaning", "Cleaning fees"), earnings.itemizedBreakdown.cleaningFeeCents],
              [t("host_dash_fee_extra_guest", "Extra guest fees"), earnings.itemizedBreakdown.extraGuestFeeCents],
              [t("host_dash_fee_pet", "Pet fees"), earnings.itemizedBreakdown.petFeeCents],
              [t("host_dash_fee_service", "Host service fee"), -earnings.itemizedBreakdown.hostServiceFeeCents],
              [t("host_dash_fee_taxes", "Host-collected taxes"), earnings.itemizedBreakdown.taxesCollectedForHostCents]
            ].map(([label, amount]) => <div key={String(label)}><dt className="text-xs text-[#727272]">{label}</dt><dd className="mt-0.5 font-semibold text-[#1F1F1F]">{formatCurrency(Number(amount), earnings.currency)}</dd></div>)}
          </dl>
          <p className="mt-4 text-xs text-[#727272]">{t("host_dash_recorded_refunds", "Recorded refunds:")} {formatCurrency(earnings.refunds.amountCents, earnings.currency)} ({earnings.refunds.count}) · {t("host_dash_payment_pending_excluded", "Payment-pending bookings excluded:")} {earnings.bookingsExcludedForPaymentStatusCount} · {t("host_dash_adjustments", "Adjustments:")} {earnings.adjustments.status === "DATA_UNAVAILABLE" ? t("host_dash_adj_unavailable", "unavailable") : t("host_dash_adj_recorded", "recorded")}</p></>}
        </div>
      </details>

      {data.recommendations.length > 0 && (
        <section className={`mt-6 ${cardClass} p-5`} aria-labelledby="host-recommendations-heading">
          <div><h2 id="host-recommendations-heading" className="text-base font-semibold text-[#1F1F1F]">{t("host_dash_insights_title", "Actionable insights")}</h2><p className="mt-1 text-xs text-[#727272]">{t("host_dash_insights_subtitle", "Based on recorded dashboard metrics. No projected revenue or market data is inferred.")}</p></div>
          <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-2">
            {isRefreshing ? <SectionRowSkeleton count={Math.min(2, Math.max(1, data.recommendations.length))} /> : data.recommendations.map((recommendation) => <article key={recommendation.id} className="rounded-xl bg-zinc-50 px-4 py-3"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium text-[#1F1F1F]">{recommendation.title}</h3><p className="mt-1 text-sm text-[#727272]">{recommendation.description}</p></div><PriorityTag priority={recommendation.priority} /></div><Link href={recommendation.actionHref} className="mt-3 inline-flex text-xs font-medium text-[#1F1F1F] underline underline-offset-2">{recommendation.actionLabel}</Link></article>)}
          </div>
        </section>
      )}

      <section className={`mt-4 ${cardClass} p-5`} aria-labelledby="upcoming-reservation-heading">
        <div className="flex items-center justify-between gap-3"><div><h2 id="upcoming-reservation-heading" className="text-base font-semibold text-[#1F1F1F]">{t("host_dash_upcoming_res_title", "Upcoming reservation")}</h2><p className="mt-1 text-xs text-[#727272]">{t("host_dash_upcoming_res_subtitle", "The next confirmed reservation in this scope.")}</p></div><Link href="/host/today" className="text-xs font-medium text-[#1F1F1F] underline underline-offset-2">{t("host_dash_view_reservations", "View reservations")}</Link></div>
        {isRefreshing ? <ReservationSkeleton /> : kpis.nextUpcomingReservation ? <UpcomingReservation reservation={kpis.nextUpcomingReservation} onSelectBookingId={onSelectBookingId} t={t} /> : <p className="mt-4 border-t border-zinc-100 pt-4 text-sm text-[#727272]">{t("host_dash_no_upcoming_reservations", "No upcoming reservations scheduled. Manage availability in the")} <Link href="/host/calendar" className="font-medium underline underline-offset-2 text-[#1F1F1F]">{t("host_dash_host_calendar_link", "Host Calendar")}</Link>.</p>}
      </section>

      <section className={`mt-4 ${cardClass} p-5`} aria-labelledby="guest-information-heading">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="guest-information-heading" className="text-base font-semibold text-[#1F1F1F]">{t("host_dash_guest_insights_title", "Guest insights")}</h2><p className="mt-1 text-xs text-[#727272]">{t("host_dash_guest_insights_subtitle", "Completed stays over the last 6 months.")}</p></div>{isRefreshing ? <span className="h-3 w-24 animate-pulse rounded bg-zinc-100" /> : <span className="text-xs text-[#727272]">{guestAnalytics.completedGuestStaysCount} {t("host_dash_completed_stays_suffix", "completed stays")}</span>}</div>
        {isRefreshing ? <GuestInsightsSkeleton /> : <><div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-3"><MetricCell label={t("host_dash_unique_guests", "Unique guests")} value={String(guestAnalytics.uniqueGuestsCount)} /><MetricCell label={t("host_dash_returning_guests", "Returning guests")} value={String(guestAnalytics.returningGuestsCount)} detail={`${guestAnalytics.returningGuestsPercentage}% ${t("host_dash_of_guests", "of guests")}`} /><MetricCell label={t("host_dash_avg_rating", "Average rating")} value={reviews.overallRating === null ? "—" : `★ ${reviews.overallRating.toFixed(2)}`} detail={`${reviews.totalReviewsCount} ${t("host_dash_published_reviews", "published reviews")}`} /></div>
        {guestAnalytics.guestOrigins.length > 0 ? <div className="mt-4 border-t border-zinc-100 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">{t("host_dash_top_origins", "Top guest origins")}</p><div className="mt-3 space-y-2.5">{guestAnalytics.guestOrigins.slice(0, 5).map((origin) => <div key={`${origin.country}-${origin.city ?? "country"}`} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 text-xs"><div><div className="mb-1 flex justify-between gap-3 text-[#727272]"><span className="truncate">{origin.city ? `${origin.city}, ${origin.country}` : origin.country}</span><span>{origin.stayCount} {t("host_dash_stays_count", "stays")}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-700" style={{ width: `${Math.min(100, Math.max(0, origin.sharePercentage))}%` }} /></div></div><span className="text-right text-[#727272]">{origin.sharePercentage}%</span></div>)}</div>{guestAnalytics.staysWithoutRecordedOriginCount > 0 && <p className="mt-3 text-xs text-[#727272]">{guestAnalytics.staysWithoutRecordedOriginCount} {t("host_dash_stays_omitted", "stays without a recorded origin are omitted.")}</p>}</div> : <p className="mt-4 border-t border-zinc-100 pt-4 text-sm text-[#727272]">{t("host_dash_no_origin_data", "No completed-stay origin data is available yet.")}</p>}</>}
      </section>

      <section className={`mt-4 ${cardClass} p-5`} aria-labelledby="reviews-heading">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="reviews-heading" className="text-base font-semibold text-[#1F1F1F]">{t("host_dash_reviews_title", "Reviews and ratings")}</h2><p className="mt-1 text-xs text-[#727272]">{t("host_dash_reviews_subtitle", "Published reviews across the selected properties.")}</p></div>{isRefreshing ? <div><div className="h-5 w-12 animate-pulse rounded bg-zinc-100" /><div className="mt-2 h-3 w-16 animate-pulse rounded bg-zinc-100" /></div> : <div className="text-right"><p className="text-xl font-semibold text-[#1F1F1F]">{reviews.overallRating === null ? "—" : `★ ${reviews.overallRating.toFixed(2)}`}</p><p className="text-xs text-[#727272]">{reviews.totalReviewsCount} {reviews.totalReviewsCount === 1 ? t("host_dash_review_singular", "review") : t("host_dash_review_plural", "reviews")}</p></div>}</div>
        {isRefreshing ? <ReviewRefreshSkeleton /> : <><div className="mt-4 grid gap-6 border-t border-zinc-100 pt-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">{t("host_dash_review_trend", "Review trend")}</p><ReviewTrendChart trend={reviews.trend} t={t} /></div>{reviews.totalReviewsCount > 0 ? <div><p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">{t("host_dash_rating_details", "Rating details")}</p><div className="mt-3 space-y-2.5">{[
          [t("host_dash_cat_cleanliness", "Cleanliness"), reviews.categoryRatings.cleanliness],
          [t("host_dash_cat_accuracy", "Accuracy"), reviews.categoryRatings.accuracy],
          [t("host_dash_cat_check_in", "Check-in"), reviews.categoryRatings.checkIn],
          [t("host_dash_cat_communication", "Communication"), reviews.categoryRatings.communication],
          [t("host_dash_cat_location", "Location"), reviews.categoryRatings.location],
          [t("host_dash_cat_value", "Value"), reviews.categoryRatings.value]
        ].map(([label, rating]) => <RatingBar key={String(label)} label={String(label)} rating={rating as number | null} />)}</div></div> : <div className="flex min-h-[250px] items-center rounded-xl bg-zinc-50 px-5 text-sm text-[#727272]">{t("host_dash_no_published_reviews", "No published reviews yet.")}</div>}</div>
        {reviews.totalReviewsCount > 0 && reviews.recentReviews.length > 0 && <div className="mt-5 border-t border-zinc-100 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">{t("host_dash_recent_reviews", "Recent reviews")}</p><div className="mt-3 grid gap-3 lg:grid-cols-3">{reviews.recentReviews.slice(0, 3).map((review) => <article key={review.id} className="rounded-xl bg-zinc-50 p-3"><p className="text-sm font-medium text-[#1F1F1F]">{review.guestName} <span className="font-normal text-[#727272]">· ★ {review.rating}</span></p><p className="mt-0.5 text-xs text-[#727272]">{review.listingTitle}</p>{review.comment && <p className="mt-2 line-clamp-2 text-xs text-[#727272]">{review.comment}</p>}</article>)}</div></div>}</>}
      </section>

      <section className={`mt-4 ${cardClass} p-5`} aria-labelledby="host-status-heading">
        <div><h2 id="host-status-heading" className="text-base font-semibold text-[#1F1F1F]">{t("host_dash_status_title", "Host & listing status")}</h2><p className="mt-1 text-xs text-[#727272]">{t("host_dash_status_subtitle", "Official badges and listing readiness from stored evaluations.")}</p></div>
        {isRefreshing ? <StatusRefreshSkeleton /> : <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-3">
          <StatusCard title={t("host_dash_superhost_title", "Superhost")} status={superhostEvaluation.officialStatus ? t("host_dash_official_superhost", "Official Superhost") : superhostEvaluation.currentProgress.eligibleNow ? t("host_dash_eligible_next_eval", "Eligible at next evaluation") : t("host_dash_not_yet_eligible", "Not yet eligible")} tone={superhostEvaluation.officialStatus ? "positive" : "neutral"} details={[`${superhostEvaluation.currentProgress.completedReservationsCount} ${t("host_dash_completed_res_suffix", "completed reservations")}`, superhostEvaluation.currentProgress.overallRating === null ? t("host_dash_no_published_rating", "No published rating") : `★ ${superhostEvaluation.currentProgress.overallRating.toFixed(2)} ${t("host_dash_rating_suffix", "rating")}`, `${t("host_dash_next_eval_label", "Next evaluation:")} ${new Date(superhostEvaluation.nextEvaluationAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`]} />
          <StatusCard title={t("host_dash_guest_favorite_title", "Guest Favorite")} status={selectedFavorite?.officialStatus ? t("host_dash_guest_favorite_title", "Guest Favorite") : selectedFavorite?.eligibleNow ? t("host_dash_eligible_next_daily_eval", "Eligible at next daily evaluation") : t("host_dash_not_yet_eligible", "Not yet eligible")} tone={selectedFavorite?.officialStatus ? "positive" : "neutral"} details={[`${officialGuestFavorites} of ${guestFavoriteSummary.length} ${t("host_dash_listings_awarded", "listings officially awarded")}`, selectedFavorite ? `${selectedFavorite.title} · ${selectedFavorite.reviewsCount} ${t("host_dash_review_plural", "reviews")}` : t("host_dash_no_listing_eval", "No listing evaluation available"), selectedFavorite?.overallRating === null || !selectedFavorite ? t("host_dash_no_published_rating", "No published rating") : `★ ${selectedFavorite.overallRating.toFixed(2)} ${t("host_dash_rating_suffix", "rating")}`]} />
          <StatusCard title={t("host_dash_listing_health_title", "Listing health")} status={selectedHealthListing ? `${selectedHealthListing.completedChecks}/${selectedHealthListing.totalChecks} ${t("host_dash_details_complete", "details complete")}` : t("host_dash_no_listings", "No listings")} tone={selectedHealthListing && selectedHealthListing.missingFields.length === 0 ? "positive" : "neutral"} details={[selectedHealthListing ? `${selectedHealthListing.title} · ${selectedHealthListing.photoCount} ${t("host_dash_photos_suffix", "photos")} · ${selectedHealthListing.amenityCount} ${t("host_dash_amenities_suffix", "amenities")}` : "", selectedHealthListing?.missingFields.length ? `${t("host_dash_needs_prefix", "Needs:")} ${selectedHealthListing.missingFields.join(", ")}` : t("host_dash_checklist_complete", "All stored checklist details are present."), `${t("host_dash_response_time_label", "Response time:")} ${formatResponseTime(listingHealth.averageResponseTimeMinutes, t)}`]} />
        </div>}
      </section>
    </section>
  );
}

function PrimaryKpi({ refreshing, label, period, value, detail, detailTone, progress }: { refreshing: boolean; label: string; period: string; value: string; detail: string; detailTone?: "positive" | "negative"; progress?: number }) {
  return <article aria-busy={refreshing} className={`${cardClass} flex min-h-36 flex-col justify-between p-4 sm:p-5`}><div><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-semibold uppercase tracking-wider text-[#727272]">{label}</p><span className="max-w-28 text-right text-[10px] text-[#727272]">{period}</span></div>{refreshing ? <div className="mt-2 h-7 w-28 animate-pulse rounded bg-zinc-100" /> : <p className="mt-2 text-2xl font-semibold tracking-tight text-[#1F1F1F]">{value}</p>}</div><div className="mt-4 border-t border-zinc-100 pt-3">{refreshing ? <><div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />{progress !== undefined && <div className="mt-2 h-1.5 rounded-full bg-zinc-100" />}</> : <><p className={`text-xs ${detailTone === "positive" ? "text-emerald-700" : detailTone === "negative" ? "text-rose-700" : "text-[#727272]"}`}>{detail}</p>{progress !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-[#1F1F1F]" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>}</>}</div></article>;
}

function SecondaryKpi({ refreshing, label, value, detail }: { refreshing: boolean; label: string; value: string; detail: string }) {
  return <article aria-busy={refreshing} className={`${cardClass} p-3.5`}><p className="text-[10px] font-semibold uppercase tracking-wider text-[#727272]">{label}</p>{refreshing ? <><div className="mt-2 h-5 w-16 animate-pulse rounded bg-zinc-100" /><div className="mt-2 h-3 w-20 animate-pulse rounded bg-zinc-100" /></> : <><p className="mt-1.5 text-lg font-semibold text-[#1F1F1F]">{value}</p><p className="mt-1 text-[11px] text-[#727272]">{detail}</p></>}</article>;
}

function MetricCell({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#727272]">{label}</p><p className="mt-1 text-lg font-semibold text-[#1F1F1F]">{value}</p>{detail && <p className="mt-1 text-[11px] text-[#727272]">{detail}</p>}</div>;
}

function EarningsDetailsSkeleton() {
  return <><div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">{[...Array(6)].map((_, index) => <div key={index}><div className="h-3 w-16 animate-pulse rounded bg-zinc-100" /><div className="mt-2 h-4 w-20 animate-pulse rounded bg-zinc-100" /></div>)}</div><div className="mt-4 h-3 w-3/4 animate-pulse rounded bg-zinc-100" /></>;
}

function SectionRowSkeleton({ count }: { count: number }) {
  return <>{[...Array(count)].map((_, index) => <div key={index} className="rounded-xl bg-zinc-50 px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-zinc-200" /><div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-zinc-100" /><div className="mt-3 h-3 w-20 animate-pulse rounded bg-zinc-100" /></div>)}</>;
}

function ReservationSkeleton() {
  return <div className="mt-4 grid gap-4 border-t border-zinc-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto]"><div className="flex items-start gap-3"><div className="size-10 animate-pulse rounded-full bg-zinc-100" /><div className="flex-1"><div className="h-4 w-44 animate-pulse rounded bg-zinc-100" /><div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-zinc-100" /></div></div><div><div className="h-3 w-20 animate-pulse rounded bg-zinc-100" /><div className="mt-2 h-4 w-16 animate-pulse rounded bg-zinc-100" /></div></div>;
}

function GuestInsightsSkeleton() {
  return <><div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-3">{[...Array(3)].map((_, index) => <div key={index} className="rounded-xl bg-zinc-50 p-3"><div className="h-3 w-20 animate-pulse rounded bg-zinc-100" /><div className="mt-2 h-5 w-12 animate-pulse rounded bg-zinc-200" /><div className="mt-2 h-3 w-24 animate-pulse rounded bg-zinc-100" /></div>)}</div><div className="mt-4 border-t border-zinc-100 pt-4"><div className="h-3 w-24 animate-pulse rounded bg-zinc-100" /><div className="mt-3 space-y-3">{[...Array(3)].map((_, index) => <div key={index}><div className="h-3 w-40 animate-pulse rounded bg-zinc-100" /><div className="mt-2 h-1.5 w-full animate-pulse rounded-full bg-zinc-100" /></div>)}</div></div></>;
}

function ReviewRefreshSkeleton() {
  return <div className="mt-4 grid gap-6 border-t border-zinc-100 pt-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"><div><div className="h-3 w-20 animate-pulse rounded bg-zinc-100" /><div className="mt-3 h-[250px] animate-pulse rounded-xl bg-zinc-50" /></div><div><div className="h-3 w-20 animate-pulse rounded bg-zinc-100" /><div className="mt-3 space-y-4">{[...Array(6)].map((_, index) => <div key={index} className="h-3 animate-pulse rounded bg-zinc-100" />)}</div></div></div>;
}

function StatusRefreshSkeleton() {
  return <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-3">{[...Array(3)].map((_, index) => <div key={index} className="rounded-xl bg-zinc-50 p-4"><div className="h-4 w-24 animate-pulse rounded bg-zinc-200" /><div className="mt-3 h-6 w-32 animate-pulse rounded-full bg-white" /><div className="mt-4 space-y-2"><div className="h-3 w-full animate-pulse rounded bg-zinc-100" /><div className="h-3 w-4/5 animate-pulse rounded bg-zinc-100" /></div></div>)}</div>;
}

function PriorityTag({ priority }: { priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" }) {
  const tone = priority === "CRITICAL" ? "bg-rose-100 text-rose-800" : priority === "HIGH" ? "bg-amber-100 text-amber-900" : "bg-zinc-200 text-zinc-700";
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{priority}</span>;
}

function UpcomingReservation({ reservation, onSelectBookingId, t }: { reservation: NonNullable<HostDashboardData["kpis"]["nextUpcomingReservation"]>; onSelectBookingId?: (bookingId: string) => void; t: (key: any, fallback?: string) => string }) {
  return <div className="mt-4 grid gap-4 border-t border-zinc-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto]"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">{reservation.guestImage ? <Image src={reservation.guestImage} alt={reservation.guestName} width={40} height={40} unoptimized className="size-full object-cover" /> : reservation.guestName.charAt(0).toUpperCase()}</div><div><p className="text-sm font-medium text-[#1F1F1F]">{reservation.guestName} <span className="font-normal text-[#727272]">· {reservation.listingTitle}</span></p><p className="mt-1 text-xs text-[#727272]">{reservation.startDate} {t("host_dash_at_time", "at")} {reservation.checkInTime} · {reservation.endDate} · {reservation.nights} {reservation.nights === 1 ? t("host_dash_night_singular", "night") : t("host_dash_night_plural", "nights")} · {reservation.guests} {reservation.guests === 1 ? t("host_dash_guest_singular", "guest") : t("host_dash_guest_plural", "guests")}</p></div></div><div className="flex items-center gap-4 md:text-right"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-[#727272]">{reservation.isPayoutEligible ? t("host_dash_eligible_payout", "Eligible payout") : t("host_dash_payment_status", "Payment status")}</p><p className="mt-1 text-sm font-semibold text-[#1F1F1F]">{reservation.isPayoutEligible ? formatCurrency(reservation.hostPayoutCents, reservation.currency) : t("host_dash_pending_payment", "Pending payment")}</p></div>{onSelectBookingId && <button type="button" onClick={() => onSelectBookingId(reservation.id)} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-[#1F1F1F] transition hover:border-zinc-500">{t("host_dash_btn_details", "Details")}</button>}</div></div>;
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

function ReviewTrendChart({ trend, t }: { trend: HostDashboardData["reviews"]["trend"]; t: (key: any, fallback?: string) => string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hasReviews = trend.some((point) => point.reviewCount > 0);
  const chartWidth = 560;
  const chartHeight = 250;
  const inset = { top: 18, right: 14, bottom: 34, left: 32 };
  const plotWidth = chartWidth - inset.left - inset.right;
  const plotHeight = chartHeight - inset.top - inset.bottom;

  if (!hasReviews) {
    return <div className="mt-3 flex h-[250px] items-center justify-center rounded-xl bg-zinc-50 px-5 text-center text-sm text-[#727272]">{t("host_dash_no_reviews_in_period", "No reviews in this period")}</div>;
  }

  const maxCount = Math.max(...trend.map((point) => point.reviewCount));
  const yMax = Math.max(2, Math.ceil(maxCount / 2) * 2);
  const yTicks = Array.from(new Set([0, Math.ceil(yMax / 2), yMax]));
  const xFor = (index: number) => inset.left + (trend.length <= 1 ? plotWidth / 2 : (index / (trend.length - 1)) * plotWidth);
  const yFor = (count: number) => inset.top + ((yMax - count) / yMax) * plotHeight;
  const linePath = trend.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(point.reviewCount)}`).join(" ");
  const hoveredPoint = hoveredIndex === null ? null : trend[hoveredIndex];

  return (
    <div className="relative mt-3 h-[250px]" aria-label={t("host_dash_aria_review_chart", "Monthly published review count for the last 12 months")}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="size-full overflow-visible" role="img" aria-label={t("host_dash_aria_review_trend", "Review count trend")}>
        {yTicks.map((tick) => <g key={tick}><line x1={inset.left} x2={chartWidth - inset.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#e4e4e7" strokeWidth="1" /><text x={inset.left - 8} y={yFor(tick) + 4} textAnchor="end" fill="#71717a" fontSize="10">{tick}</text></g>)}
        <path d={linePath} fill="none" stroke="#222222" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {trend.map((point, index) => <g key={point.month}><circle cx={xFor(index)} cy={yFor(point.reviewCount)} r={hoveredIndex === index ? 5 : 3.5} fill="#222222" stroke="white" strokeWidth="2" /><circle cx={xFor(index)} cy={yFor(point.reviewCount)} r="13" fill="transparent" className="cursor-pointer" role="button" tabIndex={0} aria-label={`${formatTrendMonth(point.month, true)}: ${point.reviewCount} ${point.reviewCount === 1 ? t("host_dash_review_singular", "review") : t("host_dash_review_plural", "reviews")}`} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} /></g>)}
        {trend.map((point, index) => <text key={`${point.month}-label`} x={xFor(index)} y={chartHeight - 8} textAnchor="middle" fill="#71717a" fontSize="10">{index % 2 === 0 || trend.length <= 6 ? formatTrendMonth(point.month) : ""}</text>)}
      </svg>
      {hoveredPoint && hoveredIndex !== null && <div role="tooltip" className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg bg-[#1F1F1F] px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${Math.min(92, Math.max(8, (hoveredIndex / Math.max(1, trend.length - 1)) * 100))}%` }}><p className="font-medium">{formatTrendMonth(hoveredPoint.month, true)}</p><p className="mt-0.5 text-zinc-300">{hoveredPoint.reviewCount} {hoveredPoint.reviewCount === 1 ? t("host_dash_review_singular", "review") : t("host_dash_review_plural", "reviews")}</p></div>}
    </div>
  );
}

function RatingBar({ label, rating }: { label: string; rating: number | null }) {
  return <div className="grid grid-cols-[6.75rem_minmax(0,1fr)_2.25rem] items-center gap-2 text-xs"><span className="text-[#727272]">{label}</span><div className="h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-700" style={{ width: `${rating === null ? 0 : Math.min(100, Math.max(0, (rating / 5) * 100))}%` }} /></div><span className="text-right font-medium text-[#1F1F1F]">{rating === null ? "—" : rating.toFixed(1)}</span></div>;
}

function StatusCard({ title, status, tone, details }: { title: string; status: string; tone: "positive" | "neutral"; details: string[] }) {
  return <article className="rounded-xl bg-zinc-50 p-4"><p className="text-sm font-semibold text-[#1F1F1F]">{title}</p><p className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium ${tone === "positive" ? "bg-emerald-100 text-emerald-800" : "bg-white text-zinc-700"}`}>{status}</p><ul className="mt-3 space-y-1.5 text-xs text-[#727272]">{details.filter(Boolean).map((detail) => <li key={detail}>{detail}</li>)}</ul></article>;
}

/** Route and in-component loading fallback, matched to the dashboard's visual hierarchy. */
export function HostDashboardOverviewSkeleton() {
  const { t } = useLanguage();
  return <section aria-label={t("host_dash_aria_loading", "Loading host performance dashboard")} aria-busy="true" className="mx-auto mb-10 w-full max-w-[1240px] animate-pulse font-sans"><div className="mb-6 flex items-end justify-between gap-4"><div><div className="h-8 w-60 rounded-lg bg-zinc-200" /><div className="mt-2 h-4 w-32 rounded bg-zinc-100" /></div><div className="h-9 w-36 rounded-lg bg-zinc-100" /></div><div className={primaryKpiGridClass}>{[...Array(4)].map((_, index) => <KpiCardSkeleton key={index} />)}</div><div className={`mt-3 ${secondaryKpiGridClass}`}>{[...Array(5)].map((_, index) => <SecondaryKpiSkeleton key={index} />)}</div><div className={`mt-3 ${cardClass} h-12`} /><DashboardSectionSkeleton className="mt-6" bodyRows={2} /><DashboardSectionSkeleton className="mt-4" bodyRows={1} /><ReviewSectionSkeleton /><DashboardSectionSkeleton className="mt-4" bodyRows={2} /><DashboardSectionSkeleton className="mt-4" metricCount={3} /></section>;
}

function KpiCardSkeleton() { return <div className={`${cardClass} flex min-h-36 flex-col justify-between p-5`}><div className="flex justify-between gap-2"><div className="h-3 w-24 rounded bg-zinc-100" /><div className="h-3 w-14 rounded bg-zinc-100" /></div><div className="h-8 w-28 rounded bg-zinc-200" /><div className="h-3 w-32 border-t border-zinc-100 pt-3" /></div>; }
function SecondaryKpiSkeleton() { return <div className={`${cardClass} p-3.5`}><div className="h-3 w-24 rounded bg-zinc-100" /><div className="mt-3 h-5 w-16 rounded bg-zinc-200" /><div className="mt-2 h-3 w-20 rounded bg-zinc-100" /></div>; }
function ReviewSectionSkeleton() { return <section className={`mt-4 ${cardClass} p-5`}><div className="flex justify-between gap-3"><div><div className="h-5 w-32 rounded bg-zinc-200" /><div className="mt-2 h-3 w-64 max-w-full rounded bg-zinc-100" /></div><div><div className="h-5 w-12 rounded bg-zinc-200" /><div className="mt-2 h-3 w-16 rounded bg-zinc-100" /></div></div><div className="mt-4 grid gap-6 border-t border-zinc-100 pt-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"><div><div className="h-3 w-20 rounded bg-zinc-100" /><div className="mt-3 h-[250px] rounded-xl bg-zinc-50" /></div><div><div className="h-3 w-20 rounded bg-zinc-100" /><div className="mt-3 space-y-4">{[...Array(6)].map((_, index) => <div key={index} className="h-3 rounded bg-zinc-100" />)}</div></div></div></section>; }
function DashboardSectionSkeleton({ className, metricCount = 0, bodyRows = 0 }: { className: string; metricCount?: number; bodyRows?: number }) { return <section className={`${className} ${cardClass} p-5`}><div className="flex justify-between gap-3"><div><div className="h-5 w-40 rounded bg-zinc-200" /><div className="mt-2 h-3 w-64 max-w-full rounded bg-zinc-100" /></div><div className="h-5 w-20 rounded bg-zinc-100" /></div><div className="mt-4 border-t border-zinc-100 pt-4">{metricCount > 0 && <div className={`grid gap-3 ${metricCount === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>{[...Array(metricCount)].map((_, index) => <div key={index} className="rounded-xl bg-zinc-50 p-3"><div className="h-3 w-16 rounded bg-zinc-100" /><div className="mt-2 h-5 w-20 rounded bg-zinc-200" /></div>)}</div>}{bodyRows > 0 && <div className={`${metricCount ? "mt-4" : ""} space-y-3`}>{[...Array(bodyRows)].map((_, index) => <div key={index} className="h-14 rounded-xl bg-zinc-50" />)}</div>}</div></section>; }
