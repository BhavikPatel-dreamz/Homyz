# Support analytics and production-readiness record (Phases 11–12)

This record covers the Support & Issue Resolution subsystem only. It is not approval to deploy financial settlement, payment-gateway refunds, or host payout processing.

## Phase 11 delivery

`/admin/support/analytics` uses the filtered `GET /api/v1/admin/support/analytics` API. Both this API and its CSV export apply the same server-side SupportCase filter: created-at UTC range, status, category, priority, current assignee, reporter role, and escalation state. The page keeps that filter state in the URL and aborts superseded browser requests.

The dashboard reports actual support-case, message, event, ResolutionOffer, evidence, recorded-refund, and notification-outbox records. The CSV endpoint requires `reports.export`, writes an `SUPPORT_ANALYTICS_EXPORT` audit record, limits detail rows to 100, and prefixes formula-leading cells. It never exports message bodies, private notes, evidence URLs, or file metadata beyond the aggregate metrics.

### Metric semantics

- The global date scope is `SupportCase.createdAt`, interpreted as UTC. The selected filters form a single case cohort.
- Created trends use `SupportCase.createdAt`; resolved, closed, and reopened trends use corresponding `SupportCaseEvent.createdAt` records, constrained to the selected UTC period and cohort. The distinction is stated in the UI.
- Current status distribution is mutually exclusive. A reopened KPI counts cases with a recorded `STATUS_REOPENED` event, even if they were subsequently resolved or closed.
- First response is the first participant-visible message authored by a user with the `ADMIN` role. Internal notes and absent timestamps are excluded; they are never counted as SLA-compliant.
- Resolution SLA only includes cases with both `resolvedAt` and `slaDueAt`. There is no historical policy snapshot or paused business-hours clock, so results are operational indicators rather than retrospective contractual SLA proof.
- Agent metrics are assigned to the current assignee. Assignment history does not retain the assignee who resolved the case, so these are workload indicators and must not be treated as quality rankings.
- Resolution-center “agreements” are accepted `ResolutionOffer` records. They do not mean an associated refund was executed or a payout was settled.
- Financial reporting is strictly limited to linked application `BookingRefund` records and category text. No gateway, reconciliation, payout, or balance claim is made.

### Bounded-query behavior

The detailed analytical cohort is capped at 2,500 newest matching cases while the case table remains server-paginated (maximum 100 rows). If the cohort is capped, the UI clearly identifies the truncation and instructs the operator to narrow the date range. The total case count is still queried server-side. This prevents unrestricted history/message/evidence loading while avoiding a false claim of a complete trend for large cohorts.

## Phase 12 verification matrix

| Area | Status | Evidence / limitation |
| --- | --- | --- |
| Guest case create, view, reply, evidence, resolution center | COMPLETE (source regression) | Phase 3/4 support tests passed; browser/database E2E remains pending a dedicated non-production environment. |
| Host direct resolution offers and mediation | COMPLETE (source regression) | Phase 5–6 suite passed; concurrent PostgreSQL action test is not run. |
| Admin case queue, assignment, status, escalation, notes | COMPLETE (source regression) | Version checks and append-only events are covered by the support suites. |
| Support analytics, filters, charts, CSV | COMPLETE (source/unit) | Phase 11–12 safeguards passed. Needs seeded data visual acceptance before release. |
| Notification outbox, retries, dead letters | PARTIALLY COMPLETE | Durable bounded worker and static safeguards passed. Provider delivery was not invoked. |
| Evidence quarantine, access, holds and retention | PARTIALLY COMPLETE | Access and retention safeguards passed statically. No scanner or private-storage integration run. |
| Endpoint RBAC / IDOR controls | PARTIALLY COMPLETE | Support source tests and explicit route permissions passed; no authenticated black-box matrix was run. |
| Database migrations and legacy backfill | BLOCKED | Local and remote migration histories diverge; migrations/backfill were intentionally not executed. |
| PostgreSQL race testing | BLOCKED | Optimistic-locking source coverage exists, but no dedicated isolated PostgreSQL test database was provided. |
| Mobile, keyboard, screen-reader acceptance | PARTIALLY COMPLETE | UI uses labeled controls, native buttons/links, responsive overflow wrappers, and text alternatives; browser/assistive-tech testing remains required. |
| Financial support reporting | PARTIALLY COMPLETE | Read-only recorded refund status only. Phases 7–8 are skipped; gateway settlement and payouts remain out of scope and unverified. |

## Safe rollout checklist

1. Reconcile the Prisma migration histories and take a database backup. Review then deploy the additive support migrations in an approved staging environment; do not use `migrate dev` against production.
2. Run the support-case legacy backfill in dry-run mode, review its report, and obtain explicit approval before any write mode.
3. Provision a least-privilege production database role and confirm the configured RBAC seed grants `disputes.view` to analytics viewers and `reports.export` only to approved export roles.
4. Configure private object storage and an active malware scanner. Do not mark evidence clean or enable download access merely because an object was uploaded.
5. Deploy the notification outbox worker with a bounded schedule, alert on dead letters, and use a non-production delivery adapter for validation. Do not manually retry ambiguous provider outcomes without reconciliation.
6. Seed a non-production dataset spanning all support statuses, assignments, SLA due dates, offers, evidence states, and refund-record states. Validate analytics values against direct SQL before enabling the navigation link for broad admin roles.
7. Run authenticated guest, host, view-only admin, manage admin, and resolve-admin browser flows; run assignment/status/offer concurrency tests against a dedicated PostgreSQL test database.
8. Perform responsive and keyboard/screen-reader checks on the guest center, host resolution center, admin queue, case detail, notification monitor, and analytics page.
9. Keep financial execution, payout settlement, retention deletion, and any real-email delivery disabled during this rollout unless separately approved and verified.

## Release gate

The non-financial support subsystem is **conditionally ready for staging** after migration reconciliation, RBAC seeding, worker/scanner configuration, and isolated end-to-end verification. It is **not production-ready as a whole** because database deployment history is divergent, external delivery and evidence-scanning integrations were not exercised, and Phases 7–8 financial work remains intentionally unverified.
