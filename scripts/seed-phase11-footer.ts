import "dotenv/config";
import { prisma } from "../lib/db/prisma";
import { CmsContentStatus, CmsContentTypeEnum } from "../generated/prisma/enums";
import {
  FooterConfigPayloadSchema,
  GlobalSettingsPayloadSchema,
  StaticPagePayloadSchema,
} from "../lib/cms/content-types";

const STATIC_PAGES = [
  {
    slug: "about",
    title: "About Homyz",
    payload: {
      metaTitle: "About Homyz — Transforming Regional Hospitality",
      metaDescription: "Learn about Homyz's mission, values, and leadership in authentic vacation rental experiences.",
      heroTitle: "About Homyz",
      heroSubtitle: "Stay like a homie. Connecting discerning travelers with remarkable homes and heartfelt local hospitality across Saudi Arabia and the Middle East.",
      badge: "Company",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "mission",
          title: "Our Mission",
          layout: "STANDARD" as const,
          body: "Homyz was founded with a singular purpose: to make every traveler feel genuinely at home while exploring extraordinary destinations.\n\nWe bridge modern travel convenience with authentic Arabian hospitality, offering curated villas, serviced apartments, and unique residences that meet stringent quality and safety standards.",
        },
        {
          id: "standards",
          title: "Our Hospitality Standards",
          layout: "TWO_COLUMN" as const,
          imageUrl: "/images/home/hero.png",
          imageAlt: "Homyz Hospitality Living",
          body: "Every property featured on Homyz undergoes rigorous verification. From premium linens and high-speed Wi-Fi to transparent cancellation and 24/7 guest support, our standard ensures peace of mind for guests and sustainable prosperity for property hosts.",
        },
        {
          id: "commitment",
          title: "Community & Local Growth",
          layout: "CALLOUT" as const,
          calloutVariant: "tip" as const,
          body: "We partner with local homeowners, boutique property managers, and tourism boards to unlock authentic experiences that empower regional communities and foster sustainable cultural tourism.",
        },
      ],
    },
  },
  {
    slug: "terms",
    title: "Terms of Service",
    payload: {
      metaTitle: "Terms of Service — Homyz",
      metaDescription: "Read the official Terms of Service governing your use of the Homyz platform and booking services.",
      heroTitle: "Terms of Service",
      heroSubtitle: "These terms constitute a legally binding agreement between you and Homyz Hospitality Ltd. regarding your access and use of our website, apps, and services.",
      badge: "Legal",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "scope",
          title: "1. Scope of Homyz Services",
          layout: "STANDARD" as const,
          body: "Homyz provides an online marketplace platform that enables registered users ('Guests') to discover, reserve, and pay for temporary accommodations, experiences, and related hospitality services offered by third-party property owners or operators ('Hosts').\n\nHomyz is not an owner, real estate broker, or insurer of properties. Hosts alone are responsible for their listings and accommodation services.",
        },
        {
          id: "accounts",
          title: "2. User Accounts & Verification",
          layout: "STANDARD" as const,
          body: "To access certain features of the platform, you must register an account and maintain accurate, current, and complete profile information. Guests and Hosts must comply with identity verification requests, including national ID or passport verification in accordance with local tourism laws.",
        },
        {
          id: "bookings",
          title: "3. Bookings, Payments & Service Fees",
          layout: "STANDARD" as const,
          body: "Upon confirming a reservation, Guests agree to pay all applicable charges, including the base nightly rate, cleaning fees, taxes, and Homyz service fees. Payments are securely processed through licensed payment gateways. Hosts receive payouts in accordance with our payout schedule following verified guest check-in.",
        },
        {
          id: "cancellations-terms",
          title: "4. Cancellations & Refunds",
          layout: "CALLOUT" as const,
          calloutVariant: "info" as const,
          body: "Cancellation policies are chosen by Hosts from our standardized policy framework. Any refunds due upon cancellation are automatically calculated and processed pursuant to the applicable cancellation policy and our Extenuating Circumstances Policy.",
        },
      ],
    },
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    payload: {
      metaTitle: "Privacy Policy — Homyz",
      metaDescription: "Understand how Homyz collects, protects, uses, and respects your personal data.",
      heroTitle: "Privacy Policy",
      heroSubtitle: "Your privacy is paramount. This policy outlines how we handle your personal data across all Homyz applications, services, and interactions.",
      badge: "Legal",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "collection",
          title: "1. Information We Collect",
          layout: "STANDARD" as const,
          body: "We collect information you provide directly to us (such as name, email address, phone number, government identification for compliance, and payment details) as well as automated telemetry data (device information, IP address, and platform usage analytics) to deliver and secure our services.",
        },
        {
          id: "usage",
          title: "2. How We Use Your Information",
          layout: "STANDARD" as const,
          body: "Your information is used to facilitate reservations, process secure payments, verify user identities, prevent fraud and abuse, provide 24/7 customer support, and personalize your search and booking experience.",
        },
        {
          id: "sharing",
          title: "3. Information Sharing & Disclosure",
          layout: "CALLOUT" as const,
          calloutVariant: "warning" as const,
          body: "We do NOT sell your personal data. We share necessary booking details with confirmed Hosts to facilitate your stay, and with regulatory authorities only when strictly mandated by applicable tourism and lodging laws.",
        },
        {
          id: "rights",
          title: "4. Your Data Rights & Choices",
          layout: "STANDARD" as const,
          body: "You have the right to access, update, correct, or request deletion of your personal data at any time through your Profile Settings or by submitting a privacy request to privacy@homyz.com.",
        },
      ],
    },
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    payload: {
      metaTitle: "Cookie Policy — Homyz",
      metaDescription: "Learn how Homyz uses cookies and similar technologies to ensure seamless platform functionality.",
      heroTitle: "Cookie Policy",
      heroSubtitle: "This policy explains how we utilize cookies, web beacons, and local storage to keep your session authenticated and enhance your browsing experience.",
      badge: "Legal",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "what-are-cookies",
          title: "What Are Cookies?",
          layout: "STANDARD" as const,
          body: "Cookies are small text files placed on your device by websites you visit. They allow websites to remember your device, preferences, and session state over time.",
        },
        {
          id: "cookie-types",
          title: "Types of Cookies We Use",
          layout: "ACCORDION" as const,
          body: "We categorize our cookies into essential, functional, and performance tiers:",
          items: [
            {
              label: "Essential & Security Cookies",
              text: "Required for core platform features including authentication, CSRF security tokens, session management, and payment processing.",
            },
            {
              label: "Preferences & Localization Cookies",
              text: "Remember your selected language, currency, and destination preferences across sessions.",
            },
            {
              label: "Analytics & Performance Cookies",
              text: "Help us understand search behavior and optimize platform load times without profiling personal identities.",
            },
          ],
        },
      ],
    },
  },
  {
    slug: "safety",
    title: "Safety Information",
    payload: {
      metaTitle: "Safety Information & Emergency Assistance — Homyz",
      metaDescription: "Comprehensive safety protocols, guidelines for guests and hosts, and 24/7 emergency support.",
      heroTitle: "Safety Information",
      heroSubtitle: "Ensuring peace of mind for every stay. Our comprehensive trust and safety framework is designed to protect guests, hosts, and local communities.",
      badge: "Support",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "emergency-notice",
          title: "Emergency Response & Assistance",
          layout: "CALLOUT" as const,
          calloutVariant: "warning" as const,
          body: "If you are in immediate danger or require urgent emergency assistance, please call local emergency services immediately (997 Ambulance / 998 Fire / 999 Police in Saudi Arabia).\n\nOur 24/7 Global Safety Hotline is available at +966 11 000 0000.",
        },
        {
          id: "property-safety",
          title: "Listing Safety Standards",
          layout: "STANDARD" as const,
          body: "Every host listing on Homyz must verify the availability of essential safety equipment, including functional smoke alarms, fire extinguishers, first aid kits, and clearly marked emergency exit routes.",
        },
        {
          id: "tips",
          title: "Safe Travel Tips for Guests",
          layout: "ACCORDION" as const,
          body: "Follow these simple precautions to ensure a seamless experience:",
          items: [
            {
              label: "Keep Communications on Homyz",
              text: "Always message and pay through the Homyz platform. Off-platform wire transfers and communication remove your booking protections.",
            },
            {
              label: "Inspect the Property Upon Arrival",
              text: "Check smoke detectors, door locks, and verify key amenities. If anything is unsafe or inaccurate, notify your host and our support team within 24 hours.",
            },
            {
              label: "Review House Rules & Community Norms",
              text: "Respect neighbor quiet hours, parking guidelines, and community regulations.",
            },
          ],
        },
      ],
    },
  },
  {
    slug: "accessibility",
    title: "Accessibility & Disability Support",
    payload: {
      metaTitle: "Accessibility Statement & Disability Support — Homyz",
      metaDescription: "Our commitment to digital accessibility and accessible physical accommodation stays.",
      heroTitle: "Accessibility Statement",
      heroSubtitle: "We believe travel should be accessible to everyone. We are committed to digital accessibility and helping travelers find accommodations that fit their physical needs.",
      badge: "Support",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "digital-accessibility",
          title: "Digital Accessibility Commitment",
          layout: "STANDARD" as const,
          body: "Homyz strives to ensure that its website and mobile interfaces conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. We regularly audit color contrast, keyboard navigation, screen reader compatibility, and text scaling.",
        },
        {
          id: "listing-features",
          title: "Accessible Accommodations Filter",
          layout: "CALLOUT" as const,
          calloutVariant: "success" as const,
          body: "Guests can search and filter for verified accessibility features, including step-free guest entrances, wide doorways (32+ inches), roll-in showers, grab bars, and accessible parking spaces.",
        },
        {
          id: "dedicated-support",
          title: "Dedicated Accessibility Assistance",
          layout: "STANDARD" as const,
          body: "Have specific accessibility requirements or encountered an obstacle? Reach our specialized accessibility desk at accessibility@homyz.com for personalized booking coordination.",
        },
      ],
    },
  },
  {
    slug: "cancellation-policy",
    title: "Cancellation Policy",
    payload: {
      metaTitle: "Cancellation Policy & Refund Options — Homyz",
      metaDescription: "Understand the cancellation policies available on Homyz and how refunds are calculated.",
      heroTitle: "Cancellation Policy",
      heroSubtitle: "Transparent, predictable cancellation options so you can book with confidence.",
      badge: "Support",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "overview",
          title: "Policy Framework Overview",
          layout: "STANDARD" as const,
          body: "Hosts select one of our standardized cancellation tiers for their property. The applicable cancellation policy is prominently displayed on the listing page and in your reservation confirmation.",
        },
        {
          id: "tiers",
          title: "Cancellation Tiers",
          layout: "ACCORDION" as const,
          body: "Review our standard cancellation tiers:",
          items: [
            {
              label: "Flexible Policy",
              text: "Full refund up to 24 hours before local check-in time. Cancellations made within 24 hours of check-in forfeit the first night's fee.",
            },
            {
              label: "Moderate Policy",
              text: "Full refund up to 5 days before local check-in time. 50% refund thereafter up to check-in.",
            },
            {
              label: "Strict Policy",
              text: "Full refund for cancellations made within 48 hours of booking, if at least 14 days before check-in. 50% refund up to 7 days before check-in.",
            },
          ],
        },
      ],
    },
  },
  {
    slug: "anti-discrimination",
    title: "Nondiscrimination Policy",
    payload: {
      metaTitle: "Nondiscrimination Policy — Homyz",
      metaDescription: "Our shared commitment to inclusion, respect, and zero tolerance for discrimination.",
      heroTitle: "Nondiscrimination Policy",
      heroSubtitle: "Homyz is a community built on mutual respect, belonging, and open hospitality. We have zero tolerance for discrimination or harassment of any kind.",
      badge: "Community",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "commitment",
          title: "Our Shared Commitment",
          layout: "CALLOUT" as const,
          calloutVariant: "info" as const,
          body: "We welcome guests and hosts of all backgrounds. Discrimination based on race, color, ethnicity, national origin, religion, sexual orientation, gender identity, marital status, or disability is strictly prohibited and will result in immediate platform suspension.",
        },
        {
          id: "reporting",
          title: "Reporting Violations",
          layout: "STANDARD" as const,
          body: "If you experience or witness discrimination, please contact our trust team immediately at report@homyz.com or submit an in-app report through your reservation view.",
        },
      ],
    },
  },
  {
    slug: "hosting-resources",
    title: "Hosting Resources",
    payload: {
      metaTitle: "Hosting Resources & Guidebook — Homyz",
      metaDescription: "Tips, guides, and best practices to help you succeed as a Homyz host.",
      heroTitle: "Hosting Resources",
      heroSubtitle: "Everything you need to create remarkable guest stays, optimize your listing, and maximize your rental earnings.",
      badge: "Hosting",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "getting-started",
          title: "1. Getting Started as a Host",
          layout: "STANDARD" as const,
          body: "From capturing high-resolution photos to writing engaging property descriptions, our host onboarding guide walks you through setting up your listing in less than 15 minutes.",
        },
        {
          id: "pricing-strategy",
          title: "2. Smart Pricing & Revenue Management",
          layout: "TWO_COLUMN" as const,
          imageUrl: "/images/home/hero.png",
          imageAlt: "Hosting Dashboard and Calendar",
          body: "Learn how to use weekend pricing premiums, length-of-stay discounts, and seasonal adjustments to boost occupancy during peak travel dates while protecting your nightly yield.",
        },
        {
          id: "hospitality-tips",
          title: "3. Hospitality Best Practices",
          layout: "ACCORDION" as const,
          body: "Proven habits of top-rated Superhosts:",
          items: [
            {
              label: "Fast Response Times",
              text: "Responding to guest inquiries within 1 hour increases booking conversion by over 40%.",
            },
            {
              label: "Seamless Check-in Process",
              text: "Smart locks or clear self-check-in instructions reduce first-day friction for weary travelers.",
            },
            {
              label: "Thoughtful Local Guidebooks",
              text: "Curate your favorite neighborhood cafes, restaurants, and hidden gems for an unforgettable local stay.",
            },
          ],
        },
      ],
    },
  },
  {
    slug: "hosting-responsibly",
    title: "Hosting Responsibly",
    payload: {
      metaTitle: "Hosting Responsibly — Homyz",
      metaDescription: "Important legal, safety, and community guidelines for hosting responsibly.",
      heroTitle: "Hosting Responsibly",
      heroSubtitle: "A guide to local regulations, building codes, neighborhood relations, and safety compliance for property hosts.",
      badge: "Hosting",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "compliance",
          title: "1. Permits & Tourism Licensing",
          layout: "STANDARD" as const,
          body: "Ensure your property complies with all municipal zoning laws and tourism authority licensing (such as the Saudi Ministry of Tourism lodging permits). Homyz provides easy fields in your host dashboard to register your permit number.",
        },
        {
          id: "safety-compliance",
          title: "2. Home Safety Standards",
          layout: "CALLOUT" as const,
          calloutVariant: "warning" as const,
          body: "Ensure working smoke detectors are installed in all sleeping areas, inspect heating and electrical equipment regularly, and provide emergency numbers in a prominent location.",
        },
        {
          id: "neighbor-relations",
          title: "3. Good Neighbor Guidelines",
          layout: "STANDARD" as const,
          body: "Set clear house rules regarding quiet hours, parking spaces, and maximum guest capacities to maintain positive relations with your neighbors and building management.",
        },
      ],
    },
  },
  {
    slug: "contact",
    title: "Contact Us",
    payload: {
      metaTitle: "Contact Us — Homyz",
      metaDescription: "Get in touch with the Homyz customer service, partnership, and press teams.",
      heroTitle: "Contact Us",
      heroSubtitle: "We are here for you 24/7. Reach out with questions, feedback, or support requests.",
      badge: "Support",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "channels",
          title: "Customer Support Channels",
          layout: "ACCORDION" as const,
          body: "Choose the fastest way to get help:",
          items: [
            {
              label: "In-App Chat (Fastest)",
              text: "Logged-in users can access live chat directly through Profile > Support tab for instant assistance with ongoing bookings.",
            },
            {
              label: "Email Support",
              text: "Email us at support@homyz.com for general inquiries. We respond within 4 hours.",
            },
            {
              label: "24/7 Emergency Phone Line",
              text: "For urgent on-trip safety or check-in emergencies, call +966 11 000 0000.",
            },
          ],
        },
        {
          id: "headquarters",
          title: "Corporate Headquarters",
          layout: "STANDARD" as const,
          body: "Homyz Hospitality Ltd.\nKing Fahd Road, Al Olaya District\nRiyadh, Kingdom of Saudi Arabia\nCommercial Registration: 1010892341",
        },
      ],
    },
  },
  {
    slug: "careers",
    title: "Careers at Homyz",
    payload: {
      metaTitle: "Careers at Homyz — Build the Future of Hospitality",
      metaDescription: "Join our fast-growing team redefining property booking and regional travel.",
      heroTitle: "Careers at Homyz",
      heroSubtitle: "Join our ambitious team transforming regional hospitality. We are building technology that connects cultures and creates economic opportunity.",
      badge: "Company",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "culture",
          title: "Why Build With Homyz?",
          layout: "STANDARD" as const,
          body: "At Homyz, we combine hyper-local hospitality with world-class engineering. We value ownership, customer obsession, relentless curiosity, and inclusive collaboration.",
        },
        {
          id: "openings",
          title: "Open Roles & Inquiries",
          layout: "CALLOUT" as const,
          calloutVariant: "success" as const,
          body: "We are actively recruiting across Engineering, Product Design, Operations, and Host Success in Riyadh, Dubai, and remote hubs.\n\nSend your resume and portfolio to careers@homyz.com.",
        },
      ],
    },
  },
  {
    slug: "newsroom",
    title: "Newsroom & Press",
    payload: {
      metaTitle: "Newsroom & Press Announcements — Homyz",
      metaDescription: "Latest company news, product releases, and media inquiries.",
      heroTitle: "Newsroom",
      heroSubtitle: "Official announcements, product milestones, and media resources from Homyz.",
      badge: "Company",
      lastUpdated: "October 2026",
      sections: [
        {
          id: "recent-release",
          title: "2026 Platform Release",
          layout: "CALLOUT" as const,
          calloutVariant: "tip" as const,
          body: "Homyz announces expanded coverage across 15 new destinations, upgraded instant booking workflows, and unified multi-currency settlement in SAR, AED, and USD.",
        },
        {
          id: "media-contact",
          title: "Press & Media Inquiries",
          layout: "STANDARD" as const,
          body: "For interview requests, executive commentary, and media assets, contact our communications team at press@homyz.com.",
        },
      ],
    },
  },
];

