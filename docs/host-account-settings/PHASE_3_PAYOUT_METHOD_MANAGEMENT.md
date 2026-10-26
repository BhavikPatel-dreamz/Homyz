# HOMYZ — PHASE 3: COMPLETE PAYOUT METHOD MANAGEMENT & RELATIONAL MIGRATION

**Status:** COMPLETED & VERIFIED  
**Phase:** 3 of 8  
**Previous Phase:** Phase 2 (Host Account Settings UI/UX & Responsive Shell)  
**Next Phase:** Phase 4 (Split Payouts, Routing Rules & Co-Host Revenue Sharing)  
**Verification Suite:** `__tests__/phase3-payout-method-management.test.ts` (22/22 Tests Passing, 100%)

---

## 1. EXECUTIVE SUMMARY

In Phase 3, Homyz has successfully migrated from storing payout accounts in untyped JSON (`User.personalInfo.payoutMethods`) to a dedicated, high-security relational database model `HostPayoutMethod` in PostgreSQL. 

The implementation delivers:
1. **Relational Database Model (`HostPayoutMethod`):** Full table with strict foreign keys, indexing, cascade deletion, soft deletion (`disabledAt`), and duplicate prevention.
2. **FinTech Security & Cryptography:** Full Saudi IBANs are encrypted at rest using authenticated **AES-256-GCM** encryption (`lib/security/payout-encryption.ts`). Account deduplication is performed via cryptographically secure HMAC-SHA256 fingerprints (`accountFingerprint`) without exposing unmasked banking credentials.
3. **Dual-Read & Dual-Write Resilience:** Seamless zero-downtime migration with dual-read fallback (reads relational first, falls back to legacy JSON) and dual-write replication on all mutations.
4. **Idempotent Backfill Pipeline:** Dedicated script `scripts/backfill-payout-methods.ts` for safe historical data migration and reconciliation.
5. **Interactive Frontend Experience:**
   - **"How you get paid" Hub (`/host/account-settings/payouts`):** Real-time payout method cards, default toggles, removal modals, and status badges.
   - **5-Step Add Payout Method Wizard (`/host/account-settings/payouts/add`):** Full-page wizard with country selection (KSA active, GCC/International informational), payment rail selection, live SAMA MOD-97 checksum validation & instant bank detection, review & legal certification, and verification outcome notice.
   - **Payout Method Details & Permitted Edits (`/host/account-settings/payouts/methods/[id]`):** Beneficiary name updates, routing notes, security immutability notice, and account management.
6. **SARIE Settlement Rail Compatibility:** Full compatibility with corporate banking batch settlement (`exportBatchSettlementCSV`) which decrypts authorized IBANs for local SAR disbursement.
7. **Host Earnings Synchronization:** Harmonized the payout methods modal in `/host/earnings/host-earnings-client.tsx` with deep-links to the dedicated settings hub.

---

## 2. RELATIONAL DATA MODEL

### Prisma Model: `HostPayoutMethod`
Located in `prisma/schema.prisma`:

```prisma
enum HostPayoutMethodStatus {
  PENDING_VERIFICATION
  VERIFIED
  REJECTED
  DISABLED
}

enum PayoutMethodType {
  SAUDI_IBAN
  INTERNATIONAL_SWIFT
  PAYPAL
}

model HostPayoutMethod {
  id                        String                 @id @default(cuid())
  hostId                    String
  type                      PayoutMethodType       @default(SAUDI_IBAN)
  accountHolderName         String
  bankName                  String
  bankCode                  String?
  country                   String                 @default("SA")
  currency                  String                 @default("SAR")
  ibanMasked                String
  ibanLast4                 String
  encryptedAccountReference String?                @db.Text
  accountFingerprint        String?
  isDefault                 Boolean                @default(false)
  status                    HostPayoutMethodStatus @default(PENDING_VERIFICATION)
  verifiedAt                DateTime?
  verifiedById              String?
  rejectionReason           String?                @db.Text
  metadata                  Json?
  createdAt                 DateTime               @default(now())
  updatedAt                 DateTime               @updatedAt
  disabledAt                DateTime?

  host                      User                   @relation("HostPayoutMethods", fields: [hostId], references: [id], onDelete: Cascade)

  @@unique([hostId, accountFingerprint])
  @@index([hostId, isDefault])
  @@index([status])
  @@index([hostId, status])
}
```

