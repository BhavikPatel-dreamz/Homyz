import { z } from "zod";
import { CmsContentTypeEnum } from "@/generated/prisma/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Content Type Schemas & Registry
// ─────────────────────────────────────────────────────────────────────────────

export const HeroSectionPayloadSchema = z.object({
  heading: z.string().min(1, "Heading is required").max(200),
  subheading: z.string().max(500).optional().default(""),
  badgeText: z.string().max(50).optional().default(""),
  backgroundImageUrl: z.string().min(1, "Background image is required"),
  mobileBackgroundImageUrl: z.string().optional().default(""),
  showSearchBar: z.boolean().default(true),
  primaryCta: z.object({
    label: z.string().max(50).optional().default(""),
    url: z.string().max(200).optional().default(""),
  }).optional(),
});

export const HomepageBannerPayloadSchema = z.object({
  title: z.string().min(1, "Title is required").max(150),
  description: z.string().max(500).optional().default(""),
  imageUrl: z.string().min(1, "Banner image is required"),
  linkUrl: z.string().max(200).optional().default(""),
  buttonText: z.string().max(50).optional().default(""),
  backgroundColor: z.string().max(30).optional().default("#000000"),
  textColor: z.string().max(30).optional().default("#FFFFFF"),
});

export const FeaturedCityItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "City name is required"),
  slug: z.string().min(1, "City slug is required"),
  country: z.string().min(1, "Country is required"),
  imageUrl: z.string().min(1, "City image is required"),
  listingCountLabel: z.string().optional().default(""),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  priority: z.number().int().default(0),
});

export const FeaturedCitiesPayloadSchema = z.object({
  title: z.string().min(1, "Section title is required").max(100),
  subtitle: z.string().max(200).optional().default(""),
  layout: z.enum(["GRID", "CAROUSEL"]).default("CAROUSEL"),
  cities: z.array(FeaturedCityItemSchema).min(1, "At least one city is required"),
});

export const FeaturedListingsPayloadSchema = z.object({
  title: z.string().min(1, "Section title is required").max(100),
  subtitle: z.string().max(200).optional().default(""),
  city: z.string().optional().default(""),
  country: z.string().optional().default(""),
  category: z.string().optional().default(""),
  listingIds: z.array(z.string()).optional().default([]),
  limit: z.number().int().min(1).max(50).default(12),
  sortBy: z.enum(["POPULARITY", "NEWEST", "RATING", "PRICE_ASC", "PRICE_DESC"]).default("POPULARITY"),
  featuredOnly: z.boolean().default(false),
});

export const PromotionalCampaignPayloadSchema = z.object({
  campaignName: z.string().min(1, "Campaign name is required").max(100),
  headline: z.string().min(1, "Headline is required").max(200),
  subheadline: z.string().max(500).optional().default(""),
  promoCode: z.string().max(50).optional().default(""),
  discountPercent: z.number().min(0).max(100).optional(),
  imageUrl: z.string().min(1, "Campaign image is required"),
  ctaText: z.string().max(50).optional().default("Book Now"),
  ctaUrl: z.string().max(200).optional().default("/"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  termsUrl: z.string().optional().default(""),
});

export const FaqItemPayloadSchema = z.object({
  question: z.string().min(1, "Question is required").max(300),
  answer: z.string().min(1, "Answer is required").max(5000),
  category: z.string().min(1, "Category is required").max(100),
  order: z.number().int().default(0),
  audience: z.enum(["ALL", "GUEST", "HOST"]).default("ALL"),
});

export const FaqCategoryPayloadSchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  slug: z.string().min(1, "Category slug is required").max(100),
  description: z.string().max(300).optional().default(""),
  icon: z.string().max(50).optional().default(""),
  order: z.number().int().default(0),
});

