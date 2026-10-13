import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  createRefundRequestSchema,
  refundApprovalSchema,
  refundProcessSchema,
  refundRejectionSchema,
} from "../lib/validation/admin-booking";

const root = process.cwd();

test("Phase 15: unauthenticated development requests cannot receive an implicit administrator", async () => {
  const context = await readFile(`${root}/lib/auth/context.ts`, "utf8");
  const guards = await readFile(`${root}/lib/permissions/guards.ts`, "utf8");

  assert.doesNotMatch(context, /getDevelopmentAdmin\(/);
  assert.match(context, /resolveLiveAuthUser/);
  assert.match(context, /candidate\.tokenVersion < liveUser\.tokenVersion/);
  assert.match(guards, /user\.status === "SUSPENDED" \|\| user\.status === "REVOKED"/);
});

test("Phase 15: refund write payloads are strict, bounded, and use minor units", () => {
  assert.equal(
    createRefundRequestSchema.safeParse({
      bookingId: "booking_123",
      amount: 1000,
      reason: "Host cancellation",
      idempotencyKey: "refund-request-123",
    }).success,
    true,
  );
  assert.equal(createRefundRequestSchema.safeParse({ bookingId: "b", amount: 1.5, reason: "x" }).success, false);
  assert.equal(createRefundRequestSchema.safeParse({ bookingId: "b", amount: -1, reason: "x" }).success, false);
  assert.equal(createRefundRequestSchema.safeParse({ bookingId: "b", amount: 1, reason: "x", currency: "USD" }).success, false);
  assert.equal(refundApprovalSchema.safeParse({ notes: "Reviewed" }).success, true);
  assert.equal(refundRejectionSchema.safeParse({ reason: "Insufficient evidence" }).success, true);
  assert.equal(refundProcessSchema.safeParse({ idempotencyKey: "refund-process-123" }).success, true);
  assert.equal(refundProcessSchema.safeParse({ idempotencyKey: "short" }).success, false);
});

test("Phase 15: refund execution is approved, locked, and sandbox-only until a provider adapter exists", async () => {
  const refunds = await readFile(`${root}/services/refund.service.ts`, "utf8");
  const reconcileRoute = await readFile(
    `${root}/app/api/v1/admin/bookings/payments/[id]/reconcile/route.ts`,
    "utf8",
  );

  assert.match(refunds, /paymentPolicy\.paymentMode === "MOCK"/);
  assert.match(refunds, /Only an approved pending refund can be processed/);
  assert.match(refunds, /pg_advisory_xact_lock\(hashtext\(\$\{payment\.id\}\)\)/);
  assert.match(refunds, /Refund execution is unavailable until a verified payment-provider adapter is configured/);
  assert.match(reconcileRoute, /PERMISSIONS\.PAYMENTS_MANAGE/);
  assert.doesNotMatch(reconcileRoute, /PERMISSIONS\.PAYMENTS_VIEW/);
});

test("Phase 15: environment diagnostics do not print configured values", async () => {
  const checkEnv = await readFile(`${root}/scripts/check-env.js`, "utf8");

  assert.match(checkEnv, /const status = val \? '\[CONFIGURED\]'/);
  assert.doesNotMatch(checkEnv, /\? '\[CONFIGURED - SECRET\]' : val/);
});
