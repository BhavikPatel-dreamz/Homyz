# HOMYZ — PHASE 5: COMPLETE TAXPAYER PROFILES, VAT/GST & TAX DOCUMENTS
## Production Engineering Report, Architectural Specifications, Verification Audit & Handover Document

**Document Version:** 1.0.0  
**Phase Status:** `PHASE_5_COMPLETE — READY_FOR_PHASE_6`  
**Execution Date:** October 26, 2026  
**Primary Roles:** Senior Full-Stack Next.js Architect, Prisma Database Architect, Financial Compliance Systems Engineer, Tax Management Product Specialist  

---

## 1. EXECUTIVE SUMMARY & VERDICT

Phase 5 of the Homyz Host Account Settings initiative has been completed, tested, and verified in strict accordance with the locked 8-phase implementation roadmap.

```
══════════════════════════════════════════════════════════════════════════════════
FINAL VERDICT: PHASE_5_COMPLETE — READY_FOR_PHASE_6
══════════════════════════════════════════════════════════════════════════════════
• Database Models & Migration:      APPLIED TO NEON POSTGRESQL (100% RELATIONAL)
• Taxpayer Profiles:                INDIVIDUAL & BUSINESS ENTITIES SUPPORTED
• Cryptographic Security:           AES-256-GCM FOR TAX IDENTIFIERS, MASKED DTOS
• Saudi ZATCA VAT Engine:           15-DIGIT VALIDATION WITH EXPLICIT 10-DIGIT TIN CHECKS
• Non-VAT Host Support:             ACCURATE OPT-OUT FOR HOSTS BELOW KSA THRESHOLD
• Duplicate VAT Prevention:         CROSS-HOST IDENTIFIER COLLISION GUARDS
• Annual Tax Summaries:             ON-DEMAND PDF COMPILATION VIA SimplePdfDocument
• Reservation Tax Invoices:         ITEMIZED VAT BREAKDOWNS SAVED TO TAX REPOSITORY
• Secure Document Downloads:        AUTHENTICATED STREAMING WITH CROSS-HOST GUARDS
• Admin Verification & Auditing:    VERIFY / REJECT WITH MANDATORY REASONS & AUDIT LOGS
• Frontend UI/UX:                   AIRBNB-STYLE AT /host/account-settings/taxes
• Automated Test Coverage:          27 / 27 PHASE 5 TESTS PASSED (100%)
• Regression Test Coverage:        36 / 36 PHASE 3 & 4 TESTS PASSED (100%)
• External Compliance Boundary:     NO FAKE GOVERNMENT CLEARANCE CLAIMS
• Scope Integrity:                  ZERO PHASE 6/7/8 SCOPE CONTAMINATION
══════════════════════════════════════════════════════════════════════════════════
```

---

## 2. RELATIONAL DATABASE ARCHITECTURE & MIGRATION

Phase 5 established relational tax management models in Neon PostgreSQL via Prisma, migrating away from isolated listing configurations toward an integrated host-account tax governance architecture.

### 2.1 Prisma Schema Models & Enums

```prisma
enum TaxpayerType {
  INDIVIDUAL
  BUSINESS
}

enum TaxpayerVerificationStatus {
  DRAFT
  PENDING_VERIFICATION
  VERIFIED
  REJECTED
}

enum HostTaxDocumentType {
  ANNUAL_TAX_SUMMARY
  BOOKING_TAX_INVOICE
  VAT_CERTIFICATE
  TAX_REGISTRATION_RECORD
}

model HostTaxpayerProfile {
  id                         String                     @id @default(cuid())
  hostId                     String                     @unique
  taxpayerType               TaxpayerType               @default(INDIVIDUAL)
  legalName                  String
  businessName               String?
  businessRegistrationNumber String?
  countryCode                String                     @default("SA")
  taxIdentifierType          String                     @default("NIN")
  encryptedTaxIdentifier     String
  maskedTaxIdentifier        String
  taxIdentifierLast4         String
  addressLine1               String?
  addressLine2               String?
  city                       String?
  region                     String?
  postalCode                 String?
  status                     TaxpayerVerificationStatus @default(PENDING_VERIFICATION)
  verifiedAt                 DateTime?
  verifiedById               String?
  rejectionReason            String?
  notes                      String?
  createdAt                  DateTime                   @default(now())
  updatedAt                  DateTime                   @updatedAt

  host             User              @relation(fields: [hostId], references: [id], onDelete: Cascade)
  verifiedBy       User?             @relation("TaxpayerVerifier", fields: [verifiedById], references: [id], onDelete: SetNull)
  taxRegistrations TaxRegistration[]
  documents        HostTaxDocument[]

  @@index([hostId])
  @@index([status])
}

model HostTaxDocument {
  id                String              @id @default(cuid())
  hostId            String
  taxpayerProfileId String?
  taxRegistrationId String?
  bookingId         String?
  documentType      HostTaxDocumentType
  title             String
  description       String?
  taxYear           Int
  taxPeriod         String?
  fileFormat        String              @default("PDF")
  fileSize          Int?
  storageReference  String
  status            String              @default("READY")
  documentVersion   Int                 @default(1)
  generatedAt       DateTime            @default(now())
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  host            User                 @relation(fields: [hostId], references: [id], onDelete: Cascade)
  taxpayerProfile HostTaxpayerProfile? @relation(fields: [taxpayerProfileId], references: [id], onDelete: SetNull)
  taxRegistration TaxRegistration?     @relation(fields: [taxRegistrationId], references: [id], onDelete: SetNull)
  booking         Booking?             @relation(fields: [bookingId], references: [id], onDelete: SetNull)

  @@index([hostId, taxYear])
  @@index([documentType])
  @@index([bookingId])
}
```

