# PHASE 11 — FOOTER & GLOBAL WEBSITE SETTINGS AUDIT
**Project:** Homyz — Airbnb-Style Property Booking Platform  
**Audit Timestamp:** 2026-10-16  
**Scope:** Client Footer, Footer Management, Footer-linked Static Pages, Global Website Settings, i18n/RTL, CMS Publishing, Security & Performance

---

## 1. Executive Summary

A deep audit of the Homyz codebase reveals that while a modern design-token-compliant footer exists in `components/dashboard/footer.tsx`, it is completely hardcoded in React JSX. 14 out of its 17 links point to placeholder `/not-available?page=...` routes.
The Prisma database schema and CMS foundation already contain `FOOTER_CONFIG` and `STATIC_PAGE` enum definitions and versioning infrastructure, but there was:
1. No dynamic Footer Management interface in Admin CMS (`/admin/cms/footer`).
2. No Global Website Settings interface in Admin CMS (`/admin/cms/settings`).
3. No public dynamic route to render published `STATIC_PAGE` records (`app/[slug]/page.tsx`).
4. No integration connecting `components/dashboard/footer.tsx` to active published footer configurations.
5. No seed/approved legal, support, or company static page records in `CmsContent`.

---

## 2. Detailed Audit Matrix

| Item / Feature | File Location | Classification | Current State & Findings | Target Action |
|---|---|---|---|---|
| **Public Footer Component** | `components/dashboard/footer.tsx` | PARTIAL — IMPROVE | Responsive 3-column layout matching design tokens with social icons and back-to-top button; hardcoded JSX links pointing to `/not-available`. | Connect to published dynamic footer data; fallback gracefully to hardcoded layout if unconfigured. |
| **Footer Usages / Placement** | `components/home/home-view.tsx`, `app/listings/[id]/...`, `app/help/...`, etc. | EXISTING — REUSE | Correctly placed across client layouts and public routes. | Preserve placements; ensure seamless client-side hydration. |
| **CMS Content Model** | `prisma/schema.prisma` (`CmsContent`, `CmsContentVersion`, `CmsPublication`) | EXISTING — REUSE | Fully supports `FOOTER_CONFIG` and `STATIC_PAGE` with revisions, drafts, publications, and metadata. | Reuse existing CMS tables without schema breaking changes. |
| **FOOTER_CONFIG Schema** | `lib/cms/content-types.ts` | PARTIAL — IMPROVE | Basic `FooterConfigPayloadSchema` exists (columns, copyright, legalNotice). Lacks link IDs, enable flags, display orders, social links array, and appearance configs. | Expand schema to support columns, links, social links, bottom links, appearance, and i18n. |
| **STATIC_PAGE Schema** | `lib/cms/content-types.ts` | EXISTING — REUSE | `StaticPagePayloadSchema` has `metaTitle`, `metaDescription`, `heroTitle`, `heroSubtitle`, `sections` array with layouts (`STANDARD`, `TWO_COLUMN`, `ACCORDION`, `CALLOUT`). | Reuse schema; support rich HTML/markdown bodies and image URLs. |
| **Public Static Page Route** | `app/[slug]/page.tsx` | MISSING — IMPLEMENT | No public dynamic route exists for static pages. Public visits to `/about`, `/terms`, `/privacy`, `/safety` 404 or redirect to `/not-available`. | Implement `app/[slug]/page.tsx` with dynamic SSR, draft preview, SEO metadata, and i18n. |
| **Footer Admin Interface** | `/admin/cms/footer` | MISSING — IMPLEMENT | Admin CMS has `/admin/cms`, `/admin/cms/homepage`, `/admin/cms/media`, but no dedicated Footer editor. | Implement comprehensive Footer Management editor at `/admin/cms/footer`. |
| **Global Website Settings Admin** | `/admin/cms/settings` | MISSING — IMPLEMENT | Platform settings at `/admin/settings` are host/financial/security-focused. No CMS Global Settings interface exists. | Implement Global Website Settings at `/admin/cms/settings`. |
| **Footer Service** | `services/cms-footer.service.ts` | MISSING — IMPLEMENT | No service exists to load, validate, save drafts, publish, and resolve localized published footers. | Implement `CmsFooterService` with caching, preview, audit logging, and fallback. |
| **Global Settings Service** | `services/cms-settings.service.ts` | MISSING — IMPLEMENT | No dedicated service to manage business identity, contact, social media, and footer appearance. | Implement `CmsSettingsService` using `AppSettings` / `CmsContent` foundation. |
| **Help Centre Page** | `app/help/page.tsx`, `app/help/help-client.tsx` | EXISTING — REUSE | Functional Help Centre with category cards and chat link to `/profile/tab/support`. | Preserve and link directly in footer (`/help`). |
| **Host Onboarding Link** | `/become-a-host`, `/host/onboarding` | EXISTING — REUSE | Dedicated host onboarding flow exists. | Point footer "Become a Host" link directly to `/become-a-host`. |
| **Host Co-Host Link** | `/host/co-host` | EXISTING — REUSE | Co-host workspace exists. | Point footer "Find a co-host" to `/host/co-host`. |
| **Contact Support Flow** | `/profile/tab/support` | EXISTING — REUSE | Real authenticated user customer support chat / ticket view. | Wire Contact Support to `/profile/tab/support` and public contact page `/contact`. |
| **Dispute / Reporting** | `/host/resolution-center`, `/profile/reports` | EXISTING — REUSE | Moderation and resolution center workflows exist. | Wire "Report concern" to `/profile/reports` or safety center. |
| **i18n & RTL** | `lib/i18n/language-context.tsx`, `MESSAGES` | EXISTING — REUSE | Multilingual provider (`en`, `ar`, `es`, `fr`, `de`, `hi`) with Arabic RTL support (`dir="rtl"`). | Support localized group titles, link labels, and static pages with fallback to English. |
| **Media Server Integration** | `media-server/server.mjs`, `CmsMediaAsset` | EXISTING — REUSE | Media upload and asset library functional. | Support image insertion in static pages and footer branding logo. |
| **Cache Invalidation** | `lib/cms/cache.ts` | EXISTING — REUSE | Invalidation handlers exist for `FOOTER_CONFIG` and `STATIC_PAGE`. | Ensure `revalidateTag("cms-footer")` and `revalidatePath("/")` fire on publish. |
| **RBAC Permissions** | `lib/permissions/permissions.ts` | EXISTING — REUSE | `PERMISSIONS.CMS_VIEW`, `CMS_EDIT`, `CMS_PUBLISH`, `CMS_MANAGE`. | Secure footer and global settings routes with these permissions. |

