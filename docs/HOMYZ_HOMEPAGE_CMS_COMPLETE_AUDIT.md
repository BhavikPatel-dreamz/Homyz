# Homyz Homepage, Search, Wishlist & CMS Audit

**Audit date:** 2026-10-16  
**Scope:** public homepage/discovery, search, dates and guests, public listing/booking hand-off, wishlist/history, map search, and the admin CMS requirement.  
**Method:** targeted source, Prisma-schema, route, and safe test inspection. This is a read-only audit; no application code, schema, migrations, environment variables, or records were changed.

## Executive summary

Homyz has a substantial marketplace discovery and booking foundation. Public listings are publication-gated, search runs through Prisma rather than a client-side subset, listing details use an authoritative quote path, favourites are user-owned and private, and the homepage now has viewport-triggered section rendering.

The client CMS commitment is **not met**. There is no content-domain schema or admin surface for homepage banners, featured-city records, campaigns, FAQs, static pages, SEO records, marketing sections, navigation/footer content, revisioning, or editorial publishing. The sole related admin setting configures the title/mode/city of the code-defined “Popular homes” row. Homepage composition and all other marketing copy are hardcoded in TypeScript/translation files.

The most important verified implementation defect is in lazy discovery: offscreen *card payloads* are omitted from the initial page props, but the server still assembles every section from one `findMany(... take: 200)` candidate set before it strips those cards. Further, an on-demand section request calls `getHomepageData` again with `deferOffscreenProperties: false`, reconstructing the complete homepage in order to slice one section. This is partial lazy loading, not database-level section lazy loading. Runtime measurement could not be performed because `DATABASE_URL` is unavailable.

## Status vocabulary

`COMPLETE — VERIFIED` requires a passing automated check in this environment. `IMPLEMENTED — NOT VERIFIED` means code and call paths exist but no live integration run was possible. `PARTIAL` means an important required behavior is absent or architecturally incomplete. `MISSING` means targeted code/schema/route searches found no supported implementation. `BLOCKED` is used for checks requiring the unavailable database, credentials, browser telemetry, or a real user journey.

## Existing architecture

| Area | Evidence | Assessment |
| --- | --- | --- |
| App routing | App Router routes under `app/`; homepage is `app/(home)/page.tsx`; searches use `app/listings/page.tsx`; details use `app/listings/[id]/page.tsx`. | IMPLEMENTED — NOT VERIFIED |
| Persistence | Prisma PostgreSQL schema includes `Listing`, `Booking`, `ListingFavorite`, `Review`, `AppSettings`, RBAC/audit models (`prisma/schema.prisma:543-840`, `1123-1187`, `1718-1732`). | IMPLEMENTED — NOT VERIFIED |
| Public visibility | Homepage candidate and public search queries require published, ACTIVE, unpaused, non-deleted listings (`services/homepage.service.ts:515-522`; `services/listing.service.ts:439-444`). | IMPLEMENTED — NOT VERIFIED |
| Homepage engine | Server page resolves URL/cookie context and calls `homepageService.getHomepageData` (`app/(home)/page.tsx:60-172`); service builds fixed rows from up to 200 listings (`services/homepage.service.ts:508-613`, `722-1455`). | PARTIAL |
| Search state | URL parameters plus localStorage and 30-day cookie helpers are used; page/detail restore cookie values (`app/(home)/page.tsx:79-113`, `app/listings/page.tsx:76-94`, `app/listings/[id]/page.tsx:110-123`). | COMPLETE — VERIFIED for covered code paths |
| CMS foundation | Only generic `AppSettings` and an admin settings screen were found. No CMS content models/routes were found in the schema or admin route tree. | MISSING |

## Homepage feature coverage

