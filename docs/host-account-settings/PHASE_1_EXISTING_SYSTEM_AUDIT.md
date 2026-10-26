# HOMYZ — PHASE 1: COMPLETE HOST ACCOUNT SETTINGS AUDIT
## Repository-Based Existing System Audit, Data Model Assessment & Technical Findings

**Document Version:** 1.0.0  
**Audit Date:** October 26, 2026  
**Auditor Roles:** Senior Full-Stack Architect, FinTech Integration Architect, Product Analyst, Database Architect, Airbnb-Style Hosting Platform Specialist  
**Target Repository:** Homyz (`/media/drive/shihab/Homyz`)  
**Technology Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Prisma ORM, PostgreSQL (Neon / RDS), Tailwind CSS, Redis Cache  

---

## 1. EXECUTIVE AUDIT SUMMARY

This audit delivers an exhaustive, evidence-backed inspection of the Homyz repository to establish the baseline for the **Host Account Settings** module (`/host/account-settings`).

### Key Findings:
1. **No Dedicated Host Account Settings Area Exists Today:**
   The route `/host/account-settings` does not exist. Currently, the user navigation header (`components/dashboard/app-header.tsx`) routes all users (Guests and Hosts alike) to `/profile/tab/account_settings`, which renders generic guest personal information (`PersonalInfoView` — legal name, emergency contact, residential address).
2. **Payout Method Logic Exists but is Tightly Coupled to Host Earnings:**
   Payout method management (IBAN addition, default assignment, deletion, and admin verification) exists in backend services (`services/payout.service.ts`) and API routes (`/api/v1/host/payout-methods`), but in the frontend, it is accessible solely via a popup modal inside the Host Earnings page (`app/(protected)/host/earnings/host-earnings-client.tsx`).
3. **Payout Methods Are Stored in Untyped JSON, Not Dedicated Relational Tables:**
   `HostPayoutMethod` records and `PayoutAdjustmentRecord` records are stored serialized within the `User.personalInfo` JSON column (`prisma.user.update({ data: { personalInfo } })`), rather than having a normalized relational table with proper foreign keys, constraints, and audit trails.
4. **Acquiring Gateway (Moyasar) Does Not Support Automated Payouts:**
   Homyz is integrated with Moyasar (Saudi Central Bank / SAMA regulated acquiring gateway for mada, Visa, Mastercard, and Apple Pay). As documented in `lib/payment/provider-interface.ts` and `docs/financial/PAYMENT_GATEWAY_CAPABILITIES.md`, Moyasar is an **acquiring gateway only**. It provides zero automated host payout, sub-merchant connected accounts, or split payment transfer APIs. Host bank disbursements are designed to run via corporate banking SARIE batch CSV exports (`payoutService.exportBatchSettlementCSV`).
5. **Real Payout Execution is Deliberately Disabled in Backend:**
   In `services/payout.service.ts`, `processPayoutSettlement()` explicitly throws `AppError.serviceUnavailable("Host payout execution is not configured. Exporting a bank batch does not settle a payout; record payment only after an approved bank-confirmation integration is available.")`.
6. **Tax Registration Backend Exists, but Lacks Account-Level Host UI:**
   A comprehensive tax model exists (`TaxRegistration`, `ReservationTax`, `TaxJurisdiction`, `TaxRule`, `TaxAuditLog`) backed by `services/tax.service.ts` and APIs (`/api/v1/taxes/registrations`, `/api/v1/taxes/reports`, `/api/v1/taxes/invoices/[bookingId]`). However, tax management in the UI exists only at the individual listing editor level (`TaxesManager.tsx` in `app/(protected)/host/listings/[id]/components/`). There is no host-level Taxpayer profile page or Tax Documents repository.
7. **Robust Financial Reporting & PDF Generation Already Exists:**
   `services/host-reporting.service.ts` provides extensive monthly and yearly financial aggregation, CSV generation, and PDF document generation (`SimplePdfDocument`). This engine must be **reused directly** without duplication.
8. **Co-Host System Lacks Financial Splitting Capabilities:**
   `ListingCoHost` and `services/listing-cohost.service.ts` support listing invitations, acceptance, and revocation, but contain zero financial fields, percentage share routing, or payout assignment capabilities.

