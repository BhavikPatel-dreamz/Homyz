# Phase 0 — Implementation Roadmap

This sequence keeps a public-social feature from outrunning its privacy and data boundaries. Phases are implementation increments, not date estimates.

| Phase | Scope | Dependencies | Exit criteria | Principal risk |
| --- | --- | --- | --- | --- |
| 0. Decisions and preflight | Approve privacy defaults, counter definitions, launch cut, handle policy, photo cap, social scope; validate migration history on a clone. | Product, security, DBA/ops availability. | Decision record; migration status clean/understood; data inventory complete. | Building against ambiguous counter/privacy semantics. |
| 1. Identity and read boundary | Typed `TravelProfile`; explicit owner/public/viewer DTOs; safe public route/handle; fix direct photo enumeration; no role dependency. | Phase 0. | Anonymous/public and owner responses prove least privilege; host can also own travel profile. | Sensitive user fields or viewer-state leaking via shared cache. |
| 2. Travel-media foundation | Travel media type, private/public delivery, upload session/finalize flow, variants, state machine, cleanup/reconciliation. | Phase 1, storage/ops design. | Private asset cannot be fetched by URL; failure/retry/orphan tests pass. | Treating public listing storage as revocable private media. |
| 3. Trips and verified destinations | `TravelTrip`, destination/visit/evidence projections, shared completed-stay eligibility, server-side five-photo cap. | Phases 1–2, booking semantics decision. | Pending/cancelled bookings do not count; verified/self-declared labels are accurate. | Date/timezone and backfill misclassification. |
| 4. Owner travel profile UX | Edit travel profile/cover, trips, photo drafts; responsive upload, real drag/drop, progress/cancel/retry; accessibility. | Phases 1–3. | Owner can recover from failed upload; modals use `ModalOverlay`; mobile/desktop acceptance passes. | Client-only validation and stranded uploads. |
| 5. Public gallery and share | Public profile layout, cursor gallery, share metadata/UI, visibility controls, report entry points. | Phases 1–4 and moderation extension. | Logged-out allowed profile works; hidden/blocked/private content never appears; performance budget met. | Cache/CDN bypass or URL leakage. |
| 6. Reactions | Profile/photo likes, unique edges, counts, block checks, social notification event key. | Phase 5 and block baseline. | Idempotent concurrent reactions; no self-like/block leaks; notification exactly-once behavior. | Counter/event race conditions. |
| 7. Safety and moderation | `UserBlock`, travel moderation targets/cases/actions, tag consent; staff tooling and audits. | Phases 2, 5, 6. | Reports can hide/restore travel content; blocked users are isolated in all paths. | Missed enforcement path. |
| 8. Stamps and achievements | Versioned travel catalog, award criteria/evidence, UI. | Verified destination/trip data. | Awards are explainable, reversible, and do not reuse host badges. | Product criteria churn/data re-awards. |
| 9. Optional social expansion | Follows and then comments/replies/feed only if approved. | Reactions, blocks, moderation, notification scale. | Abuse controls, pagination, retention/edit/delete policy, load tests. | Moderation/fan-out complexity. |
| 10. Migration and release | Backfill/dark launch, metrics, operations runbooks, staged rollout. | All launched scopes. | Rollback plan, dashboards, support/admin procedures, acceptance suite green. | Legacy public assets/data mismatch. |

## Recommended release slices

### Slice A — safe identity, no public media

- Introduce `TravelProfile`, typed validation, owner/public DTO split, and a safe public profile route.
- Define and display only truthful counters and verified/self-declared destination placeholders.
- Keep existing TripPhoto UI private/legacy while the media foundation is built.

### Slice B — travel albums and public gallery

- Move to travel-aware upload/finalize/variant delivery.
- Add trips, destination evidence, privacy, pagination, sharing, and travel-content reporting.
- Run with feature flag and migrate existing images as private drafts by default.

### Slice C — minimal social

- Add blocks first, then idempotent likes and social notifications.
- Exclude follow/comments until safety, volume, and moderation requirements are funded.

## Workstream ownership checklist

| Workstream | Deliverables |
| --- | --- |
| Product/design | States for private/public/unlisted, empty/processing/removed media, counter labels, report/block flows, responsive specs, accessibility copy. |
| Backend/data | Models/migrations, safe DTOs, eligibility projection, visibility authorization, pagination, idempotency/outbox. |
| Media/platform | Asset states, signed/private delivery, variants, lifecycle cleanup, observability and quotas. |
| Web/mobile | Owner editor, gallery, optimistic UI rollback, share UI, focus management, loading/error/retry states. |
| Trust & safety | Reporting targets, severity/SLAs, moderator tooling, appeals/restore policy, tag/block policy. |
| QA/SRE | Matrix in the companion test document, staging data, migration rehearsal, dashboards, feature flags/rollback. |

## Do-not-start conditions

- Do not release photo privacy controls while photos retain public listing-media URLs.
- Do not calculate “trips” from all bookings or use photo count as a substitute.
- Do not launch public social writes without `UserBlock`, rate limits, idempotency, and moderation targets.
- Do not add migrations until the `HostGuestReview`/schema history discrepancy is understood on a database clone.
- Do not alter the Listing Description page; it is outside this scope.
