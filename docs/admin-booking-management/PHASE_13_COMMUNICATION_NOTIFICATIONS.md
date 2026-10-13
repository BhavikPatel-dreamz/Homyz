# Phase 13 — Booking Communications & Notifications Management

## 1. Overview & Objective

Phase 13 establishes centralized administrative oversight into guest-host communications and transactional booking notifications across the **Homyz** property booking platform.

The core objectives are:
1. Provide administrators with a secure, read-only inspection tool for booking-related conversations without altering participants' read receipts or compromising host arrival credentials.
2. Provide real-time operational visibility into outgoing notification deliveries across all delivery channels (EMAIL, IN_APP, SMS, PUSH, WHATSAPP).
3. Offer safe administrative remediation mechanisms, including a bounded notification retry mechanism (capped at 5 attempts) and non-invasive conversation auditing.

---

## 2. Core Architecture & Features

### 2.1 Booking Communications Service (`services/communication-admin.service.ts`)
- **Aggregate KPI Summary (`getCommunicationSummaryForAdmin`)**:
  - `totalConversations`: Total count of conversations across the platform.
  - `activeConversations`: Conversations in `ACTIVE` state.
  - `bookingInquiries`: Inquiries preceding a booking request.
  - `bookingRequests`: Formal booking requests.
  - `confirmedConversations`: Conversations tied to confirmed reservations.
  - `reportedConversations`: Flagged or reported conversations requiring moderation.
- **Paginated Listing (`listBookingConversationsForAdmin`)**:
  - Filters by conversation type (`BOOKING_INQUIRY`, `DIRECT_MESSAGE`, `SUPPORT`), status (`ACTIVE`, `ARCHIVED`, `REPORTED`), search query (guest/host name, email, listing title), and date ranges.
  - Sanitized preview generation: Masks sensitive credentials (door lock codes, PINs, passwords, Wi-Fi keys) with `[PROTECTED]` badges to preserve host physical security.
- **Read-Only Conversation Inspection (`getConversationDetailsForAdmin`)**:
  - Admin inspection strictly queries message contents without updating participant `lastReadAt` or message `readAt` timestamps.
  - Full audit logging: Each admin inspection triggers an `AuditLog` entry with action `CONVERSATION_INSPECTED_BY_ADMIN` to ensure administrative accountability.

### 2.2 Booking Notifications Service (`services/notification-admin.service.ts`)
- **Aggregate KPI Summary (`getNotificationSummaryForAdmin`)**:
  - `totalNotifications`: Total volume of generated notifications.
  - `pendingNotifications`: Notifications scheduled or queued.
  - `sentNotifications`: Outbound notifications dispatched to delivery providers.
  - `deliveredNotifications`: Confirmed delivered / opened notifications.
  - `failedNotifications`: Failed deliveries with delivery errors.
  - `retryingNotifications`: Notifications undergoing automated retry cycles.
  - `requiresAttentionCount`: Notifications failing repeatedly or blocked.
- **Paginated Notification Listing (`listNotificationsForAdmin`)**:
  - Multi-channel filtering: `EMAIL`, `IN_APP`, `SMS`, `PUSH`, `WHATSAPP`.
  - Recipient role filtering: `GUEST`, `HOST`, `ADMIN`.
  - Delivery status mapping: Canonical calculation of `PENDING`, `SENT`, `DELIVERED`, `FAILED`, `RETRYING` based on metadata, error logs, and delivery timestamps.
- **Detailed Notification Inspector (`getNotificationDetailsForAdmin`)**:
  - Displays full delivery payload, recipient metadata, related booking information, and historical delivery attempt error logs.
- **Bounded Notification Retry (`retryNotificationForAdmin`)**:
  - Validates that the notification is booking-relevant before initiating retry.
  - Strictly enforces an upper ceiling of **5 retry attempts** (`retryCount < 5`).
  - Increments `retryCount`, resets error state to `null`, records `lastRetriedAt`, and dispatches an audit log entry (`NOTIFICATION_RETRIED_BY_ADMIN`).

---

## 3. API Endpoints

| Endpoint | Method | Permission Required | Description |
|---|---|---|---|
| `/api/v1/admin/bookings/communications` | GET | `COMMUNICATIONS_VIEW` | Paginated list of booking conversations with search and filters |
| `/api/v1/admin/bookings/communications/summary` | GET | `COMMUNICATIONS_VIEW` | 6 KPI aggregate communication metrics |
| `/api/v1/admin/bookings/communications/[id]` | GET | `COMMUNICATIONS_VIEW` | Read-only conversation messages with masked secrets |
| `/api/v1/admin/bookings/notifications` | GET | `NOTIFICATIONS_VIEW` | Paginated list of booking notifications with status and channel filters |
| `/api/v1/admin/bookings/notifications/summary` | GET | `NOTIFICATIONS_VIEW` | 7 KPI aggregate notification metrics |
| `/api/v1/admin/bookings/notifications/[id]` | GET | `NOTIFICATIONS_VIEW` | Deep delivery payload and attempt details |
| `/api/v1/admin/bookings/notifications/[id]/retry` | POST | `NOTIFICATIONS_RETRY` | Safe bounded retry execution (max 5 attempts) |

---

## 4. UI/UX Implementation

### 4.1 Admin Booking Communications (`/admin/bookings/communications`)
- **KPI Summary Grid**: 6 responsive cards featuring real-time conversation volumes.
- **Search & Filtering Toolbar**: Real-time debounce search across participants and properties, type filters, status filters, and sorting.
- **Conversation Inspection Modal**:
  - Implemented using `@/components/ui/modal-overlay` with body scroll locking across mobile, tablet, and desktop viewports.
  - Message bubble transcript layout with color-coded sender roles (Guest vs Host vs System).
  - Prominent badge indicators for protected credentials (`[PROTECTED]`).

### 4.2 Admin Booking Notifications (`/admin/bookings/notifications`)
- **KPI Summary Grid**: 7 operational cards highlighting delivery health, failures, and items needing attention.
- **Channel & Role Tabs**: Quick filtering across Email, In-App, SMS, Push, and WhatsApp.
- **Notification Details & Retry Modal**:
  - Implemented using `@/components/ui/modal-overlay`.
  - JSON payload inspector, error trace viewers, and recipient routing metadata.
  - One-click "Retry Notification" action with disabled state once max attempts (5) are reached.

---

## 5. Security & Privacy Safeguards

1. **Read Receipt Invariance**: Admin queries do not alter participant `readAt` timestamps. Guests and hosts never perceive unread messages being marked read by background administrative oversight.
2. **Access Credential Masking**: Door codes, lockbox keys, smart-lock PINs, and Wi-Fi credentials matching common sensitive patterns are redacted in conversation previews.
3. **Audit Logging**: Every conversation inspection and notification retry is recorded in `AuditLog` with actor ID, actor role, target entity ID, and timestamp.
4. **Strict Role-Based Access Control**: Only authenticated users with `Role.ADMIN` and specific granular permission slugs (`COMMUNICATIONS_VIEW`, `NOTIFICATIONS_VIEW`, `NOTIFICATIONS_RETRY`) can access these interfaces.
