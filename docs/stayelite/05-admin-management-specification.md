# StayElite admin management specification

**Status:** proposed information architecture. Reuse existing admin shell, RBAC, audit log patterns, pagination and managed-media authorization. Do not add these pages in Phase 1.

## 1. Navigation and capabilities

| Section | Information / administrator actions | Required permission family and controls |
|---|---|---|
| Loyalty Overview | KPI totals, pending jobs, qualification/revocation/reward exceptions; drill down to source records. | `loyalty.view`; read-only, aggregated privacy-safe data. |
| Achievement & Badge Catalog | Create draft, validate rule schema, preview eligible evidence, publish, archive; never hard-delete awarded definitions. | `loyalty.definitions.manage`; two-person/publish approval recommended. |
| Travel Sticker Management | Reuse `/admin/travel-stamps` for user-managed catalog artwork; separately manage verified sticker definitions/taxonomy mapping. | `travel_stamps.manage` vs `loyalty.definitions.manage`; no user-selected catalog entry becomes an earned award. |
| Loyalty Tiers & Eligibility | View tier versions/criteria, simulate against anonymized evidence, publish future version, inspect membership history. | `loyalty.tiers.manage`; financial-tier changes require elevated approval. |
| Points & Reward Rules | Configure only approved earning/reward policies; view ledger/reversal queue. | `loyalty.rewards.manage`; adjustments require `loyalty.points.adjust`. |
| Referral Program | Reuse current approval queue; edit future program configuration; investigate fraud/revoke. | Existing `referrals.view/review` plus `loyalty.referrals.manage`. |
| Loyalty Campaigns | Create target/audience/date/benefit campaign drafts, validate overlap, publish/disable. | `loyalty.campaigns.manage`; pricing-affecting campaign approval. |
| Guest Loyalty Accounts | Search a guest; view safe evidence, tier, progress, awards, rewards and immutable history. | `loyalty.accounts.view`; PII minimization and reason logging. |
| Award & Redemption History | Filter award/issue/redeem/revoke/reverse events; manual action workflow. | `loyalty.history.view`; reversible actions only with dedicated permission. |
| Analytics & Audit Logs | Conversion, issuance, liability, reconciliation/worker failures, actor history. | `loyalty.audit.view`; export governed by existing policy. |

## 2. Definition lifecycle and versioning

Definitions use immutable published versions:

`DRAFT → VALIDATED → PENDING_APPROVAL → PUBLISHED → ARCHIVED`.

- Editing a published rule creates a new version; it never changes an award’s historical interpretation.
- New version requires: stable definition key, comparison schema, source-data mapping, display content/artwork, effective date, dry-run impact, and explicit backward-evaluation flag.
- Archive stops future qualification but preserves awards, history and public display according to policy.
- A definition cannot be permanently deleted after it has award/ledger history.
- Classification data (city aliases, country/continent/language, theme tags) is separately versioned and referenced in evidence snapshots.

## 3. Automatic versus manual actions

| Action | Allowed actor | Requirement |
|---|---|---|
| Automatic award/revoke | System processor only | Authoritative event evidence, rule version, idempotency key, audit entry. |
| Manual award | Authorized admin | Exceptional reason, evidence attachment/reference, selected definition version, public visibility default, immutable override marker. |
| Manual revoke | Authorized senior admin | Reason, source/appeal reference, actor, effective timestamp, dependent benefit/reward disposition. |
| Points adjustment | Finance/loyalty approver | Signed positive/negative ledger entry; never edit balance. |
| Reward cancellation/reversal | Reward/finance approver | References original issue/redemption and commercial reason. |

Admin UI must make overrides visibly distinct from automatic awards. It may not alter a user-managed travel stamp as a proxy for achievement action.

## 4. Validation and audit requirements

- Validate category-specific rule fields server-side before draft save and again before publish.
- Do not permit arbitrary JSON/SQL rules, arbitrary client evidence or unrestricted image URLs.
- Rule preview cannot write awards/points.
- Record actor, action, reason, before/after, definition/taxonomy version, scope and correlation ID in `AuditLog`/future loyalty audit stream.
- Admin changes must invalidate read models/projections without retroactively re-evaluating awards unless an explicit, reviewed migration is scheduled.
- Use granular permissions rather than only `Role.ADMIN`; keep existing referral permissions intact.

## 5. Phase 2 acceptance criteria

- [ ] Role/permission matrix separates read, definition publish, override, points adjustment and campaign approval.
- [ ] Published rule changes create versions and preserve historical award evidence.
- [ ] Admin simulation/dry-run cannot mutate loyalty state.
- [ ] Manual actions are reasoned, auditable and distinguishable from automatic evidence.
- [ ] Existing travel stamp CRUD remains user-managed-catalog administration, not verified award administration.
