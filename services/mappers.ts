import type { Booking, Listing, User } from "@/generated/prisma/client";

// DTO mappers. The ONLY shape of a user/listing/booking that leaves the service
// layer. `passwordHash` (and any future secret column) is never included here,
// so it can never appear in an API response or Server Action result.

export function toPublicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    image: u.image,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    createdAt: u.createdAt,
  };
}
export type PublicUser = ReturnType<typeof toPublicUser>;

export function toListingDTO(l: Listing) {
  return {
    id: l.id,
    hostId: l.hostId,
    title: l.title,
    description: l.description,
    price: l.price,
    published: l.published,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}
export type ListingDTO = ReturnType<typeof toListingDTO>;

export function toBookingDTO(b: Booking) {
  return {
    id: b.id,
    userId: b.userId,
    listingId: b.listingId,
    status: b.status,
    startDate: b.startDate,
    endDate: b.endDate,
    createdAt: b.createdAt,
  };
}
export type BookingDTO = ReturnType<typeof toBookingDTO>;
