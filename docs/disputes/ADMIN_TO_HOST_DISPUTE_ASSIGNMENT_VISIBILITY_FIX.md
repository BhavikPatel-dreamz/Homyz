# Admin-to-Host Dispute Sharing, Visibility, and Notification Fix

Audit date: 2026-10-14

## Existing assignment behavior

`Assign Case` assigns an **Admin investigator** in `metadata.assignedAdmin`.
It does not, and must not, grant a Host access to a case. The separate existing
`request-info` mutation is now the Admin-to-Host sharing action.

## Root cause

The Host Resolution Center previously scoped cases only by
`listing.hostId`. That made every case on a Host's property visible before an
Admin review decision. Conversely, the Host response request did not persist a
separate share/grant marker, so the code had no explicit policy boundary to
enforce across direct detail, reply, evidence, or note endpoints.

## Implementation

- `Request Host Response` in Admin Dispute Details opens the existing request
  modal with Host preselected. Its confirmation text explains that it shares
  the case, marks a response required, and notifies the booking Host.
- The request uses the authoritative booking → listing → host relationship and
  rejects a missing, non-Host, or inactive Host. It records the Admin ID/email,
  timestamp, request ID, instructions, and `hostParticipation` grant in the
  existing dispute metadata.
- Host visibility is now server-side and consistent:
  - A Host sees a case they reported themselves immediately.
  - A Host sees a Guest-reported case only after `hostParticipation` is granted.
  - Pre-existing cases that already contain a Host information request remain
    visible as a backward-compatible, bounded migration path.
  - The same predicate protects list, counts, details, response, official
    reply, private notes, evidence, and proposal actions.
- Requesting a Host response sets the existing `AWAITING_INFO` workflow state
  and the existing `infoRequests` item. The Host list derives its
  response-required badge and count from that authoritative state.
- The existing shared notification service creates the idempotent Host
  notification with the actual dispute ID and
  `/host/resolution-center/[disputeId]` destination.
- Guest booking details now show a bounded list of that Guest's own reports and
  statuses for the booking. It does not expose another Guest's cases, Host
  notes, or Admin notes.

## Files changed

- `services/dispute.service.ts` — participation grant, eligible-Host check,
  role-safe Host visibility predicate, and endpoint-wide enforcement.
- `app/(protected)/admin/bookings/disputes/[id]/admin-dispute-details-client.tsx`
  — explicit Request Host Response entry point and confirmation language.
- `services/booking.service.ts` — bounded Guest-owned case summaries in the
  existing booking-detail payload.
- `components/bookings/booking-details-client.tsx` — read-only Guest report
  status section.

## Security and privacy verification

- Before sharing, the relevant Host is excluded from the Host list and direct
  Host reply access returns not found.
- An unrelated Host is excluded from case details.
- Host official responses are visible to Admin; Host-private notes are not
  returned by the Admin DTO.
- Admin internal notes are not returned by the Host DTO.
- Admin investigator assignment remains independent of Host access.

## End-to-end evidence

The following development-database checks used temporary records and deleted
the incident and its notifications afterward:

| Check | Result |
|---|---|
| Guest-created case appears in the Guest's booking details | Pass |
| Host is denied before Admin sharing | Pass |
| Admin requests Host response using the same dispute ID | Pass |
| Host case appears in Response Required and count state | Pass |
| Host notification targets `/host/resolution-center/[disputeId]` | Pass |
| Host official response becomes visible to Admin | Pass |
| Host evidence upload and Admin authorized retrieval | Pass |
| Host-private note omitted from Admin response | Pass |
| Resolved shared case remains visible to Host | Pass |
| Another Host is denied | Pass when a second active Host is available |

`pnpm exec tsc --noEmit` passes. No authenticated browser session was available
for literal modal-click/browser-refresh testing, so those UI-click assertions
are not claimed as executed; the same route handlers and services used by the
UI were exercised directly.
