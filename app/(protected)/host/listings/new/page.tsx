import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { listingService } from "@/services/listing.service";
import { createListingSchema } from "@/lib/validation/listing";
import { Role } from "@/generated/prisma/enums";

export default async function NewListingPage() {
  const actor = await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);

  // Create a new draft listing for the host
  const newListing = await listingService.create(
    actor,
    createListingSchema.parse({
      title: "Draft Listing",
      description: "",
      price: 15000,
      hostingType: "HOME",
      propertyType: "Rental unit*",
      listingType: "Entire place",
      guests: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      published: false,
    })
  );

  // Instantly redirect to the Figma-designed Host Listing Editor
  redirect(`/host/listings/${newListing.id}`);
}
