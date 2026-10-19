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
  badge: z.string().max(50).optional().default(""),
  lastUpdated: z.string().max(50).optional().default(""),
  sections: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().max(200).optional().default(""),
      body: z.string().min(1, "Section body text is required"),
      layout: z.enum(["STANDARD", "TWO_COLUMN", "ACCORDION", "CALLOUT", "GRID", "MEDIA"]).default("STANDARD"),
      calloutVariant: z.enum(["info", "warning", "success", "tip"]).optional(),
      imageUrl: z.string().optional(),
      imageAlt: z.string().optional(),
      items: z.array(
        z.object({
          label: z.string().min(1),
          text: z.string().min(1),
        })
      ).optional(),
    })
  ).min(1, "At least one section is required"),
  translations: z.record(z.string(), z.any()).optional(),
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
      id: z.string().optional(),
      title: z.string().min(1),
      displayOrder: z.number().int().optional().default(0),
      enabled: z.boolean().optional().default(true),
      translations: z.record(z.string(), z.object({ title: z.string() })).optional(),
      links: z.array(
        z.object({
          id: z.string().optional(),
          label: z.string().min(1),
          href: z.string().min(1),
          targetPageSlug: z.string().optional(),
          openInNewTab: z.boolean().optional(),
          enabled: z.boolean().optional(),
          displayOrder: z.number().int().optional(),
          badge: z.string().optional(),
          translations: z.record(z.string(), z.object({ label: z.string() })).optional(),
        })
      ),
    })
  ),
  socialLinks: z.array(
    z.object({
      id: z.string().optional(),
      platform: z.string().min(1),
      url: z.string().min(1),
      label: z.string().optional(),
      enabled: z.boolean().optional(),
      displayOrder: z.number().int().optional(),
    })
  ).optional().default([]),
  bottomLinks: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string().min(1),
      href: z.string().min(1),
      targetPageSlug: z.string().optional(),
      openInNewTab: z.boolean().optional(),
      enabled: z.boolean().optional(),
      displayOrder: z.number().int().optional(),
      translations: z.record(z.string(), z.object({ label: z.string() })).optional(),
    })
  ).optional().default([]),
  copyrightNotice: z.string().max(200).optional().default("© 2026 Homyz Inc. All rights reserved."),
  legalNotice: z.string().max(500).optional().default(""),
  showBackToTop: z.boolean().optional().default(true),
  showSocialIcons: z.boolean().optional().default(true),
  appearance: z.object({
    backgroundColor: z.string().optional().default("#F3F4F5"),
    textColor: z.string().optional().default("#000000"),
    mutedTextColor: z.string().optional().default("#727272"),
    borderColor: z.string().optional().default("rgba(31,31,31,0.9)"),
    accentColor: z.string().optional().default("#FCDF9C"),
  }).optional().default({
    backgroundColor: "#F3F4F5",
    textColor: "#000000",
    mutedTextColor: "#727272",
    borderColor: "rgba(31,31,31,0.9)",
    accentColor: "#FCDF9C",
  }),
  translations: z.record(z.string(), z.object({
    copyrightNotice: z.string().optional(),
    legalNotice: z.string().optional(),
  })).optional(),
});

export const GlobalSettingsPayloadSchema = z.object({
  siteName: z.string().min(1).default("Homyz"),
  tagline: z.string().default("Travel & Hospitality Platform"),
  logoUrl: z.string().optional().default("/images/home/homyz-logo.png"),
  faviconUrl: z.string().optional().default("/favicon.ico"),
  supportEmail: z.string().email().default("support@homyz.com"),
  supportPhone: z.string().default("+966 11 000 0000"),
  legalEntityName: z.string().default("Homyz Hospitality Ltd."),
  registeredAddress: z.string().default("King Fahd Road, Riyadh, Kingdom of Saudi Arabia"),
  businessRegistrationNumber: z.string().default("CR-1010892341"),
  defaultLocale: z.string().default("en"),
  supportedLocales: z.array(z.string()).default(["en", "ar", "es", "fr", "de", "hi"]),
  defaultCurrency: z.string().default("SAR"),
  socialMedia: z.object({
    facebook: z.string().optional().default("https://facebook.com"),
    twitter: z.string().optional().default("https://twitter.com"),
    instagram: z.string().optional().default("https://instagram.com"),
    linkedin: z.string().optional().default(""),
    youtube: z.string().optional().default(""),
  }).default({
    facebook: "https://facebook.com",
    twitter: "https://twitter.com",
    instagram: "https://instagram.com",
    linkedin: "",
    youtube: "",
  }),
  seo: z.object({
    defaultMetaTitle: z.string().default("Homyz — Travel & Hospitality Platform"),
    defaultMetaDescription: z.string().default("Stay like a homie. Premium booking and property management."),
    ogImageUrl: z.string().optional().default("/images/home/hero.png"),
  }).default({
    defaultMetaTitle: "Homyz — Travel & Hospitality Platform",
    defaultMetaDescription: "Stay like a homie. Premium booking and property management.",
    ogImageUrl: "/images/home/hero.png",
  }),
  footer: z.object({
    copyrightText: z.string().default("© 2026 Homyz Inc. All rights reserved."),
    showBackToTop: z.boolean().default(true),
  }).default({
    copyrightText: "© 2026 Homyz Inc. All rights reserved.",
    showBackToTop: true,
  }),
});

