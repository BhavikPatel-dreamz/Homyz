"use client";

import React, { useState, useMemo } from "react";
import { ReservationCard, ReservationCardData } from "./reservation-card";
import { FilterBar, FilterOptions } from "./filter-bar";
import { LoadingSkeleton } from "./loading-skeleton";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";

const SAMPLE_RESERVATIONS: ReservationCardData[] = [
  {
    id: "res-1",
    propertyName: "Villa Breeze Malibu",
    location: "Malibu, California",
    propertyImage: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=600&q=80",
    startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    guestName: "Mark Davis",
    guestCount: 3,
    status: "CONFIRMED",
    checkOutTime: "12:00 PM",
    actionType: "check_out",
    isToday: true,
  },
  {
    id: "res-2",
    propertyName: "Alpine Loft Haven",
    location: "Aspen, Colorado",
    propertyImage: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80",
    startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18),
    guestName: "Sarah Jenkins",
    guestCount: 2,
    status: "CONFIRMED",
    checkOutTime: "12:00 PM",
    actionType: "check_out",
    isToday: false,
  },
  {
    id: "res-3",
    propertyName: "Seaside Bungalow",
    location: "Miami Beach, Florida",
    propertyImage: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80",
    startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 25),
    guestName: "Elena Rostova",
    guestCount: 4,
    status: "CONFIRMED",
    checkInTime: "3:00 PM",
    actionType: "check_in",
    isToday: false,
  },
  {
    id: "res-4",
    propertyName: "Modern City Penthouse",
    location: "New York, NY",
    propertyImage: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80",
    startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 35),
    guestName: "David Kim",
    guestCount: 1,
    status: "CONFIRMED",
    checkInTime: "4:00 PM",
    actionType: "check_in",
    isToday: false,
  },
  {
    id: "res-5",
    propertyName: "Lakeside Cabin Retreat",
    location: "Tahoe, Nevada",
    propertyImage: "https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=600&q=80",
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
    endDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    guestName: "Alex Vance",
    guestCount: 2,
    status: "CONFIRMED",
    checkOutTime: "11:00 AM",
    actionType: "check_out",
    isToday: false,
  },
  {
    id: "res-6",
    propertyName: "Highland Stone Cottage",
    location: "Portland, Oregon",
    propertyImage: null,
    startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
    guestName: "Chloe Martin",
    guestCount: 2,
    status: "PENDING",
    checkInTime: "2:00 PM",
    actionType: "check_in",
    isToday: false,
  },
];

export function ReservationDashboard({
  initialReservations = [],
}: {
  initialReservations?: ReservationCardData[];
}) {
  const [filters, setFilters] = useState<FilterOptions>({
    tab: "today",
    search: "",
    status: "ALL",
    dateRange: "ALL",
  });

  const [selectedRes, setSelectedRes] = useState<ReservationCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const combinedData = useMemo(() => {
    if (initialReservations.length > 0) {
      return [...initialReservations, ...SAMPLE_RESERVATIONS.slice(initialReservations.length)];
    }
    return SAMPLE_RESERVATIONS;
  }, [initialReservations]);

  const filteredItems = useMemo(() => {
    return combinedData.filter((item) => {
      // Tab Filter
      if (filters.tab === "today" && !item.isToday) {
        // Also allow items with start date matching today
        const start = new Date(item.startDate);
        const isTodayDate = new Date().toDateString() === start.toDateString();
        if (!isTodayDate && !item.isToday) return false;
      }
      if (filters.tab === "upcoming") {
        const start = new Date(item.startDate);
        if (start < new Date() && !item.isToday) return false;
      }
      if (filters.tab === "past") {
        const end = new Date(item.endDate);
        if (end > new Date()) return false;
      }

      // Status Filter
      if (filters.status !== "ALL" && item.status !== filters.status) {
        return false;
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
    });
  }, [combinedData, filters]);

  const handleFilterChange = (updated: Partial<FilterOptions>) => {
    setLoading(true);
    setFilters((prev) => ({ ...prev, ...updated }));
    setTimeout(() => setLoading(false), 200);
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header & Filter Controls matching Screenshots */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        totalCount={filteredItems.length}
      />

      {/* Main Reservation Cards Grid matching Reference Screenshots */}
      {error ? (
        <ErrorState message={error} onRetry={() => setError(null)} />
      ) : loading ? (
        <LoadingSkeleton count={4} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={`No ${filters.tab} reservations`}
          description="Try adjusting your search criteria or switching filter tabs."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filteredItems.map((item) => (
            <ReservationCard
              key={item.id}
              data={item}
              onSelect={(res) => setSelectedRes(res)}
            />
          ))}
        </div>
      )}

      {/* Selected Reservation Details Drawer / Modal */}
      {selectedRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#FBDE9B] dark:bg-[#f59e0b]" />
                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  Reservation Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRes(null)}
                className="rounded-full p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="py-5 flex flex-col gap-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">Property</span>
                <span className="font-bold text-[var(--foreground)]">{selectedRes.propertyName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">Location</span>
                <span className="font-semibold text-[var(--foreground)]">{selectedRes.location}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">Guest Name</span>
                <span className="font-semibold text-[var(--foreground)]">{selectedRes.guestName || "Guest"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">Status</span>
                <span className="rounded-full bg-[#FBDE9B] px-3 py-0.5 text-xs font-extrabold text-[#291E05] dark:bg-[#f59e0b] dark:text-zinc-950">
                  {selectedRes.status || "CONFIRMED"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-end border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setSelectedRes(null)}
                className="rounded-full bg-[var(--primary)] px-5 py-2 text-xs font-bold text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
