"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ReservationCard, ReservationCardData } from "./reservation-card";
import { FilterBar, FilterOptions } from "./filter-bar";
import { LoadingSkeleton } from "./loading-skeleton";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { toReservationCardData } from "@/lib/profile/reservation-data";
import { MyReviewsSection } from "@/components/profile/my-reviews-section";
import type { GuestAuthoredReviewDTO } from "@/lib/profile/profile-loader";
import type { BookingDTO } from "@/services/mappers";
import { bookingDateEpoch, bookingDateYear } from "@/lib/booking/booking-date";
import { isUpcomingBookingStatus } from "@/lib/booking/booking-status";
import { useLanguage } from "@/lib/i18n/language-context";

export function ReservationDashboard({
  initialReservations,
  initialTab = "today",
  reviews = [],
  onTabChange,
  wideGuestGrid = false,
}: {
  initialReservations?: ReservationCardData[];
  initialTab?: FilterOptions["tab"];
  reviews?: GuestAuthoredReviewDTO[];
  onTabChange?: (tab: FilterOptions["tab"]) => void;
  /** Enables five columns only for the full-width guest dashboard. */
  wideGuestGrid?: boolean;
}) {
  const searchParams = useSearchParams();
  const requestedBookingView = searchParams.get("bookingView");
  const resolvedInitialTab: FilterOptions["tab"] = requestedBookingView === "all" ? "all" : initialTab;
  const { t } = useLanguage();
  const [reservations, setReservations] = useState<ReservationCardData[]>(initialReservations || []);
  const [filters, setFilters] = useState<FilterOptions>({
    tab: resolvedInitialTab,
    search: "",
    status: "ALL",
    dateRange: "ALL",
  });
  const [loading, setLoading] = useState<boolean>(initialReservations === undefined);
  const [error, setError] = useState<string | null>(null);
  const reservationGridClassName = wideGuestGrid
    ? "grid grid-cols-1 items-start gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    : "grid grid-cols-1 items-start gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4";

  useEffect(() => {
    if (initialReservations !== undefined) return;

    const controller = new AbortController();

    fetch("/api/v1/bookings?limit=50", {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(t("dashboard_error_unable_load", "Unable to load reservations. Please try again."));
        }
        return res.json();
      })
      .then((json) => {
        const rawItems = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.items)
            ? json.items
            : [];
        const mapped = rawItems.map((booking: BookingDTO) => toReservationCardData(booking));
        setReservations(mapped);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || t("dashboard_error_failed_load", "Failed to load reservations"));
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [initialReservations]);

  const filteredItems = useMemo(() => {
    const todayMidnight = bookingDateEpoch(new Date());

    return reservations.filter((item) => {
      const status = item.status || "PENDING";
      const endMidnight = bookingDateEpoch(item.endDate);

      // Tab Filter:
      // "today": check-in is today, or currently staying today
      if (filters.tab === "today") {
        if (status === "CANCELLED" || status === "DECLINED" || status === "EXPIRED" || !item.isToday) return false;
      }

      // "upcoming": active future requests and confirmed stays whose check-out date has not passed.
      if (filters.tab === "upcoming") {
        if (!isUpcomingBookingStatus(status)) return false;
        if (endMidnight < todayMidnight) return false;
      }

      // "past": completed stay where check-out has passed or terminal cancelled/declined/expired requests
      if (filters.tab === "past") {
        const isTerminal = status === "CANCELLED" || status === "DECLINED" || status === "EXPIRED";
        if (!isTerminal && endMidnight >= todayMidnight) return false;
      }

      // Status Filter
      if (filters.status !== "ALL") {
        if (filters.status === "CONFIRMED" && status !== "CONFIRMED" && status !== "CURRENT_STAY") {
          return false;
        }
        if (filters.status === "CANCELLED" && status !== "CANCELLED" && status !== "DECLINED" && status !== "EXPIRED") {
          return false;
        }
        if (filters.status === "PENDING" && status !== "PENDING") {
          if (status !== "PENDING_HOST_CONFIRMATION") return false;
        }
      }

      // Search Filter
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const prop = (item.propertyName || "").toLowerCase();
        const loc = (item.location || "").toLowerCase();
        const guest = (item.guestName || "").toLowerCase();
        if (!prop.includes(q) && !loc.includes(q) && !guest.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((left, right) => {
      if (filters.tab === "past") {
        return bookingDateEpoch(right.endDate) - bookingDateEpoch(left.endDate);
      }
      return bookingDateEpoch(left.startDate) - bookingDateEpoch(right.startDate);
    });
  }, [reservations, filters]);

  const upcomingGroups = useMemo(() => {
    if (filters.tab !== "upcoming") return { pending: [], confirmed: [] };
    return {
      pending: filteredItems.filter((item) => item.status === "PENDING" || item.status === "PENDING_HOST_CONFIRMATION"),
      confirmed: filteredItems.filter((item) => item.status === "CONFIRMED" || item.status === "CURRENT_STAY"),
    };
  }, [filteredItems, filters.tab]);

  // Group past bookings by stay completion year (newest year first, newest stay inside)
  const pastYearGroups = useMemo(() => {
    if (filters.tab !== "past") return [];
    const groups = new Map<number, ReservationCardData[]>();
    const sorted = [...filteredItems].sort(
      (a, b) => bookingDateEpoch(b.endDate) - bookingDateEpoch(a.endDate),
    );
    for (const item of sorted) {
      const year = bookingDateYear(item.endDate);
      if (year === null) continue;
      const group = groups.get(year) ?? [];
      group.push(item);
      groups.set(year, group);
    }
    return Array.from(groups, ([year, items]) => ({ year, items })).sort(
      (a, b) => b.year - a.year,
    );
  }, [filteredItems, filters.tab]);

  const handleFilterChange = (updated: Partial<FilterOptions>) => {
    if (updated.tab) {
      setLoading(true);
      if (onTabChange) {
        onTabChange(updated.tab);
      }
      setTimeout(() => setLoading(false), 200);
    }
    setFilters((prev) => ({ ...prev, ...updated }));
  };

  return (
    <div className="flex flex-col gap-8 sm:pb-12 pb-5">
      {/* Header & Filter Controls */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        totalCount={filteredItems.length}
      />

      {/* Main Reservation Cards Grid */}
      {error ? (
        <ErrorState message={error} onRetry={() => setError(null)} />
      ) : loading ? (
        <LoadingSkeleton count={4} wideGuestGrid={wideGuestGrid} />
      ) : filteredItems.length === 0 ? (
        filters.tab === "upcoming" && !filters.search ? (
          <EmptyState
            title={t("dashboard_empty_upcoming_title", "No upcoming trips yet")}
            description={t("dashboard_empty_upcoming_desc", "Time to dust off your bags and start planning your next great adventure.")}
            actionHref="/"
            actionText={t("dashboard_empty_explore_action", "Explore stays")}
          />
        ) : filters.tab === "past" && !filters.search ? (
          <div className="space-y-12">
            <EmptyState
              title={t("dashboard_empty_past_title", "No past bookings yet")}
              description={t("dashboard_empty_past_desc", "Once you complete trips with Homyz, your completed bookings will be cataloged here.")}
              actionHref="/"
              actionText={t("dashboard_empty_explore_action", "Explore stays")}
            />
            {/* My Reviews Section below past bookings even if past bookings are empty */}
            <div className="pt-8 border-t border-zinc-200/80">
              <MyReviewsSection reviews={reviews} />
            </div>
          </div>
        ) : (
          <EmptyState
            title={t("dashboard_empty_generic_title" as any, { tab: filters.tab }, `No ${filters.tab} reservations`)}
            description={t("dashboard_empty_generic_desc" as any, "Try adjusting your search criteria or switching filter tabs.")}
          />
        )
      ) : filters.tab === "upcoming" ? (
        <div className="flex flex-col gap-10 sm:gap-12">
          {upcomingGroups.pending.length > 0 && (
            <section aria-labelledby="pending-requests-heading">
              <h2 id="pending-requests-heading" className="mb-5 text-xl font-semibold leading-7 text-[#1F1F1F] sm:text-2xl">
                {t("dashboard_pending_requests", { count: upcomingGroups.pending.length }, `Pending requests (${upcomingGroups.pending.length})`)}
              </h2>
              <div className="grid max-w-[812px] grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingGroups.pending.map((item) => (
                  <ReservationCard key={item.id} data={item} href={`/bookings/${item.id}`} />
                ))}
              </div>
            </section>
          )}

          {upcomingGroups.confirmed.length > 0 && (
            <section aria-labelledby="confirmed-trips-heading">
              <h2 id="confirmed-trips-heading" className="mb-5 text-xl font-semibold leading-7 text-[#1F1F1F] sm:text-2xl">
                {t("dashboard_confirmed_trips", { count: upcomingGroups.confirmed.length }, `Confirmed trips (${upcomingGroups.confirmed.length})`)}
              </h2>
              <div className="grid max-w-[812px] grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingGroups.confirmed.map((item) => (
                  <ReservationCard key={item.id} data={item} href={`/bookings/${item.id}`} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : filters.tab === "past" ? (
        <div className="flex flex-col gap-12 sm:gap-14">
          <div className="flex flex-col gap-12 sm:gap-14">
            {pastYearGroups.map(({ year, items }) => (
              <section key={year} aria-labelledby={`bookings-year-${year}`}>
                <h2 id={`bookings-year-${year}`} className="text-xl font-semibold leading-7 text-[#1F1F1F] mb-5 sm:text-2xl">
                  {year}
                </h2>
                <div className={reservationGridClassName}>
                  {items.map((item) => (
                    <ReservationCard
                      key={item.id}
                      data={item}
                      href={`/bookings/${item.id}`}
                      variant="past"
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Specification Requirement: My Reviews section below Past Bookings */}
          <div className="pt-10 border-t border-zinc-200/80">
            <MyReviewsSection reviews={reviews} />
          </div>
        </div>
      ) : (
                <div className={reservationGridClassName}>
          {filteredItems.map((item) => (
            <ReservationCard
              key={item.id}
              data={item}
              href={`/bookings/${item.id}`}
              variant="past"
            />
          ))}
        </div>
      )}
    </div>
  );
}
