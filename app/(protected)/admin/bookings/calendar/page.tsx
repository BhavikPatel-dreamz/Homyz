import React from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { bookingService } from "@/services/booking.service";
import { AdminCalendarClient } from "./admin-calendar-client";

export const dynamic = "force-dynamic";

export default async function AdminBookingsCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const sp = searchParams ? await searchParams : undefined;
  const readParam = (name: string) => {
    const value = sp?.[name];
    return typeof value === "string" ? value : undefined;
  };
  const requestedListingId = readParam("listingId") || readParam("propertyId");
  const isSinglePropertyView = Boolean(requestedListingId) || readParam("view") === "single";

  // The all-properties timeline is the default. The existing per-property
  // calendar remains available whenever a listing is selected.
  const page = Math.max(1, Number(readParam("page")) || 1);
  const limit = [10, 20, 50].includes(Number(readParam("limit")))
    ? Number(readParam("limit"))
    : 20;
  let listings = [];
  let allCalendarData = null;
  let calendarData = null;
  const selectedListingId: string | null = requestedListingId || null;

  if (isSinglePropertyView) {
    listings = await bookingService.listPropertiesForAdminCalendar(actor, undefined, 30);
    try {
      if (selectedListingId) {
        calendarData = await bookingService.getAdminCalendarData(actor, selectedListingId, readParam("month"));
      }
    } catch (e) {
      console.warn("[AdminBookingsCalendarPage] Failed to fetch calendar data:", e);
      calendarData = null;
    }
  } else {
    allCalendarData = await bookingService.getAdminAllPropertiesCalendarData(actor, {
      page,
      limit,
      startDate: readParam("startDate"),
      endDate: readParam("endDate"),
      search: readParam("search"),
      hostId: readParam("hostId"),
      city: readParam("city"),
      cityKey: readParam("cityKey"),
      country: readParam("country"),
      status: readParam("status"),
      propertyType: readParam("propertyType"),
      bookingStatus: readParam("bookingStatus"),
      filterListingId: readParam("filterListingId"),
    });
    listings = allCalendarData.properties.map((property) => ({
      ...property,
      bookingCount: property.bookings.length,
    }));
  }

  return (
    <AdminCalendarClient
      initialListings={listings}
      initialSelectedListingId={selectedListingId}
      initialCalendarData={calendarData}
      initialAllCalendarData={allCalendarData}
      initialCalendarScope={isSinglePropertyView ? "single" : "all"}
      initialMonth={readParam("month")}
      initialView={readParam("calendarView") || readParam("view")}
    />
  );
}
