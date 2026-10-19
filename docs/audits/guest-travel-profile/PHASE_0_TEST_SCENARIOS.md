# Phase 0 — Test Scenarios

These are acceptance and regression scenarios for later implementation. Current status is intentionally conservative: this Phase 0 audit inspected code only and did not run database-mutating suites.

| ID | Scenario | Expected result | Current coverage / gap |
| --- | --- | --- | --- |
| ID-01 | A USER, HOST, and ADMIN each create/access a travel profile. | Every account has one travel identity; no role changes occur. | Gap; regression needed for existing USER→HOST promotion. |
| ID-02 | Public anonymous visitor opens an allowed profile. | Safe public DTO and public processed media only; no login redirect. | Current route behavior must be verified/fixed. |
| ID-03 | Anonymous visitor opens a hidden/private profile. | 404 or policy-safe denial with no existence/data leak. | Partial current profile boolean; media leak gap. |
| ID-04 | Owner opens own profile/editor. | Owner-only fields and drafts are available; response is private/no-store. | Existing profile tests are related; new DTO coverage needed. |
| ID-05 | Authenticated non-owner views a public profile. | No email, phone, birth date, role, status, private URLs, drafts, or moderation notes. | Critical regression gap around generic mapper. |
| ID-06 | Viewer is blocked by, or has blocked, profile owner. | Profile, media, interactions, search/tagging, and notifications obey block policy. | Missing. |
| ID-07 | Profile visibility changes while cached. | Subsequent public requests cannot receive stale now-private content. | Missing visibility-version/cache test. |
| DM-01 | Upload valid JPEG, PNG, WebP, and AVIF. | Accepted after server validation; variants/process state created. | Existing validator coverage is reusable. |
| DM-02 | Upload spoofed MIME, unsupported type, oversized file, malformed image. | Rejected server-side before publication; clear safe error. | Existing listing-media coverage related; travel endpoint needed. |
| DM-03 | Upload a private/draft travel photo and guess/copy its media URL. | Unauthorized request cannot retrieve original or variant. | Critical missing. |
| DM-04 | Cancel or lose network during upload/finalize. | Client can retry; incomplete asset is inaccessible and later cleaned up. | Missing. |
| DM-05 | Finalize succeeds but database attach fails. | No public orphan; retry/recovery is deterministic. | Missing. |
| DM-06 | Delete a photo while delivery/cache is active. | Gallery removes it immediately by policy; asset lifecycle follows retention/cleanup safely. | Partial current best-effort delete only. |
| DM-07 | Upload with drag/drop, keyboard file picker, and mobile picker. | Equivalent validation, preview, labels, progress, and error behavior. | Drag/drop missing. |
| TR-01 | Confirmed booking with checkout in the past. | Creates/qualifies verified travel evidence once. | Requires shared eligibility/projection tests. |
| TR-02 | Pending, cancelled, future confirmed, and expired booking. | Never contributes to verified trip/destination counter. | Current stats are incorrect. |
| TR-03 | Two completed stays in the same destination. | Trip evidence may have two records; destination display count is distinct and correct. | Missing. |
| TR-04 | User self-declares then verifies same destination. | One destination display, source label upgrades without duplicate. | Missing. |
| TR-05 | Add sixth active photo to one published trip concurrently. | One request fails atomically; trip has at most five photos. | Missing. |
| TR-06 | Associate photo/trip owned by another user. | Forbidden, no information disclosure. | Missing. |
| SO-01 | Like profile/photo twice, including concurrent requests. | One edge/count/event only; calls are idempotent. | Missing. |
| SO-02 | Like own profile/photo. | Rejected if product chooses no self-like; counter unchanged. | Missing policy test. |
| SO-03 | Like a private, removed, or blocked photo. | Forbidden/not found; no count or notification. | Missing. |
| SO-04 | Unlike after notification delivery. | Count decrements safely; notification policy behaves as specified without duplicate events. | Missing. |
| SO-05 | Tag another user who has blocked owner or disallows tags. | No visible tag/no notification; safe policy response. | Missing. |
| SO-06 | Tag acceptance/decline/removal. | Status controls display and notifications; relation remains auditable. | Missing. |
| SO-07 | Follow/unfollow (if approved). | Unique edge, block/private policy, cursor follower lists and notifications work. | Deferred feature. |
| SO-08 | Comment/reply/edit/delete/report (if approved). | Thread policy, pagination, moderation, notification, and tombstone semantics hold. | Deferred feature. |
| MO-01 | Report a travel profile/photo/comment. | Existing report/case flow resolves target ownership and creates auditable case. | Travel targets missing. |
| MO-02 | Moderator hides/removes/restores travel photo. | Public/gallery/search/CDN authorization stops/returns content according to state. | Missing. |
| MO-03 | Non-moderator requests evidence/moderation data. | Forbidden; no private URLs/case metadata leak. | Extend existing moderation coverage. |
| UI-01 | Open/close upload, edit, delete, share, report dialogs at mobile/tablet/desktop. | Background scroll locks via `ModalOverlay`; dialog scrolls, focus is trapped/restored, escape works. | Overlay is reusable; scenario needed for new dialogs. |
| UI-02 | Gallery at 320px, tablet, and desktop. | Stable grid, meaningful skeleton/empty/error states, no horizontal overflow/layout shift. | Missing. |
| UI-03 | Keyboard/screen-reader traversal. | Visible focus, labeled controls, announced upload/progress/errors, meaningful alt text. | Missing. |
| PF-01 | Profile with thousands of photos. | Cursor pagination, bounded query, thumbnails, no original-image waterfall. | Current `findMany` is unbounded. |
| PF-02 | Concurrent likes/uploads/profile edits. | No counter drift, lost visibility update, or duplicate notification. | Missing. |
| PF-03 | Cache invalidation after privacy/moderation change. | Public and viewer-specific caches reflect policy within documented SLA. | Missing. |
| OP-01 | Migration rehearsal on production-like clone. | Migrate status understood; backfill is resumable/idempotent and metrics reconcile. | Required before schema change. |
| OP-02 | Rollback feature flag after partial rollout. | New public routes/writes disable safely; no data loss; owner assets remain recoverable. | Missing. |

## Minimum automated suite for the first release

1. Unit tests for eligibility, DTO redaction, visibility/block predicates, and reaction idempotency.
2. Service/database integration tests for uniqueness, ownership, photo cap, transaction rollback, and moderation state.
3. Route tests for anonymous/owner/viewer permissions and cache headers.
4. Browser tests for upload failure/retry, responsive gallery, dialogs, keyboard flow, and share/report paths.
5. Storage integration tests that prove a private travel asset cannot be retrieved with a copied URL.
6. Migration/backfill rehearsal in CI or a staging job, never against developer/production data as an incidental test.
