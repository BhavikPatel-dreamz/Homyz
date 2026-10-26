# HOMYZ — PAYPAL SAUDI ARABIA AVAILABILITY & PAYOUTS INTEGRATION REPORT
## Comprehensive Technical Specifications, Currency Peg Architecture, UI/UX Corrections & Provider Readiness Audit

**Document Version:** 1.0.0  
**Status:** `VERIFIED & OPERATIONAL`  
**Execution Date:** October 26, 2026  
**Primary Roles:** Senior Next.js Architect, FinTech Payment Systems Specialist, PayPal Gateway Integration Engineer  

---

## 1. EXECUTIVE SUMMARY

The payout method selection wizard at `/host/account-settings/payouts/add` previously displayed a hardcoded restriction claiming:
> *"Not Available in KSA — PayPal does not support SAR merchant disbursements."*

This statement was factually inaccurate regarding PayPal's regional service availability. Official PayPal documentation confirms that **Saudi Arabia (`SA`) is an eligible, active country** for creating accounts, receiving funds, holding balances, and withdrawing money to local Saudi bank accounts.

### What Was Corrected:
1. **Country Eligibility Fixed:**
   - Removed the hardcoded `"Not Available in KSA"` block.
   - Recognized Saudi Arabia (`SA`) as a fully supported PayPal country.
   - Separated host country eligibility from platform API integration readiness.
2. **Authoritative Currency Separation:**
   - Kept local Saudi bank accounts strictly in **SAR** via SAMA SARIE.
   - Clarified that PayPal Payouts REST API does **not** support direct SAR disbursements.
   - Enforced **USD** as the authoritative disbursement currency for PayPal in Saudi Arabia.
   - Built a deterministic currency converter based on the **official SAMA fixed exchange rate peg (1 USD = 3.75 SAR)**.
   - Preserved original SAR ledger figures down to the halala while recording the exact USD converted amount and exchange rate.
3. **UI/UX Status Transparency:**
   - Replaced `"Not Available in KSA"` with:
     - Badge: **"Supported in Saudi Arabia"**
     - Status: **"Integration setup required"** (when API credentials are not yet configured) or **"Available (USD)"** (when credentials are active).
     - Informative Callout: *"PayPal accounts in Saudi Arabia are eligible to receive USD disbursements and withdraw to local Saudi banks in SAR. Automated Homyz platform disbursements require PayPal Business Payouts credentials. In the meantime, use your Saudi IBAN bank account for instant zero-fee SAR deposits."*
4. **Account Management & Security:**
   - Implemented RFC 5322 recipient email validation.
   - AES-256-GCM authenticated encryption for recipient emails.
   - Masked email display (`h***t@example.com`) to prevent PII exposure.
   - Case-insensitive HMAC-SHA256 fingerprint deduplication.
   - Relational storage in `HostPayoutMethod` table with `type: "PAYPAL"`.
5. **Zero Faking Guarantee:**
   - Unconfigured PayPal integrations will **never** fake a successful payout. `paypalPayoutService.submitPayout` strictly rejects execution if `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET` is missing.

---

## 2. PAYPAL PAYOUTS VS PAYPAL CHECKOUT: ARCHITECTURAL DISTINCTION

It is critical not to confuse **PayPal Checkout** with **PayPal Payouts**:

| Feature / Attribute | PayPal Checkout | PayPal Payouts (Disbursements) |
|---|---|---|
| **Primary Direction** | Inbound (Guest $\to$ Platform) | Outbound (Platform $\to$ Host) |
| **API Endpoint** | `/v2/checkout/orders` | `/v1/payments/payouts` |
| **Account Type Required** | Standard PayPal Business Account | Approved PayPal Business Account with explicit **Payouts API permission** |
| **Recipient Identifiers** | Credit/Debit Card or PayPal Login | Host PayPal Email Address or Phone Number |
| **SAR Support** | Supported for guest credit card charges | **Not Supported** for direct payouts |
| **Homyz Architecture** | Managed by guest payment gateway | Managed by Host Account Settings $\to$ Payouts module |

---

## 3. CURRENCY HANDLING & SAMA FIXED PEG POLICY

### 3.1 Currency Specification
The PayPal Payouts REST API specification supports:
`USD, EUR, GBP, AUD, CAD, JPY, CHF, NZD, SGD, HKD, SEK, DKK, PLN, NOK, HUF, CZK, ILS, MXN, BRL, PHP, TWD, THB`.
**SAR is not a direct disbursement currency in the Payouts API.**

When a Saudi host receives funds via PayPal:
1. Homyz disburses funds in **USD**.
2. Funds arrive in the host's PayPal USD balance.
3. The host can hold the balance in USD or withdraw to their local Saudi bank account (where PayPal converts USD to SAR upon withdrawal).