export const StaticPagePayloadSchema = z.object({
  metaTitle: z.string().min(1, "Meta title is required").max(150),
  metaDescription: z.string().max(300).optional().default(""),
  heroTitle: z.string().min(1, "Hero title is required").max(200),
  heroSubtitle: z.string().max(500).optional().default(""),
  sections: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().max(200).optional().default(""),
      body: z.string().min(1, "Section body text is required"),
      layout: z.enum(["STANDARD", "TWO_COLUMN", "ACCORDION", "CALLOUT"]).default("STANDARD"),
    })
  ).min(1, "At least one section is required"),
});

export const SeoLandingPagePayloadSchema = z.object({
  targetCity: z.string().min(1, "City is required"),
  targetCountry: z.string().min(1, "Country is required"),
  h1Heading: z.string().min(1, "H1 is required").max(150),
  introText: z.string().min(1, "Intro text is required").max(1000),
  metaTitle: z.string().min(1, "Meta title is required").max(150),
  metaDescription: z.string().min(1, "Meta description is required").max(300),
  canonicalUrl: z.string().optional().default(""),
  faqItems: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
    })
  ).optional().default([]),
});

export const AnnouncementBarPayloadSchema = z.object({
  text: z.string().min(1, "Text is required").max(250),
  linkText: z.string().max(50).optional().default(""),
  linkUrl: z.string().max(200).optional().default(""),
  bgColor: z.string().max(30).optional().default("#1F1F1F"),
  textColor: z.string().max(30).optional().default("#FFFFFF"),
  isActive: z.boolean().default(true),
});

export const NavigationConfigPayloadSchema = z.object({
  mainLinks: z.array(
    z.object({
      label: z.string().min(1),
      href: z.string().min(1),
      openInNewTab: z.boolean().default(false),
    })
  ),
});

export const FooterConfigPayloadSchema = z.object({
  columns: z.array(
    z.object({
      title: z.string().min(1),
      links: z.array(
        z.object({
          label: z.string().min(1),
          href: z.string().min(1),
        })
      ),
    })
  ),
  copyrightNotice: z.string().max(200).optional().default("© 2026 Homyz Inc. All rights reserved."),
  legalNotice: z.string().max(500).optional().default(""),
});

// ─────────────────────────────────────────────────────────────────────────────
// Content Type Registry Contract
// ─────────────────────────────────────────────────────────────────────────────

export interface ContentTypeDefinition {
  type: CmsContentTypeEnum;
  displayName: string;
  description: string;
  schema: z.ZodType<any>;
  supportsSlug: boolean;
  supportsScheduling: boolean;
  supportsPreview: boolean;
  defaultPayload: Record<string, unknown>;
  allowedPlacements: string[];
}