---

## 2. INVENTORY OF EXISTING MODULES & BOUNDARIES

To adhere to strict non-duplication architectural guidelines, the table below documents all related modules, their responsibilities, and how they relate to the new Host Account Settings scope.

| Module | Route / File Path | Current Responsibility | Relationship to Host Account Settings |
|---|---|---|---|
| **Guest Profile & Personal Info** | `/profile`, `/profile/tab/account_settings`, `components/account-settings/personal-info-view.tsx` | Manages guest personal info: legal name, preferred name, email, phone, government ID, address, emergency contact. | **DO NOT TOUCH / DUPLICATE.** Retains guest-facing personal settings. Host Account Settings is distinct and hosting-specific. |
| **Host Dashboard Hub** | `/host/dashboard`, `app/(protected)/host/dashboard/page.tsx` | Operational metrics, arrival cards, alerts, booking summaries, calendar snapshot. | **RETAIN AS-IS.** Links to Host Account Settings via dropdown/header. |
| **Host Earnings Hub** | `/host/earnings`, `app/(protected)/host/earnings/page.tsx`, `host-earnings-client.tsx` | Authoritative financial ledger, transaction history, upcoming/paid balances, RevPAN analytics. Embedded payout modal. | **AUTHORITATIVE FINANCIAL SOURCE.** Remains the primary financial reporting dashboard. Host Account Settings will link to transaction history and extract payout settings out of the modal into dedicated settings pages. |
| **Host Reports** | `/host/earnings/reports`, `/host/earnings/reports/monthly/[year]/[month]`, `/host/earnings/reports/yearly/[year]` | Year/month earnings cards, downloadable PDF and CSV reports. | **REUSE ENGINE DIRECTLY.** Host Account Settings `/earnings-reports` should provide an overview and link directly to these authoritative report views. |
| **Listing Tax Settings** | `/host/listings/[id]`, `TaxesManager.tsx` | Property-level tax submission rules (e.g., municipal lodging tax added to guest checkout). | **DISTINCT SCOPE.** Property-level tax rules remain on listings. Host Account Settings handles Host Taxpayer entity registration and annual tax summary documents. |
| **Co-Host Invitations** | `/host/co-host`, `/co-host-invitations/accept`, `services/listing-cohost.service.ts` | Inviting co-hosts by email/phone, token verification, accepting/revoking listing co-hosts. | **EXTEND IN PHASE 4.** Keep existing invitation flow; layer financial routing and compensation rules in Host Account Settings without rewriting existing logic. |
| **Admin Payouts Management** | `/admin/bookings/payouts`, `admin-payouts-client.tsx`, `services/payout.service.ts` | Admin view of payouts across all hosts, placing/releasing holds, SARIE batch CSV export. | **REMAIN ADMIN CONTROL PLANE.** Provides administrative verification and hold management for host payout methods and payouts. |

---

## 3. INVENTORY OF EXISTING ROUTES & NAVIGATION

### 3.1 Host Routes Inventory (`app/(protected)/host/`)
- `/host/today`: Operational command center (check-ins, check-outs, active stays).
- `/host/dashboard`: Standard & Plus performance metrics, revenue summary, operational tasks.
- `/host/calendar`: Availability, rate overrides, blackout dates.
- `/host/listings`: Property management, new listing wizard, listing editor.
- `/host/listings/[id]`: Listing settings including `TaxesManager` (property tax).
- `/host/earnings`: Gross revenue, platform fees, net earnings, transaction tabs.
- `/host/earnings/transactions`: Transaction table with date and listing filters.
- `/host/earnings/transactions/[transactionId]`: Single reservation payout breakdown.
- `/host/earnings/upcoming`: Reservations awaiting check-in + 24h payout eligibility.
- `/host/earnings/paid`: Settled payout transactions.
- `/host/earnings/analytics`: Deep revenue analytics (RevPAN, occupancy, ADR).
- `/host/earnings/reports`: Monthly and yearly financial statement overview.
- `/host/earnings/reports/monthly/[year]/[month]`: Monthly breakdown and PDF export.
- `/host/earnings/reports/yearly/[year]`: Yearly breakdown and PDF export.
- `/host/insights`: Guest market insights, superhost qualification, listing performance.
- `/host/co-host`: Co-host management per listing.
- `/host/resolution-center`: Dispute management and quality incident resolution.
- `/host/messages`: Host-guest messaging inbox.

