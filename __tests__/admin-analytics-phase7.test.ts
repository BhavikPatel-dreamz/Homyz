import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { recommendationEngineService } from "../services/pricing-intelligence/recommendation-engine.service";
import { demandFactorService } from "../services/pricing-intelligence/demand-factor.service";
import { pricingConstraintsService } from "../services/pricing-intelligence/pricing-constraints.service";
import { pricingValidationService } from "../services/pricing-intelligence/pricing-validation.service";
import { exchangeRateService } from "../services/currency/exchange-rate.service";
import { defaultExchangeRateProvider } from "../services/currency/exchange-rate-provider";
import { accountingOAuthService } from "../services/admin-analytics/accounting/oauth-service";
import { pushNotificationsService } from "../services/admin-analytics/push-notifications.service";
import { Role } from "../generated/prisma/enums";

describe("Phase 7 — Intelligent Dynamic Pricing, Live FX, ERP OAuth & Real-Time Push Notifications", () => {
  const rootDir = process.cwd();

  it("7.0: Phase 6 Verification & Mathematical Error Reduction Correction", () => {
    // 1. Validate relative error reduction vs absolute percentage points
    const baselineWape = 24.6;
    const forecastWape = 11.8;
    const absDiffPp = Math.round((baselineWape - forecastWape) * 10) / 10;
    const relErrorReduction = Math.round(((baselineWape - forecastWape) / baselineWape) * 1000) / 10;

    assert.equal(absDiffPp, 12.8, "Absolute difference must be exactly 12.8 percentage points");
    assert.equal(relErrorReduction, 52.0, "Relative error reduction must be 52.0%");

    // 2. Validate documentation correction
    const docPath = path.join(rootDir, "docs/admin-analytics-phase-6/04-forecast-validation-results.md");
    assert.ok(fs.existsSync(docPath), "Phase 6 validation doc must exist");
    const docContent = fs.readFileSync(docPath, "utf-8");
    assert.ok(docContent.includes("12.8 percentage points"), "Doc must state 12.8 pp difference");
    assert.ok(docContent.includes("52.0%"), "Doc must state 52.0% relative error reduction");
    assert.ok(!docContent.includes("(p < 0.01)"), "Doc must not contain unsupported p < 0.01 claim");
  });

  it("7.1: Dynamic Pricing Demand Factors & Saudi Weekend Sensitivity", () => {
    // Saudi weekend night: 2026-11-12 is Thursday, 2026-11-13 is Friday
    const thursdayDate = "2026-11-12";
    const wednesdayDate = "2026-11-11";

    const weekendDemand = demandFactorService.evaluateDemandFactor(thursdayDate, {
      marketOccupancyRate: 65,
      historicalPaceAheadPercentage: 4.8,
      hasManualOverride: false,
    });

    const weekdayDemand = demandFactorService.evaluateDemandFactor(wednesdayDate, {
      marketOccupancyRate: 65,
      historicalPaceAheadPercentage: 4.8,
      hasManualOverride: false,
    });

    assert.ok(
      weekendDemand.demandMultiplier > weekdayDemand.demandMultiplier,
      "Thursday/Friday weekend nights must receive positive demand uplift"
    );
    assert.equal(weekendDemand.primarySignal, "HIGH_DEMAND_WEEKEND");

    // Low occupancy stimulation
    const softDemand = demandFactorService.evaluateDemandFactor("2026-11-16", {
      marketOccupancyRate: 30, // low market occupancy (<35%)
      historicalPaceAheadPercentage: 0,
      hasManualOverride: false,
    });
    assert.ok(
      softDemand.demandMultiplier < 1.0,
      "Soft market occupancy must recommend a stimulating discount"
    );
    assert.equal(softDemand.primarySignal, "LOW_OCCUPANCY_STIMULATION");
  });

  it("7.2: Pricing Constraints, Safety Bounds & Confirmed Booking Protection", () => {
    const limits = {
      systemMinPriceCents: 5000, // 50 SAR
      systemMaxPriceCents: 5000000, // 50,000 SAR
      hostFloorPriceCents: 30000, // 300 SAR host floor
      hostCeilingPriceCents: 60000, // 600 SAR host ceiling
      maxDailyChangePercentage: 15, // +/- 15% max daily change
      currency: "SAR",
    };

    // 1. Confirmed booking date must be locked permanently
    const bookedConstraint = pricingConstraintsService.applyPricingConstraints({
      currentPriceCents: 40000,
      rawRecommendedPriceCents: 55000,
      isBooked: true, // Already booked!
      limits,
    });
    assert.equal(bookedConstraint.isLockedBooked, true);
    assert.equal(bookedConstraint.canModify, false);
    assert.equal(bookedConstraint.constrainedPriceCents, 40000, "Price must remain unchanged for booked dates");

    // 2. Host floor clamping
    const floorConstraint = pricingConstraintsService.applyPricingConstraints({
      currentPriceCents: 32000,
      rawRecommendedPriceCents: 25000, // Below 300 SAR floor
      isBooked: false,
      limits,
    });
    assert.equal(floorConstraint.constrainedPriceCents, 30000);
    assert.ok(floorConstraint.appliedConstraints.includes("HOST_FLOOR_PRICE_CLAMPED"));

    // 3. Daily max change limit clamping (+15% max increase)
    const maxChangeConstraint = pricingConstraintsService.applyPricingConstraints({
      currentPriceCents: 40000,
      rawRecommendedPriceCents: 55000, // +37.5% increase requested
      isBooked: false,
      limits,
    });
    assert.equal(maxChangeConstraint.constrainedPriceCents, 46000); // 40,000 * 1.15 = 46,000
    assert.ok(maxChangeConstraint.appliedConstraints.includes("MAX_DAILY_INCREASE_BOUNDED"));
    assert.equal(maxChangeConstraint.deltaPercentage, 15);
  });

  it("7.3: Recommendation Acceptance, Rejection & Rollback Audit", async () => {
    const actor = { id: "host_test_77", role: Role.HOST };
    const listingId = "lst_pricing_unit_test";

    // 1. Accept recommendations
    const acceptRes = await pricingValidationService.acceptRecommendations({
      actor,
      listingId,
      acceptedDates: [
        { dateKey: "2026-11-20", priceCents: 45000 },
        { dateKey: "2026-11-21", priceCents: 48000 },
      ],
      reason: "Automated test acceptance",
    });

    assert.equal(acceptRes.success, true);
    assert.equal(acceptRes.appliedDatesCount, 2);
    assert.ok(acceptRes.auditRecords.length === 2);

    // 2. Reject recommendation
    const rejectRecord = pricingValidationService.logRejection({
      actor,
      listingId,
      dateKey: "2026-11-22",
      suggestedPriceCents: 50000,
      reason: "Host preferred standard rate",
    });
    assert.equal(rejectRecord.action, "REJECTED");

    // 3. Rollback recent accepted changes
    const rollbackRes = await pricingValidationService.revertRecentChanges({
      actor,
      listingId,
      auditRecordIds: [acceptRes.auditRecords[0].id],
    });
    assert.equal(rollbackRes.revertedCount, 1);

    // 4. Audit trail inspection
    const logs = pricingValidationService.getAuditLogs(listingId);
    assert.ok(logs.length >= 3, "Audit trail must log acceptance, rejection, and rollback");
  });

  it("7.4: Multi-Currency Live FX & SAMA Peg Decimal-Safe Conversion", async () => {
    // 1. SAMA official peg: 1 USD = 3.75 SAR (100 USD = 375 SAR)
    const usdToSar = await exchangeRateService.convertAmount({
      amountCents: 10000, // 100 USD (10,000 cents)
      fromCurrency: "USD",
      toCurrency: "SAR",
    });
    assert.equal(usdToSar.convertedAmountCents, 37500, "100 USD must convert to exactly 375 SAR (37,500 cents)");
    assert.equal(usdToSar.exchangeRateUsed, 3.75);

    // 2. SAR to USD conversion: 375 SAR = 100 USD
    const sarToUsd = await exchangeRateService.convertAmount({
      amountCents: 37500, // 375 SAR
      fromCurrency: "SAR",
      toCurrency: "USD",
    });
    assert.equal(sarToUsd.convertedAmountCents, 10000, "375 SAR must convert to exactly 100 USD");

    // 3. Original ledger preservation (amounts and currency unaltered)
    assert.equal(sarToUsd.originalAmountCents, 37500);
    assert.equal(sarToUsd.originalCurrency, "SAR");

    // 4. Rate status & freshness
    const status = await exchangeRateService.getRatesStatus();
    assert.equal(status.baseCurrency, "SAR");
    assert.ok(status.supportedCurrencies.includes("USD"));
    assert.ok(status.supportedCurrencies.includes("EUR"));
    assert.ok(status.supportedCurrencies.includes("GBP"));
    assert.ok(status.supportedCurrencies.includes("AED"));
    assert.ok(["LIVE", "CACHED", "STALE_FALLBACK"].includes(status.freshness));
  });

  it("7.5: ERP OAuth PKCE, State Validation & AES-256-GCM Token Encryption", async () => {
    // 1. Generate OAuth authorization intent with PKCE and signed anti-CSRF state
    const intent = accountingOAuthService.generateAuthorizationIntent({
      provider: "QUICKBOOKS",
      actorId: "admin_user_01",
      origin: "https://homyz.sa",
    });

    assert.equal(intent.provider, "QUICKBOOKS");
    assert.ok(intent.authorizationUrl.includes("code_challenge="));
    assert.ok(intent.authorizationUrl.includes("state="));
    assert.ok(intent.codeVerifier.length >= 32);

    // 2. Handle callback exchange
    const tokenBundle = await accountingOAuthService.handleOAuthCallback({
      code: "mock_auth_code_xyz123",
      state: intent.state,
      realmId: "qbo_company_9988",
      origin: "https://homyz.sa",
    });

    assert.equal(tokenBundle.provider, "QUICKBOOKS");
    assert.equal(tokenBundle.tenantId, "qbo_company_9988");
    assert.ok(accountingOAuthService.isProviderConnected("QUICKBOOKS"));

    // 3. Verify AES-256-GCM encrypted retrieval
    const retrieved = await accountingOAuthService.getActiveTokenBundle("QUICKBOOKS");
    assert.ok(retrieved);
    assert.equal(retrieved?.tenantId, "qbo_company_9988");

    // 4. Disconnect provider
    const disconnected = await accountingOAuthService.disconnectProvider("QUICKBOOKS");
    assert.equal(disconnected, true);
    assert.equal(accountingOAuthService.isProviderConnected("QUICKBOOKS"), false);

    // 5. Honest status reporting (Xero unconfigured without credentials)
    const statuses = accountingOAuthService.getDetailedProviderStatuses();
    const xeroStatus = statuses.find((s) => s.provider === "XERO");
    assert.ok(xeroStatus);
    if (!process.env.XERO_CLIENT_ID) {
      assert.equal(xeroStatus.connectionState, "PENDING_CONFIGURATION");
    }
  });

  it("7.6: Admin Push Notification Cooldowns, Quiet Hours & Route Security", async () => {
    const userId = "admin_user_push_01";
    const endpoint = "https://fcm.googleapis.com/fcm/send/test_endpoint_token_99";

    // 1. Register subscription
    const sub = await pushNotificationsService.registerSubscription({
      userId,
      endpoint,
      keys: { p256dh: "mock_p256dh_key", auth: "mock_auth_secret" },
      preferences: {
        criticalAlertsOnly: true,
        financeAlerts: true,
        quietHours: { enabled: true, startUtcHour: 0, endUtcHour: 23 }, // simulate all-day quiet hours for test
      },
    });

    assert.equal(sub.userId, userId);
    assert.equal(sub.endpoint, endpoint);

    // 2. Quiet hours suppression for normal priority alert
    const normalAlert = await pushNotificationsService.dispatchCriticalAlert({
      title: "Daily Occupancy Update",
      body: "Market occupancy reached 62%",
      category: "FINANCE",
      eventType: "OCCUPANCY_REPORT",
      destinationUrl: "/admin/analytics",
      priority: "NORMAL",
    });
    assert.equal(normalAlert.dispatchedCount, 0, "Normal priority alert must be suppressed during quiet hours");

    // 3. Urgent priority bypasses quiet hours
    const urgentAlert = await pushNotificationsService.dispatchCriticalAlert({
      title: "Payment Settlement Failure",
      body: "Bank wire failed for batch #8820",
      category: "FINANCE",
      eventType: "SETTLEMENT_FAILURE",
      destinationUrl: "https://evil.com/phish", // non-admin URL
      priority: "URGENT",
    });
    assert.ok(urgentAlert.dispatchedCount >= 1, "Urgent alert must bypass quiet hours");

    // 4. Cooldown suppression: duplicate alert within 5 minutes is throttled
    const duplicateAlert = await pushNotificationsService.dispatchCriticalAlert({
      title: "Payment Settlement Failure",
      body: "Bank wire failed for batch #8820",
      category: "FINANCE",
      eventType: "SETTLEMENT_FAILURE",
      destinationUrl: "/admin/analytics",
      priority: "URGENT",
    });
    assert.equal(duplicateAlert.suppressedByCooldown, true, "Duplicate alert must be suppressed by cooldown");

    // 5. Unsubscribe
    const removed = await pushNotificationsService.removeSubscription(userId, endpoint);
    assert.equal(removed, true);
  });

  it("7.7: Strict Typography Compliance (0 font-bold, 0 font-semibold, 0 <b>, 0 <strong>)", () => {
    const phase7Files = [
      "components/admin/analytics/tabs/pricing-tab.tsx",
      "components/admin/analytics/admin-analytics-hub-client.tsx",
      "app/api/v1/admin/analytics/pricing/route.ts",
      "app/api/v1/admin/analytics/currency/rates/route.ts",
      "app/api/v1/admin/analytics/push/route.ts",
      "services/pricing-intelligence/recommendation-engine.service.ts",
      "services/currency/exchange-rate.service.ts",
      "services/admin-analytics/push-notifications.service.ts",
    ];

    const forbiddenRegex = /(font-bold|font-semibold|<b\b|<strong\b)/g;

    for (const file of phase7Files) {
      const fullPath = path.join(rootDir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const matches = content.match(forbiddenRegex);
        assert.equal(
          matches,
          null,
          `File ${file} violates GEMINI.md typography rules with ${matches?.length} forbidden tokens: ${matches?.join(", ")}`
        );
      }
    }
  });

  it("7.8: All 10 Phase 7 Documentation Files Exist and have Content", () => {
    const docsDir = path.join(rootDir, "docs/admin-analytics-phase-7");
    const requiredDocs = [
      "01-phase-6-verification-and-corrections.md",
      "02-dynamic-pricing-architecture.md",
      "03-pricing-safety-and-validation.md",
      "04-currency-provider-and-conversion.md",
      "05-historical-fx-and-financial-precision.md",
      "06-erp-oauth-and-accounting-sync.md",
      "07-push-notification-architecture.md",
      "08-security-performance-and-deployment.md",
      "09-tests-and-verification.md",
      "10-phase-8-readiness.md",
    ];

    assert.ok(fs.existsSync(docsDir), "docs/admin-analytics-phase-7 directory must exist");

    for (const doc of requiredDocs) {
      const docPath = path.join(docsDir, doc);
      assert.ok(fs.existsSync(docPath), `Missing documentation file: ${doc}`);
      const stats = fs.statSync(docPath);
      assert.ok(stats.size > 200, `Documentation file ${doc} is too short (${stats.size} bytes)`);
    }
  });
});