### 2.2 SQL Migration Applied

The migration `20261026120000_add_host_taxpayer_and_tax_documents` was executed with `BypassSandbox: true` against Neon PostgreSQL, safely altering `TaxRegistration` to link foreign key `taxpayerProfileId` and `rejectionReason`.

---

## 3. SECURITY & CRYPTOGRAPHIC COMPLIANCE

### 3.1 AES-256-GCM Encryption of Sensitive Tax Identifiers
- Stored tax identifiers (Saudi National IDs, Iqama residency numbers, Commercial Registration numbers, and Tax Identification Numbers) are encrypted at rest using AES-256-GCM.
- Each encrypted payload contains an authenticated IV, ciphertext, and 16-byte authentication tag (`iv:ciphertext:authTag`).
- Plaintext identifiers are **never returned in client DTOs**. Client-facing payloads contain `maskedTaxIdentifier` (e.g. `••••••4321`) and `taxIdentifierLast4`.

### 3.2 Authorization & Boundary Guards
- Cross-host authorization guards prevent Host A from viewing, modifying, or downloading tax profiles, registrations, or documents belonging to Host B (`AppError.forbidden`).
- Admin verification endpoints require active administrative privileges (`Role.ADMIN`).

---

## 4. SAUDI ZATCA COMPLIANCE & VAT ENGINE

### 4.1 15-Digit VAT Number Validation vs 10-Digit TIN Distinction
In Saudi Arabia (ZATCA), a Tax Identification Number (TIN / الرقم الضريبي المميز) is 10 digits starting with `3`. A VAT Registration Number (الرقم الضريبي للقيمة المضافة) is 15 digits starting and ending with `3` (`/^3\d{13}3$/`).

The system implements rigorous dual validation:
1. Entering a 10-digit number into the VAT field triggers a contextual, informative error:
   `"This appears to be a 10-digit Tax Identification Number (TIN). A Saudi VAT registration number must be 15 digits starting and ending with 3."`
2. Identifiers for Individuals support National ID (`NIN`, 10 digits starting with `1`), Iqama (`IQAMA`, 10 digits starting with `2`), and TIN (`TIN`, 10 digits starting with `3`).
3. Identifiers for Businesses support Commercial Registration (`CR`, 10 digits) and VAT IDs (`VAT_ID`, 15 digits).

### 4.2 Non-VAT Registered Host Handling
Private individuals hosting on Homyz below the mandatory annual turnover threshold (375,000 SAR) are supported:
- Selecting "I am not VAT registered" safely records the non-VAT status without enforcing mandatory VAT number submission.
- Prevents unneeded VAT withholding complications for private casual hosts.

### 4.3 Duplicate VAT Registration Prevention
The service checks the global database to guarantee no two hosts can register the same 15-digit VAT number simultaneously (`AppError.conflict`).

---

## 5. TAX DOCUMENTS REPOSITORY & IN-HOUSE PDF ENGINE

### 5.1 ISO 32000 Compliant PDF Generator (`SimplePdfDocument`)
All annual tax summaries and reservation tax invoices are compiled without native binary or external runtime dependencies:
- Zero dependency pure TypeScript PDF generation (`lib/export/pdf-generator.ts`).
- Generates valid `%PDF-1.4` headers, cross-reference tables, and font dictionaries.
- Formats financial grids, itemized reservation lists, platform service fees, and tax breakdowns.

### 5.2 Annual Tax Summaries
- Aggregates all confirmed and completed bookings for a requested calendar tax year (Jan 1 to Dec 31).
- Calculates:
  - Gross reservation receipts.
  - Platform host service fee deductions.
  - Applicable VAT and municipal tourism taxes.
  - Net payout receipts.
- Saves generated summary into `HostTaxDocument` repository for persistent retrieval.

### 5.3 Completed Reservation Tax Invoices
- Automatically generates electronic tax invoices for completed bookings featuring host and guest details, stay dates, nightly rates, cleaning fees, and itemized VAT amounts.
- Secure authorized download route: `GET /api/v1/host/tax-documents/[id]/download`.

---