| Section/capability | Source and data | Status / evidence |
| --- | --- | --- |
| Header/navigation | `AppHeader`; code-defined links. | PARTIAL: responsive UI exists, but links/branding are not admin managed (`components/dashboard/app-header.tsx`). |
| Hero/search | `components/home/hero-section.tsx`; static `/images/home/hero.png` and `/images/home/hero-banner.png` at lines 1139 and 1206. Uses autocomplete, date picker, guest picker and mobile `ModalOverlay`. | IMPLEMENTED — NOT VERIFIED; no CMS banner fields, scheduling, crop, CTA, or fallback management. |
| Destination autocomplete | `/api/v1/listings/search-suggest`; combines places provider with active public DB listings and Redis caching (`route.ts:77-232`). | COMPLETE — VERIFIED by `search-flow-upgrade.test.ts`. |
| Property rows | Fixed service rules: favourites, popular, near location, trending, villas, apartments, cabins, family, recommendation, superhost, value, new (`services/homepage.service.ts:1151-1439`). | PARTIAL: selection is code-driven, not configurable; only 200 candidate listings are considered (`:25-27`, `:575`). |
| Featured cities / destinations | `loadTrendingLocations` derives cities from cache/fallback active listings (`services/homepage.service.ts:615-702`). | PARTIAL: dynamic derivation, not admin curation; no public visual row was found consuming `trendingLocations` in `HomeView`. |
| Recently viewed | browser history snapshot, then public card endpoint checks present eligibility/badges (`components/home/home-view.tsx:77-174`, `422-464`). | IMPLEMENTED — NOT VERIFIED: logged-out local persistence only; not cross-device/account persistence. |
| Recent searches | client cookie/local storage and authenticated Redis/memory fallback (`services/search-analytics.service.ts:59-129`); rows built on homepage. | PARTIAL: it is history, not user-managed saved searches; no durable Prisma record. |
| Favourite hearts | `WishlistProvider` fetches per-user API state and mutation queue synchronizes events (`components/wishlist/WishlistProvider.tsx:39-148`). | COMPLETE — VERIFIED by `wishlist-profile-saved.test.ts` for code integration. |
| Footer | fixed JSX links/social URLs (`components/dashboard/footer.tsx:42-226`). | PARTIAL: responsive UI exists; most policy links resolve to `/not-available`; no CMS control. |
| Mobile | hero has a mobile modal, with `ModalOverlay` (`components/home/hero-section.tsx:1455-1684`); shared overlay meets the scroll-lock convention. | IMPLEMENTED — NOT VERIFIED in a browser. |

### Homepage initial loading and performance

The page requests homepage data once, with `deferOffscreenProperties: true` and two initial sections (`app/(home)/page.tsx:145-162`). The service subsequently clears properties for section index 2+ before serializing (`services/homepage.service.ts:1542-1564`). `LazySection` observes placeholders with a 500px root margin and a maximum of two queued client fetches (`components/home/lazy-section.tsx:25-46`, `290-322`); the carousel asks for more near its horizontal end (`components/home/category-carousel.tsx:203-205`). Skeletons and retry UI are supplied (`lazy-section.tsx:324-367`).

However, `getHomepageData` first calls `assembleHomepageData` for the whole homepage and `getDiscoveryCandidateListings` fetches up to 200 listing records, booking ranges and review summaries (`services/homepage.service.ts:508-589`). Every deferred endpoint then calls `getHomepageData(... deferOffscreenProperties: false)` and slices the completed in-memory section (`services/homepage.service.ts:1598-1621`). Therefore:

- **Initial network payload:** reduced for sections after the first two.
- **Initial database work:** not deferred at section level.
- **Offscreen request:** deferred until observer visibility, but it can recompute/load the complete discovery set rather than execute a purpose-built paginated query.
- **Measured request/query count, image request count, CWV, memory, and mobile-network behavior:** BLOCKED; no database/runtime/browser profiler is configured.

The in-progress `homepage-lazy-discovery-pagination.test.ts` is designed to exercise this runtime service behavior but could not start because `lib/db/prisma.ts` rejects the absent `DATABASE_URL`. This is a verification blocker, not evidence of a code failure.

## Location, search, dates and guests

### Location and destination

Autocomplete has debounce/abort logic and keyboard-index state in the hero (`components/home/hero-section.tsx:343-401`, `559-620`). The route returns global/provider suggestions plus public DB cities/districts/listing-title matches, with provider-place IDs and coordinates (`app/api/v1/listings/search-suggest/route.ts:144-232`). Search submit writes location, coordinates, dates and detailed guest counts into `/listings` query parameters and persists a normalized history context (`components/home/home-view.tsx:192-289`).

`listingService.searchPublicListings` applies coordinates/radius when present, otherwise text fallback, and can forward-geocode a text destination (`services/listing.service.ts:402-435`, `624-677`). This verifies database/service-level filtering in source, not a live database result. Country matching and provider normalisation are still partly text-based; city/district comparisons use `contains`, not a first-class destination ID (`services/listing.service.ts:657-670`). There is no CMS destination model.

