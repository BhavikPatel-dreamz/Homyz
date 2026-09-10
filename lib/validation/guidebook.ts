import { z } from "zod";

export const GUIDEBOOK_CATEGORIES = [
  { id: "FOOD_AND_DRINK", label: "Food & drink", icon: "🍽️" },
  { id: "COFFEE_AND_CAFES", label: "Coffee & cafés", icon: "☕" },
  { id: "SIGHTSEEING", label: "Sightseeing", icon: "🏛️" },
  { id: "SHOPPING", label: "Shopping", icon: "🛍️" },
  { id: "OUTDOORS", label: "Outdoors", icon: "🌳" },
  { id: "ENTERTAINMENT", label: "Entertainment", icon: "🎭" },
  { id: "NIGHTLIFE", label: "Nightlife", icon: "🍸" },
  { id: "ESSENTIALS", label: "Essentials", icon: "🛒" },
  { id: "GETTING_AROUND", label: "Getting around", icon: "🚇" },
  { id: "FAMILY", label: "Family", icon: "👨‍👩‍👧" },
  { id: "WELLNESS", label: "Wellness", icon: "🧘" },
  { id: "LOCAL_FAVORITE", label: "Local favorites", icon: "⭐" },
] as const;

export const TIP_CATEGORIES = [
  { id: "GETTING_AROUND", label: "Getting around", icon: "🚕" },
  { id: "BEFORE_YOU_GO", label: "Before you go", icon: "🧳" },
  { id: "LOCAL_ETIQUETTE", label: "Local etiquette", icon: "🤝" },
  { id: "SHOPPING", label: "Shopping tips", icon: "🏷️" },
  { id: "FAMILY", label: "Family tips", icon: "🧸" },
  { id: "LONG_STAYS", label: "Long stays", icon: "🏠" },
  { id: "WEATHER", label: "Weather & season", icon: "☀️" },
  { id: "USEFUL_INFO", label: "Useful information", icon: "ℹ️" },
] as const;

export type GuidebookCategoryId = (typeof GUIDEBOOK_CATEGORIES)[number]["id"];
export type TipCategoryId = (typeof TIP_CATEGORIES)[number]["id"];

// Images uploaded by this app are stored under /uploads in local development
// and use an absolute S3 URL in production.  `z.url()` alone rejects the
// local URL returned by the upload API, which prevented guidebooks containing
// an uploaded photo from being saved.
const guidebookMediaUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value.startsWith("/uploads/guidebook-photos/") ||
      /^https?:\/\/.+/i.test(value),
    "Photo must be an uploaded guidebook image or an absolute URL"
  );

export const createGuidebookSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Guidebook title must be at least 2 characters")
    .max(100, "Guidebook title cannot exceed 100 characters"),
  coverImage: guidebookMediaUrlSchema.optional().nullable(),
  description: z.string().trim().max(1200, "Guidebook details cannot exceed 1200 characters").optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  countryCode: z.string().trim().max(10).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  formattedAddress: z.string().trim().max(300).optional().nullable(),
  listingIds: z.array(z.string().trim()).optional().default([]),
  published: z.boolean().optional().default(true),
});

export type CreateGuidebookInput = z.infer<typeof createGuidebookSchema>;

export const updateGuidebookSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Guidebook title must be at least 2 characters")
    .max(100, "Guidebook title cannot exceed 100 characters")
    .optional(),
  coverImage: guidebookMediaUrlSchema.optional().nullable(),
  description: z.string().trim().max(1200, "Guidebook details cannot exceed 1200 characters").optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  countryCode: z.string().trim().max(10).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  formattedAddress: z.string().trim().max(300).optional().nullable(),
  published: z.boolean().optional(),
});

export type UpdateGuidebookInput = z.infer<typeof updateGuidebookSchema>;

export const createGuidebookItemSchema = z.object({
  type: z.enum(["PLACE", "NEIGHBORHOOD", "TIP"]).default("PLACE"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(150, "Title cannot exceed 150 characters"),
  category: z.string().trim().min(1, "Category is required"),
  description: z.string().trim().max(1200, "Recommendation cannot exceed 1200 characters").optional().nullable(),
  hostTip: z.string().trim().max(600, "Host tip cannot exceed 600 characters").optional().nullable(),
  photo: guidebookMediaUrlSchema.optional().nullable(),
  placeProviderId: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  isFavorite: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

export type CreateGuidebookItemInput = z.infer<typeof createGuidebookItemSchema>;

export const updateGuidebookItemSchema = createGuidebookItemSchema.partial();

export type UpdateGuidebookItemInput = z.infer<typeof updateGuidebookItemSchema>;

export const reorderGuidebookItemsSchema = z.object({
  itemIds: z.array(z.string().trim()).min(1, "Must provide at least one item ID"),
});

export type ReorderGuidebookItemsInput = z.infer<typeof reorderGuidebookItemsSchema>;

export const setGuidebookListingsSchema = z.object({
  listingIds: z.array(z.string().trim()),
});

export type SetGuidebookListingsInput = z.infer<typeof setGuidebookListingsSchema>;

export function getCategoryLabel(category: string): string {
  const match = GUIDEBOOK_CATEGORIES.find((c) => c.id === category);
  if (match) return match.label;
  const tipMatch = TIP_CATEGORIES.find((t) => t.id === category);
  if (tipMatch) return tipMatch.label;
  return category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getCategoryIcon(category: string): string {
  const match = GUIDEBOOK_CATEGORIES.find((c) => c.id === category);
  if (match) return match.icon;
  const tipMatch = TIP_CATEGORIES.find((t) => t.id === category);
  if (tipMatch) return tipMatch.icon;
  return "📍";
}
