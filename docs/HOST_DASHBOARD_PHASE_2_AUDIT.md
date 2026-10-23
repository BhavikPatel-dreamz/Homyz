# Standard Host Dashboard — Phase 2 audit

## Scope and audit method

This was an existing-implementation completion pass. It reviewed the Standard host dashboard, Earnings, Insights, Calendar, reservations, reviews, listing performance, opportunities, guest insights, their APIs, the associated services, and Prisma models. Existing detail pages remain the source of truth; the dashboard provides compact summaries and links to them.

The requested source documents `DASHBOARD (Standard Edition)(6).docx` and `Host_Dashboard_Specification(7).docx` are not available in this repository, so an exact document-to-file comparison is **BLOCKED**. The matrix below accounts for every requirement in the supplied Phase 2 brief against the implemented application.

| Standard requirement | Previous status | Changes made | Final status |
|---|---|---|---|
| Monthly/YTD earnings, prior-period comparison and basic graph | COMPLETE | Verified authoritative stored payout snapshots and existing Earnings detail navigation. | COMPLETE |
| Upcoming payout, arrival state and authorized payout method | PARTIAL | Kept payment data read-only; clarified empty payout-method state and retained status-based, non-promissory arrival text. | COMPLETE |
| Average booking value and stay length | PARTIAL | Averages now render `—` when no eligible completed stays exist instead of implying a zero average. | COMPLETE |
| Fees, cleaning, pending payouts, refunds and adjustments | COMPLETE | Reused the existing Earnings and payout modules; no duplicate financial UI. | COMPLETE |
| Confirmed/upcoming reservations and booking detail navigation | PARTIAL | Next reservation now uses the real-time booking-status resolver, excluding completed/cancelled stays. | COMPLETE |
| Occupancy, booked, available and blocked nights | PARTIAL | Secondary KPI now identifies blocked nights and uses the active reporting-period label. Calendar remains the detailed surface. | COMPLETE |
| Cancellation and monthly reservation snapshot | COMPLETE | Preserved the existing all-record cancellation scope and explicitly labels its period; monthly snapshot remains booking-activity scoped. | COMPLETE |
| Calendar booking, availability, blocks and supported pricing | COMPLETE | Verified existing `/host/calendar`; no second calendar introduced. | COMPLETE |
| Guest origins, returning guests and rating | COMPLETE | Reused guest analytics and preserved unknown geographic data rather than inferring it. | COMPLETE |
| Check-in instructions viewed/not viewed | PARTIAL | Verified persisted `Booking.checkInInstructionsViewedAt`, guest-authorized recording endpoint, and eligible-reservation calculation. Historical data stays unavailable until `CHECKIN_INSTRUCTIONS_TRACKING_STARTED_AT` is configured. | COMPLETE (forward collection); BLOCKED (unconfigured/historical data) |
| Reviews, categories, trend, responses and quality recommendations | PARTIAL | Preserved Insights review management and corrected reporting/detail/reply authorization to use actor-scoped owned or accepted co-host listings. | COMPLETE |
| Basic listing views, conversion, observed ranking and comparable pricing | COMPLETE | Reused existing Listing Performance telemetry, attribution labels, search context and empty states. | COMPLETE |
| Listing health, Superhost/Guest Favorite and basic recommendations | COMPLETE | Retained stored-data rule-based recommendations and valid deep links; no AI forecasting added. | COMPLETE |
| Dashboard hierarchy, empty/loading states, accessibility and mobile layout | PARTIAL | Removed client-side response reuse, added private/no-store response caching, and made empty financial labels honest while retaining the existing responsive design. | COMPLETE |
| Standard versus Dashboard Plus separation | COMPLETE | Basic reporting remains ungated. Existing Plus-only advanced reporting/forecasting functionality remains separate. | COMPLETE |

## API and data notes

- Updated `GET /api/v1/host/dashboard` to return `Cache-Control: private, no-store`.
- Reused the existing Earnings, Insights, Calendar, reservation, review, listing-performance and opportunity APIs; no payment gateway or payout initiation was added.
- Review list, overview, detail and reply authorization now accept the authenticated actor and enforce `accessibleHostListingWhere`, which includes owned and accepted co-host listings.
- Guest history and opportunities use that same listing scope. Opportunity lifecycle rows remain isolated to the signed-in actor.
- Check-in views are recorded only for the booked guest, a confirmed reservation and a listing with saved check-in instructions. Only post-configuration eligible stays form the denominator, so historical guests are never reported as not viewed.

## Database migration

The existing migration `20261022140000_add_checkin_instruction_view_tracking` adds `Booking.checkInInstructionsViewedAt` and its listing/index support. No additional migration was required in this phase.

## Remaining blockers and deliberate deferrals

- Set a valid `CHECKIN_INSTRUCTIONS_TRACKING_STARTED_AT` deployment value when forward check-in engagement reporting should become active. Before that, the UI must continue to say that data is unavailable.
- The two requested `.docx` documents must be supplied to complete an exact client-spec comparison.
- No Dashboard Plus work was expanded: RevPAN, advanced booking behavior, pricing history, market benchmarking, forecasting, lifetime value, AI copilot, pricing autopilot, and predictive ROI remain deferred/entitlement-controlled.

## Validation coverage

Focused source and unit contracts cover real-time upcoming reservation eligibility, honest empty financial states, actor-scoped authorization, persisted check-in tracking, and private dashboard responses. Type checking and targeted lint/test commands are recorded with their results in the implementation handoff.