Status: **COMPLETE — VERIFIED** for source-level path coverage by `search-flow-upgrade.test.ts`; real provider/database results are **NOT RUNTIME VERIFIED**.

### Dates and canonical state

Date strings are consistently `YYYY-MM-DD`; timezone regression coverage passed in `booking-date-consistency.test.ts`. The homepage, listing results and detail page read aliases plus persisted fallback (`app/listings/page.tsx:88-94`; `app/listings/[id]/page.tsx:113-123`). Detail precomputes an authoritative server quote when dates are valid (`app/listings/[id]/page.tsx:142-165`) and its client refetches both booked date ranges and quote on selection changes (`public-listing-detail-client.tsx:978-1038`, `1320-1426`). The booked-date route enforces a maximum 366-day range and only exposes compact ranges (`app/api/v1/listings/[id]/booked-dates/route.ts:13-84`).

Mobile UI advertises flexible/month/stay preferences (`components/home/hero-section.tsx:1333`, `1584-1622`), but `HomeView.handleSearch` does not include `datePreferences` in the URL or persisted payload (`components/home/home-view.tsx:176-289`). Those flexible preferences therefore do not become discovery filters. `findSimilarDateRange` exists but is explicitly unused (`services/homepage.service.ts:365-391`). Flexible dates, weekend-only, week-long, and month-based search are **PARTIAL/MISSING** as search capabilities, despite UI affordances.

### Guests and pets

Adults/children/infants/pets are carried in the URL and persisted context (`components/home/home-view.tsx:219-260`). Search capacity uses adults+children/`guests` and pet policy is filtered at the database level (`services/listing.service.ts:446-465`). Detail intentionally retains an over-capacity source count to display validation rather than silently clamp it, then validates against listing capacity before reserve (`public-listing-detail-client.tsx:1320-1433`, `1656-1836`). The listing schema supplies `petsAllowed`, `maxPets`, infant/children policy fields (`prisma/schema.prisma:622-639`).

Status: **COMPLETE — VERIFIED** for URL/detail persistence and capacity validation by `airbnb-search-booking-persistence.test.ts`; an actual POST booking flow is not run.

## Search results and filters

Search accepts destination, coordinates, dates, guests, property/room type, price, amenities, accessibility, languages, bedrooms/baths/beds, pets, instant-book, featured, sorting and map bounds (`app/listings/page.tsx:79-172`; `services/listing.service.ts:314-362`). Prisma filters apply publication state, capacity, policy, filters, map bounds and booking conflicts before pagination (`services/listing.service.ts:439-724`). Pagination is server-side (20 per SSR page); route API supports skip/take (`app/api/v1/listings/route.ts:71-135`).

Verified gaps:

- Requested date validation is conditional: invalid or incomplete supplied date strings are silently not converted to an availability constraint (`services/listing.service.ts:582-620`), instead of returning a 400 or a clear invalid-filter result.
- Search declares `country` in `PublicSearchFilters`, but `app/listings/page.tsx` does not accept/pass a `country` query field (`app/listings/page.tsx:23-70`, `139-172`); homepage links can produce `country` URLs that the page ignores. **BROKEN, P1.**
- “Recommended”, `top_rated`, and `most_reviewed` have separate semantics; `recommended` is merely featured/newest DB ordering (`services/listing.service.ts:733-751`), not a personalisation model. This is acceptable if labelled generic, but not a real recommendation engine.
- Cancellation-policy filtering is absent from `PublicSearchFilters` and its UI/API route. **MISSING, P2.**

## Property details and booking integration

The cards build detail URLs using persisted date/guest context. Detail supports ID or slug, publication-gated lookup, canonical/Open Graph metadata, JSON-LD and server quote handoff (`app/listings/[id]/page.tsx:28-211`). Quote API uses Zod and `bookingService.getBookingQuote` (`app/api/v1/listings/[id]/quote/route.ts:9-42`), while bookings POST requires authenticated actor, validates input, checks moderation/payment policy and calls the service (`app/api/v1/bookings/route.ts:25-35`). Listing and booking schema include min/max nights, advance notice, blocked dates, price breakdown and a booking date-range index (`prisma/schema.prisma:656-692`, `804-839`).

