# Support notification and evidence operations

## Migration and rollout

`20261029150000_add_support_notification_outbox_evidence_security` is additive.
It must be deployed after the earlier unapplied support migrations. Do not run
the legacy support backfill as part of this release. Validate Prisma migration
history in the target environment before deploying; this workspace currently
has a divergent remote migration history.

## Notification outbox

Support and Resolution Center changes write a `NotificationOutbox` row in the
same database transaction as their event/audit record. A scheduler or an
authorized operator invokes `POST /api/v1/admin/support/notification-outbox/process`
with a maximum batch size of 50. It performs one bounded batch only; it never
polls or self-restarts.

Events have a 90-second lease, five maximum attempts, exponential retry delay,
and move to `DEAD_LETTER` after permanent/ambiguous provider failure or the
attempt limit. Use the admin Notification Delivery page to review and manually
retry `DEAD_LETTER` and `RETRY_PENDING` events. Manual retry is permissioned,
rate-limited, and audited.

In-app notifications are persisted as delivered when the inbox row is written.
Email is only attempted with `RESEND_API_KEY`; a Resend API acceptance is stored
as `SENT`, never `DELIVERED`. Timeouts and ambiguous provider outcomes are sent
to dead letter rather than automatically resent.

## Evidence quarantine

Support evidence is stored through the existing private storage adapter and is
initially `QUARANTINED`. It cannot be downloaded until a configured scanning
integration changes it to `CLEAN`. This repository has no approved scanner
adapter, so neither the worker nor an administrator may mark evidence clean;
scan-dependent access remains safely blocked. Do not claim malware scanning is
operational until an approved provider and secure worker credential are added.

Legal holds are available only to `disputes.resolve` administrators. They write
an append-only hold record, support event, and audit log. Hold records always
exclude an item from cleanup. The retention endpoint is a dry-run report only:
there is no route that performs support-evidence deletion. Any future deletion
run must use an approved policy, explicit confirmation, a bounded set of IDs,
and the service-level legal-hold/case-status checks.
