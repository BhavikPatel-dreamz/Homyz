# Guest reviews loading performance audit

Scope: public guest reviews on `/listings/[id]`.

## Root causes found

1. The review section started two independent browser requests after it entered the viewport: a detailed statistics request and the first review page. The section skeleton waited for the statistics request even though the listing payload already contained the lightweight rating and count.
2. Zero-review listings still requested the first page.
3. The first-page service performed a count plus a broad `Review` relation fetch. Prisma then resolved reviewer, response, and response-author data separately; it read private/moderation columns that the public DTO never rendered.
4. Detailed stats used three queries and, when historic reviews lacked persisted topic tags, a fourth scan of up to 100 comments. The detailed modal also fetched page one again despite receiving preview reviews.
5. Public review pages and stats had no dedicated cache or versioned invalidation.

## Implementation

- `ReviewList` renders the rating/count already present in the listing payload and makes one bounded (`limit=4`) page request only when the count is non-zero. It aborts stale requests, has an explicit retry state, and does not depend on dates, guests, or booking UI state.
- “Show all reviews” fetches detailed statistics only on intent. The review modal receives the already-loaded preview and pagination, and maintains a two-minute client page cache so its first open does not repeat that request.
- Public review pages now use a single parameterized joined query with `COUNT(*) OVER()`; it selects only fields rendered by the public DTO. The detailed stats endpoint now uses one aggregate/mentions CTE instead of the previous multi-query path and legacy keyword fallback scan.
- Added versioned cache-aside entries for public page and stats data (120 seconds and 300 seconds). Any listing invalidation increments the per-listing review version. Reciprocal publication, response creation, moderation, deletion, and normal listing changes invalidate public review data.
- Added a composite review index migration for `(listingId, status, direction, createdAt DESC)`.
- The full review DTO endpoint now requires authentication; anonymous pages only use the privacy-safe listing-review API.

## Measurements

Measurements used the configured development database with a listing containing published reviews. Timings include service/API work, not browser paint.

| Path | Before (warm DB connection) | After, warm connection cache miss | After cache hit |
| --- | ---: | ---: | ---: |
| First page (bounded review records) | 1.62–1.68 s | 251 ms service / 311 ms local API | 0.4 ms service / 24 ms local API |
| Detailed stats | about 475 ms in the earlier aggregate path; legacy-topic fallback could add another query | 280 ms service / 290 ms local API | 0.1 ms service / 48 ms local API |

The first request after a development-server rebuild/connection setup was about 1.7 s; it is startup overhead, not the warmed query path. The API now meets the requested 300/500 ms targets under the warmed local test conditions. Production measurements still need representative production data and network conditions.

## Request, query, and payload changes

- Initial positive-review section: two browser requests (`stats` + `page`) → one bounded page request. The lightweight summary comes from the existing listing payload.
- Initial zero-review section: two browser requests → zero review API requests.
- Modal first open: first-page duplicate request → zero duplicate page requests; only the detailed stats request is made if absent from cache.
- First page: count + broad relation loading (up to five SQL operations in the old relation path) → one joined SQL statement for ordinary pages.
- Detailed stats: three SQL operations, plus a possible comment fallback scan → one SQL statement.
- Initial review record cap remains four. API response bytes were not captured, so no byte-size claim is made; the public JSON schema remains the same while database reads no longer include private notes or moderation fields.

## Verification completed

- `npx tsc --noEmit --pretty false`
- `npx prisma validate`
- `npx tsx __tests__/review-loading-performance-regression.test.ts`
- Local API timing checks for cold-cache and cache-hit page/stat routes.
- `git diff --check`

## Remaining validation

The available development database has at most six reviews on the measured listing. The code is bounded and paginated for larger datasets, but 100-, 1,000+-review, slow-network, screen-reader, and real production cache-hit-rate tests require representative seeded or production-like data. Apply the included Prisma migration before measuring the composite-index benefit in the target environment.