export const CONTENT_TYPE_REGISTRY: Record<CmsContentTypeEnum, ContentTypeDefinition> = {
  [CmsContentTypeEnum.HERO_SECTION]: {
    type: CmsContentTypeEnum.HERO_SECTION,
    displayName: "Homepage Hero Section",
    description: "Main above-the-fold hero banner with integrated search and imagery",
    schema: HeroSectionPayloadSchema,
    supportsSlug: false,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      heading: "Find your next perfect stay",
      subheading: "Discover premium homes and unique stays across Saudi Arabia and the Middle East.",
      backgroundImageUrl: "/images/home/hero.png",
      showSearchBar: true,
    },
    allowedPlacements: ["HOMEPAGE_HERO"],
  },
  [CmsContentTypeEnum.HOMEPAGE_BANNER]: {
    type: CmsContentTypeEnum.HOMEPAGE_BANNER,
    displayName: "Homepage Banner",
    description: "Promotional or informational visual banners displayed on the homepage",
    schema: HomepageBannerPayloadSchema,
    supportsSlug: false,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      title: "Exclusive Getaways",
      description: "Experience luxury retreats and unforgettable hospitality.",
      imageUrl: "/images/home/hero-banner.png",
      backgroundColor: "#1F1F1F",
      textColor: "#FFFFFF",
    },
    allowedPlacements: ["HOMEPAGE_BANNER", "HOMEPAGE_MID_BANNER"],
  },
  [CmsContentTypeEnum.FEATURED_CITIES]: {
    type: CmsContentTypeEnum.FEATURED_CITIES,
    displayName: "Featured Cities Section",
    description: "Curated destination grid or carousel showcasing top cities",
    schema: FeaturedCitiesPayloadSchema,
    supportsSlug: false,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      title: "Explore Popular Destinations",
      subtitle: "Discover the best stays in top destinations",
      layout: "CAROUSEL",
      cities: [
        { name: "Riyadh", slug: "riyadh", country: "Saudi Arabia", imageUrl: "/images/home/hero.png", priority: 1 },
        { name: "Jeddah", slug: "jeddah", country: "Saudi Arabia", imageUrl: "/images/home/hero.png", priority: 2 },
      ],
    },
    allowedPlacements: ["HOMEPAGE_SECTION"],
  },
  [CmsContentTypeEnum.FEATURED_LISTINGS]: {
    type: CmsContentTypeEnum.FEATURED_LISTINGS,
    displayName: "Featured Listings Carousel",
    description: "Curated or dynamically filtered listing collection row",
    schema: FeaturedListingsPayloadSchema,
    supportsSlug: false,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      title: "Trending Stays",
      subtitle: "Most popular properties this month",
      limit: 12,
      sortBy: "POPULARITY",
      featuredOnly: false,
    },
    allowedPlacements: ["HOMEPAGE_SECTION"],
  },
  [CmsContentTypeEnum.PROPERTY_COLLECTION]: {
    type: CmsContentTypeEnum.PROPERTY_COLLECTION,
    displayName: "Property Collection",
    description: "Custom themed property showcase (e.g. Luxury Villas, Beachfront)",
    schema: FeaturedListingsPayloadSchema,
    supportsSlug: true,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      title: "Luxury Villas",
      subtitle: "Exclusive private villas with exceptional amenities",
      category: "villa",
      limit: 12,
      sortBy: "RATING",
      featuredOnly: true,
    },
    allowedPlacements: ["HOMEPAGE_SECTION", "LANDING_PAGE"],
  },
  [CmsContentTypeEnum.PROMOTIONAL_CAMPAIGN]: {
    type: CmsContentTypeEnum.PROMOTIONAL_CAMPAIGN,
    displayName: "Promotional Campaign",
    description: "Seasonal discounts and special offer campaigns",
    schema: PromotionalCampaignPayloadSchema,
    supportsSlug: true,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      campaignName: "National Day Special",
      headline: "Celebrate with Special Rates",
      subheadline: "Save up to 20% on selected properties",
      imageUrl: "/images/home/hero.png",
      ctaText: "Explore Offers",
    },
    allowedPlacements: ["CAMPAIGN_PAGE", "HOMEPAGE_BANNER"],
  },
  [CmsContentTypeEnum.FAQ_ITEM]: {
    type: CmsContentTypeEnum.FAQ_ITEM,
    displayName: "FAQ Item",
    description: "Individual frequently asked question and answer",
    schema: FaqItemPayloadSchema,
    supportsSlug: false,
    supportsScheduling: false,
    supportsPreview: true,
    defaultPayload: {
      question: "How do I cancel my reservation?",
      answer: "You can cancel your reservation through your upcoming trips tab in your profile.",
      category: "Booking & Reservations",
      order: 0,
      audience: "ALL",
    },
    allowedPlacements: ["HELP_CENTER", "LISTING_PAGE"],
  },
  [CmsContentTypeEnum.FAQ_CATEGORY]: {
    type: CmsContentTypeEnum.FAQ_CATEGORY,
    displayName: "FAQ Category",
    description: "Topic grouping for FAQs",
    schema: FaqCategoryPayloadSchema,
    supportsSlug: true,
    supportsScheduling: false,
    supportsPreview: false,
    defaultPayload: {
      name: "Booking & Reservations",
      slug: "booking-reservations",
      description: "Everything you need to know about searching and booking stays.",
      order: 1,
    },
    allowedPlacements: ["HELP_CENTER"],
  },
  [CmsContentTypeEnum.STATIC_PAGE]: {
    type: CmsContentTypeEnum.STATIC_PAGE,
    displayName: "Static Page",
    description: "Content page such as Terms, Privacy Policy, About Us, or Safety",
    schema: StaticPagePayloadSchema,
    supportsSlug: true,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      metaTitle: "About Homyz",
      heroTitle: "About Homyz",
      heroSubtitle: "Transforming regional travel and property hospitality.",
      sections: [
        {
          title: "Our Mission",
          body: "Homyz connects discerning travelers with remarkable accommodations across the Middle East.",
          layout: "STANDARD",
        },
      ],
    },
    allowedPlacements: ["STATIC_ROUTE"],
  },
  [CmsContentTypeEnum.SEO_LANDING_PAGE]: {
    type: CmsContentTypeEnum.SEO_LANDING_PAGE,
    displayName: "SEO Landing Page",
    description: "Optimized landing page targeted at specific destinations or search queries",
    schema: SeoLandingPagePayloadSchema,
    supportsSlug: true,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      targetCity: "Riyadh",
      targetCountry: "Saudi Arabia",
      h1Heading: "Vacation Rentals & Apartments in Riyadh",
      introText: "Find and book unique vacation homes and luxury apartments in Riyadh.",
      metaTitle: "Best Vacation Rentals in Riyadh | Homyz",
      metaDescription: "Explore handpicked luxury stays and cozy apartments in Riyadh. Instant confirmation.",
    },
    allowedPlacements: ["SEO_ROUTE"],
  },
  [CmsContentTypeEnum.ANNOUNCEMENT_BAR]: {
    type: CmsContentTypeEnum.ANNOUNCEMENT_BAR,
    displayName: "Announcement Bar",
    description: "Top-level notification bar across all pages",
    schema: AnnouncementBarPayloadSchema,
    supportsSlug: false,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      text: "Enjoy complimentary cancellation on select summer stays.",
      isActive: true,
    },
    allowedPlacements: ["HEADER_ANNOUNCEMENT"],
  },
  [CmsContentTypeEnum.NAVIGATION_CONFIG]: {
    type: CmsContentTypeEnum.NAVIGATION_CONFIG,
    displayName: "Header Navigation",
    description: "Custom primary navigation links",
    schema: NavigationConfigPayloadSchema,
    supportsSlug: false,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      mainLinks: [
        { label: "Stays", href: "/" },
        { label: "Become a Host", href: "/become-a-host" },
      ],
    },
    allowedPlacements: ["GLOBAL_HEADER"],
  },
  [CmsContentTypeEnum.FOOTER_CONFIG]: {
    type: CmsContentTypeEnum.FOOTER_CONFIG,
    displayName: "Footer Configuration",
    description: "Custom footer columns, links, and disclaimers",
    schema: FooterConfigPayloadSchema,
    supportsSlug: false,
    supportsScheduling: true,
    supportsPreview: true,
    defaultPayload: {
      columns: [
        {
          title: "Support",
          links: [
            { label: "Help Center", href: "/help" },
            { label: "Safety Information", href: "/not-available?page=safety-issue" },
          ],
        },
      ],
      copyrightNotice: "© 2026 Homyz Inc. All rights reserved.",
    },
    allowedPlacements: ["GLOBAL_FOOTER"],
  },
};

export function getContentTypeDefinition(type: CmsContentTypeEnum): ContentTypeDefinition {
  const def = CONTENT_TYPE_REGISTRY[type];
  if (!def) {
    throw new Error(`Unsupported content type: ${type}`);
  }
  return def;
}

export function validateContentPayload(type: CmsContentTypeEnum, payload: unknown) {
  const def = getContentTypeDefinition(type);
  return def.schema.parse(payload);
}