Status: **COMPLETE — VERIFIED** for source/tested date/guest/quote navigation by `airbnb-search-booking-persistence.test.ts`; final transaction, payment gateway, race-condition result, taxes, and live price correctness are **NOT RUNTIME VERIFIED**. Do not rebuild the quote/availability service; use it as the canonical path.

## Wishlist, saved searches and recently viewed

`ListingFavorite` has a user/listing unique key and a listing index (`prisma/schema.prisma:762-773`). The service verifies a listing remains public before upsert, invalidates a per-user cache version, and list APIs send `private, no-store` headers (`services/favorite.service.ts:125-170`; `app/api/v1/favorites/route.ts:10-41`). Login handoff occurs on client 401 (`WishlistProvider.tsx:90-105`, `123-140`). `/wishlists` redirects to the profile saved tab (`app/wishlists/page.tsx:1-5`).

Wishlist status: **COMPLETE — VERIFIED** for tested UI/route wiring. It has one implicit collection only; wishlist collections are **MISSING**. `favorite.service.ts:107-123` also tries runtime DDL if the table is absent. That conflicts with migration-controlled schema practice and should be removed in a future hardening task; it was not executed here.

Saved searches status: **MISSING**. Recent search cache/history is not a saved-search product: there is no `SavedSearch` model or create/list/edit/delete/reopen UI/API. Authenticated history is Redis/memory TTL data, not durable cross-device account data (`services/search-analytics.service.ts:59-129`).

Recently viewed status: **PARTIAL**. Local browser storage gives ordering/deduplication and a current public-card eligibility lookup, but no user model/server persistence/cross-device sync. The local snapshot is deliberately suppressed when current API response excludes a listing (`components/home/home-view.tsx:429-436`).

## Interactive map search

Search results dynamically import Leaflet map client-side (`app/listings/listings-results-client.tsx:22-26`). `SearchMap` supports price markers, marker/card selection, map bounds callbacks, search-as-move state and collision spreading; listings lacking finite coordinates are omitted (`components/listings/search-map.tsx:119-137`, `211-261`, `295-320`). Database map-bounds filtering exists (`services/listing.service.ts:573-580`).

Status: **IMPLEMENTED — NOT VERIFIED**. There is no clustering implementation, no demonstrated mobile map interaction, and the map works on search results rather than homepage discovery. Exact-location privacy needs manual verification against the public DTO because schema has `showExactLocation` but `SearchMap` consumes latitude/longitude; source review here did not establish coordinate redaction. The default CARTO key literal in `search-map.tsx:52` should be removed/replaced with configured credentials before production.

## Admin CMS and client-requirement audit

### What exists

- Admin RBAC models, permissions and audit logs (`prisma/schema.prisma:1123-1187`), plus many operational admin routes.
- Generic `AppSettings` key/value storage (`prisma/schema.prisma:1718-1732`).
- The admin settings page loads/saves one homepage “Popular homes” configuration: enabled, mode (`STATIC`, `USER_LOCATION`, `USER_IP`), city and title (`app/(protected)/admin/settings/page.tsx:1-32`; `services/app-settings.service.ts:269-323`). Homepage reads it (`services/homepage.service.ts:1145-1148`).
- Host-side listing price promotions exist, stored in listing `discounts`; these are booking-pricing features, **not** CMS marketing campaigns (`prisma/schema.prisma:681-692`; `services/pricing.service.ts:375-399`).

### What is absent

No targeted schema, API, or admin route was found for `Banner`, `HomepageSection`, `FeaturedCity`, `Collection`, `Campaign`, `FAQ`, `StaticPage`, `SEO`, `Redirect`, `Navigation`, `Footer`, `MediaAsset`, `ContentRevision`, `ContentSchedule`, or `SavedSearch`. There is no reusable section registry/template architecture. Existing homepage types called `HomepageSection` are in-memory TypeScript DTOs, not persisted CMS records (`services/homepage.service.ts:59-94`).

Consequently every client content requirement beyond the one popular-homes setting is **MISSING**: desktop/mobile banner management, featured cities/listing collections, marketing sections/promotions, FAQs, static pages/legal-content workflow, SEO editing, navigation/footer/global announcement content, preview/draft/publish/scheduling/revisions/rollback, media-library governance, and CMS cache invalidation. Admin cannot make ordinary content changes without code.