---

## 3. Approved Content Strategy & Safety Guardrails

1. **Support Pages:**
   - **Help Centre:** Route `/help` (already built and functional).
   - **Contact Support:** Route `/contact` (CMS static page with official support email, hours, and link to in-app `/profile/tab/support`).
   - **Safety Issues:** Route `/safety` (comprehensive guest & host safety guidelines, emergency instructions, and verified reporting links).
   - **Cancellation Options:** Route `/cancellation-policy` (official policy overview matching Homyz booking engine rules).
   - **Accessibility:** Route `/accessibility` (Homyz platform accessibility statement and disability support contact).
   - **Anti-discrimination Policy:** Route `/anti-discrimination` (official community nondiscrimination commitment).
   - **Report a Concern:** Link to `/profile/reports` or `/safety#report`.

2. **Hosting Pages:**
   - **Become a Host:** Link to `/become-a-host`.
   - **Homyz for Hosts:** Link to `/host/onboarding`.
   - **Find a Co-host:** Link to `/host/co-host`.
   - **Hosting Resources:** Route `/hosting-resources` (informational guides for new hosts).
   - **Hosting Responsibly:** Route `/hosting-responsibly` (local regulations, zoning, and safety standards).

3. **Company & About Pages:**
   - **About Homyz:** Route `/about` (company mission, values, and platform overview).
   - **Careers:** Route `/careers` (culture and recruitment inquiry contact).
   - **Newsroom:** Route `/newsroom` (official announcements and press contact).

4. **Legal Pages:**
   - **Terms & Conditions:** Route `/terms` (platform terms of service).
   - **Privacy Policy:** Route `/privacy` (privacy notice, data protection, user rights).
   - **Cookie Policy:** Route `/cookies` (cookie usage and preferences).

All enabled footer links will point to either an existing application route (`/help`, `/become-a-host`, `/host/co-host`, `/profile/tab/support`, `/giftcards`) or an official published CMS static page (`/about`, `/terms`, `/privacy`, `/cookies`, `/safety`, `/accessibility`, `/cancellation-policy`, `/anti-discrimination`, `/hosting-resources`, `/hosting-responsibly`, `/contact`, `/careers`, `/newsroom`).
Zero broken links, zero placeholder `not-available` defaults on live published footer!