### 3.2 SAMA Fixed-Peg Calculation Engine ([`lib/currency/payout-converter.ts`](file:///media/drive/shihab/Homyz/lib/currency/payout-converter.ts))
In Saudi Arabia, the Saudi Riyal has been officially pegged to the US Dollar by the Saudi Central Bank (SAMA) at the fixed rate of **1 USD = 3.7500 SAR** ($1 \text{ SAR} = \frac{4}{15} \text{ USD} = 0.266667 \text{ USD}$).

```typescript
export function convertSarHalalasToUsdCents(sarHalalas: number): PayoutConversionResult {
  const safeHalalas = Math.max(0, Math.round(Number(sarHalalas) || 0));
  // Exact integer rational conversion: (sarHalalas * 4) / 15
  const settlementUsdCents = Math.round((safeHalalas * 4) / 15);
  return {
    originalSarHalalas: safeHalalas,
    settlementUsdCents,
    exchangeRatePeg: 3.75,
    effectiveRate: 4 / 15,
    pegFormula: "1 USD = 3.75 SAR (Exact integer arithmetic: (halalas * 4) / 15)",
    rateSource: "SAMA_OFFICIAL_FIXED_PEG",
    feeCents: 0,
    convertedAt: new Date().toISOString(),
  };
}
```

#### Deterministic Conversion Table:
| SAR Halalas | SAR Amount | USD Cents | USD Settlement | Mathematical Formula |
|---|---|---|---|---|
| 37,500 | 375.00 SAR | 10,000 | **$100.00 USD** | $(37500 \times 4) / 15 = 10000$ |
| 15,000 | 150.00 SAR | 4,000 | **$40.00 USD** | $(15000 \times 4) / 15 = 4000$ |
| 1,000 | 10.00 SAR | 267 | **$2.67 USD** | $\text{round}(4000 / 15) = 267$ |
| 375 | 3.75 SAR | 100 | **$1.00 USD** | $(375 \times 4) / 15 = 100$ |

---

## 4. UI/UX DESIGN & INTERACTION FLOW

### 4.1 Payout Method Wizard ([`components/host/account-settings/add-payout-method-wizard.tsx`](file:///media/drive/shihab/Homyz/components/host/account-settings/add-payout-method-wizard.tsx))

```
Step 1: Billing Country ───> Step 2: Method Selection ───> Step 3: Account Details ───> Step 4: Review & Confirm ───> Step 5: Complete
[ 🇸🇦 Saudi Arabia ]         [ 🏦 Bank Account (SAR) ]      [ Beneficiary Name ]         [ Provider Summary ]         [ Status: Verified ]
                            [ 💳 PayPal (USD) ]            [ PayPal Email ]             [ SAMA Peg Disclaimer ]      [ Active / Default ]
```

### 4.2 Step 2 Behavior
- **Saudi IBAN:** Recommended (Emerald badge). Zero platform fees. Fast SARIE transfer in SAR.
- **PayPal:**
  - Badge: `Supported in Saudi Arabia` + `Integration setup required` (when unconfigured).
  - Subtitle: `Disbursed in USD at SAMA fixed peg (1 USD = 3.75 SAR) · Direct local bank withdrawal supported by PayPal`.
  - When unconfigured: displays status explanation explaining that PayPal accounts in KSA are eligible to receive USD and withdraw to local banks, while direct automated platform disbursements require PayPal Business Payouts credentials.
  - When configured: radio button activates, allowing host to proceed to PayPal account entry.

### 4.3 Step 3 Details
- **Beneficiary Legal Name:** Matching name on PayPal account.
- **PayPal Recipient Email:** Validated with live RFC 5322 regex.
- **Disbursement Currency Card:** Explains the USD disbursement and SAMA 3.75 peg.
- **Default Method Toggle:** Option to set as primary payout destination.

---

## 5. EXTERNAL DEPENDENCIES & INTEGRATION PREREQUISITES

To enable automated live disbursements via PayPal Payouts, the platform administrator must configure:

1. **PayPal Business Account:**
   - A verified PayPal Business account registered to the Homyz legal entity.
2. **PayPal Payouts Feature Permission:**
   - In PayPal Developer Dashboard, the Payouts permission must be granted.
   - Standard business accounts must apply for Payouts access via PayPal Merchant Services.
3. **Environment Credentials:**
   ```bash
   PAYPAL_CLIENT_ID="<your_paypal_client_id>"
   PAYPAL_CLIENT_SECRET="<your_paypal_client_secret>"
   PAYPAL_ENVIRONMENT="live" # or "sandbox"
   ```
4. **Funding Balance:**
   - PayPal Payouts draws directly from the platform's PayPal account balance. Sufficient USD balance must be maintained.
5. **Webhooks:**
   - Optional webhook listener for `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` / `PAYMENT.PAYOUTS-ITEM.FAILED`.

---

## 6. VERIFICATION AUDIT & TEST RESULTS