### 3.2 Navigation & Menu Integration (`components/dashboard/app-header.tsx`)
In `AppHeader`:
- Active mode detection: `isHosting = isHost && pathname.startsWith("/host")`.
- When in Hosting mode, the user avatar dropdown exposes:
  - Dashboard (`/host/dashboard`)
  - Today (`/host/today`)
  - Calendar (`/host/calendar`)
  - Your listings (`/host/listings`)
  - Earnings (`/host/earnings`)
  - Insights (`/host/insights`)
  - Resolution Center (`/host/resolution-center`)
  - Messages (`/host/messages`)
  - Profile (`/profile`)
  - Notifications (`/profile/tab/notifications`)
  - Account settings (`/profile/tab/account_settings` — **Currently points to Guest personal info!**)
- **Architecture Requirement:** When in Hosting mode, the Account Settings navigation link must point to `/host/account-settings`, giving hosts dedicated hosting account controls while preserving `/profile/tab/account_settings` for traveling mode.

---

## 4. INVENTORY OF APIS & SERVER SERVICES

### 4.1 Relevant Existing Server APIs

| Endpoint | Method | File Path | Auth Guard | Purpose |
|---|---|---|---|---|
| `/api/v1/host/payout-methods` | GET | `app/api/v1/host/payout-methods/route.ts` | `HOST, ADMIN` | Returns all payout methods for the authenticated host. |
| `/api/v1/host/payout-methods` | POST | `app/api/v1/host/payout-methods/route.ts` | `HOST, ADMIN` | Adds a new Saudi IBAN payout method. |
| `/api/v1/host/payout-methods/[id]` | DELETE | `app/api/v1/host/payout-methods/[id]/route.ts` | `HOST, ADMIN` | Removes a payout method. |
| `/api/v1/host/payout-methods/[id]/default` | PUT | `app/api/v1/host/payout-methods/[id]/default/route.ts` | `HOST, ADMIN` | Sets a payout method as default. |
| `/api/v1/admin/hosts/[id]/payout-methods/[methodId]/verify` | POST | `app/api/v1/admin/hosts/[id]/payout-methods/[methodId]/verify/route.ts` | `ADMIN (HOSTS_VIEW, PAYOUTS_VIEW)` | Verifies or rejects a host payout method. |
| `/api/v1/taxes/registrations` | POST | `app/api/v1/taxes/registrations/route.ts` | `AuthUser` | Creates or updates a host tax registration (VAT ID/GST/License). |
| `/api/v1/taxes/reports` | GET | `app/api/v1/taxes/reports/route.ts` | `AuthUser` | Returns aggregated reservation tax reports across host listings. |
| `/api/v1/taxes/invoices/[bookingId]` | GET | `app/api/v1/taxes/invoices/[bookingId]/route.ts` | `AuthUser` | Generates tax invoice data for a completed booking. |
| `/api/v1/admin/bookings/payouts` | GET | `app/api/v1/admin/bookings/payouts/route.ts` | `ADMIN` | Lists all platform host payouts with status and filtering. |
| `/api/v1/admin/bookings/payouts/[id]/hold` | POST | `app/api/v1/admin/bookings/payouts/[id]/hold/route.ts` | `ADMIN` | Places administrative hold on booking payout. |
| `/api/v1/admin/bookings/payouts/[id]/release` | POST | `app/api/v1/admin/bookings/payouts/[id]/release/route.ts` | `ADMIN` | Releases administrative hold. |
| `/api/v1/admin/bookings/payouts/[id]/process` | POST | `app/api/v1/admin/bookings/payouts/[id]/process/route.ts` | `ADMIN` | Calls `processPayoutSettlement` (currently returns 503). |
| `/api/v1/admin/bookings/payouts/export` | GET | `app/api/v1/admin/bookings/payouts/export/route.ts` | `ADMIN` | Downloads SARIE corporate banking CSV export. |

