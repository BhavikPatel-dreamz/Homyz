# HOMYZ — HOST ACCOUNT SETTINGS DEPENDENCIES & PAYMENT GATEWAY ASSESSMENT
## FinTech Infrastructure, Payment Gateway Limitations, Regulatory Requirements & Fallback Strategies

**Document Version:** 1.0.0  
**Assessment Date:** October 26, 2026  
**Auditor Roles:** FinTech Integration Architect, Senior Full-Stack Architect, Payment Systems Specialist  
**Evaluated Systems:** Moyasar Gateway, SAMA SARIE Rail, ZATCA Tax Compliance, PayPal Integration  

---

## 1. PAYMENT GATEWAY EVALUATION (MOYASAR)

Homyz is integrated with **Moyasar**, a payment gateway licensed and regulated by the Saudi Central Bank (SAMA).

### 1.1 Provider Capability & Status Audit

| Gateway Dimension | Actual Repository State | Verification Evidence | Status / Architectural Impact |
|---|---|---|---|
| **Gateway Provider Name** | Moyasar (SAMA Regulated) | `lib/payment/moyasar-adapter.ts` L17 | Primary payment gateway in KSA. |
| **Live vs. Test State** | `MOCK` / `DEFERRED` mode active; `MOYASAR_API_KEY` empty in `.env`. | `.env` / `lib/payment/moyasar-adapter.ts` L38 | Safe development sandbox. Live keys required for production acquiring. |
| **Supported Inbound Methods** | mada (Debit), Visa, Mastercard, Apple Pay | `lib/payment/provider-interface.ts` L57 | Inbound guest checkout payment capture is fully supported. |
| **Supported Currencies** | SAR (Saudi Riyal) primary; GCC / USD secondary | `services/payout.service.ts` L627 | Inbound transactions settle in SAR. Multi-currency reporting exists without automated FX conversion. |
| **Marketplace Split Payments** | **UNSUPPORTED** | `lib/payment/provider-interface.ts` L100 | Moyasar does NOT support splitting payments between platform and host at capture time. |
| **Connected Sub-Merchant Accounts** | **UNSUPPORTED** | `lib/payment/provider-interface.ts` L104 | Moyasar does NOT provide an automated Stripe Connect-style sub-merchant onboarding API in KSA. |
| **Host Direct Bank Transfers / Payouts** | **UNSUPPORTED** | `lib/payment/provider-interface.ts` L108 | Moyasar is an **acquiring gateway only**. It does NOT provide an outbound payout or B2B disbursement API. |
| **Payout Status Tracking** | **UNSUPPORTED** | `lib/payment/provider-interface.ts` L112 | Outbound payouts cannot be tracked via Moyasar API. Status is tracked in Homyz database. |
| **Webhooks** | Fully implemented (`payment.paid`, `payment.failed`, `payment.refunded`) | `services/payment-webhook.service.ts` | Inbound guest payment and refund webhooks are verified with HMAC-SHA256 signatures. |
| **Idempotency Support** | Supported via database uniqueness | `prisma/schema.prisma` L728 | Enforced on `BookingPayment.idempotencyKey` and `BookingRefund.idempotencyKey`. |

---

## 2. DISBURSEMENT INFRASTRUCTURE & SAMA SARIE INTEGRATION

Because Moyasar cannot disburse funds to host bank accounts, Homyz relies on Saudi Arabia's national payment rails:

### 2.1 The SARIE Interbank Transfer System
- **System:** SARIE (Saudi Financial Interbank Sub-System / سريع), operated by SAMA.
- **Current Homyz Implementation:** Batch Corporate Banking CSV Export (`payoutService.exportBatchSettlementCSV`).
- **Workflow:**
  1. Reservation completes; stay elapses 24 hours after check-in.
  2. Payout status transitions to `ELIGIBLE_SETTLEMENT`.
  3. Admin navigates to `/admin/bookings/payouts` and downloads the SARIE batch settlement file (`GET /api/v1/admin/bookings/payouts/export`).
  4. Admin uploads the batch file to the platform's corporate banking portal (e.g. Al Rajhi Corporate / SNB e-Corp).
  5. Bank processes interbank SARIE transfers directly to host IBANs.
  6. Admin enters the corporate bank settlement reference to reconcile the payout.
- **Architectural Reality:** Automated direct bank transfer via REST API (`processPayoutSettlement`) is **BLOCKED — EXTERNAL DEPENDENCY** until a licensed Open Banking B2B disbursement partner (e.g. Lean Technologies, Tarabut Gateway, HyperPay Payouts, or direct corporate bank host-to-host API) is contracted and configured.

