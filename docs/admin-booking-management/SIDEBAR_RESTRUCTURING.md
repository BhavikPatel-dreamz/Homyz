# Admin Sidebar Navigation Restructuring & Route Resolution Audit

## Overview
This document summarizes the restructuring of the Homyz Admin Dashboard sidebar navigation (`components/admin/admin-sidebar.tsx`) to provide a structured, expandable hierarchy with unambiguous active route detection across all modules.

---

## 1. Structural Grouping

The sidebar navigation is organized into seven distinct functional groups:

### WORKSPACE
- **Dashboard** (`/admin`)
- **Bookings** (Expandable Parent, default target: `/admin/bookings`)
  - **Booking Overview** (`/admin/bookings`)
  - **All Bookings** (`/admin/bookings/all`)
  - **Reservation Calendar** (`/admin/bookings/calendar`)
  - **Cancellations** (`/admin/bookings/cancellations`)
- **Listings** (`/admin/listings`)

### FINANCIAL MANAGEMENT
- **Payments** (`/admin/bookings/payments`)
- **Refunds** (`/admin/bookings/refunds`)
- **Host Payouts** (`/admin/bookings/payouts`)

### MANAGEMENT
- **Hosts** (`/admin/hosts`)
- **Guests** (`/admin/guests`)
- **Referral Credits** (`/admin/referrals`)

### SUPPORT & OPERATIONS
- **Disputes** (`/admin/bookings/disputes`)
- **Communications** (`/admin/bookings/communications`)
- **Notifications** (`/admin/bookings/notifications`)

### INSIGHTS
- **Analytics** (`/admin/bookings/analytics`)
- **Reports** (`/admin/bookings/reports`)

### ADMINISTRATION
- **Admin Accounts** (`/admin/admins`)
- **Audit Logs** (`/admin/activity-logs`)

### SYSTEM
- **Settings** (`/admin/settings`)
- **Security** (`/admin/security`)

---

## 2. Active Route Resolution (`resolveActiveKey`)

### Problem Addressed
Because several modules (Payments, Refunds, Payouts, Disputes, Communications, Analytics, etc.) share the URL prefix `/admin/bookings/*`, a naive check like `pathname.startsWith('/admin/bookings')` incorrectly activated the Bookings menu item when viewing financial or support pages.

### Solution
An explicit route-key mapping table (`ROUTE_NAV_KEY`) was implemented in priority order (most-specific route prefix first):

1. Specific sub-routes:
   - `/admin/bookings/all` → `bookings-all`
   - `/admin/bookings/calendar` → `calendar`
   - `/admin/bookings/cancellations` → `cancellations`
   - `/admin/bookings/refunds` → `refunds` (Financial Management)
   - `/admin/bookings/payments` → `payments` (Financial Management)
   - `/admin/bookings/payouts` → `payouts` (Financial Management)
   - `/admin/bookings/disputes` → `disputes` (Support & Operations)
   - `/admin/bookings/communications` → `communications` (Support & Operations)
   - `/admin/bookings/notifications` → `notifications` (Support & Operations)
   - `/admin/bookings/analytics` → `analytics` (Insights)
   - `/admin/bookings/reports` → `reports` (Insights)
2. Catch-all for Bookings parent:
   - `/admin/bookings` → `bookings-overview`
3. Exact matching for `/admin`:
   - `/admin` → `dashboard` (exact match only)

Result: Navigating to `/admin/bookings/refunds` activates **Refunds** under **FINANCIAL MANAGEMENT** and leaves **Bookings** unhighlighted.

---

## 3. Bookings Expandable Submenu Behavior

- **Automatic Expansion**: When navigating to any child route in `BOOKINGS_CHILD_KEYS` (`bookings-overview`, `bookings-all`, `calendar`, `cancellations`), the Bookings group auto-expands via `useEffect`.
- **Manual Toggle**: A dedicated chevron toggle button allows collapsing or expanding the submenu on demand.
- **Independent Label Navigation**: Clicking the "Bookings" label navigates directly to `/admin/bookings` (Booking Overview) without interfering with the chevron button.
- **Active State Differentiation**:
  - The currently selected child receives the primary active highlight (`bg-[var(--accent)] text-[var(--accent-foreground)]`).
  - The parent Bookings container displays a subtle active state (`text-foreground bg-[var(--surface-secondary)]`) whenever any child route is active.
- **Collapsed Mode**: In sidebar collapsed mode (desktop icon-only mode), the Bookings icon displays tooltip and primary highlight when active, hiding the child tree cleanly.
- **Mobile Drawer**: Utilizes `ModalOverlay` from `@/components/ui/modal-overlay` with reference-counted body scroll locking, fully compliant with mobile drawer requirements.

---

## 4. Verification

- `tsc --noEmit` passed with exit code 0.
- All original permissions and RBAC role checks preserved.
- Zero URL redirects or breaking route changes introduced.