### Applied Migration:
- **Migration Script:** `prisma/migrations/20261026100000_add_host_payout_methods/migration.sql`
- **Application Script:** `scripts/apply-payout-migration.ts`
- **Table Verification:** Verified in PostgreSQL Neon database with 21 columns, primary keys, indexes, and foreign keys.

---

## 3. FINTECH SECURITY & ENCRYPTION ARCHITECTURE

### Module: `lib/security/payout-encryption.ts`

1. **AES-256-GCM Authenticated Encryption:**
   - 96-bit Initialization Vector (`crypto.randomBytes(12)`).
   - 128-bit Authentication Tag (`cipher.getAuthTag()`).
   - Format: `ivHex:authTagHex:cipherTextHex`.
   - Salted key derivation via `crypto.scryptSync(secret, salt, 32)`.
   - Protects full 24-character Saudi IBAN at rest in the database.
2. **Account Fingerprinting for Deduplication:**
   - Normalized clean uppercase IBAN is hashed with HMAC-SHA256 (`generateAccountFingerprint`).
   - Stored in `accountFingerprint` column.
   - Enforced by compound unique constraint: `@@unique([hostId, accountFingerprint])`.
   - Prevents duplicate registration of the same bank account by a single host without ever querying or storing plaintext IBANs.
3. **Masked IBAN Representation:**
   - Standard: `SA03 **** **** **** **** 7519`.
   - Used everywhere across client APIs, logs, and frontend views to satisfy PCI-DSS and SAMA data protection directives.

---

## 4. DUAL-READ & DUAL-WRITE ENGINE

Implemented in `services/payout.service.ts`:

1. **`getHostPayoutMethods(hostId)`:**
   - Queries `prisma.hostPayoutMethod.findMany({ where: { hostId, disabledAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })`.
   - If relational records exist, maps and returns them.
   - If empty, falls back safely to reading legacy `User.personalInfo.payoutMethods`.
2. **`addHostPayoutMethod(hostId, input)`:**
   - Validates Saudi IBAN using standard MOD-97 check digits.
   - Checks for duplicate fingerprint in relational database (and legacy JSON).
   - Encrypts clean IBAN with AES-256-GCM.
   - Checks whether host identity is verified (`identityStatus === "VERIFIED"`); if yes, auto-verifies the payout method.
   - Executes atomic transaction updating defaults and writing to `HostPayoutMethod`.
   - Replicates into `User.personalInfo.payoutMethods` to guarantee zero regressions for existing consumers.
3. **`updateHostPayoutMethod(hostId, methodId, input)`:**
   - Permits updating beneficiary preferred display name and routing nickname.
   - Rejects any attempt to modify immutable IBAN numbers or bank codes.
   - Synchronizes relational and legacy mirror records.
4. **`setDefaultPayoutMethod(hostId, methodId)`:**
   - Atomically resets prior defaults and sets target as `isDefault: true`.
   - Synchronizes relational and legacy mirror records.
5. **`deleteHostPayoutMethod(hostId, methodId)`:**
   - Performs compliant soft deletion: sets `disabledAt = new Date()`, `status = "DISABLED"`, `isDefault = false`.
   - If the deleted method was default, promotes the newest active remaining method to default.
   - Synchronizes relational and legacy mirror records.
6. **`verifyHostPayoutMethod(actor, hostId, methodId, status, reason)`:**
   - Admin RBAC guard (`Role.ADMIN`).
   - Updates status to `VERIFIED` (with timestamp) or `REJECTED` (with rejection reason).
   - Records structured audit log via `auditService.record`.

---

## 5. COMPLETE API ENDPOINTS SPECIFICATION

| Method | Endpoint | Access Role | Description |
|---|---|---|---|
| `GET` | `/api/v1/host/payout-methods` | Host, Admin | Returns all active registered payout methods for authenticated host. |
| `POST` | `/api/v1/host/payout-methods` | Host, Admin | Validates IBAN, encrypts reference, and registers new payout method. |
| `GET` | `/api/v1/host/payout-methods/[id]` | Host, Admin | Returns detailed information for a single payout method (host-scoped). |
| `PATCH` | `/api/v1/host/payout-methods/[id]` | Host, Admin | Updates permitted metadata (beneficiary name, nickname) without mutating IBAN. |
| `DELETE` | `/api/v1/host/payout-methods/[id]` | Host, Admin | Soft-deletes payout method and transfers default if applicable. |
| `PUT` | `/api/v1/host/payout-methods/[id]/default` | Host, Admin | Atomically sets payout method as primary default for host earnings. |
| `POST` | `/api/v1/admin/hosts/[id]/payout-methods/[methodId]/verify` | Admin | Administrative approval/rejection with audit logging. |