### 4.2 Relevant Backend Services
1. **`payoutService` (`services/payout.service.ts` — 3,049 lines):**
   - Core IBAN validation (`validateSaudiIban`): Checks Saudi prefix (`SA`), exact 24-character length, valid alphanumeric format, and standard MOD-97 checksum calculation. Maps 2-digit bank code to 12 licensed Saudi banks (e.g., Al Rajhi, SNB, Riyad Bank).
   - IBAN display masking (`maskIban`): Formats as `SA03 **** **** **** **** 1234`.
   - Methods CRUD on `User.personalInfo.payoutMethods`.
   - Core reservation payout calculation (`calculateBookingPayout`): Reads immutable `Booking.priceBreakdown.payoutBreakdown`, computes scheduled payout date (check-in + 24 hours), checks 7 eligibility constraints, resolves holds and execution status.
   - Payout lifecycle states: `SCHEDULED`, `ELIGIBLE_SETTLEMENT`, `PROCESSING`, `PAID`, `ON_HOLD`, `FAILED`, `CANCELLED`, `REQUIRES_REVIEW`.
   - SARIE corporate banking export generator (`exportBatchSettlementCSV`).
2. **`taxService` (`services/tax.service.ts` — 637 lines):**
   - Saves tax registration (`saveTaxRegistration`) with audit logging (`TaxAuditLog`).
   - Resolves tax jurisdiction (`resolveTaxJurisdiction`) and calculates reservation taxes (`TaxCalculator`).
   - Aggregates host tax report (`getTaxReport`).
   - Generates tax invoice data (`generateTaxInvoice`).
3. **`hostReportingService` (`services/host-reporting.service.ts` — 1,000+ lines):**
   - Computes monthly/yearly reporting datasets (`getReportsLanding`, `getMonthlyReportDetails`, `getYearlyReportDetails`).
   - Generates CSV exports (`generateEarningsExportCSV`).
   - Generates in-process formatted PDF documents (`generateEarningsReportPDF`).
4. **`listingCoHostService` (`services/listing-cohost.service.ts` — 170 lines):**
   - Listing co-host invitations with cryptographic tokens, email/SMS dispatch, expiry handling, and acceptance.
5. **`hostPermissionService` (`services/host-permission.service.ts`):**
   - Admin-level permission overrides on host capabilities (`HostPermissionOverride`).

---

## 5. DATABASE ARCHITECTURE AUDIT

### 5.1 Verification of Actual Prisma Models vs. Assumptions

| Entity Name in Prompt / Design | Exists in Prisma? | Actual Model / Storage Location | Assessment & Missing Requirements |
|---|---|---|---|
| **User** | **YES** | `model User` (`prisma/schema.prisma` L360) | Core actor model. Stores roles, credentials, and JSON fields (`personalInfo`, `publicProfile`). |
| **Host** | **NO (Implicit)** | `model User` with `role = HOST` or `ADMIN` | No standalone `Host` table; host status is determined by `User.role` and listing ownership. |
| **Property / Listing** | **YES** | `model Listing` (`prisma/schema.prisma` L450) | Contains host relation (`hostId`), title, location, pricing rules. |
| **Booking** | **YES** | `model Booking` (`prisma/schema.prisma` L590) | Central reservation entity. Contains immutable JSON `priceBreakdown`, status, dates, financial snapshots. |
| **BookingPayment** | **YES** | `model BookingPayment` (`prisma/schema.prisma` L724) | Tracks guest payments (`MOCK`, `MOYASAR`, `DEFERRED`). Minor currency units. |
| **BookingRefund** | **YES** | `model BookingRefund` (`prisma/schema.prisma` L752) | Tracks guest refunds with idempotency keys and status. |
| **HostPayoutMethod** | **NO (In JSON)** | `User.personalInfo.payoutMethods` (JSON Array) | **CRITICAL DEFICIENCY:** Stored as untyped JSON array inside `User.personalInfo`. No foreign keys, no unique IBAN constraints, no relational audit tracking. |
| **HostPayout / Transaction** | **NO (Derived)** | Derived from `Booking.priceBreakdown.payoutBreakdown` | No separate `HostPayout` ledger table. Payout records are dynamically computed by `payoutService` from booking snapshots. |
| **PayoutSchedule** | **NO (Derived)** | Computed as `Booking.startDate + 24 hours` | Payout schedule rule is hard-coded in TypeScript; no host-configurable scheduling preferences exist. |
| **TaxRegistration** | **YES** | `model TaxRegistration` (`prisma/schema.prisma` L2050) | Stores `taxType` (VAT_ID, GST_NUMBER, etc.), `registrationNumber`, `businessName`, `documentUrl`, `status`. Needs host taxpayer relationship extension. |
| **Taxpayer / TaxDocument** | **NO** | Missing | No standalone `Taxpayer` profile table or `TaxDocument` annual statement table exists. |
| **ReservationTax** | **YES** | `model ReservationTax` (`prisma/schema.prisma` L2072) | Tracks exact tax lines collected on reservations (VAT, tourist fee, etc.). |
| **TaxAuditLog** | **YES** | `model TaxAuditLog` (`prisma/schema.prisma` L2097) | Tracks audit history for tax creation and registration changes. |
| **ListingCoHost** | **YES** | `model ListingCoHost` (`prisma/schema.prisma` L565) | Tracks co-host invitations and acceptance per listing. **Lacks all financial/payout fields.** |
| **Notification** | **YES** | `model Notification` (`prisma/schema.prisma` L400) | Stores system, booking, and message alerts. **Lacks host notification preferences storage.** |
| **AuditLog** | **YES** | `model AuditLog` (`prisma/schema.prisma` L812) | System-wide audit log for compliance, payouts, and admin actions. |

