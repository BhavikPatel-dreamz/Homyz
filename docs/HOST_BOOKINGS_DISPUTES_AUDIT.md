# Host Bookings & Disputes Audit

**Date:** 2026-10-13  
**Scope:** Host booking detail route, host reservation navigation, guest/host dispute filing, host dispute visibility and response workflow.  
**Method:** Read-only code and development-database verification. No product behavior was changed as part of this audit.

## Executive finding

The reported URL is returning a 404 for the correct reason, but it is using the wrong entity ID.

`cmv6i1h0t000hlvas1ie6lmks` is a `ListingQualityIncident` (dispute) record, not a `Booking` record. The dispute is linked to booking `cmv6brrc7000alvaswzgps245` (`CONFIRMED`). The corresponding host can retrieve that booking through the existing host booking-detail service and it is present in the host's existing all-reservations workspace.

The valid booking-detail URL is therefore:

```
/host/bookings/cmv6brrc7000alvaswzgps245
```

This is an ID-type/navigation problem, not a missing `[id]` route or an authorization failure.

## A. 404 root-cause analysis

| Check | Result | Evidence |
| --- | --- | --- |
| Dynamic host booking page exists | Implemented | `app/(protected)/host/bookings/[id]/page.tsx` awaits `params`, requires a Host or Admin, obtains the booking, and calls `notFound()` only for a 404 result. |
| Host booking API exists | Implemented | `GET /api/v1/host/bookings/[id]` delegates to the same booking service. |
| Provided ID is a Booking | No | Development data identifies `cmv6i1h0t000hlvas1ie6lmks` as a dispute/`ListingQualityIncident`, case reference `DSP-HDXKWQ`. |
| Related Booking exists | Yes | The dispute is associated with booking `cmv6brrc7000alvaswzgps245`, status `CONFIRMED`. |
| Owning host can obtain the related booking | Yes | Read-only service call to `getRequestDetailsForHost` returned that booking and status. |
| Booking is discoverable in host workspace | Yes | The same booking appears in `getHostWorkspace(..., { tab: "all" })` for the owning host. |
| Supplied dispute ID is accepted by the booking endpoint | Correctly no | `getRequestDetailsForHost` returns a 404, “Booking request not found”, because it queries `Booking.id`. |

### Current route and authorization behaviour

`getRequestDetailsForHost` looks up a booking by ID and verifies `booking.listing.hostId === actor.id`. A non-existent booking gets a 404; an existing booking owned by somebody else gets a forbidden error. That is the correct access-control split.

Although its comment calls it a “pending request” detail method, the implementation can return a host-owned booking in other statuses, including the confirmed booking above. The page title/comment should eventually be renamed for clarity, but that discrepancy does not cause this 404.

### Root cause

The system currently has no host-facing dispute-detail route. A dispute-case ID can therefore be mistakenly used where a booking ID is required. The host is notified of a newly filed dispute, but that notification currently points to the generic notification page rather than to a host-safe case or reservation view. This makes the ID mismatch much easier to encounter.

## B. Existing host-booking functionality

| Area | Current behavior | Assessment |
| --- | --- | --- |
| `/host/bookings` | Pending, future, unexpired approval queue only. | Works for approvals, but it is not a complete reservation history. |
| `/host/bookings/[id]` | Direct detail page for any booking owned by the host; shows booking/guest/stay data and the issue-report intake. | Works when supplied a booking ID, but it has weak discoverability from the main host workspace. |
| `/host/today` and `/host/calendar` | Shared workspace supports today, upcoming, staying, completed, pending, cancelled, and all reservation states. | This is the existing full reservation view. It includes the related booking in the audit case. |
| Reservation card/modal | Opens `ReservationDetails` with property, guest, message, payout and stay details. | Useful operational view, but it has no “View full booking” deep link to `/host/bookings/[bookingId]`. |
| Navigation | Host sub-navigation exposes Today, Calendar, Listings, and Messages. | No explicit Reservations or Disputes entry exists. |
| Notifications | Guest-created disputes notify the host. | The link is generic (`/profile/tab/notifications`), so it does not lead to a relevant host action. |

### Navigation conclusion

Do not create a second host reservation data model or duplicate the workspace queries. The current host workspace is the correct source for all reservation states. The missing piece is a deliberate deep link from the reservation modal (and dispute notifications) to the existing booking-detail route.

## C. Existing dispute functionality

### Guest filing

Implemented. Guest booking details render `FileBookingDispute`, which posts a booking ID, category, severity and description to `POST /api/v1/admin/bookings/disputes`. The server authorizes the caller against the booking, so only the booking guest, property host, or an admin can create the case.

### Host filing

Partially implemented. The same component is rendered on the direct host booking-detail page, so a host can report an issue with a reservation. It is not available from the primary Host Today/Calendar reservation modal or Host Messages, so it is difficult to find during normal host work.

### Admin workflow

Implemented. The Admin Disputes area provides case listing/detail and administrative assignment, internal notes, information requests, resolution, and closing. Those endpoints and views are intentionally admin-only.

