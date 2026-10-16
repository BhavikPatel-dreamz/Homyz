# Homyz Homepage & CMS Proposed Roadmap

**Status: proposed only — not approved implementation scope.**  
This roadmap is derived from the companion audit and is intentionally gap-based. It does not authorise changes.

## Delivery principles

- Reuse the existing public listing visibility guards, search service, card DTOs, availability/quote service, `ModalOverlay`, admin RBAC and `AuditLog`.
- Keep content campaigns separate from booking discounts. A CMS campaign must never change a booking price unless a separate pricing requirement explicitly adds that integration.
- Build a constrained section catalogue, not arbitrary executable/admin-authored React components. Clarify which section types the client needs before designing the registry.
- Every published public record needs a clear cache invalidation/revalidation strategy. Draft data must not leak into public pages, metadata, sitemap or search engines.
- Establish runtime verification before calling any phase production-ready.

## Proposed sequence

| Phase | Priority | Scope | Complexity | Dependencies | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| 0 | P0 | Runtime baseline and parity fixes | Medium | Staging DB/Redis/browser access | Run database-backed homepage lazy test; add query/request profiling; fix `country` URL parity and decide invalid-date contract. |
| 1 | P0 | CMS core and editorial lifecycle | High | Product section catalogue, migration approval | Content models, CMS APIs/UI, `cms.*` RBAC, validation, audit events, draft/publish/unpublish, start/end schedules, preview, public revalidation. |
| 2 | P0 | Homepage content controls | High | Phase 1 | Admin manages banner/media, featured cities, curated collections, configured row title/limit/link/order/visibility; homepage renders only published configuration with safe empty states. |
| 3 | P1 | Static/marketing/SEO/global content | High | Phase 1 | FAQ and static pages, navigation/footer/social/global announcement config, per-page SEO, sitemap/robots and no-index guarantees. |
| 4 | P1 | Discovery data-access optimisation | High | Baseline measurement | Initial request fetches only visible section pages; offscreen endpoint queries only requested section/page; no all-section rebuild; preserve cards, cache and scroll behavior. |
| 5 | P1 | Search and map completion | Medium | Product decisions | Canonical destination identity, explicit invalid filters, cancellation filter if required, map privacy/redaction, mobile-map tests; clustering only if volume warrants it. |
| 6 | P1 | User preference products | Medium | Auth + migration approval | Durable saved searches, named reopen/update/delete, optional favourite collections, server-side recently viewed with privacy/retention policy. |
| 7 | P2 | Advanced discovery/editorial enhancements | High | Phases 1–6 | Real flexible date search, configured landing pages, recommendations, editorial revisions/rollback/approval workflow, promotion targeting/analytics. |

## Phase 0 — critical verification and parity

Fix only verified defects and establish measurements before large CMS work:

1. Supply non-production database/Redis configuration and run `homepage-lazy-discovery-pagination.test.ts`; add a browser network trace and database query capture for `/`.
2. Correct the homepage `/listings?country=...` link/query mismatch: either carry `country` from the route into `searchPublicListings` or stop generating the parameter.
3. Define invalid/incomplete date behavior. The recommended contract is: omit availability only when no date filter was requested; return a validation error for malformed or checkout-before-checkin requests.
4. Remove migration-altering fallback DDL from `favorite.service`; schema creation belongs to Prisma migrations.

Acceptance requires no source claim of database lazy loading without showing first-load query count and offscreen behavior, plus regression tests for country/date error behavior.

## Phase 1 — CMS foundation

Create a minimal, reusable editorial domain. Suggested bounded records:

- `MediaAsset` (owner, source, alt text, dimensions, usage, validation state).
- `ContentDocument` / `StaticPage` with slug, locale, body, SEO, draft/publish/schedule fields.
- `HomepageLayout` and ordered `HomepageSectionConfig`, restricted to an approved section type registry.
- Shared publishing fields: `status`, `publishedAt`, `scheduledAt`, `expiresAt`, `updatedBy`, optimistic version.
- `ContentRevision` or immutable revision snapshots with audit references.

Authorisation should use existing `AdminRole`, `AdminPermission`, and `AuditLog`, with least-privilege permissions such as `cms.view`, `cms.edit`, `cms.publish`, and `cms.media.manage`. CMS APIs should validate outbound URLs and content schema, sanitize any rich text, enforce asset types/sizes, prevent unsafe image sources, and make preview authenticated and non-indexable.

Acceptance requires an editor can draft, preview, publish, unpublish, schedule and audit a safe test document without deploying code; ordinary viewers cannot retrieve draft content; publish/expiry changes public content and metadata after expected revalidation.