---

## 6. SUBMODULE-BY-SUBMODULE AUDIT FINDINGS

### Submodule 1: Payout Settings
- **Current State:** Functional backend in `payoutService`. Saudi IBAN validation with MOD-97 check and bank name resolution is implemented. Masked IBAN display (`SA03 **** **** **** **** 1234`) is verified. UI is confined to a modal in `/host/earnings`.
- **Supported Providers:** Saudi Commercial Banks (SNB, Al Rajhi, Riyad Bank, SAB, Alinma, Banque Saudi Fransi, Bank AlJazira, Saudi Investment Bank, Bank AlBilad, Arab National Bank, GIB, Emirates NBD KSA).
- **Unsupported Providers:** PayPal is completely unsupported in backend code (no PayPal SDK, credentials, or webhooks). International bank routing numbers (ABA routing, UK Sort Codes) are unsupported in the current Saudi IBAN-exclusive validation function.
- **Routing Rules / Split Payouts:** Missing. Every listing currently settles to the host's default payout method. No listing-specific or percentage-split payout routing exists.

### Submodule 2: Tax Information
- **Current State:** `TaxRegistration` model exists and tracks VAT/GST number, business name, document URL, and verification status (`UNVERIFIED`, `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`).
- **Missing in Repository:**
  - No `GET /api/v1/taxes/registrations` endpoint (only POST exists).
  - No dedicated host account UI for Taxpayers (`/host/account-settings/taxes/taxpayers`).
  - No dedicated host account UI for Tax Documents (`/host/account-settings/taxes/documents`).
  - No yearly 1099-K / VAT summary statement generation or download table for hosts.

### Submodule 3: Earnings Reports & Documents
- **Current State:** Comprehensive reporting backend implemented in `services/host-reporting.service.ts` and pages at `/host/earnings/reports`, `/host/earnings/reports/monthly/[year]/[month]`, and `/host/earnings/reports/yearly/[year]`.
- **Capability:** Accurate gross, net, fee, adjustment, and tax calculations; CSV download; PDF rendering using `SimplePdfDocument`.
- **Architecture Directive:** Do not rebuild or duplicate this reporting engine. `/host/account-settings/earnings-reports` must provide a high-level overview card that deep-links directly to the authoritative `/host/earnings/reports` pages.

### Submodule 4: Hosting Preferences
- **Current State:** Missing.
- **Scope Needed:** Host business preferences (default checkout times, minimum payout release thresholds, automatic payout frequency [daily, weekly, monthly], communication preferences).

