import { revalidatePath } from "next/cache";

/**
 * Centrally revalidates all Next.js server-rendered routes and layouts
 * associated with bookings across traveler, host, and admin surfaces.
 */
export function revalidateBookingPaths(bookingId?: string) {
  try {
    // 1. Guest / Traveler booking & profile routes
    revalidatePath("/profile/tab/upcoming");
    revalidatePath("/profile/tab/past");
    revalidatePath("/profile/tab/today");
    revalidatePath("/profile/tab/upcoming_trips");
    revalidatePath("/profile/tab/past_bookings");
    revalidatePath("/profile/tab/[[...slug]]", "page");
    revalidatePath("/profile", "page");
    revalidatePath("/profile", "layout");
    revalidatePath("/bookings");
    revalidatePath("/dashboard");
    if (bookingId) {
      revalidatePath(`/bookings/${bookingId}`);
    }
    revalidatePath("/travel-profile");

    // 2. Host operational & earnings routes
    revalidatePath("/host/bookings");
    revalidatePath("/host/today");
    revalidatePath("/host/earnings");
    revalidatePath("/host/earnings/upcoming");

    // 3. Admin booking management routes
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/bookings/all");
  } catch (err) {
    // Expected when running outside Next.js request context (e.g. unit tests, CLI, workers)
    console.warn("[revalidateBookingPaths] Warning:", err);
  }
}