---

## 6. FRONTEND PAGES & COMPONENTS

### 1. "How you get paid" Hub
- **Route:** `/host/account-settings/payouts`
- **Component:** `components/host/account-settings/payout-methods-manager.tsx`
- **Features:**
  - Live method listing with bank institution icon, masked IBAN, currency, and default badge.
  - "Set as Default" action with optimistic update.
  - "Details" direct link.
  - "Remove" action with accessible confirmation modal warning about default reassignment.
  - Rejection notice banner showing admin feedback.
  - SAMA SARIE disbursement guide card.

### 2. 5-Step Add Payout Method Wizard
- **Route:** `/host/account-settings/payouts/add`
- **Component:** `components/host/account-settings/add-payout-method-wizard.tsx`
- **Features:**
  - **Step 1 (Billing Country):** Saudi Arabia (active/supported); UAE & International (informational/coming soon).
  - **Step 2 (Payout Rail):** Saudi Bank Account (SARIE) active; PayPal & SWIFT disabled with regulatory explanation.
  - **Step 3 (Account Details):** Auto-formatting `SA` IBAN input, live MOD-97 check digit validation, real-time SAMA bank directory detection (12 Saudi banks), account nickname, and default toggle.
  - **Step 4 (Review & Legal Certification):** Comprehensive summary card with mandatory host certification checkbox.
  - **Step 5 (Submission & Verification):** Immediate feedback confirming account registration and explaining administrative verification status.

### 3. Payout Method Detail & Edit
- **Route:** `/host/account-settings/payouts/methods/[id]`
- **Component:** `components/host/account-settings/payout-method-detail-client.tsx`
- **Features:**
  - Bank metadata (name, currency, bank code, country, registration date, verification timestamp).
  - Masked IBAN with one-click copy.
  - In-place editing of beneficiary name and account nickname.
  - SAMA IBAN Immutability notice explaining regulatory non-editable account number rules.
  - "Set as Default" and "Remove Account" actions.

### 4. Earnings Hub Harmonization
- **File:** `app/(protected)/host/earnings/host-earnings-client.tsx`
- Deep-links from the earnings modal directly into `/host/account-settings/payouts`.
- Updated `getHostEarningsOverview` in `services/payout.service.ts` to query `getHostPayoutMethods(hostId)` relationally.

---

## 7. VERIFICATION & TEST RESULTS

Automated test suite: `__tests__/phase3-payout-method-management.test.ts`

```
=== RUNNING HOMYZ PHASE 3 COMPREHENSIVE TEST SUITE ===

Suite 1: Saudi IBAN & SAMA Bank Directory
  ✓ Validates valid Saudi IBAN with MOD-97 check digits
  ✓ Identifies Saudi National Bank (SNB) correctly
  ✓ Rejects invalid checksum digits in IBAN
  ✓ Rejects IBAN not starting with SA
  ✓ Rejects IBAN with invalid length
  ✓ Masks IBAN according to security standards

Suite 2: AES-256-GCM Encryption & Account Fingerprinting
  ✓ Encrypts and decrypts IBAN correctly using AES-256-GCM
  ✓ Safely rejects tampered ciphertext without crashing
  ✓ Generates deterministic account fingerprints for deduplication

Suite 3: Relational Database CRUD & Dual-Read Fallback
  ✓ Creates isolated test host user
  ✓ Returns empty payout methods list for new host
  ✓ Adds primary payout method relationally (marks default automatically)
  ✓ Prevents duplicate IBAN registration for the same host
  ✓ Adds secondary payout method as non-default
  ✓ Retrieves single method by ID verifying ownership
  ✓ Updates permitted editable fields without mutating immutable IBAN
  ✓ Atomically changes default payout method
  ✓ Soft-deletes payout method and reassigns default
  ✓ Admin verifies payout method and records audit log
  ✓ Dual-read fallback: reads legacy User.personalInfo.payoutMethods if relational is empty
  ✓ exportBatchSettlementCSV formats headers and executes cleanly with relational methods
  ✓ Cleans up test records safely

=======================================================
TOTAL TESTS: 22 | PASSED: 22 | FAILED: 0
=======================================================
```

---

## 8. PHASE VERDICT

All requirements of Phase 3 are complete, tested, and verified against the live PostgreSQL database and App Router frontend.

```
PHASE_3_COMPLETE — READY_FOR_PHASE_4
```