---

## 3. PAYPAL & INTERNATIONAL PAYOUT ASSESSMENT

### 3.1 PayPal Feasibility in Homyz
- **Reference Context:** Airbnb reference screenshots show PayPal as a payout method alongside Bank Transfer.
- **Current Repository State:** Zero PayPal integration exists. No SDK, no webhook listeners, no credentials in `.env.example`.
- **Regulatory & Geographic Reality in KSA:**
  1. Majority of Saudi hosts do not operate PayPal business accounts for domestic property income. SAMA regulations heavily incentivize direct local bank transfers to Saudi IBANs.
  2. Operating PayPal Payouts requires a verified PayPal Business Account with Payouts API permissions approved and funded in USD/EUR.
- **Architectural Decision:**
  - PayPal is classified as **`BLOCKED_EXTERNAL`**.
  - In Phase 3, the Add Payout Method wizard will present Saudi IBAN Bank Transfer as the active, recommended method. PayPal will be marked as "Coming Soon / International Only", preventing dead UI clicks without breaking the architecture.

---

## 4. REGULATORY & COMPLIANCE REQUIREMENTS

### 4.1 Saudi Central Bank (SAMA) IBAN Standards
- Every Saudi IBAN must conform strictly to the international ISO 13616 standard:
  - Total length: exactly 24 alphanumeric characters.
  - Prefix: `SA`.
  - Check Digits: 2 numerical digits computed via MOD-97 algorithm.
  - Bank Identifier: 2 numerical digits identifying the licensed commercial bank (e.g., `80` = Al Rajhi Bank, `10` = Saudi National Bank).
  - Account Number: 18 alphanumeric characters.
- **Homyz Verification:** Fully verified in `payoutService.validateSaudiIban()`.

### 4.2 ZATCA (Zakat, Tax and Customs Authority) Compliance
- Hosts registered as businesses or surpassing the mandatory VAT registration threshold (375,000 SAR annual revenue in KSA) must collect and remit 15% Value-Added Tax.
- VAT identification numbers in Saudi Arabia must conform to the 15-digit format starting and ending with `3`.
- Homyz stores VAT registrations via `TaxRegistration` (`taxType = "VAT_ID"`) and tracks collected reservation taxes via `ReservationTax`.

---

## 5. COMPLETE DEPENDENCY TRACKING MATRIX

| Dependency Item | Type | Owning Entity | Current Repository Status | Impact on Phase 2–8 | Safe Alternative / Resolution Strategy |
|---|---|---|---|---|---|
| **Moyasar Live API Key** | Secret | Moyasar Merchant Portal | Missing (`.env` empty) | None for Phase 2–7 UI & Data logic | Operate in safe `MOCK` mode during testing. |
| **Automated B2B Payout API** | Rail | Commercial Bank / Open Banking | Not integrated | Blocks automated instant payout execution | Rely on verified SARIE batch corporate banking CSV export. |
| **PayPal Payouts API** | Gateway | PayPal Developer Portal | Not integrated | Blocks PayPal as a live disbursement method | Mark PayPal as "Coming Soon / International" in Phase 3. |
| **S3 Media Storage Bucket** | Storage | AWS / S3 Compatible | Optional (`MEDIA_SERVER_URL` active) | Affects tax certificate file uploads | Leverage existing local media upload service (`services/cms-media.service.ts`). |
| **ZATCA E-Invoicing Phase 2 API** | Regulatory | ZATCA Government Portal | Not integrated | Precludes automated government invoice signing | Retain in-process PDF/CSV tax invoice generation via `taxService`. |
| **Host Identity Verification (KYC)** | Compliance | Saudi National Portal (Absher/Nafath) | Simulated in `saudi-license.service.ts` | Payout methods remain `PENDING_VERIFICATION` until verified | Manual Admin review endpoint (`verifyHostPayoutMethod`) is fully operational. |

---

## 6. ARCHITECTURAL CONCLUSION

None of the identified external dependencies prevent completing the full Host Account Settings domain. By adopting:
1. **Provider-Agnostic Abstraction Layers:** Decoupling payout method storage and business rules from the payment gateway.
2. **SAMA-Compliant Corporate Banking SARIE Workflows:** Supporting batch file disbursements as the primary KSA payout rail.
3. **Graceful Fallbacks:** Clear status indications for features requiring live external contracts.

The Homyz architecture is sound, robust, and ready for immediate implementation starting with **Phase 2 — Complete Host Account Settings UI/UX**.

