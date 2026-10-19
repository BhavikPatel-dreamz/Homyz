import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Homepage Section Registry & Template Contracts (Phase 3 Foundation)
// ─────────────────────────────────────────────────────────────────────────────

export type SectionTemplateId =
  | "HERO_SEARCH_BANNER"
  | "CITY_GRID_CAROUSEL"
  | "LISTING_CARD_CAROUSEL"
  | "PROMOTIONAL_SPLIT_BANNER"
  | "FAQ_ACCORDION_SECTION";

export interface SectionTemplateDefinition {
  id: SectionTemplateId;
  name: string;
  description: string;
  category: "HERO" | "DESTINATIONS" | "LISTINGS" | "MARKETING" | "SUPPORT";
  supportsPropertyQuery: boolean;
  supportsMedia: boolean;
  supportsCta: boolean;
  defaultConfig: Record<string, unknown>;
}

export const PropertyQueryConfigSchema = z.object({
  city: z.string().optional(),
  country: z.string().optional(),
  category: z.string().optional(),
  featuredOnly: z.boolean().default(false),
  manualListingIds: z.array(z.string()).default([]),
  limit: z.number().int().min(1).max(50).default(12),
  sortBy: z.enum(["POPULARITY", "NEWEST", "RATING", "PRICE_ASC", "PRICE_DESC"]).default("POPULARITY"),
  activeOnly: z.boolean().default(true),
});

export const SectionConfigSchema = z.object({
  templateId: z.enum([
    "HERO_SEARCH_BANNER",
    "CITY_GRID_CAROUSEL",
    "LISTING_CARD_CAROUSEL",
    "PROMOTIONAL_SPLIT_BANNER",
    "FAQ_ACCORDION_SECTION",
  ]),
  sectionKey: z.string().min(1),
  title: z.string().max(100).optional(),
  subtitle: z.string().max(250).optional(),
  displayOrder: z.number().int().default(0),
  isVisible: z.boolean().default(true),
  propertyQuery: PropertyQueryConfigSchema.optional(),
  desktopColumns: z.number().int().min(1).max(6).default(4),
  mobileScrollMode: z.enum(["SNAP_HORIZONTAL", "STACKED"]).default("SNAP_HORIZONTAL"),
  ctaText: z.string().max(50).optional(),
  ctaLink: z.string().max(200).optional(),
});

export type SectionConfig = z.infer<typeof SectionConfigSchema>;

export const SECTION_TEMPLATE_REGISTRY: Record<SectionTemplateId, SectionTemplateDefinition> = {
  HERO_SEARCH_BANNER: {
    id: "HERO_SEARCH_BANNER",
    name: "Hero Search Banner",
    description: "Primary above-the-fold banner with search controls",
    category: "HERO",
    supportsPropertyQuery: false,
    supportsMedia: true,
    supportsCta: true,
    defaultConfig: {
      showSearchBar: true,
      badgeText: "Exclusive stays",
    },
  },
  CITY_GRID_CAROUSEL: {
    id: "CITY_GRID_CAROUSEL",
    name: "City Destinations Carousel",
    description: "Horizontal carousel of destination cards with high-quality photography",
    category: "DESTINATIONS",
    supportsPropertyQuery: false,
    supportsMedia: true,
    supportsCta: true,
    defaultConfig: {
      desktopColumns: 4,
      mobileScrollMode: "SNAP_HORIZONTAL",
    },
  },
  LISTING_CARD_CAROUSEL: {
    id: "LISTING_CARD_CAROUSEL",
    name: "Listing Card Carousel Row",
    description: "Horizontal carousel of property cards with progressive lazy loading",
    category: "LISTINGS",
    supportsPropertyQuery: true,
    supportsMedia: false,
    supportsCta: true,
    defaultConfig: {
      desktopColumns: 4,
      propertyQuery: {
        limit: 12,
        sortBy: "POPULARITY",
        activeOnly: true,
      },
    },
  },
  PROMOTIONAL_SPLIT_BANNER: {
    id: "PROMOTIONAL_SPLIT_BANNER",
    name: "Promotional Split Banner",
    description: "Two-column marketing feature with imagery, headline, and call-to-action",
    category: "MARKETING",
    supportsPropertyQuery: false,
    supportsMedia: true,
    supportsCta: true,
    defaultConfig: {
      layout: "IMAGE_LEFT",
    },
  },
  FAQ_ACCORDION_SECTION: {
    id: "FAQ_ACCORDION_SECTION",
    name: "FAQ Accordion Section",
    description: "Collapsible questions and answers for customer reassurance",
    category: "SUPPORT",
    supportsPropertyQuery: false,
    supportsMedia: false,
    supportsCta: true,
    defaultConfig: {
      allowMultipleOpen: false,
    },
  },
};

export function listSectionTemplates(): SectionTemplateDefinition[] {
  return Object.values(SECTION_TEMPLATE_REGISTRY);
}

export function validateSectionConfig(input: unknown): SectionConfig {
  return SectionConfigSchema.parse(input);
}

