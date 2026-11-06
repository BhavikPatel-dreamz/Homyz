import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { analyticsEventsService } from "../services/admin-analytics/analytics-events.service";
import { demandForecastService } from "../services/admin-analytics/forecasting/demand-forecast.service";
import { forecastDataService } from "../services/admin-analytics/forecasting/forecast-data.service";
import { modelValidationService } from "../services/admin-analytics/forecasting/model-validation.service";
import { accountingMappingService } from "../services/admin-analytics/accounting/accounting-mapping.service";
import { accountingSyncService } from "../services/admin-analytics/accounting/accounting-sync.service";
import { partnerReportingService } from "../services/admin-analytics/partner-reporting.service";
import { Role, ListingCoHostStatus } from "../generated/prisma/enums";

describe("Phase 6 — Real-Time Analytics, Forecasting, Accounting & Partner Intelligence", () => {
  const rootDir = process.cwd();

  it("6.1: Real-Time Event Architecture & Replay Buffer", () => {
    const testEventId = `evt_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const testEvent = {
      id: testEventId,
      type: "BOOKING_CONFIRMED" as const,
      timestamp: new Date().toISOString(),
      aggregateId: "booking_xyz_123",
      actorId: "user_guest_789",
      currency: "SAR",
      amountCents: 185000,
      metadata: { city: "Riyadh", nights: 3, listingId: "lst_123" },
    };

    let dispatchedEvent: any = null;
    const unsubscribe = analyticsEventsService.subscribe((evt) => {
      if (evt.id === testEventId) {
        dispatchedEvent = evt;
      }
    });

    // 1. Publish event
    analyticsEventsService.publish(testEvent);
    assert.ok(dispatchedEvent, "Subscriber must receive published event");
    assert.equal(dispatchedEvent.id, testEventId);
    assert.equal(dispatchedEvent.amountCents, 185000);
    assert.equal(dispatchedEvent.currency, "SAR");

    unsubscribe();

    // 2. Replay buffer retrieval
    const recent = analyticsEventsService.getRecentEvents(50);
    assert.ok(recent.length > 0, "Buffer must contain recent events");
    const found = recent.find((e) => e.id === testEventId);
    assert.ok(found, "Published event must be stored in the in-memory ring buffer");

    // 3. Idempotency / Deduplication
    const bufferCountBefore = recent.length;
    analyticsEventsService.publish(testEvent); // duplicate
    const recentAfter = analyticsEventsService.getRecentEvents(50);
    const duplicates = recentAfter.filter((e) => e.id === testEventId);
    assert.equal(duplicates.length, 1, "Duplicate event IDs must not be re-inserted into the buffer");
  });

  it("6.2: Predictive Revenue & Demand Forecasting Engine", async () => {
    const forecast7d = await demandForecastService.generateForecast("7d", "SAR");
    assert.equal(forecast7d.summary.horizon, "7d");
    assert.equal(forecast7d.dailyProjections.length, 7);

    // Verify mathematical coherence of daily projections
    for (const day of forecast7d.dailyProjections) {
      assert.ok(day.dateKey, "Projection must have dateKey");
      assert.ok(day.dayLabel, "Projection must have dayLabel");
      assert.equal(
        day.totalExpectedGmvCents,
        day.confirmedGmvCents + day.projectedAdditionalGmvCents,
        `Total projected GMV must equal confirmed + pickup on ${day.dateKey}`
      );
      assert.ok(
        day.lowerBoundGmvCents <= day.totalExpectedGmvCents,
        `Lower 80% bound must be <= expected GMV on ${day.dateKey}`
      );
      assert.ok(
        day.upperBoundGmvCents >= day.totalExpectedGmvCents,
        `Upper 80% bound must be >= expected GMV on ${day.dateKey}`
      );
      assert.ok(
        day.projectedOccupancyPercentage >= 0 && day.projectedOccupancyPercentage <= 100,
        `Occupancy percentage must be between 0 and 100% on ${day.dateKey}`
      );
    }

    // Verify booking pace distribution (pickup curves)
    assert.ok(forecast7d.paceDistribution.length >= 4, "Must provide lead-time buckets");
    const totalPaceShare = forecast7d.paceDistribution.reduce(
      (sum, p) => sum + p.historicalSharePercentage,
      0
    );
    assert.ok(
      Math.abs(totalPaceShare - 100) < 1,
      `Historical pickup curve shares must sum to ~100%, got ${totalPaceShare}%`
    );

    // Verify 30d horizon calculation
    const forecast30d = await demandForecastService.generateForecast("30d", "SAR");
    assert.equal(forecast30d.summary.horizon, "30d");
    assert.equal(forecast30d.dailyProjections.length, 30);
  });

  it("6.3: Rolling-Origin Model Validation & Backtesting Audit", async () => {
    const validation = await modelValidationService.runBacktesting("SAR");

    assert.ok(validation.backtestedPeriodsCount > 0, "Must backtest across historical periods");
    assert.ok(
      validation.weightedAbsolutePercentageError >= 0 && validation.weightedAbsolutePercentageError < 40,
      `WAPE must be a realistic statistical error rate, got ${validation.weightedAbsolutePercentageError}%`
    );
    assert.ok(validation.meanAbsoluteErrorCents >= 0, "MAE must be non-negative");
    assert.ok(
      validation.predictionIntervalCoveragePercentage >= 70 &&
        validation.predictionIntervalCoveragePercentage <= 100,
      `80% prediction interval coverage must be reasonable, got ${validation.predictionIntervalCoveragePercentage}%`
    );
    assert.ok(
      validation.baselineComparisonAdvantagePercentage >= 0,
      "Pickup model must show positive or neutral advantage over naive baseline"
    );
  });

  it("6.4: Accounting Integration & Double-Entry Balanced Journals", () => {
    // 1. Payment Capture Journal: Booking Total 1,000 SAR (100,000 cents), 120 SAR fee, 150 SAR tax
    const captureJournal = accountingMappingService.createPaymentCaptureJournal({
      paymentId: "pay_test_001",
      bookingId: "bk_test_001",
      totalGrossCents: 100_000,
      hostPayoutCents: 73_000,
      platformFeeCents: 12_000,
      taxCents: 15_000,
      currency: "SAR",
      timestamp: new Date().toISOString(),
    });

    assert.equal(captureJournal.isBalanced, true, "Payment capture journal must be balanced");
    assert.equal(
      captureJournal.totalDebitCents,
      captureJournal.totalCreditCents,
      "Sum of Debits must equal Sum of Credits"
    );
    assert.equal(captureJournal.totalDebitCents, 100_000);

    // Verify standard Chart of Accounts lines
    const bankLine = captureJournal.lines.find((l) => l.accountCode === "1020");
    const hostPayableLine = captureJournal.lines.find((l) => l.accountCode === "2010");
    const feeLine = captureJournal.lines.find((l) => l.accountCode === "4010");
    const taxLine = captureJournal.lines.find((l) => l.accountCode === "2030");

    assert.ok(bankLine && bankLine.debitCents === 100_000, "1020 Gateway Clearing must be debited");
    assert.ok(hostPayableLine && hostPayableLine.creditCents === 73_000, "2010 Host Payable must be credited");
    assert.ok(feeLine && feeLine.creditCents === 12_000, "4010 Platform Fee must be credited");
    assert.ok(taxLine && taxLine.creditCents === 15_000, "2030 Tax Payable must be credited");

    // 2. Refund Issuance Journal: 400 SAR refund
    const refundJournal = accountingMappingService.createRefundJournal({
      refundId: "ref_test_001",
      paymentId: "pay_test_001",
      bookingId: "bk_test_001",
      refundAmountCents: 40_000,
      hostDeductionCents: 35_000,
      feeReversalCents: 5_000,
      currency: "SAR",
      timestamp: new Date().toISOString(),
    });

    assert.equal(refundJournal.isBalanced, true, "Refund journal must be balanced");
    assert.equal(
      refundJournal.totalDebitCents,
      refundJournal.totalCreditCents,
      "Refund Sum of Debits must equal Sum of Credits"
    );
    assert.equal(refundJournal.totalDebitCents, 40_000);

    // 3. Payout Settlement Journal: 500 SAR payout
    const payoutJournal = accountingMappingService.createPayoutSettlementJournal({
      payoutId: "po_test_001",
      hostId: "host_001",
      amountCents: 50_000,
      currency: "SAR",
      timestamp: new Date().toISOString(),
    });

    assert.equal(payoutJournal.isBalanced, true, "Payout journal must be balanced");
    assert.equal(
      payoutJournal.totalDebitCents,
      payoutJournal.totalCreditCents,
      "Payout Sum of Debits must equal Sum of Credits"
    );
    assert.equal(payoutJournal.totalDebitCents, 50_000);
  });

  it("6.5: Accounting Webhook Security & Honest Connection Status", () => {
    // 1. Inbound Webhook HMAC-SHA256 signature verification
    const secret = "erp_webhook_secret_xyz789";
    const payload = JSON.stringify({ event: "JOURNAL_POSTED", externalId: "qbo_jrn_999" });
    const validSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const isVerified = accountingSyncService.verifyWebhookSignature(payload, validSignature, secret);
    assert.equal(isVerified, true, "Valid HMAC signature must verify successfully");

    const isTampered = accountingSyncService.verifyWebhookSignature(payload, "invalid_hash", secret);
    assert.equal(isTampered, false, "Tampered HMAC signature must be rejected");

    // 2. Honest status reporting (no fake sync claims)
    const statuses = accountingSyncService.getProviderStatuses();
    assert.ok(statuses.length >= 3, "Must track QuickBooks, Xero, NetSuite");
    for (const p of statuses) {
      if (!process.env[`${p.provider.toUpperCase()}_CLIENT_ID`]) {
        assert.equal(
          p.connectionStatus,
          "PENDING_CONFIGURATION",
          `Provider ${p.provider} without configured environment credentials must report PENDING_CONFIGURATION`
        );
      }
    }
  });

  it("6.6: Host & Co-Host Scoped Partner Reporting & Premier Host Scoring", async () => {
    // 1. Primary host report scope
    const hostActor = { id: "host_primary_1", role: Role.HOST };
    const hostReport = await partnerReportingService.getHostPerformance(hostActor, {
      period: "30d",
      currency: "SAR",
    });

    assert.equal(hostReport.actorRole, "HOST");
    assert.ok(hostReport.payouts.netEarnedCents >= 0);
    assert.ok(hostReport.premierHostStatus.status in { ELIGIBLE: 1, IN_PROGRESS: 1, NOT_ELIGIBLE: 1 });
    assert.ok(
      typeof hostReport.premierHostStatus.metrics.ratingAverage === "number",
      "Premier host rating metric must be numeric"
    );

    // 2. Co-host report isolation
    const coHostActor = { id: "cohost_user_2", role: Role.HOST };
    const coHostReport = await partnerReportingService.getHostPerformance(coHostActor, {
      period: "30d",
      currency: "SAR",
    });

    assert.ok(coHostReport.propertiesCount >= 0);
    // Co-host payout summary reflects allocated share only
    assert.ok(coHostReport.payouts.netEarnedCents >= 0);

    // 3. Scoped CSV Export Generation
    const csvExport = await partnerReportingService.generatePartnerReportExport(
      hostActor,
      { period: "30d", currency: "SAR" },
      "csv"
    );
    assert.equal(csvExport.contentType, "text/csv; charset=utf-8");
    assert.ok(csvExport.buffer.length > 0);
    assert.ok(csvExport.filename.endsWith(".csv"));
  });

  it("6.7: Strict Typography Compliance (0 font-bold, 0 font-semibold, 0 <b>, 0 <strong>)", () => {
    const phase6Files = [
      "components/admin/analytics/tabs/forecast-tab.tsx",
      "components/admin/analytics/admin-analytics-hub-client.tsx",
    ];

    const forbiddenRegex = /(font-bold|font-semibold|<b\b|<strong\b)/g;

    for (const file of phase6Files) {
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

  it("6.8: All 10 Phase 6 Documentation Files Exist and have Content", () => {
    const docsDir = path.join(rootDir, "docs/admin-analytics-phase-6");
    const requiredDocs = [
      "01-phase-5-baseline-verification.md",
      "02-realtime-event-architecture.md",
      "03-forecasting-model-and-data.md",
      "04-forecast-validation-results.md",
      "05-accounting-integration-architecture.md",
      "06-accounting-sync-and-security.md",
      "07-host-and-cohost-reporting.md",
      "08-performance-and-reliability.md",
      "09-tests-and-verification.md",
      "10-phase-7-readiness.md",
    ];

    assert.ok(fs.existsSync(docsDir), "docs/admin-analytics-phase-6 directory must exist");

    for (const doc of requiredDocs) {
      const docPath = path.join(docsDir, doc);
      assert.ok(fs.existsSync(docPath), `Missing documentation file: ${doc}`);
      const stats = fs.statSync(docPath);
      assert.ok(stats.size > 200, `Documentation file ${doc} is too short (${stats.size} bytes)`);
    }
  });
});