const BASELINE_FOOTER = {
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
  copyrightNotice: "© 2026 Homyz, Inc. All rights reserved.",
  legalNotice: "Licensed under the Saudi Ministry of Tourism. Commercial Registration CR: 1010892341.",
  showBackToTop: true,
  showSocialIcons: true,
  appearance: {
    backgroundColor: "#F3F4F5",
    textColor: "#000000",
    mutedTextColor: "#727272",
    borderColor: "rgba(31,31,31,0.9)",
    accentColor: "#FCDF9C",
  },
};

const BASELINE_SETTINGS = {
  siteName: "Homyz",
  tagline: "Stay like a homie. Travel & Hospitality Platform",
  logoUrl: "/images/home/homyz-logo.png",
  faviconUrl: "/favicon.ico",
  supportEmail: "support@homyz.com",
  supportPhone: "+966 11 000 0000",
  legalEntityName: "Homyz Hospitality Ltd.",
  registeredAddress: "King Fahd Road, Al Olaya District, Riyadh, Kingdom of Saudi Arabia",
  businessRegistrationNumber: "CR-1010892341",
  defaultLocale: "en",
  supportedLocales: ["en", "ar", "es", "fr", "de", "hi"],
  defaultCurrency: "SAR",
  socialMedia: {
    facebook: "https://facebook.com",
    twitter: "https://twitter.com",
    instagram: "https://instagram.com",
    linkedin: "https://linkedin.com",
    youtube: "https://youtube.com",
  },
  seo: {
    defaultMetaTitle: "Homyz — Travel & Hospitality Platform",
    defaultMetaDescription: "Stay like a homie. Premium booking and vacation rental property management.",
    ogImageUrl: "/images/home/hero.png",
  },
  footer: {
    copyrightText: "© 2026 Homyz, Inc. All rights reserved.",
    showBackToTop: true,
  },
};

