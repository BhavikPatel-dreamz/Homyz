import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Phase 2 — critical security and financial safety regressions", () => {
  test("role-protected APIs use the live active-account guard", () => {
    const guards = source("lib/permissions/guards.ts");
    const roleGuard = guards.slice(guards.indexOf("export async function requireApiRole"));

    assert.match(roleGuard, /const user = await requireApiAuth\(req\);/);
    assert.match(roleGuard, /authorize\(user, roles\);/);
  });

  test("every identified admin payout mutation requires PAYOUTS_MANAGE", () => {
    const mutations = [
      "app/api/v1/admin/bookings/payouts/[id]/hold/route.ts",
      "app/api/v1/admin/bookings/payouts/[id]/release/route.ts",
      "app/api/v1/admin/bookings/payouts/[id]/process/route.ts",
      "app/api/v1/admin/bookings/payouts/export/route.ts",
      "app/api/v1/admin/payouts/batch-settlement/confirm/route.ts",
      "app/api/v1/admin/hosts/[id]/payout-methods/[methodId]/verify/route.ts",
    ];

    for (const path of mutations) {
      assert.match(source(path), /requireApiPermission\(req, PERMISSIONS\.PAYOUTS_MANAGE\)/, path);
    }
    assert.match(source(mutations[3]), /export const POST/);
    assert.doesNotMatch(source(mutations[3]), /export const GET/);
  });

  test("refund dispatch claims the record before gateway contact and preserves unknown outcomes", () => {
    const refunds = source("services/refund.service.ts");
    const claimIndex = refunds.indexOf("status: RefundStatus.PROCESSING");
    const gatewayIndex = refunds.indexOf("moyasarAdapter.createRefund");

    assert.ok(claimIndex >= 0, "refund must transition to PROCESSING");
    assert.ok(gatewayIndex > claimIndex, "gateway call must occur after durable PROCESSING claim");
    assert.match(refunds, /gatewayIdempotencySupported: false/);
    assert.match(refunds, /settlementStatus: "OUTCOME_UNKNOWN"/);
    assert.match(refunds, /must be reconciled before any retry/);
    assert.match(refunds, /Only a pending refund can be rejected/);
    assert.match(refunds, /const lockedActiveRefund = await tx\.bookingRefund\.findFirst/);
  });

  test("Moyasar refunds do not manufacture a refund ID or retry ambiguous responses", () => {
    const adapter = source("lib/payment/moyasar-adapter.ts");
    const refundMethod = adapter.slice(adapter.indexOf("async createRefund"));

    assert.doesNotMatch(refundMethod, /providerRefundId:\s*data\.id/);
    assert.match(refundMethod, /providerOutcome: "UNKNOWN"/);
    assert.match(refundMethod, /body: JSON\.stringify\(\{ amount: params\.amount \}\)/);
  });

  test("refund webhooks are serialized and retain payment IDs in metadata", () => {
    const webhook = source("services/payment-webhook.service.ts");

    assert.match(webhook, /const processedEvent = await tx\.auditLog\.findFirst/);
    assert.match(webhook, /duplicate: true/);
    assert.doesNotMatch(webhook, /providerRefundId: String\(event\.data\.id \|\| paymentProviderId\)/);
    assert.match(webhook, /providerPaymentId: paymentProviderId/);
  });
});
