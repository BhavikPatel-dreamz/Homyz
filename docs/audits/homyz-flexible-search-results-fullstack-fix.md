# Homyz flexible search results full-stack fix

## Root cause

Flexible selections were serialized by the homepage search flow, but the result-view contracts only understood exact `checkIn` and `checkOut` values. This made result headings, property cards, map markers, and some listing-detail links fall back to exact-date or implicit-duration presentation.

## Search state fixes

- `dateMode=flexible`, `stay`, and `months` are carried from the homepage through the listings URL, results client state, compact results bar, cards, map previews, and listing detail links.
- The results search bar restores the mode from URL state and uses one merged **When** segment for a flexible selection.
- The client cache key includes flexible parameters, so browser navigation cannot reuse a result set from a different flexible selection.

## Search Results UI changes

- The summary identifies the requested duration and month(s), for example “22 homes available for weekend in November in Surat”.
- Flexible cards display `From <nightly price> / night`; they do not manufacture a selected two-night, week, or month total.
- Map price markers and selected-map previews use the same `From` nightly-price convention.

## Availability verification

- Weekend uses every Friday arrival in each selected month and a two-night range.
- Week uses every day as a possible arrival and a continuous seven-night range.
- Month uses every day as a possible arrival and a continuous 28-night range.
- Each candidate is checked by the shared booking availability rules, including holds, blocked dates, capacity, minimum/maximum stay, and advance notice. Only listings with at least one valid candidate are returned.

## Result count, filtering, and map synchronization

- Availability is applied before pagination and result totals.
- Filters remain in the same URL and API request as the flexible criteria.
- The map receives the current returned listing set (`allListings`), clears old markers before rendering the new set, and derives every marker from that set.

## Performance notes

- Candidate generation is bounded by selected calendar months: at most 31 arrivals per selected month before policy filtering (and approximately 4–5 Friday arrivals for weekends).
- Reservation/hold retrieval is batched for the candidate search window; no per-listing reservation query is introduced.
- No representative production database was available in this workspace, so no numerical database latency figure is claimed.

## Files changed

- `lib/search/flexible-stays.ts`
- `lib/validation/public-listing-search.ts`
- `services/listing.service.ts`
- `app/api/v1/listings/route.ts`
- `app/listings/page.tsx`
- `app/listings/listings-results-client.tsx`
- `components/home/home-view.tsx`
- `components/home/hero-section.tsx`
- `components/home/mobile-date-picker.tsx`
- `components/listings/listing-search-bar.tsx`
- `components/listings/results-summary-bar.tsx`
- `components/listings/listing-card.tsx`
- `components/listings/search-map.tsx`

## Tests executed

- `npx tsx __tests__/flexible-search-contract.test.ts`
- `npx tsx __tests__/flexible-results-presentation.test.ts`
- `npx tsx __tests__/phase1-search-booking-integration.test.ts`
- `npx tsx __tests__/listing-search-bar.test.ts`
- `npx tsc --noEmit --pretty false`

## Remaining blocker

The repository has pre-existing type errors in `services/achievement-reconciliation.service.ts` where a reconciliation summary is not typed as a Prisma JSON value. Those are outside the flexible-search change. Final booking availability remains revalidated by the existing booking service when a guest chooses concrete dates.