async function seed() {
  console.log("\n=======================================================");
  console.log("   PHASE 11 — SEEDING FOOTER, PAGES & GLOBAL SETTINGS   ");
  console.log("=======================================================\n");

  // 1. Seed Static Pages
  console.log("1. Seeding 13 Approved CMS Static Pages...");
  for (const page of STATIC_PAGES) {
    const validated = StaticPagePayloadSchema.parse(page.payload);

    let content = await prisma.cmsContent.findFirst({
      where: {
        type: CmsContentTypeEnum.STATIC_PAGE,
        slug: page.slug,
        locale: "en",
      },
      include: { versions: true },
    });

    if (!content) {
      content = await prisma.cmsContent.create({
        data: {
          type: CmsContentTypeEnum.STATIC_PAGE,
          title: page.title,
          slug: page.slug,
          locale: "en",
          status: CmsContentStatus.PUBLISHED,
        },
        include: { versions: true },
      });
      console.log(`  + Created master record for /${page.slug}`);
    }

    let version = content.versions.find((v: { versionNumber: number }) => v.versionNumber === 1);
    if (!version) {
      version = await prisma.cmsContentVersion.create({
        data: {
          contentId: content.id,
          versionNumber: 1,
          title: page.title,
          slug: page.slug,
          locale: "en",
          payload: validated as any,
          changeSummary: "Official approved Phase 11 page content",
        },
      });
      console.log(`  + Created version 1 for /${page.slug}`);
    } else {
      await prisma.cmsContentVersion.update({
        where: { id: version.id },
        data: { payload: validated as any },
      });
    }

    // Publish
    await prisma.cmsPublication.upsert({
      where: { contentId: content.id },
      create: {
        contentId: content.id,
        versionId: version.id,
        publishedAt: new Date(),
      },
      update: {
        versionId: version.id,
        publishedAt: new Date(),
      },
    });

    await prisma.cmsContent.update({
      where: { id: content.id },
      data: {
        status: CmsContentStatus.PUBLISHED,
        publishedVersionId: version.id,
        draftVersionId: version.id,
      },
    });

    console.log(`  ✓ Published: /${page.slug} ("${page.title}")`);
  }

  // 2. Seed Baseline Footer Configuration
  console.log("\n2. Seeding Official Baseline Footer Configuration...");
  const validatedFooter = FooterConfigPayloadSchema.parse(BASELINE_FOOTER);

  let footerContent = await prisma.cmsContent.findFirst({
    where: {
      type: CmsContentTypeEnum.FOOTER_CONFIG,
      locale: "en",
    },
    include: { versions: true },
  });

  if (!footerContent) {
    footerContent = await prisma.cmsContent.create({
      data: {
        type: CmsContentTypeEnum.FOOTER_CONFIG,
        title: "Global Footer Configuration",
        slug: "footer-main",
        locale: "en",
        status: CmsContentStatus.PUBLISHED,
      },
      include: { versions: true },
    });
  }

  let footerVersion = footerContent.versions[0];
  if (!footerVersion) {
    footerVersion = await prisma.cmsContentVersion.create({
      data: {
        contentId: footerContent.id,
        versionNumber: 1,
        title: footerContent.title,
        slug: footerContent.slug,
        locale: "en",
        payload: validatedFooter as any,
        changeSummary: "Official baseline footer configuration (0 broken links)",
      },
    });
  } else {
    await prisma.cmsContentVersion.update({
      where: { id: footerVersion.id },
      data: { payload: validatedFooter as any },
    });
  }

  await prisma.cmsPublication.upsert({
    where: { contentId: footerContent.id },
    create: {
      contentId: footerContent.id,
      versionId: footerVersion.id,
      publishedAt: new Date(),
    },
    update: {
      versionId: footerVersion.id,
      publishedAt: new Date(),
    },
  });

  await prisma.cmsContent.update({
    where: { id: footerContent.id },
    data: {
      status: CmsContentStatus.PUBLISHED,
      publishedVersionId: footerVersion.id,
      draftVersionId: footerVersion.id,
    },
  });
  console.log("  ✓ Published official dynamic footer configuration (Revision #1)");

  // 3. Seed Global Settings in AppSettings
  console.log("\n3. Seeding CMS Global Settings in AppSettings...");
  const validatedSettings = GlobalSettingsPayloadSchema.parse(BASELINE_SETTINGS);

  await prisma.appSettings.upsert({
    where: { key: "GLOBAL_WEBSITE_SETTINGS" },
    create: {
      key: "GLOBAL_WEBSITE_SETTINGS",
      value: JSON.stringify(validatedSettings),
      description: "CMS Global Website Identity, Contact, Social, and Appearance Settings",
      dataType: "JSON",
    },
    update: {
      value: JSON.stringify(validatedSettings),
    },
  });
  console.log("  ✓ Updated GLOBAL_WEBSITE_SETTINGS in AppSettings table");

  console.log("\n=======================================================");
  console.log("   ALL PHASE 11 DATA SUCCESSFULLY SEEDED & VERIFIED!   ");
  console.log("=======================================================\n");
}

seed()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
