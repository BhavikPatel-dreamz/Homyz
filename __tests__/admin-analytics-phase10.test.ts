import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { financialReconciliationService } from "../services/admin-analytics/reconciliation/financial-reconciliation.service";
import { financialConsolidationService } from "../services/admin-analytics/consolidation/financial-consolidation.service";
import { executiveBoardReportingService } from "../services/admin-analytics/executive/executive-board-reporting.service";
import { systemHealthService } from "../services/admin-analytics/system-health/system-health.service";

describe("Phase 10 — Production Reliability, Financial Reconciliation, Executive Reporting & Disaster Recovery", () => {
  const rootDir = process.cwd();

  it("10.0: Phase 9 Baseline Verification & Risk Register Check", () => {
    const docPath = path.join(rootDir, "docs/admin-analytics-phase-10/01-phase-9-baseline-verification.md");
    assert.ok(fs.existsSync(docPath), "Phase 10 doc 01 must exist");
    const content = fs.readFileSync(docPath, "utf-8");
    assert.ok(content.includes("Phase 9 test suite"), "Must document Phase 9 test suite execution");
    assert.ok(content.includes("100% test passage"), "Must document 100% test passage");
    assert.ok(content.includes("Baseline Operational Risk Register"), "Must document baseline risk register");
  });

  it("10.1: Financial Discrepancy Detection & Classification", async () => {
    financialReconciliationService.reset();
    const discrepancies = await financialReconciliationService.scanDiscrepancies();
    assert.ok(discrepancies.length >= 3, "Must detect seeded financial discrepancies");

    const webhookDisc = discrepancies.find((d) => d.discrepancyType === "MISSING_PAYMENT_WEBHOOK");
    assert.ok(webhookDisc, "Must detect MISSING_PAYMENT_WEBHOOK");
    assert.equal(webhookDisc?.entityType, "PAYMENT");
    assert.equal(webhookDisc?.localStatus, "PENDING");
    assert.equal(webhookDisc?.providerStatus, "CAPTURED");
    assert.equal(webhookDisc?.isEligibleForAutoHealing, true);

    const payoutDisc = discrepancies.find((d) => d.discrepancyType === "PAYOUT_STATUS_DESYNC");
    assert.ok(payoutDisc, "Must detect PAYOUT_STATUS_DESYNC");
    assert.equal(payoutDisc?.entityType, "PAYOUT");
    assert.equal(payoutDisc?.isEligibleForAutoHealing, true);

    const unknownDisc = discrepancies.find((d) => d.discrepancyType === "UNKNOWN_GATEWAY_OUTCOME");
    assert.ok(unknownDisc, "Must detect UNKNOWN_GATEWAY_OUTCOME");
    assert.equal(unknownDisc?.isEligibleForAutoHealing, false, "Unknown outcome must NOT be eligible for auto-healing");
  });

  it("10.2: Idempotent Self-Healing Execution & Audit History", async () => {
    // Execute self-healing reconciliation
    const result1 = await financialReconciliationService.executeSelfHealing("reconciliation_worker_10");
    assert.ok(result1.jobId.startsWith("job_recon_"));
    assert.ok(result1.healedCount >= 2, "Must heal eligible discrepancies");
    assert.ok(result1.auditLogs.length >= 2, "Must generate audit logs");

    // Verify audit log structure
    const auditEntry = result1.auditLogs[0];
    assert.ok(auditEntry.discrepancyId);
    assert.ok(auditEntry.actionApplied);
    assert.ok(auditEntry.previousState);
    assert.ok(auditEntry.newState);
    assert.ok(auditEntry.evidenceSource);
    assert.equal(auditEntry.actorId, "reconciliation_worker_10");

    // Idempotent secondary execution should make 0 additional changes
    const result2 = await financialReconciliationService.executeSelfHealing("reconciliation_worker_10");
    assert.equal(result2.healedCount, 0, "Secondary execution must be idempotent with zero duplicate updates");
  });

  it("10.3: Unknown Gateway Outcomes Safety & No Blind Retries", () => {
    const discrepancies = financialReconciliationService.getDiscrepancies();
    const unknownDisc = discrepancies.find((d) => d.discrepancyType === "UNKNOWN_GATEWAY_OUTCOME");

    assert.ok(unknownDisc);
    assert.equal(unknownDisc?.status, "REQUIRES_MANUAL_REVIEW");
    assert.equal(unknownDisc?.isEligibleForAutoHealing, false);
    assert.ok(unknownDisc?.remediationAction.includes("Alert administrator"), "Must hold for manual administrator review");
  });

  it("10.4: Corrected Intercompany Elimination Journal Accounts", async () => {
    const statement = await financialConsolidationService.generateConsolidatedStatement("USD", "2026-10");
    assert.ok(statement.intercompanyEliminations.length >= 2);

    // Verify that elimination reverses actual internal revenue and expense accounts!
    const mgmtElim = statement.intercompanyEliminations.find((e) => e.transactionReference === "ic_tx_2026_01");
    assert.ok(mgmtElim, "Management fee elimination must exist");
    assert.equal(
      mgmtElim?.debitRole,
      "4020_INTERCOMPANY_MANAGEMENT_REVENUE",
      "Debit must reverse internal management revenue"
    );
    assert.equal(
      mgmtElim?.creditRole,
      "5030_INTERCOMPANY_MANAGEMENT_EXPENSE",
      "Credit must reverse internal management expense"
    );

    // Verify balance sheet debt elimination
    const balanceElim = statement.intercompanyEliminations.find((e) => e.eliminationId.startsWith("elim_bal_"));
    assert.ok(balanceElim, "Balance sheet debt elimination must exist");
    assert.equal(balanceElim?.debitRole, "2040_INTERCOMPANY_PAYABLE");
    assert.equal(balanceElim?.creditRole, "1040_INTERCOMPANY_RECEIVABLE");
  });

  it("10.5: Controlled Period Closing Workflow & Snapshot Immutability", () => {
    const period = "2026-11";
    // 1. Initial state is OPEN
    const status1 = financialConsolidationService.getPeriodCloseStatus(period);
    assert.equal(status1.status, "OPEN");

    // 2. Transition OPEN -> REVIEW -> APPROVED -> CLOSED
    financialConsolidationService.transitionPeriodStatus(period, "REVIEW", "usr_fin_analyst");
    financialConsolidationService.transitionPeriodStatus(period, "APPROVED", "usr_fin_director");
    const closedRecord = financialConsolidationService.transitionPeriodStatus(period, "CLOSED", "usr_cfo");
    assert.equal(closedRecord.status, "CLOSED");
    assert.ok(closedRecord.closedAt);
    assert.ok(closedRecord.snapshotHash);

    // 3. Attempting to record adjustments on a CLOSED period must fail
    assert.throws(
      () => {
        financialConsolidationService.recordPeriodAdjustment(
          period,
          { accountRole: "5010_GATEWAY_FEE", amountMinor: 5000, reason: "Late fee invoice" },
          "usr_fin_analyst"
        );
      },
      /Cannot modify closed period/
    );

    // 4. Reopening requires formal transition to REVIEW
    financialConsolidationService.transitionPeriodStatus(period, "REVIEW", "usr_cfo");
    const reopened = financialConsolidationService.getPeriodCloseStatus(period);
    assert.equal(reopened.status, "REVIEW");
  });

  it("10.6: Executive Board Report Package Generation & Unaudited Disclosures", async () => {
    const boardPackage = await executiveBoardReportingService.generateBoardPackage({
      period: "2026-10",
      presentationCurrency: "USD",
      actorId: "usr_ceo",
    });

    assert.ok(boardPackage.reportId.startsWith("brd_pkg_"));
    assert.equal(boardPackage.reportingPeriod, "2026-10");
    assert.equal(boardPackage.presentationCurrency, "USD");
    assert.equal(boardPackage.accountingBasis, "ACCRUAL");

    // Mandatory Governance Disclosures
    assert.equal(boardPackage.isAudited, false, "Must disclose that management accounts are unaudited");
    assert.ok(boardPackage.dataQualityLimitations.length > 0, "Must include data-quality disclosures");

    // Verify all 7 sections are populated
    assert.ok(boardPackage.executiveSummary.periodHighlight, "Section A must be present");
    assert.ok(boardPackage.revenueAndFinance.grossBookingValueCents > 0, "Section B must be present");
    assert.ok(boardPackage.marketplaceOperations.totalReservationsCount > 0, "Section C must be present");
    assert.ok(boardPackage.growthAndCohorts.repeatGuestBookingPct > 0, "Section D must be present");
    assert.ok(boardPackage.riskAndCompliance.supportCaseSlaCompliancePct > 0, "Section E must be present");
    assert.ok(boardPackage.forecastOutlook.nextQuarterProjectedRevenueCents > 0, "Section F must be present");
    assert.ok(boardPackage.financialStatements.profitAndLossSummary.grossOperatingProfit > 0, "Section G must be present");
  });

  it("10.7: Dependency-Aware System Health & Observability", async () => {
    const health = await systemHealthService.getSystemHealth();
    assert.ok(health.overallStatus === "HEALTHY" || health.overallStatus === "DEGRADED");
    assert.ok(health.components.length >= 5, "Must evaluate at least 5 core components");

    const dbComponent = health.components.find((c) => c.component.includes("Database"));
    assert.ok(dbComponent);
    assert.ok(dbComponent?.latencyMs >= 0);

    const busComponent = health.components.find((c) => c.component.includes("Event Bus"));
    assert.ok(busComponent);
    assert.equal(busComponent?.status, "HEALTHY");

    const reconComponent = health.components.find((c) => c.component.includes("Reconciliation"));
    assert.ok(reconComponent);
  });

  it("10.8: SOC 2 Evidence Readiness & Disaster Recovery Guarantees", () => {
    // 1. SOC 2 Controls
    const controls = systemHealthService.getSoc2Controls();
    assert.ok(controls.length >= 6, "Must evaluate at least 6 SOC 2 controls");
    assert.ok(controls.some((c) => c.controlId === "CC6.1"));
    assert.ok(controls.some((c) => c.controlId === "CC6.6"));
    assert.ok(controls.some((c) => c.controlId === "CC7.2"));
    assert.ok(controls.some((c) => c.controlId === "A1.2"));

    // 2. Disaster Recovery Guarantees
    const dr = systemHealthService.getDisasterRecoveryStatus();
    assert.equal(dr.targetRpoMinutes, 5, "RPO must be 5 minutes");
    assert.equal(dr.targetRtoMinutes, 30, "RTO must be 30 minutes");
    assert.equal(dr.databaseBackup.encryptionAtRest, "AES-256");
    assert.equal(dr.failoverSafety.primaryWriteArchitecture, true);
    assert.equal(dr.failoverSafety.multiPrimaryAllowed, false, "Multi-primary writes must be disallowed to prevent split-brain double charges");
  });

  it("10.9: Strict Typography Compliance (RULE[/media/drive/shihab/Homyz/GEMINI.md])", () => {
    const targetDirs = [
      path.join(rootDir, "services/admin-analytics/reconciliation"),
      path.join(rootDir, "services/admin-analytics/executive"),
      path.join(rootDir, "services/admin-analytics/system-health"),
      path.join(rootDir, "app/api/v1/admin/analytics/reconciliation"),
      path.join(rootDir, "app/api/v1/admin/analytics/executive"),
      path.join(rootDir, "app/api/v1/admin/analytics/system-health"),
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

  it("10.10: Phase 10 Documentation Completeness Verification", () => {
    const docsDir = path.join(rootDir, "docs/admin-analytics-phase-10");
    assert.ok(fs.existsSync(docsDir), "Phase 10 docs directory must exist");

    const expectedDocs = [
      "01-phase-9-baseline-verification.md",
      "02-financial-reconciliation-and-self-healing.md",
      "03-consolidation-and-period-closing.md",
      "04-executive-board-reporting.md",
      "05-soc2-control-evidence-readiness.md",
      "06-observability-and-system-health.md",
      "07-disaster-recovery-and-failover.md",
      "08-performance-security-and-deployment.md",
      "09-tests-and-verification.md",
      "10-production-readiness-and-phase-11.md",
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