## SEO, navigation and static content

Homepage metadata is hardcoded (`app/(home)/page.tsx:18-28`). Listing pages generate metadata/JSON-LD from listing records (`app/listings/[id]/page.tsx:58-103`, `167-199`). No sitemap/robots route was found under `app/`; no CMS SEO fields were found. Footer/header links and social URLs are hardcoded (`components/dashboard/footer.tsx:42-226`). Help content is code/i18n rendered. Status: **PARTIAL** for listing-level SEO, **MISSING** for SEO CMS/landing pages/redirect management/static-page workflow.

## Cross-module and security observations

| Integration | Result |
| --- | --- |
| Homepage → listing results | COMPLETE — VERIFIED source/test: normalized URL state reaches `/listings`; search service filters server-side. |
| Listing results → detail → checkout | COMPLETE — VERIFIED for navigation/date/guest query persistence (`airbnb-search-booking-persistence.test.ts`); live checkout/booking is unverified. |
| Date/guest → availability/quote | IMPLEMENTED — NOT VERIFIED end-to-end; shared availability and quote paths are used. |
| CMS → public pages/SEO/cache | MISSING except `popularHomes` setting. |
| Moderation → public visibility | IMPLEMENTED — NOT VERIFIED: published/ACTIVE/unpaused/nondeleted guards recur in public queries. |
| Reviews → cards | IMPLEMENTED — NOT VERIFIED: discovery loads published review summaries (`homepage.service.ts:578-586`). |
| User cache isolation | IMPLEMENTED — NOT VERIFIED: favourites use per-user cache version and `private, no-store`; homepage current cache is public before favourite decoration. |

Inputs are mostly parsed via route code/Zod, but public listing route uses `parseInt`/`parseFloat` with weak bounds checks, so oversized pages/limits and malformed numerics should receive explicit validation. Admin CMS content sanitisation, URL validation, media upload controls and editorial concurrency controls cannot be audited because the CMS does not exist.

## Automated verification performed

Passed (all are repository tests; several are source/contract tests rather than browser/database E2E):

- `__tests__/search-flow-upgrade.test.ts` — 8/8.
- `__tests__/booking-date-consistency.test.ts`.
- `__tests__/airbnb-search-booking-persistence.test.ts` — 14/14.
- `__tests__/wishlist-profile-saved.test.ts` — 6/6.
- `__tests__/dynamic-homepage-engine.test.ts` — 7/7.

Blocked:

- `__tests__/homepage-lazy-discovery-pagination.test.ts` imports `homepageService` and stops before assertions because `DATABASE_URL` is unset. No database records were created.
- No browser, production endpoint, authenticated admin account, map/provider credential, Redis, payment provider, performance trace or database EXPLAIN session was available.

## Verified bugs and priority actions

| Priority | Finding | Required action |
| --- | --- | --- |
| P0 | No CMS for the client’s committed content types or publishing lifecycle. | New CMS foundation; do not claim no-code management until it exists. |
| P1 | Homepage “lazy” rows still require whole-homepage assembly/database candidate fetch; on-demand page rebuilds full set. | Fix data-access design to query a section/page directly. |
| P1 | Homepage links can use `country`, but `/listings` page ignores it. | Fix URL/filter parity. |
| P1 | Flexible-date controls are not passed into search state; similar-date helper is unused. | Either connect and support it or remove the implied capability. |
| P1 | Featured city/marketing content is hardcoded/derived and cannot be curated. | Extend CMS after foundation. |
| P1 | Runtime DDL fallback in favourites service. | Remove and rely on migrations. |
| P2 | No saved searches or wishlist collections; recently viewed is device-local. | New user-preference models/UI. |
| P2 | No cluster map, map privacy test, cancellation filter, sitemap/robots/SEO CMS, or global nav/footer CMS. | Extend after P0/P1. |

## Complete 20-module status matrix