## Phase 2 — homepage content management

Use the Phase 1 registry to support a finite initial library:

- Hero/banner: desktop/mobile image, crop/focal point, alt text, headline, body, CTA label, validated internal/external target, ordering, enabled state and schedule.
- Featured city: link to a canonical destination record/identifier, display label/image, ordering and visibility.
- Listing collection: manual listing selection and defined query strategies (property type, guest favourite, price, newest, review ranking); title, subtitle, limit, View All target, order, visibility and schedule.
- Marketing card/announcement: content-only CTA and schedule.

Reuse `Listing` public publication guards and current card mapper. CMS collection rendering must omit unavailable/unpublished listings and have a configured empty behavior. Do not fold host `discounts` into campaigns.

Acceptance requires edits from admin demonstrably update the public homepage at desktop/mobile widths, ordering is persisted, a scheduled/disabled section is absent, and card duplication/visibility policy is explicit.

## Phase 3 — static, SEO and global content

Add FAQ category/question ordering and visibility; static pages with legal-page publishing control; navigation/footer/social/contact/global announcements; page-specific title/description/canonical/Open Graph fields; sitemap/robots integration and safe redirects if explicitly approved.

Clarifications needed before implementation:

- Which policies are legally approved for admin editing, and is a publish approver required?
- Which locales are actually content-managed versus translated from source?
- Are external navigation/CTA domains allowlisted, and who manages that allowlist?
- Which landing-page templates are required (city, property type, campaign) and which content needs schema markup?

Acceptance requires draft pages are not indexed, published metadata is server rendered, footer/header configuration is validated/accessibly rendered, and legal page revisions are auditable.

## Phase 4 — actual lazy discovery optimisation

Replace “assemble all then strip” with section-specific data access. The homepage shell should obtain layout metadata and only the first page of the first visible collections. The section API should resolve the requested configured collection and run its own bounded query/cursor, not call a full homepage assembly function.

Preserve the existing good UX: `IntersectionObserver`, two-request queue, skeleton footprint, retry, carousel `onLoadMore`, and state/cache behavior. Use an opaque cursor if section rankings can change during pagination; otherwise document stable page ordering. Cache public collection queries by content version and filter/context, and keep favourites private/user-specific.

Acceptance criteria:

- Measured initial homepage property rows and DB reads are limited to viewport sections.
- Scrolling one offscreen section produces one section-specific request/query.
- Horizontal pagination returns no duplicate IDs and stable ordering.
- Empty/error/retry/mobile/scroll-back behavior remain correct.
- Before/after network, query and payload measures are recorded; Core Web Vitals claims require browser telemetry.

## Phases 5–7 quality gates

Before production sign-off, run:

- Unit/route tests for all filter parsing, canonical date utilities, CMS schemas/URLs/schedules and RBAC.
- Integration tests with Prisma/PostgreSQL for public visibility, collection rendering, favourites/user isolation, saved searches and publishing/revalidation.
- Playwright/manual journeys: desktop and mobile homepage search; keyboard autocomplete; direct URL/back/refresh; date/guest/pet capacity; map movement/marker selection; login favourite handoff; CMS draft/preview/publish/expiry; screen reader and focus behavior.
- Security review for rich text/media uploads, external URLs, preview tokens, user cache isolation and map coordinate precision.
- Load/query analysis for homepage, search, map bounds, section pagination and CMS public rendering.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| CMS overpromises arbitrary components | Establish a finite section registry and documented change process. |
| Draft or expired content is publicly cached/indexed | Enforce status/time predicates at every public reader; tag/path revalidation; automated indexing tests. |
| Marketing campaigns accidentally alter booking price | Separate data models/services and UI labels; only pricing service can quote discounts. |
| Large curated collections degrade homepage | Query/cursor each section independently; cache metadata; measure. |
| Content editor introduces unsafe links/markup | Schema validation, allowlist, sanitisation, RBAC and audit log. |
| Map reveals exact homes | Centralize public-coordinate rounding/redaction and test it. |
| Existing search state fragments further | Consolidate URL as shareable source of truth and persist only its normalized representation. |

## Features to retain, not rebuild

- Prisma-level public listing gating and search filter base.
- Shared availability validation, booked-range endpoint and quote service.
- Date-key utilities and tested date/guest state propagation.
- Favourite ownership/unique constraint, no-store API headers and cache invalidation pattern.
- Current listing card DTOs, carousel UI, `ModalOverlay`, viewport observer and dynamic Leaflet loading.
- Admin RBAC/audit-log infrastructure.