### Host visibility and response

Not implemented. There is no host-scoped list/detail endpoint, no host-safe dispute case screen, no case-status UI, no reply-to-information-request action, and no evidence upload flow. The admin detail API must not be exposed directly: it includes internal notes, assignee information, and other administrative case data.

### Evidence

Only pre-existing evidence URLs can be accepted by the creation payload. The current guest/host intake explicitly states that upload is unavailable. There is no upload UI, no access-controlled evidence storage flow, and no host evidence-submission endpoint.

### The audited case

Case `DSP-HDXKWQ` is already `RESOLVED`. Its recorded request for more information targeted the guest, not the host. The host therefore should not receive a pending-response action for this specific case. That is separate from the broader missing host case visibility and response capability.

## D. Recommended user experience

### Recommended first release: booking-centred actions, not a new Resolution Center

Use the existing reservation surfaces as the primary host experience:

1. Add **View booking** to `ReservationDetails`, linking to `/host/bookings/[bookingId]`.
2. Keep **Report an issue** on the booking detail, and surface the same action from the reservation modal after the deep-link is established.
3. Add a compact, host-safe **Case status / Action required** section to the booking detail when a related dispute exists.
4. Link dispute notifications directly to the related booking’s dispute section, not to the generic notification page.

This makes reservations actionable without duplicating the Host Today/Calendar data source or creating another host dashboard. It also fixes the misleading path that produced the audit 404.

A dedicated **Resolution Center** is reasonable later if hosts need to triage disputes across many properties. If added, it should be a thin filtered index over the same host-scoped dispute service—not a second dispute model, copy of Admin Disputes, or parallel API family.

### Suggested host-facing states

| Case state | Host display | Host action |
| --- | --- | --- |
| Newly filed by guest | “Homyz is reviewing this report” | View case summary; provide a response only if requested. |
| Information requested from host | “Action required” with due date | Submit response and permitted evidence. |
| Under review | “Under review” | View submitted items; contact support through the designated channel. |
| Resolved/closed | “Decision available” | Read host-safe decision summary; no further evidence submission. |

## E. Implementation plan (await approval)

### Phase 1 — Correct navigation and terminology

- Ensure any booking-detail link is built from `dispute.bookingId`, never `dispute.id`.
- Add a View booking link to the Host Today/Calendar `ReservationDetails` modal.
- Update the misleading “pending request” comments/title where the page supports all host-owned booking statuses.
- Keep the existing ownership checks unchanged.

**Validation:** direct URL, modal link, and API checks for pending, confirmed, cancelled, missing, and another host’s booking.

### Phase 2 — Add a host-safe dispute read model

- Add shared service methods for a participant-scoped dispute summary and detail.
- Authorize exclusively through the linked booking: `booking.listing.hostId` for host and `booking.userId` for guest.
- Return a dedicated public DTO with only case reference, status, category, submitted/relevant evidence, participant-visible messages, request state, and the published decision summary.
- Do not return admin-only notes, internal timeline events, staff assignment, or unrelated guest personal data.

**Validation:** host/guest can access only cases tied to their own booking; unrelated host/guest gets 403/404 as appropriate; admin route behavior remains unchanged.

### Phase 3 — Request/response and evidence workflow

- Model participant responses as explicit case events rather than silently overloading arbitrary metadata.
- Allow response/evidence submission only while a case is open and only when the request is addressed to that participant.
- Add upload/storage policy, file validation, malware/content scanning integration if available, object authorization, retention, and audit events before exposing file upload.
- Notify the targeted participant with a deep link to the correct booking/case context.

**Validation:** requester/target combinations, closed/resolved rejection, file type/size checks, unauthorized download checks, notification deep links.

### Phase 4 — Optional cross-booking Resolution Center

- Add only after Phase 2 has a host-safe list service and actual triage demand warrants it.
- Reuse the same DTO, filters, pagination, and authorization methods from Phase 2.

## F. Risks and constraints

- **Privacy:** The existing admin case detail contains internal data. Reusing it for hosts would be a data exposure vulnerability.
- **Authorization:** Case access must be derived from the linked booking on every read and mutation; do not trust a client-provided role or case ID alone.
- **Resolution integrity:** A resolved case must not accept new participant submissions unless staff explicitly reopens it.
- **Evidence security:** URLs in JSON are not a complete evidence feature. Upload/download authorization and lifecycle rules are required.
- **Data consistency:** The booking remains the canonical host-reservation object; the dispute is a related case. Mixing IDs in links is the direct cause of the observed 404.
- **Performance:** `getHostWorkspace` already scopes owned listings and fetches rows/count in parallel. Preserve this source and avoid a second reservation query just to show a dispute badge; add a batched relation/count lookup only when the UI needs it.

## Audit conclusion

The immediate 404 does not need a routing repair: use booking ID `cmv6brrc7000alvaswzgps245` for the host booking page. The product gaps are discoverability and host-safe dispute participation. The phased approach above preserves the working host workspace and admin workflow while adding the smallest safe bridge for host visibility, response, and evidence.
