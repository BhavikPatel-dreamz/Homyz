import { z } from "zod";

export interface RemovalOption {
  id: string;
  label: string;
}

export interface RemovalCategory {
  id: string;
  title: string;
  options: RemovalOption[];
}

export const LISTING_REMOVAL_SURVEY: RemovalCategory[] = [
  {
    id: "no_longer_able",
    title: "I'm no longer able to host.",
    options: [
      { id: "no_property", label: "I don't currently have a property to list." },
      { id: "legally_unable", label: "Legally, I'm no longer able to host." },
      { id: "neighbours_issue", label: "My neighbours have made it hard for me to host." },
      { id: "lifestyle_fit", label: "Hosting no longer fits my lifestyle." },
      { id: "another_reason_no_longer_able", label: "Another reason" },
    ],
  },
  {
    id: "not_ready",
    title: "I'm not ready to host right now.",
    options: [
      { id: "host_occasionally", label: "I only host occasionally." },
      { id: "getting_property_ready", label: "I've created my listing but need to get my property ready to host guests." },
      { id: "renovating_improvements", label: "I'm renovating my place or making improvements." },
      { id: "another_reason_not_ready", label: "Another reason" },
    ],
  },
  {
    id: "expected_more_platform",
    title: "I expected more from Homyz.",
    options: [
      { id: "better_customer_support", label: "I was hoping for better customer support from Homyz as a host." },
      { id: "no_longer_trust", label: "I no longer trust Homyz to treat hosts fairly." },
      { id: "more_supportive_resources", label: "I wanted more supportive resources from Homyz." },
      { id: "improve_policies", label: "I think Homyz can improve its policies." },
      { id: "another_reason_expected_more", label: "Another reason" },
    ],
  },
  {
    id: "make_more_money",
    title: "I was hoping to make more money.",
    options: [
      { id: "more_work_than_anticipated", label: "Managing the property was more work than I anticipated." },
      { id: "dealing_with_taxes", label: "Dealing with taxes was too much work." },
      { id: "registration_process", label: "The local registration process was too much work." },
      { id: "hoped_more_bookings", label: "I hoped to get more bookings." },
      { id: "expected_more_money", label: "I expected to make more money." },
      { id: "another_reason_more_money", label: "Another reason" },
    ],
  },
  {
    id: "smoothly_with_guests",
    title: "I expected things to go more smoothly with guests.",
    options: [
      { id: "guests_rules", label: "Guests didn't follow my house rules." },
      { id: "guests_damage", label: "Guests stole or damaged my property." },
      { id: "guests_cancellations", label: "Guests cancelled their reservations too often." },
      { id: "guests_rude", label: "Guests were rude or demanding." },
      { id: "guests_unfair_reviews", label: "Guests left unfair reviews." },
      { id: "another_reason_guests", label: "Another reason" },
    ],
  },
  {
    id: "duplicate_listing",
    title: "This is a duplicate listing.",
    options: [
      { id: "is_duplicate", label: "This is a duplicate listing." },
    ],
  },
];

export const removeListingInputSchema = z.object({
  listingId: z.string().min(1, "Listing ID is required"),
  categories: z.array(z.string()).min(1, "Please select at least one category"),
  reasons: z.array(z.string()).min(1, "Please choose at least one reason for removing your listing"),
  customFeedback: z.string().max(2000).optional(),
});

export type RemoveListingInput = z.infer<typeof removeListingInputSchema>;

