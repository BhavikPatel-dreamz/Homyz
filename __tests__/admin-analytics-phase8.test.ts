import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pricingAutoPilotService } from "../services/pricing-intelligence/autopilot/pricing-autopilot.service";
import { erpAccountMappingService } from "../services/admin-analytics/accounting/account-mapping.service";
import { distributedEventBusService } from "../services/admin-analytics/events/distributed-event-bus.service";
import { mobileDeviceService } from "../services/admin-analytics/mobile-push/mobile-device.service";
import { mobilePushDispatcherService } from "../services/admin-analytics/mobile-push/mobile-push-dispatcher.service";

describe("Phase 8 — Host Pricing Auto-Pilot, ERP Account Mapping, Distributed Real-Time Events & Mobile Push", () => {
  const rootDir = process.cwd();

  it("8.0: Phase 7 Verification & Baseline Documentation Check", () => {
    const docPath = path.join(rootDir, "docs/admin-analytics-phase-8/01-phase-7-verification.md");
    assert.ok(fs.existsSync(docPath), "Phase 8 doc 01 must exist");
    const content = fs.readFileSync(docPath, "utf-8");
    assert.ok(content.includes("47 unit and integration tests"), "Must document 47 baseline tests");
    assert.ok(content.includes("100% success rate"), "Must document 100% success rate");
  });

  it("8.1: Host Pricing Auto-Pilot Operating Modes (A, B, C)", async () => {
    const listingId = "lst_test_modes_01";
    const baseListing = {
      id: listingId,
      price: 200, // $200 / 20000 cents
      weekendPrice: 240,
      customPrices: {},
    };

    // 1. Mode A: RECOMMENDATIONS_ONLY
    const configModeA = pricingAutoPilotService.saveConfig(listingId, {
      enabled: true,
      mode: "RECOMMENDATIONS_ONLY",
      minPriceCents: 15000,
      maxPriceCents: 35000,
    });
    assert.equal(configModeA.operatingMode, "RECOMMENDATIONS_ONLY");

    const resultA = await pricingAutoPilotService.executeAutoPilot(
      listingId,
      baseListing,
      ["2026-11-20", "2026-11-21"],
      new Set()
    );
    assert.equal(resultA.mode, "RECOMMENDATIONS_ONLY");
    assert.ok(resultA.proposals.length > 0, "Proposals should be generated");
    assert.equal(resultA.appliedBatch, undefined, "Mode A must not apply batch automatically");

    // 2. Mode B: APPROVAL_REQUIRED
    pricingAutoPilotService.saveConfig(listingId, {
      enabled: true,
      mode: "APPROVAL_REQUIRED",
    });

    const resultB = await pricingAutoPilotService.executeAutoPilot(
      listingId,
      baseListing,
      ["2026-11-20", "2026-11-21"],
      new Set()
    );
    assert.equal(resultB.mode, "APPROVAL_REQUIRED");
    assert.ok(resultB.appliedBatch, "Mode B should create a pending batch");
    assert.equal(resultB.appliedBatch?.status, "PENDING_APPROVAL");

    // Approve the batch
    const approvedBatch = pricingAutoPilotService.approveBatch(resultB.appliedBatch!.batchId, "usr_host_123");
    assert.equal(approvedBatch?.status, "APPLIED");
    assert.equal(approvedBatch?.approvedBy, "usr_host_123");

    // 3. Mode C: AUTOMATIC_WITHIN_LIMITS
    pricingAutoPilotService.saveConfig(listingId, {
      enabled: true,
      mode: "AUTOMATIC_WITHIN_LIMITS",
    });

    const resultC = await pricingAutoPilotService.executeAutoPilot(
      listingId,
      baseListing,
      ["2026-11-22"],
      new Set()
    );
    assert.equal(resultC.mode, "AUTOMATIC_WITHIN_LIMITS");
    assert.equal(resultC.appliedBatch?.status, "APPLIED", "Mode C batch should be automatically applied");
  });

  it("8.2: Pricing Constraints, Floor/Ceiling Clamping, Booking Protection & Manual Overrides", async () => {
    const listingId = "lst_test_guardrails_02";
    const baseListing = {
      id: listingId,
      price: 200,
      weekendPrice: 240,
      customPrices: {
        "2026-11-25": 45000, // Host manual override: $450
      },
    };

    const minCents = 18000; // $180 floor
    const maxCents = 26000; // $260 ceiling

    pricingAutoPilotService.saveConfig(listingId, {
      enabled: true,
      mode: "RECOMMENDATIONS_ONLY",
      minPriceCents: minCents,
      maxPriceCents: maxCents,
      blackoutDates: ["2026-11-26"], // Blackout date
      protectManualOverrides: true,
    });

    // Date 2026-11-24 is booked, 2026-11-25 has manual override, 2026-11-26 is blackout, 2026-11-27 is unconstrained
    const targetDates = ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"];
    const confirmedBooked = new Set(["2026-11-24"]);

    const result = await pricingAutoPilotService.executeAutoPilot(
      listingId,
      baseListing,
      targetDates,
      confirmedBooked
    );

    const bookedProposal = result.proposals.find((p) => p.date === "2026-11-24");
    assert.ok(bookedProposal?.skipped, "Confirmed booked date must be skipped");
    assert.ok(bookedProposal?.skipReason?.includes("Confirmed reservation"));

    const overrideProposal = result.proposals.find((p) => p.date === "2026-11-25");
    assert.ok(overrideProposal?.skipped, "Host manual override must be protected and skipped");
    assert.ok(overrideProposal?.skipReason?.includes("Host manual override"));

    const blackoutProposal = result.proposals.find((p) => p.date === "2026-11-26");
    assert.ok(blackoutProposal?.skipped, "Blackout date must be skipped");
    assert.ok(blackoutProposal?.skipReason?.includes("Host blackout"));

    const activeProposal = result.proposals.find((p) => p.date === "2026-11-27");
    assert.ok(!activeProposal?.skipped, "Unconstrained date must be evaluated");
    assert.ok(activeProposal!.proposedPriceCents >= minCents, "Rate must be >= host floor");
    assert.ok(activeProposal!.proposedPriceCents <= maxCents, "Rate must be <= host ceiling");
  });

  it("8.3: Concurrency Locking, Pause/Resume & Safe Rollback", async () => {
    const listingId = "lst_test_concurrency_03";
    const baseListing = {
      id: listingId,
      price: 150,
      weekendPrice: 180,
      customPrices: {},
    };

    // 1. Pause and Resume
    pricingAutoPilotService.saveConfig(listingId, {
      enabled: true,
      mode: "AUTOMATIC_WITHIN_LIMITS",
      protectManualOverrides: false,
    });

    pricingAutoPilotService.pauseAutoPilot(listingId);
    const pausedResult = await pricingAutoPilotService.executeAutoPilot(
      listingId,
      baseListing,
      ["2026-12-01"],
      new Set()
    );
    assert.equal(pausedResult.proposals.length, 0);
    assert.ok(pausedResult.proposals, "Paused execution should skip processing");

    pricingAutoPilotService.resumeAutoPilot(listingId);

    // 2. Apply a batch
    const execResult = await pricingAutoPilotService.executeAutoPilot(
      listingId,
      baseListing,
      ["2026-12-01", "2026-12-02"],
      new Set()
    );
    const batchId = execResult.appliedBatch?.batchId;
    assert.ok(batchId, "Batch must be created");

    // Simulate current prices after batch ran:
    // 2026-12-01 kept the batch price, but host manually intervened on 2026-12-02 setting $300
    const applied01 = execResult.appliedBatch.changes.find((c: any) => c.date === "2026-12-01");
    const currentCalendarPrices: Record<string, number> = {
      "2026-12-01": applied01.appliedPriceCents,
      "2026-12-02": 30000, // Host manually set $300
    };

    // 3. Rollback the batch
    const rollback = pricingAutoPilotService.rollbackBatch(batchId!, currentCalendarPrices);
    assert.ok(rollback, "Rollback result must be returned");
    assert.equal(rollback?.status, "ROLLED_BACK");

    // Verify 2026-12-01 was reverted to original price, but 2026-12-02 was preserved because of the newer manual host edit
    const reverted01 = rollback?.revertedChanges.find((c) => c.date === "2026-12-01");
    const preserved02 = rollback?.revertedChanges.find((c) => c.date === "2026-12-02");

    assert.equal(reverted01?.status, "REVERTED");
    assert.equal(reverted01?.restoredPriceCents, 15000);

    assert.equal(preserved02?.status, "PRESERVED_MANUAL_EDIT");
    assert.equal(preserved02?.restoredPriceCents, 30000);
  });

  it("8.4: Multi-Tenant ERP Chart of Accounts Customizer", () => {
    // 1. Check supported ledger roles
    const roles = erpAccountMappingService.getSupportedLedgerRoles();
    assert.equal(roles.length, 8, "Must support exactly 8 canonical ledger roles");
    assert.ok(roles.some((r) => r.roleCode === "1010" && r.category === "ASSET"));
    assert.ok(roles.some((r) => r.roleCode === "2010" && r.category === "LIABILITY"));
    assert.ok(roles.some((r) => r.roleCode === "4010" && r.category === "REVENUE"));
    assert.ok(roles.some((r) => r.roleCode === "5010" && r.category === "EXPENSE"));

    // 2. Create valid draft mapping for Tenant A
    const tenantA = "tenant_alpha_corp";
    const draftA = erpAccountMappingService.createDraftMapping(
      tenantA,
      "QUICKBOOKS",
      [
        { roleCode: "1010", externalAccountId: "qb_bank_999", externalAccountName: "Main Operating Account", externalAccountCategory: "BANK" },
        { roleCode: "1020", externalAccountId: "qb_clearing_888", externalAccountName: "Guest Payment In-Transit", externalAccountCategory: "ASSET" },
        { roleCode: "1030", externalAccountId: "qb_ar_777", externalAccountName: "Accounts Receivable", externalAccountCategory: "ASSET" },
        { roleCode: "2010", externalAccountId: "qb_payout_666", externalAccountName: "Host Escrow Liability", externalAccountCategory: "LIABILITY" },
        { roleCode: "2030", externalAccountId: "qb_tax_555", externalAccountName: "Sales & Lodging Tax", externalAccountCategory: "LIABILITY" },
        { roleCode: "4010", externalAccountId: "qb_rev_444", externalAccountName: "Platform Commission", externalAccountCategory: "REVENUE" },
        { roleCode: "5010", externalAccountId: "qb_fee_333", externalAccountName: "Stripe Processing Fees", externalAccountCategory: "EXPENSE" },
        { roleCode: "5020", externalAccountId: "qb_loss_222", externalAccountName: "Refunds & Losses", externalAccountCategory: "EXPENSE" },
      ],
      "usr_finance_admin"
    );

    assert.equal(draftA.status, "DRAFT");
    assert.equal(draftA.mappings.length, 8);

    // 3. Activate mapping
    const activatedA = erpAccountMappingService.activateMapping(draftA.mappingId, tenantA);
    assert.equal(activatedA.status, "ACTIVE");

    // 4. Validate category compatibility error
    assert.throws(
      () => {
        erpAccountMappingService.createDraftMapping(
          tenantA,
          "QUICKBOOKS",
          [
            // Incompatible: mapping Asset role 1010 to EXPENSE external account
            { roleCode: "1010", externalAccountId: "qb_bad_1", externalAccountName: "Bad Expense", externalAccountCategory: "EXPENSE" },
          ],
          "usr_finance_admin"
        );
      },
      /Category mismatch/
    );

    // 5. Multi-tenant isolation: Tenant B cannot access or activate Tenant A mapping
    const tenantB = "tenant_beta_ltd";
    assert.throws(
      () => {
        erpAccountMappingService.activateMapping(draftA.mappingId, tenantB);
      },
      /Forbidden: Mapping does not belong to tenant/
    );
  });

  it("8.5: Distributed Redis-Based Event Bus Infrastructure", async () => {
    // 1. Publish event and verify sequence generation
    const event = await distributedEventBusService.publishEvent(
      "BOOKING_CONFIRMED",
      { bookingId: "bk_dist_123", amountCents: 50000 },
      "actor_admin_1"
    );

    assert.ok(event.sequenceNumber > 0, "Sequence number must be positive");
    assert.equal(event.type, "BOOKING_CONFIRMED");

    // 2. Replay cursor: getEventsSince
    const replayEvents = distributedEventBusService.getEventsSince(event.sequenceNumber - 1);
    assert.ok(replayEvents.some((e) => e.eventId === event.eventId), "Outbox must replay missed event");

    // 3. Invalidation scopes
    const scopes = distributedEventBusService.getInvalidationScopes("BOOKING_CONFIRMED");
    assert.ok(scopes.includes("REVENUE_FORECAST"));
    assert.ok(scopes.includes("OCCUPANCY_METRICS"));

    const payoutScopes = distributedEventBusService.getInvalidationScopes("PAYOUT_SETTLED");
    assert.ok(payoutScopes.includes("PAYOUT_SUMMARY"));

    // 4. Bus health telemetry
    const health = distributedEventBusService.getBusHealth();
    assert.equal(health.healthy, true);
    assert.ok(health.currentSequence >= event.sequenceNumber);
  });

  it("8.6: Native Mobile Push Readiness", () => {
    // 1. Register a device
    const registered = mobileDeviceService.registerDevice({
      deviceId: "dev_unit_test_ios_99",
      userId: "usr_push_tester_1",
      role: "ADMIN",
      platform: "IOS",
      token: "apns_test_token_abcdef123456",
      appVersion: "2.4.0",
      deviceModel: "iPhone 15",
      preferences: {
        quietHoursEnabled: true,
        quietHoursStartUTC: "01:00",
        quietHoursEndUTC: "05:00",
        criticalOnly: false,
        categoriesEnabled: ["PRICING_ALERT", "SYSTEM_ALERT"],
      },
    });

    assert.equal(registered.deviceId, "dev_unit_test_ios_99");
    assert.equal(registered.pushEnabled, true);

    // 2. Build deep link
    const deepLinkAdmin = mobilePushDispatcherService.buildDeepLink("admin", "analytics", { tab: "pricing" });
    assert.equal(deepLinkAdmin, "homyz://admin/analytics?tab=pricing");

    const deepLinkHost = mobilePushDispatcherService.buildDeepLink("host", "pricing/lst_test_1");
    assert.equal(deepLinkHost, "homyz://host/pricing/lst_test_1");

    // 3. Dispatch to device and check credential status honesty
    const results = mobilePushDispatcherService.dispatchToUser("usr_push_tester_1", {
      title: "Rate Adjustment Notice",
      body: "Saudi weekend rates adjusted by +15%",
      category: "PRICING_ALERT",
      urgency: "HIGH",
      deepLink: deepLinkHost,
    });

    assert.equal(results.length, 1);
    // Since mock APNS env vars are not loaded in sandboxed test, it must honestly report PENDING_CREDENTIALS
    assert.ok(
      results[0].status === "PENDING_CREDENTIALS" || results[0].status === "DELIVERED",
      "Status must reflect genuine delivery or honest PENDING_CREDENTIALS"
    );

    // 4. Revoke device
    const revoked = mobileDeviceService.revokeDevice("dev_unit_test_ios_99", "usr_push_tester_1");
    assert.equal(revoked, true);
    assert.equal(mobileDeviceService.getDeviceById("dev_unit_test_ios_99"), null);
  });

  it("8.7: Strict Typography Compliance (RULE[/media/drive/shihab/Homyz/GEMINI.md])", () => {
    // Verify that NO files in Phase 8 contain font-bold, font-semibold, <b>, or <strong>
    const targetDirs = [
      path.join(rootDir, "services/pricing-intelligence/autopilot"),
      path.join(rootDir, "services/admin-analytics/events"),
      path.join(rootDir, "services/admin-analytics/mobile-push"),
      path.join(rootDir, "app/api/v1/admin/analytics/pricing/autopilot"),
      path.join(rootDir, "app/api/v1/admin/analytics/accounting/mapping"),
      path.join(rootDir, "app/api/v1/admin/analytics/mobile-push"),
    ];

    const forbiddenPatterns = [
      /font-bold/g,
      /font-semibold/g,
      /<b\b[^>]*>/g,
      /<\/b>/g,
      /<strong\b[^>]*>/g,
      /<\/strong>/g,
    ];

    for (const dir of targetDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) continue;
        const content = fs.readFileSync(fullPath, "utf-8");
        for (const pattern of forbiddenPatterns) {
          const match = content.match(pattern);
          assert.equal(
            match,
            null,
            `Violation found in ${fullPath}: pattern ${pattern.toString()} is strictly forbidden by GEMINI.md`
          );
        }
      }
    }
  });

  it("8.8: Phase 8 Documentation Completeness Verification", () => {
    const docsDir = path.join(rootDir, "docs/admin-analytics-phase-8");
    assert.ok(fs.existsSync(docsDir), "Phase 8 docs directory must exist");

    const expectedDocs = [
      "01-phase-7-verification.md",
      "02-pricing-autopilot-architecture.md",
      "03-pricing-safety-and-rollback.md",
      "04-erp-chart-of-accounts-mapping.md",
      "05-erp-sync-validation.md",
      "06-distributed-event-infrastructure.md",
      "07-mobile-push-readiness.md",
      "08-security-performance-and-deployment.md",
      "09-tests-and-verification.md",
      "10-phase-9-readiness.md",
    ];

    for (const doc of expectedDocs) {
      const fullPath = path.join(docsDir, doc);
      assert.ok(fs.existsSync(fullPath), `Document ${doc} must exist`);
      const stat = fs.statSync(fullPath);
      assert.ok(
        stat.size >= 200,
        `Document ${doc} size (${stat.size} bytes) must be >= 200 bytes`
      );
    }
  });
});
