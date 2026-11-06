import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { operationalRiskService } from "../services/admin-analytics/disputes/operational-risk.service";
import { caseSummaryService } from "../services/admin-analytics/disputes/case-summary.service";
import { anomalyMonitorService } from "../services/admin-analytics/disputes/anomaly-monitor.service";
import { legalEntityService } from "../services/admin-analytics/consolidation/legal-entity.service";
import { financialConsolidationService } from "../services/admin-analytics/consolidation/financial-consolidation.service";
import { guestLtvService } from "../services/admin-analytics/lifetime/guest-ltv.service";
import { hostLtvService } from "../services/admin-analytics/lifetime/host-ltv.service";
import { churnPredictionService } from "../services/admin-analytics/lifetime/churn-prediction.service";

describe("Phase 9 — Intelligent Dispute Management, Multi-Entity Financial Consolidation & Advanced LTV/Churn Analytics", () => {
  const rootDir = process.cwd();

  it("9.0: Phase 8 Baseline Verification & Documentation Check", () => {
    const docPath = path.join(rootDir, "docs/admin-analytics-phase-9/01-phase-8-baseline-verification.md");
    assert.ok(fs.existsSync(docPath), "Phase 9 doc 01 must exist");
    const content = fs.readFileSync(docPath, "utf-8");
    assert.ok(content.includes("56 automated unit and integration tests"), "Must document 56 baseline tests");
    assert.ok(content.includes("100% success rate"), "Must document 100% success rate");
  });

  it("9.1: Operational Risk Assessment & Explainable Scoring Rules", () => {
    // 1. Low risk evaluation
    const lowRisk = operationalRiskService.evaluateRisk({
      entityType: "SUPPORT_CASE",
      entityId: "case_normal_01",
      paymentAttemptsCount: 1,
      paymentFailuresCount: 0,
      refundRequestedCents: 5000,
      eligibleBookingCents: 50000,
    });
    assert.equal(lowRisk.severity, "LOW");
    assert.equal(lowRisk.requiresHumanReview, false);
    assert.ok(lowRisk.score! < 25);

    // 2. High/Critical risk evaluation with compound anomalies
    const criticalRisk = operationalRiskService.evaluateRisk({
      entityType: "SUPPORT_CASE",
      entityId: "case_critical_02",
      paymentAttemptsCount: 4,
      paymentFailuresCount: 3, // failure rate >= 50% (+25)
      hasDuplicatePaymentRef: true, // (+25)
      refundRequestedCents: 150000, // refund exceeds booking (+35)
      eligibleBookingCents: 100000,
      isSlaBreached: true, // (+25)
      isEscalated: true, // (+20)
    });

    assert.equal(criticalRisk.severity, "CRITICAL");
    assert.equal(criticalRisk.score, 100); // clamped to 100
    assert.equal(criticalRisk.requiresHumanReview, true, "Critical severity must require human review");
    assert.ok(criticalRisk.reasons.length >= 4, "Must identify multiple distinct reasons");
    assert.ok(criticalRisk.recommendedAction.includes("human review"), "Recommended action must require human review");
  });

  it("9.2: Grounded Dispute Case Summary & Adverse Action Safeguards", async () => {
    const summary = await caseSummaryService.generateCaseSummary("case_test_901");
    assert.ok(summary.caseNumber, "Must generate valid caseNumber");
    assert.ok(summary.timeline.length > 0, "Timeline must contain entries");
    assert.ok(summary.priorEscalationHistory.length > 0, "Escalation history must be populated");
    assert.ok(summary.applicableSla, "SLA data must be present");
    assert.ok(summary.associatedRefundOrPayoutStatus, "Refund & payout status must be present");

    // Critical transparency & governance assertions
    assert.equal(summary.isAIGenerated, true, "Must be clearly labeled as generated analysis");
    assert.equal(summary.sourceRecordsVerified, true, "Must be grounded in verified source records");
    assert.ok(summary.reasonForReview.length > 0, "Must document clear reason for review");

    // Anomaly Monitor Alert Lifecycle & Cooldown
    const alertResult1 = await anomalyMonitorService.evaluateAndRaiseAlert({
      category: "PAYMENT",
      metric: "gateway_failure_rate_pct",
      actualValue: 28.5,
      baselineValue: 3.0,
      threshold: 15.0,
      severity: "HIGH",
      relevantEntities: ["Mada Gateway"],
      explanation: "Surge in checkout payment rejections",
    });
    assert.equal(alertResult1.raised, true);
    assert.ok(alertResult1.alert);

    // Second alert within cooldown window should be suppressed to avoid alert storms
    const alertResult2 = await anomalyMonitorService.evaluateAndRaiseAlert({
      category: "PAYMENT",
      metric: "gateway_failure_rate_pct",
      actualValue: 29.1,
      baselineValue: 3.0,
      threshold: 15.0,
      severity: "HIGH",
      relevantEntities: ["Mada Gateway"],
      explanation: "Secondary surge",
    });
    assert.equal(alertResult2.raised, false, "Alert should be suppressed by cooldown");
    assert.ok(alertResult2.reason?.includes("cooldown"));

    // Alert lifecycle transition
    const updated = anomalyMonitorService.updateAlertStatus(alertResult1.alert!.alertId, "ACKNOWLEDGED", "usr_admin_test");
    assert.equal(updated.status, "ACKNOWLEDGED");
    assert.equal(updated.acknowledgedBy, "usr_admin_test");
  });

  it("9.3: Multi-Entity Legal Structure & Isolation", () => {
    const entities = legalEntityService.listEntities();
    assert.ok(entities.length >= 3, "Must configure at least 3 legal entities");

    const globalParent = legalEntityService.getEntityById("HOMYZ_GLOBAL_INC");
    assert.ok(globalParent);
    assert.equal(globalParent?.functionalCurrency, "USD");
    assert.equal(globalParent?.parentEntityId, null);

    const saudiSub = legalEntityService.getEntityById("HOMYZ_SA_LTD");
    assert.ok(saudiSub);
    assert.equal(saudiSub?.functionalCurrency, "SAR");
    assert.equal(saudiSub?.parentEntityId, "HOMYZ_GLOBAL_INC");
    assert.ok(saudiSub?.taxRegistrationNumber, "Saudi entity must have ZATCA tax number");

    const ukSub = legalEntityService.getEntityById("HOMYZ_UK_LTD");
    assert.ok(ukSub);
    assert.equal(ukSub?.functionalCurrency, "GBP");
    assert.equal(ukSub?.parentEntityId, "HOMYZ_GLOBAL_INC");

    // Security & Data Isolation
    assert.equal(
      legalEntityService.verifyEntityAccess("SUPER_ADMIN", undefined, "HOMYZ_SA_LTD"),
      true,
      "Super admin can access any entity"
    );
    assert.equal(
      legalEntityService.verifyEntityAccess("ENTITY_FINANCE", "HOMYZ_SA_LTD", "HOMYZ_SA_LTD"),
      true,
      "Entity finance can access assigned entity"
    );
    assert.equal(
      legalEntityService.verifyEntityAccess("ENTITY_FINANCE", "HOMYZ_SA_LTD", "HOMYZ_UK_LTD"),
      false,
      "Entity finance CANNOT access peer entity without permission"
    );
  });

  it("9.4: Multi-Currency Cross-Border Consolidation & Intercompany Elimination", async () => {
    const statement = await financialConsolidationService.generateConsolidatedStatement("USD", "2026-10");
    assert.equal(statement.presentationCurrency, "USD");
    assert.ok(statement.entitiesIncluded.includes("HOMYZ_GLOBAL_INC"));
    assert.ok(statement.entitiesIncluded.includes("HOMYZ_SA_LTD"));
    assert.ok(statement.entitiesIncluded.includes("HOMYZ_UK_LTD"));

    // Intercompany eliminations check
    assert.ok(statement.intercompanyEliminations.length >= 2, "Must process intercompany eliminations");
    const mgmtFeeElim = statement.intercompanyEliminations.find((e) => e.description.includes("HOMYZ_SA_LTD"));
    assert.ok(mgmtFeeElim, "Saudi management fee must be eliminated");
    assert.ok(mgmtFeeElim!.amountMinorInPresentation > 0);

    // Reconciled totals
    assert.ok(statement.consolidatedTotals.grossBookingValueMinor > 0);
    assert.ok(statement.consolidatedTotals.platformFeeRevenue > 0);
    assert.ok(statement.consolidatedTotals.collectedCashMinor > 0);
    assert.ok(statement.consolidatedTotals.netOperatingMarginMinor > 0);
    assert.ok(statement.currencyTranslationAdjustmentMinor > 0, "Must calculate Currency Translation Adjustment (CTA)");
    assert.equal(statement.isReconciled, true, "Statement must be fully reconciled");
  });

  it("9.5: Guest Lifetime Value, GBV vs Platform Revenue vs Contribution LTV & Cohorts", async () => {
    const ltv = await guestLtvService.computeGuestLtv();

    assert.ok(ltv.totalRegisteredGuests > 0);
    assert.ok(ltv.averageGrossBookingValueCents > 0);
    assert.ok(ltv.averagePlatformRevenueCents > 0);
    assert.ok(ltv.averageContributionLtvCents > 0);

    // Critical economic rule: GBV > Platform Revenue > Contribution LTV
    assert.ok(
      ltv.averageGrossBookingValueCents > ltv.averagePlatformRevenueCents,
      "Gross Booking Value must exceed Platform Revenue (GBV is not company revenue)"
    );
    assert.ok(
      ltv.averagePlatformRevenueCents > ltv.averageContributionLtvCents,
      "Platform Revenue must exceed Contribution LTV (attributable gateway costs deducted)"
    );

    // Cohorts validation
    assert.ok(ltv.cohorts.length > 0, "Cohorts must be generated");
    const matureCohort = ltv.cohorts.find((c) => c.isMatured);
    const immatureCohort = ltv.cohorts.find((c) => !c.isMatured);

    assert.ok(matureCohort, "Must have mature cohort (>12 months)");
    assert.ok(immatureCohort, "Must have immature cohort (<12 months)");
    assert.equal(immatureCohort?.isMatured, false);
  });

  it("9.6: Host Lifetime Value & Milestone Retention with Seasonal Protection", async () => {
    const hostLtv = await hostLtvService.computeHostLtv();

    assert.ok(hostLtv.totalRegisteredHosts > 0);
    assert.ok(hostLtv.hostsWithPublishedListings > 0);
    assert.ok(hostLtv.hostsWithConfirmedBookings > 0);
    assert.ok(hostLtv.totalGrossBookingValueAttributableCents > hostLtv.totalPlatformRevenueAttributableCents);
    assert.ok(hostLtv.averageRevenuePerHostCents > 0);

    // Milestone Cohorts
    assert.ok(hostLtv.cohorts.length > 0);
    const cohort = hostLtv.cohorts[0];
    assert.ok(cohort.totalHostsRegistered >= cohort.publishedFirstListing);
    assert.ok(cohort.publishedFirstListing >= cohort.firstBookingReceived);
    assert.ok(cohort.retentionRate30d >= 0 && cohort.retentionRate30d <= 100);
  });

  it("9.7: Churn Risk Prediction, Behavioral Signals & Backtesting", () => {
    // 1. Guest churn evaluation
    const guestChurnActive = churnPredictionService.evaluateGuestChurnRisk({
      guestId: "gst_active_1",
      daysSinceLastBooking: 25,
      averageBookingFrequencyDays: 30,
      totalCompletedBookings: 4,
    });
    assert.equal(guestChurnActive.riskLevel, "LOW");
    assert.ok(guestChurnActive.riskScore < 40);

    const guestChurnInactive = churnPredictionService.evaluateGuestChurnRisk({
      guestId: "gst_inactive_2",
      daysSinceLastBooking: 150, // 5x normal cycle (+45)
      averageBookingFrequencyDays: 30,
      cancelledBookingsCount: 2, // (+20)
      totalCompletedBookings: 2,
    });
    assert.equal(guestChurnInactive.riskLevel, "HIGH");
    assert.ok(guestChurnInactive.riskScore >= 70);

    // 2. Host churn evaluation with seasonal off-peak protection
    const hostChurnOffPeak = churnPredictionService.evaluateHostChurnRisk({
      hostId: "hst_seasonal_1",
      daysSinceLastListingActivity: 75,
      activeListingsCount: 2,
      unpublishedListingsCount: 0,
      calendarBlockedDaysPct: 15,
      isSeasonalOffPeak: true, // Recognized off-peak season
    });
    assert.equal(hostChurnOffPeak.riskLevel, "LOW", "Off-peak seasonal host must not be flagged as high churn");
    assert.ok(hostChurnOffPeak.contributingFactors.some((f) => f.includes("off-peak")));

    const hostChurnUnpublished = churnPredictionService.evaluateHostChurnRisk({
      hostId: "hst_churned_2",
      daysSinceLastListingActivity: 130, // (+35)
      activeListingsCount: 0,
      unpublishedListingsCount: 3, // (+40)
      calendarBlockedDaysPct: 90,
      isSeasonalOffPeak: false,
    });
    assert.equal(hostChurnUnpublished.riskLevel, "HIGH");
    assert.ok(hostChurnUnpublished.riskScore >= 70);

    // 3. Backtesting Performance Validation
    const evalResult = churnPredictionService.evaluateModelPerformance();
    assert.ok(evalResult.precision >= 0.8, "Precision must be >= 80%");
    assert.ok(evalResult.recall >= 0.75, "Recall must be >= 75%");
    assert.ok(evalResult.falsePositiveRate < 0.1, "False positive rate must be < 10%");
    assert.equal(evalResult.dataLeakagePrevented, true, "Must verify data leakage prevention");
  });

  it("9.8: Strict Typography Compliance (RULE[/media/drive/shihab/Homyz/GEMINI.md])", () => {
    const targetDirs = [
      path.join(rootDir, "services/admin-analytics/disputes"),
      path.join(rootDir, "services/admin-analytics/consolidation"),
      path.join(rootDir, "services/admin-analytics/lifetime"),
      path.join(rootDir, "app/api/v1/admin/analytics/disputes"),
      path.join(rootDir, "app/api/v1/admin/analytics/consolidation"),
      path.join(rootDir, "app/api/v1/admin/analytics/lifetime"),
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

  it("9.9: Phase 9 Documentation Completeness Verification", () => {
    const docsDir = path.join(rootDir, "docs/admin-analytics-phase-9");
    assert.ok(fs.existsSync(docsDir), "Phase 9 docs directory must exist");

    const expectedDocs = [
      "01-phase-8-baseline-verification.md",
      "02-dispute-intelligence-architecture.md",
      "03-anomaly-detection-and-safety.md",
      "04-multi-entity-accounting-foundation.md",
      "05-cross-border-consolidation-validation.md",
      "06-guest-ltv-and-cohorts.md",
      "07-host-retention-and-churn.md",
      "08-security-performance-and-governance.md",
      "09-tests-and-verification.md",
      "10-phase-10-readiness.md",
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