| # | Module | Status | Relevant evidence / next action |
| ---: | --- | --- | --- |
| 1 | Foundation & existing system | IMPLEMENTED — NOT VERIFIED | App Router, Prisma and public guards; reuse. |
| 2 | Location & destination search | COMPLETE — VERIFIED | Suggest API + server search; tighten canonical destination IDs. |
| 3 | Advanced date search | PARTIAL | Exact dates work; flexible/month preferences do not drive search. |
| 4 | Guest & pet selection | COMPLETE — VERIFIED | Persisted counts/capacity/pet filtering; live booking unverified. |
| 5 | Search results & filters | PARTIAL | Extensive Prisma filters/paging; fix country parity and invalid dates; add cancellation filter. |
| 6 | Detail & booking integration | IMPLEMENTED — NOT VERIFIED | Reuse quote/availability; verify real booking/payment. |
| 7 | Wishlist, saved searches, recently viewed | PARTIAL | Wishlist works; saved search missing, viewed is local only. |
| 8 | Interactive map search | IMPLEMENTED — NOT VERIFIED | Leaflet/bounds/markers; add privacy/mobile/cluster verification. |
| 9 | Homepage discovery/recommendations | PARTIAL | Code-defined ranking/collections, not personal/curated CMS. |
| 10 | Lazy loading/carousel optimisation | PARTIAL | UI payload/lazy requests work; backend work is not lazy. |
| 11 | CMS foundation/section builder | MISSING | New persisted content and renderer registry. |
| 12 | Homepage banners/media | MISSING | Static hero only; new media/banner CMS. |
| 13 | Featured cities/listings/collections | PARTIAL | Listing `isFeatured` + one setting; create curation/ordering CMS. |
| 14 | Promotions/marketing CMS | MISSING | Host pricing promotions are not content campaigns. |
| 15 | FAQs/static pages CMS | MISSING | Code/static help only. |
| 16 | Dynamic SEO/landing pages | PARTIAL | Listing metadata exists; no sitemap/SEO CMS. |
| 17 | Navigation/footer/global settings | MISSING | Hardcoded header/footer links/socials. |
| 18 | CMS publishing/permissions/audit | PARTIAL | Generic RBAC/audit exists; no content lifecycle. |
| 19 | Performance/security/accessibility | PARTIAL | Good guards/caching/modal overlay; performance and CMS hardening gaps. |
| 20 | E2E testing/production readiness | PARTIAL | Focused tests pass; runtime DB/browser/payment/CWV checks blocked. |

## Client requirement mapping

| Requirement | Current state | No-code admin? | What must be developed / reuse |
| --- | --- | --- | --- |
| Homepage banner management | Static image imports in hero. | No | Banner/media model, crop/alt/CTA/schedule and renderer. |
| Featured city management | Derived active-listing cities; no persisted curation. | No | Destination/featured-city records and ordering; reuse public listing guards. |
| Promotional content | Host booking discounts only. | No | Campaign/marketing content; keep it separate from pricing. |
| FAQ management | No FAQ model/route found. | No | FAQ categories/items/public renderer. |
| Static-page management | Help/footer labels hardcoded. | No | Versioned page model and safe rich text. |
| SEO content | Hardcoded homepage + dynamic listing metadata. | No | Page/section SEO records, metadata resolver, sitemap/robots. |
| Marketing sections | Fixed TS service sections. | No | Registry-backed configured sections; reuse card DTO/section renderer. |
| Dynamic section creation | No registry/storage. | No | Clarify allowed component catalogue; do not promise arbitrary software components. |
| Ordering/visibility | Fixed priorities. | No | Persisted sort/visibility and publishing filters. |
| Preview | Not found. | No | Draft preview with secure token/role check. |
| Publish/schedule | Listing lifecycle only, no content lifecycle. | No | Draft/publish/start/end lifecycle. |
| No-code content updates | Only Popular Homes configuration. | No | Deliver the above CMS components. |
| Role-based content permissions | Generic RBAC exists. | Partially | Add `cms.*` permissions and content ownership; reuse AdminRole/Permission. |
| Public synchronisation | Popular Homes setting is read server-side. | Partial | Tag/path revalidation for all CMS public content. |
| Cache invalidation | Favourites paths revalidate; CMS absent. | No | Revalidate tags/paths after publish. |
| Mobile presentation | Existing responsive components. | Partial | Add per-content responsive media/crop and test previews. |

## Evidence limitations

No percentages are supplied because the matrix mixes verified code-contract coverage with blocked runtime behavior. “Passing” test names that call themselves audits are not treated as full production E2E validation. The audit did not modify or inspect live content, create a booking/payment, authenticate as an admin, or run database performance queries.