Test suite executed: [`__tests__/paypal-saudi-availability-integration.test.ts`](file:///media/drive/shihab/Homyz/__tests__/paypal-saudi-availability-integration.test.ts)

```
=== RUNNING HOMYZ PAYPAL SAUDI ARABIA AVAILABILITY & INTEGRATION TEST SUITE ===

--- SUITE 1: Country & Currency Eligibility Checks ---
  ✓ Recognizes Saudi Arabia ('SA', 'KSA', 'Saudi Arabia') as PayPal-supported
  ✓ Separates country support from direct SAR currency support (enforces USD)
  ✓ Rejects attempt to register PayPal method in SAR with authoritative error

--- SUITE 2: SAMA Fixed-Peg Currency Conversion Engine ---
  ✓ Converts 375.00 SAR (37,500 halalas) to exactly $100.00 USD (10,000 cents)
  ✓ Converts 150.00 SAR (15,000 halalas) to exactly $40.00 USD (4,000 cents)
  ✓ Converts 3.75 SAR (375 halalas) to exactly $1.00 USD (100 cents)
  ✓ Inverse conversion: converts USD cents back to SAR halalas accurately

--- SUITE 3: PayPal Email Validation & Security Masking ---
  ✓ Validates RFC 5322 compliant recipient PayPal email addresses
  ✓ Masks PayPal email securely without exposing full PII
  ✓ Encrypts and decrypts PayPal email using AES-256-GCM authenticated encryption
  ✓ Generates case-insensitive deterministic fingerprints for email deduplication

--- SUITE 4: PayPal Account Management & Relational Database Storage ---
  ✓ Registers a verified PayPal payout method for a Saudi host (country: 'SA', currency: 'USD')
  ✓ Prevents duplicate PayPal account registration for the same host
  ✓ Retrieves single PayPal method by ID ensuring host ownership
  ✓ Rejects cross-host access: Host B cannot view or delete Host A's PayPal method

--- SUITE 5: Gateway Readiness, Integration Status & Non-Faking Guarantee ---
  ✓ getIntegrationStatus reports 'Integration setup required' when credentials are missing
  ✓ submitPayout strictly refuses to fake successful payout when credentials are missing

--- SUITE 6: Zero Regression on Saudi IBAN & Payout Routing Co-existence ---
  ✓ Registers Saudi IBAN alongside PayPal method and reassigns default atomically
  ✓ Host A now has 2 registered payout methods: 1 Saudi IBAN (SAR) + 1 PayPal (USD)

=======================================================
TOTAL TESTS: 19 | PASSED: 19 | FAILED: 0
=======================================================
```

---

## 7. SUMMARY OF MODIFIED & CREATED FILES

| File | Purpose |
|---|---|
| [`lib/currency/payout-converter.ts`](file:///media/drive/shihab/Homyz/lib/currency/payout-converter.ts) | SAMA official fixed peg (1 USD = 3.75 SAR) integer conversion engine |
| [`services/paypal-payout.service.ts`](file:///media/drive/shihab/Homyz/services/paypal-payout.service.ts) | Country recognition, email validation, readiness checks & idempotent execution |
| [`app/api/v1/host/payout-methods/paypal-status/route.ts`](file:///media/drive/shihab/Homyz/app/api/v1/host/payout-methods/paypal-status/route.ts) | Real-time gateway status endpoint for host client components |
| [`lib/security/payout-encryption.ts`](file:///media/drive/shihab/Homyz/lib/security/payout-encryption.ts) | Added `maskEmail()` and case-insensitive email fingerprinting |
| [`services/payout.service.ts`](file:///media/drive/shihab/Homyz/services/payout.service.ts) | Extended `addHostPayoutMethod` to support `PAYPAL` method type and USD enforcement |
| [`app/api/v1/host/payout-methods/route.ts`](file:///media/drive/shihab/Homyz/app/api/v1/host/payout-methods/route.ts) | Accepts `type`, `paypalEmail`, and `country` in POST payload |
| [`components/host/account-settings/add-payout-method-wizard.tsx`](file:///media/drive/shihab/Homyz/components/host/account-settings/add-payout-method-wizard.tsx) | Updated UI: removed false KSA restriction, shows "Integration setup required" / "Available (USD)" |
| [`components/host/account-settings/payout-methods-manager.tsx`](file:///media/drive/shihab/Homyz/components/host/account-settings/payout-methods-manager.tsx) | Displays PayPal icon and currency indicators on registered payout method cards |
| [`components/host/account-settings/payout-method-detail-client.tsx`](file:///media/drive/shihab/Homyz/components/host/account-settings/payout-method-detail-client.tsx) | Displays PayPal rail and SAMA peg details on payout method details page |
| [`__tests__/paypal-saudi-availability-integration.test.ts`](file:///media/drive/shihab/Homyz/__tests__/paypal-saudi-availability-integration.test.ts) | Comprehensive automated test suite covering all 19 test cases |