### Submodule 5: Host Financial Permissions
- **Current State:** System permissions exist in `lib/permissions/host-permissions.ts` (`earnings.view`, `earnings.payout`). Admin overrides exist via `HostPermissionOverride`.
- **Missing Scope:** Co-host financial permission delegation (e.g. Can Co-Host A view earnings? Can Co-Host B manage payout methods?). Currently, co-hosts are either in the listing or not; there is no granular permission tiering for co-hosts.

### Submodule 6: Host Notifications & Help
- **Current State:** In-app notification system exists (`Notification` model and `notificationService`), and transactional emails exist (`lib/services/email.ts` via Resend).
- **Missing Scope:** Host-configurable notification preferences (Email/SMS toggles for payout released, payout failed, tax statement ready, payout method verified). Currently, notifications are dispatched globally without host toggle options.
- **Help Integration:** Needs contextual hosting help links connecting to Homyz support and FAQ resources.

---

## 7. BROKEN & BLOCKED FUNCTIONALITY ANALYSIS

### 7.1 Defect / Incomplete Functionality: Payout Settlement Execution
- **Location:** `services/payout.service.ts` L1349–1364 (`processPayoutSettlement`).
- **Code:**
  ```typescript
  export async function processPayoutSettlement(actor: AuthUser, bookingId: string, input: any = {}): Promise<any> {
    assertRole(actor, [Role.ADMIN]);
    throw AppError.serviceUnavailable(
      "Host payout execution is not configured. Exporting a bank batch does not settle a payout; record payment only after an approved bank-confirmation integration is available."
    );
  }
  ```
- **Impact:** Clicking "Process Settlement" in the admin dashboard fails with a 503 error. Payouts can only be exported as a SARIE banking batch CSV file (`exportBatchSettlementCSV`).
- **Classification:** **BLOCKED_EXTERNAL** — Automated transfer execution requires a real corporate banking disbursement gateway integration.

### 7.2 Defect: Untyped Payout Method Storage in `User.personalInfo`
- **Location:** `services/payout.service.ts` L321–335, L364–380.
- **Impact:** Concurrency race conditions when adding or updating payout methods, lack of relational referential integrity, inability to enforce unique IBAN constraints across accounts, and risk of data overwriting during profile updates.
- **Classification:** **PARTIALLY_IMPLEMENTED (Technical Debt)** — Functional for basic operations, but requires a structured migration to a normalized relational model or strong schema validation.

### 7.3 Defect: Missing GET Endpoint for Tax Registrations
- **Location:** `app/api/v1/taxes/registrations/route.ts`.
- **Impact:** While hosts can submit a tax registration via `POST /api/v1/taxes/registrations`, there is no API endpoint to retrieve the host's existing registrations.
- **Classification:** **BROKEN (Incomplete API)**.

---

## 8. ADMIN DEPENDENCY & INTEGRATION AUDIT

Admins interact with host financial settings through the following existing mechanisms:
1. **Payout Method Verification:**
   - Admin calls `POST /api/v1/admin/hosts/[id]/payout-methods/[methodId]/verify` with status `VERIFIED` or `REJECTED` and an optional reason.
   - Payout method status transitions from `PENDING_VERIFICATION` to `VERIFIED`.
2. **Payout Holds & Releases:**
   - Admin visits `/admin/bookings/payouts` and can place a hold (`POST /api/v1/admin/bookings/payouts/[id]/hold`) with hold types (`FRAUD_REVIEW`, `DISPUTE_HOLD`, `COMPLIANCE_HOLD`, `REFUND_HOLD`, `MANUAL_ADMIN_HOLD`).
   - Admin releases the hold (`POST /api/v1/admin/bookings/payouts/[id]/release`).
3. **Settlement Batch Export:**
   - Admin downloads SARIE format CSV (`GET /api/v1/admin/bookings/payouts/export`) to upload to Saudi corporate banking portals.
4. **Audit Trail:**
   - All admin actions write to `AuditLog`.

---

## 9. CONCLUSION & ARCHITECTURAL VERDICT

The Homyz repository has a robust financial calculation foundation and rigorous database models for bookings, payments, refunds, and taxes. However, **Host Account Settings as a cohesive user management domain does not yet exist**. 

Phase 1 audit is **COMPLETE**. The technical gaps, model deficiencies, and external dependencies are fully cataloged, enabling the final architecture and phase roadmap to be locked with zero guesswork.

