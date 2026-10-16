# Property details optimization audit

Scope: `app/listings/[id]` and its public booking flow.

## Completed improvements

- The server route shares listing resolution between metadata and page rendering with request-scoped React `cache`, validates explicit date/guest query parameters, and only precomputes a quote for a valid selection.
- Reviews and the map are deferred until their sections approach the viewport. The dynamic imports already existed, but the page had mounted their direct components instead of the deferred wrappers.
- The photo gallery now waits to preload adjacent images until the lightbox is open, exposes **Show all photos** for every multi-photo listing, and returns keyboard focus to the trigger after close.
- Guest controls support adults, children, infants, and permitted pets. Adults are required; infants do not consume listing guest capacity; pet counts respect the listing policy and configured maximum.
- Invalid explicit URL state is surfaced to the guest instead of being silently replaced with a persisted search. A partial URL date pair cannot combine with stale cookie state.

## Existing production mechanisms verified

- Public listing detail uses a versioned persistent detail cache and parallel review aggregates in `services/listing.service.ts`.
- The booking quote remains authoritative on the server. The public booked-dates route bounds its requested calendar window and performs its independent lookup work concurrently.
- The listing loading UI retains the page shell and booking-card footprint, while the gallery uses responsive image sizes and prioritizes only the hero image.

## Verification

- `npx tsc --noEmit --pretty false` — passed.
- `npx next build` — compiled successfully, completed TypeScript and static-generation stages, and produced `.next/BUILD_ID`.
- Focused regressions passed: property-detail performance/booking state, single-listing upgrades, booking-date consistency, search-to-booking persistence, price breakdown, and property booking-card suites.

## Measurement boundary

No Lighthouse/Web Vitals trace or production database load test was run in this workspace, so this audit does not claim an LCP, CLS, INP, API latency, query-count, or cache-hit-rate improvement. The deferred UI and reduced gallery preloading are code-level changes intended to lower initial client and image work; they should be measured against a deployed representative listing before setting performance SLOs.

## Follow-up recommended before release

1. Capture mobile and desktop field data or Lighthouse traces for representative 1-, 5-, and 20-photo listings.
2. Monitor quote and booked-dates endpoint latency, errors, and cache effectiveness under real traffic.
3. Exercise keyboard and screen-reader flows through the gallery, reservation card, and any booking error state in a browser.