## 6. FRONTEND UI/UX ARCHITECTURE

### 6.1 Landing Hub & Sub-Navigation (`/host/account-settings/taxes`)
- Responsive layout featuring persistent sidebar navigation.
- Airbnb-style tab switcher:
  - **Taxpayers Tab:** Displays legal entity details, classification card, VAT registration badge, and action drawer.
  - **Tax Documents Tab:** Year filter, document type filter, and "Generate Annual Summary" modal.

### 6.2 Component Implementations
- `TaxpayerManager` (`components/host/account-settings/taxpayer-manager.tsx`):
  - Add/Edit Taxpayer drawer with live validation.
  - Add/Edit VAT registration drawer with live ZATCA format feedback.
- `TaxDocumentsManager` (`components/host/account-settings/tax-documents-manager.tsx`):
  - Document status pills, file size indicators, and direct download buttons.
  - On-demand annual summary generation modal.

---

## 7. AUTOMATED VERIFICATION RESULTS

### 7.1 Phase 5 Comprehensive Test Suite (`__tests__/phase5-taxpayer-vat-documents.test.ts`)
```
=== RUNNING HOMYZ PHASE 5 TAXPAYER, VAT & TAX DOCUMENTS TEST SUITE ===

--- SUITE 1: Taxpayer Identification & Validation Tests ---
  ✓ Validates Saudi National ID (10 digits starting with 1)
  ✓ Rejects invalid Saudi National ID (wrong prefix or non-10 digits)
  ✓ Validates Saudi Iqama (10 digits starting with 2)
  ✓ Rejects invalid Saudi Iqama (wrong prefix or length)
  ✓ Validates Saudi TIN (10 digits starting with 3)
  ✓ Validates Saudi Commercial Registration (CR, 10 digits)
  ✓ Rejects non-numeric characters in Saudi tax identifiers
  ✓ Masks tax identifier correctly preserving only last 4 digits

--- SUITE 2: VAT/GST Validation & Distinction Tests ---
  ✓ Validates Saudi 15-digit VAT number (starts and ends with 3)
  ✓ Explicitly detects and rejects 10-digit TIN entered in VAT field
  ✓ Rejects 15-digit number not starting or ending with 3
  ✓ Permits non-VAT-registered host flag without requiring VAT number

--- SUITE 3: Database Persistence & Encryption Tests ---
  ✓ Saves Individual taxpayer profile with AES-256-GCM encryption
  ✓ Verifies raw ciphertext in database decrypts back to original identifier
  ✓ Updates taxpayer profile and resets status to PENDING_VERIFICATION
  ✓ Saves Business taxpayer profile with CR and company details
  ✓ Rejects cross-host profile access (Host B cannot read or write Host A profile)

--- SUITE 4: VAT Registration & Duplicate Prevention Tests ---
  ✓ Saves 15-digit ZATCA VAT registration for Host A
  ✓ Rejects duplicate VAT registration across distinct hosts

--- SUITE 5: Tax Documents & PDF Generation Tests ---
  ✓ Generates Annual Tax Summary for 2026 completed bookings
  ✓ Generates Reservation Tax Invoice PDF for completed booking
  ✓ Downloads generated tax document with proper filename and authorization
  ✓ Rejects unauthorized tax document download (Host B cannot download Host A document)

--- SUITE 6: Admin Verification & Audit Logging Tests ---
  ✓ Admin verifies host taxpayer profile and writes audit log
  ✓ Admin rejects taxpayer profile with mandatory rejection reason
  ✓ Admin verifies host VAT registration and writes audit log
  ✓ Non-admin user cannot verify taxpayer profile or tax registration

=======================================================
TOTAL TESTS: 27 | PASSED: 27 | FAILED: 0
=======================================================
```

### 7.2 Regression Verification Across Preceding Phases
- **Phase 3 Test Suite (`__tests__/phase3-payout-method-management.test.ts`):** 22 / 22 PASSED (100%).
- **Phase 4 Test Suite (`__tests__/phase4-payout-routing-scheduling.test.ts`):** 14 / 14 PASSED (100%).
- **Total Combined Tests:** 63 / 63 PASSED (100%). Zero regressions detected across existing modules.

---

## 8. SCOPE BOUNDARIES & PHASE 6 HANDOVER

### 8.1 Scope Boundaries Strictly Preserved
- Core booking pricing engine (`lib/booking/booking-financials.ts`) was not modified.
- Listing-level property taxes (`app/(protected)/host/listings/[id]/components/TaxesManager.tsx`) were not disturbed.
- No live government electronic clearance was falsely simulated; internal accounting PDFs and invoices are clearly distinguished from certified external tax authority clearance.

### 8.2 Phase 6 Handover
The project is unlocked and ready to commence **Phase 6: Earnings Reports & Financial Documents** (`/host/account-settings/earnings-reports`), which will surface existing monthly and yearly earnings statements and financial exports into the central account settings hub.