export type GlobalSettingsPayload = z.infer<typeof GlobalSettingsPayloadSchema>;
export type FooterConfigPayload = z.infer<typeof FooterConfigPayloadSchema>;
export type StaticPagePayload = z.infer<typeof StaticPagePayloadSchema>;

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
          id: "col-support",
          title: "Support",
          displayOrder: 1,
          enabled: true,
          links: [
            { id: "lnk-help", label: "Help Center", href: "/help", enabled: true, displayOrder: 1 },
            { id: "lnk-safety", label: "Get help with a safety issue", href: "/safety", targetPageSlug: "safety", enabled: true, displayOrder: 2 },
            { id: "lnk-disability", label: "Disability support", href: "/accessibility", targetPageSlug: "accessibility", enabled: true, displayOrder: 3 },
            { id: "lnk-cancellation", label: "Cancellation options", href: "/cancellation-policy", targetPageSlug: "cancellation-policy", enabled: true, displayOrder: 4 },
            { id: "lnk-report", label: "Report neighborhood concern", href: "/anti-discrimination", targetPageSlug: "anti-discrimination", enabled: true, displayOrder: 5 },
          ],
        },
        {
          id: "col-hosting",
          title: "Hosting",
          displayOrder: 2,
          enabled: true,
          links: [
            { id: "lnk-homyz-home", label: "Homyz your home", href: "/become-a-host", enabled: true, displayOrder: 1 },
            { id: "lnk-homyz-exp", label: "Homyz your experience", href: "/hosting-resources", targetPageSlug: "hosting-resources", enabled: true, displayOrder: 2 },
            { id: "lnk-homyz-srv", label: "Homyz your service", href: "/hosting-responsibly", targetPageSlug: "hosting-responsibly", enabled: true, displayOrder: 3 },
            { id: "lnk-for-hosts", label: "Homyz for Hosts", href: "/host/onboarding", enabled: true, displayOrder: 4 },
            { id: "lnk-hosting-res", label: "Hosting resources", href: "/hosting-resources", targetPageSlug: "hosting-resources", enabled: true, displayOrder: 5 },
            { id: "lnk-hosting-resp", label: "Hosting responsibly", href: "/hosting-responsibly", targetPageSlug: "hosting-responsibly", enabled: true, displayOrder: 6 },
            { id: "lnk-find-cohost", label: "Find a co-host", href: "/host/co-host", enabled: true, displayOrder: 7 },
          ],
        },
        {
          id: "col-homyz",
          title: "Homyz",
          displayOrder: 3,
          enabled: true,
          links: [
            { id: "lnk-newsroom", label: "Newsroom", href: "/newsroom", targetPageSlug: "newsroom", enabled: true, displayOrder: 1 },
            { id: "lnk-careers", label: "Careers", href: "/careers", targetPageSlug: "careers", enabled: true, displayOrder: 2 },
            { id: "lnk-about", label: "About Us", href: "/about", targetPageSlug: "about", enabled: true, displayOrder: 3 },
            { id: "lnk-giftcards", label: "Gift cards", href: "/giftcards", enabled: true, displayOrder: 4 },
            { id: "lnk-contact", label: "Contact Us", href: "/contact", targetPageSlug: "contact", enabled: true, displayOrder: 5 },
          ],
        },
      ],
      socialLinks: [
        { id: "soc-fb", platform: "facebook", url: "https://facebook.com", enabled: true, displayOrder: 1 },
        { id: "soc-tw", platform: "twitter", url: "https://twitter.com", enabled: true, displayOrder: 2 },
        { id: "soc-ig", platform: "instagram", url: "https://instagram.com", enabled: true, displayOrder: 3 },
      ],
      bottomLinks: [
        { id: "bot-privacy", label: "Privacy", href: "/privacy", targetPageSlug: "privacy", enabled: true, displayOrder: 1 },
        { id: "bot-terms", label: "Terms", href: "/terms", targetPageSlug: "terms", enabled: true, displayOrder: 2 },
        { id: "bot-cookies", label: "Cookies", href: "/cookies", targetPageSlug: "cookies", enabled: true, displayOrder: 3 },
      ],
      copyrightNotice: "© 2026 Homyz Inc. All rights reserved.",
      legalNotice: "",
      showBackToTop: true,
      showSocialIcons: true,
      appearance: {
        backgroundColor: "#F3F4F5",
        textColor: "#000000",
        mutedTextColor: "#727272",
        borderColor: "rgba(31,31,31,0.9)",
        accentColor: "#FCDF9C",
      },
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

