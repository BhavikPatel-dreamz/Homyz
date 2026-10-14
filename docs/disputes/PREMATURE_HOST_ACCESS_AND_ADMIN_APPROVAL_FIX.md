# Premature Host Dispute Access and Admin Approval Fix

Audit date: 2026-10-14

## Root causes

1. Guest dispute creation selected the booking Host as the other party and
   immediately created a Host dispute notification. This contradicted the
   selected Admin-review-first workflow.
2. The Host access predicate had been added for the review-first workflow, but
   old Host notification-link repair still considered property ownership alone
   enough to restore a Host deep link.
3. Repeated Admin Host-response requests could create separate request records
   and notification events.

## Fixes

- A Guest-created dispute now notifies authorized Admin recipients only. It
  does not create a Host notification, grant Host participation, or mark a
  Host response required.
- Host access remains server-side and requires either that the Host filed the
  dispute, an explicit `hostParticipation` grant, or an existing historical
  Admin Host-information request. This predicate covers the Host list, counts,
  details, reply/response, uploads, evidence access, notes, and proposals.
- Admin investigator assignment only changes `assignedAdmin`; it never changes
  Host visibility or sends a Host response notification.
- Requesting a Host response records the Admin actor, timestamp, request ID,
  instructions, and Host participation in the existing metadata; it then sends
  the one idempotent, role-correct notification to the related active Host.
- A second pending Host request returns a conflict instead of creating another
  request or notification.
- Historical premature Host notifications are retained for audit but their
  deep link is safely removed unless the associated case is actually shared.
  A notification link never grants access; the route remains authorized by the
  same backend predicate.
- The inbox uses a dedicated `Dispute` badge for dispute events. Notifications
  with no safe destination do not offer a View Details action.

## Files changed

- `services/dispute.service.ts`
- `services/notification.service.ts`
- `components/profile/notifications-view.tsx`
- `app/(protected)/admin/bookings/disputes/[id]/admin-dispute-details-client.tsx`
- `services/booking.service.ts`
- `components/bookings/booking-details-client.tsx`

## Verification

An isolated development Guest, Host, and Admin flow was executed using a
temporary dispute record, then the record and related notifications were
removed.

| Scenario | Result |
|---|---|
| Guest creation saves one dispute and creates Admin notification | Pass |
| Host receives no initial dispute notification | Pass |
| Host list, detail, response, and evidence upload are denied before sharing | Pass |
| Admin investigator assignment does not share the case | Pass |
| Legacy premature Host notification becomes non-actionable | Pass |
| Admin Host-response request creates one Host notification with the dispute route | Pass |
| Repeated pending request is rejected without duplicate event | Pass |
| Shared case appears in Host Response Required | Pass |
| Host response becomes visible to Admin | Pass |
| Resolved shared case remains available to Host | Pass |

`pnpm exec tsc --noEmit` passes. Browser click-through/refresh testing was not
executed because no authenticated browser session is available; the same API
and service paths used by the UI were exercised directly.
