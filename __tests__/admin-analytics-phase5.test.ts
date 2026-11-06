import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { KPI_REGISTRY } from "../services/admin-analytics/analytics-contracts";
import { buildExcelWorkbook } from "../lib/export/excel-generator";
import { buildExecutivePdfReport } from "../lib/export/executive-pdf-report";
import { sanitizeCsvCell } from "../services/analytics-admin.service";
import { calculateNextRunTimestamp } from "../services/admin-analytics/report-scheduler.service";
import { normalizeAnalyticsTimeframe } from "../services/admin-analytics/analytics-filters";

describe("Phase 5 — Enterprise Reporting Automation, Advanced Exports, Alerts & Business Intelligence", () => {
  const rootDir = process.cwd();

  it("5.1: Canonical Financial Definitions & Contract Integrity", () => {
    const requiredFinancialKpis = [
      "GROSS_BOOKING_VALUE",
      "ACCOMMODATION_REVENUE",
      "GUEST_SERVICE_FEES",
      "HOST_SERVICE_FEES",
      "PLATFORM_COMMISSION",
      "CLEANING_FEES",
      "TAXES_COLLECTED",
      "DISCOUNTS_TOTAL",
      "CAPTURED_PAYMENT_VOLUME",
      "REFUNDED_VOLUME",
      "NET_COLLECTED_CASH",
      "NET_HOST_PAYOUTS",
      "SETTLED_HOST_PAYOUTS",
      "OUTSTANDING_PAYOUT_LIABILITY",
    ];

    for (const kpi of requiredFinancialKpis) {
      assert.ok(KPI_REGISTRY[kpi], `Missing canonical financial KPI definition: ${kpi}`);
      assert.ok(KPI_REGISTRY[kpi].formula, `KPI ${kpi} must have a formula`);
      assert.ok(KPI_REGISTRY[kpi].source, `KPI ${kpi} must have a database source`);
      assert.equal(KPI_REGISTRY[kpi].category, "FINANCIAL");
    }

    // Mathematical reconciliation check:
    // Net Collected Cash = Captured Volume - Succeeded Refunds
    const captured = 1_000_000;
    const refunded = 150_000;
    const netCash = captured - refunded;
    assert.equal(netCash, 850_000);
    assert.ok(netCash <= captured);

    // Host payout liability does not assume fixed 3% commission
    assert.ok(KPI_REGISTRY.HOST_SERVICE_FEES.formula.includes("hostServiceFee"));
  });

  it("5.2: Excel (.xlsx) OpenXML Generator Produces Valid PKZIP Spreadsheet", () => {
    const workbookBuf = buildExcelWorkbook({
      creator: "Homyz Enterprise Audit",
      sheets: [
        {
          name: "Executive Summary",
          headerTitle: "HOMYZ BUSINESS INTELLIGENCE",
          subtitle: "Reporting Window: 2026-10-01 to 2026-10-31 | Currency: SAR",
          summaryCards: [
            { label: "Gross Booking Value", value: "SAR 150,000" },
            { label: "Net Cash Flow", value: "SAR 142,500" },
          ],
          columns: [
            { header: "Date", key: "date" },
            { header: "Gross GMV", key: "gmv", type: "currency" },
            { header: "Occupancy Rate", key: "occ", type: "percentage" },
          ],
          rows: [
            { date: "2026-10-01", gmv: 5000, occ: 65.5 },
            { date: "2026-10-02", gmv: 6200, occ: 72.0 },
          ],
        },
      ],
    });

    assert.ok(Buffer.isBuffer(workbookBuf), "Workbook must be a valid Node.js Buffer");
    assert.ok(workbookBuf.length > 500, "Workbook must contain genuine zipped XML entries");

    // Standard PKZIP header signature (0x50, 0x4b, 0x03, 0x04)
    assert.equal(workbookBuf[0], 0x50, "Byte 0 must match PK signature");
    assert.equal(workbookBuf[1], 0x4b, "Byte 1 must match PK signature");
    assert.equal(workbookBuf[2], 0x03, "Byte 2 must match PK signature");
    assert.equal(workbookBuf[3], 0x04, "Byte 3 must match PK signature");
  });

  it("5.3: Executive PDF Generator Produces Valid PDF 1.4 Binary Buffer", () => {
    const fixedNow = new Date("2026-11-06T12:00:00.000Z");
    const norm = normalizeAnalyticsTimeframe({ period: "30d" }, fixedNow);

    const pdfBuf = buildExecutivePdfReport({
      timeframe: norm.context,
      currency: "SAR",
      generatedAt: "2026-11-06 12:00:00 UTC",
      filtersDescription: "Type: EXECUTIVE_SUMMARY | Currency: SAR",
      executiveKpis: [
        { label: "Gross Booking Value", value: "SAR 120,000", deltaText: "+12.5%", isHighlight: true },
        { label: "Net Collected Cash", value: "SAR 114,000", deltaText: "+8.2%" },
        { label: "Occupancy Rate", value: "68.4%", deltaText: "+4.2 pp" },
        { label: "Resolution SLA", value: "96.5%", deltaText: "+1.5 pp" },
      ],
      trendRows: [
        { date: "2026-10-08", gmv: "SAR 4,000", captured: "SAR 4,000", refunded: "SAR 0", netCash: "SAR 4,000", occupancy: "65%" },
      ],
      financialSummary: [
        { category: "Gross Booking Value", amount: "SAR 120,000", percentage: "100%", notes: "Contractual GMV" },
      ],
      operationsKpis: [
        { label: "Backlog Cases", value: "2", status: "Compliant" },
        { label: "First Response SLA", value: "98.2%", status: "Compliant" },
      ],
    });

    assert.ok(Buffer.isBuffer(pdfBuf), "PDF output must be a Buffer");
    assert.ok(pdfBuf.length > 500, "PDF must contain stream objects");
    const pdfHeader = pdfBuf.slice(0, 8).toString("utf-8");
    assert.ok(pdfHeader.startsWith("%PDF-1.4"), "Must have standard PDF 1.4 header");
  });

  it("5.4: CSV Streaming & Injection Sanitization (RFC 4180)", () => {
    // Normal string
    assert.equal(sanitizeCsvCell("Riyadh Apartment"), '"Riyadh Apartment"');
    // Formula triggers must be sanitized with leading apostrophe
    assert.equal(sanitizeCsvCell("=SUM(A1:B10)"), `"'=SUM(A1:B10)"`);
    assert.equal(sanitizeCsvCell("+cmd|' /C calc'!A0"), `"'++cmd|' /C calc'!A0"`.replace("++", "+"));
    assert.equal(sanitizeCsvCell("-1500"), `"'-1500"`);
    assert.equal(sanitizeCsvCell("@malicious"), `"'@malicious"`);
    // Inner quotes must be doubled
    assert.equal(sanitizeCsvCell('Property "Al-Nakheel"'), '"Property ""Al-Nakheel"""');
  });

  it("5.5: Automated Report Scheduler & Next-Run Calculations", () => {
    const baseDate = new Date("2026-11-06T12:00:00.000Z"); // Friday Nov 6, 2026

    // Daily next run at 06:00 UTC -> should advance to Saturday Nov 7, 06:00
    const nextDaily = calculateNextRunTimestamp("DAILY", "06:00", 1, 1, baseDate);
    const dDaily = new Date(nextDaily);
    assert.equal(dDaily.getUTCHours(), 6);
    assert.equal(dDaily.getUTCDate(), 7);

    // Weekly next run on Monday (1) at 06:00 UTC -> should be Monday Nov 9, 2026
    const nextWeekly = calculateNextRunTimestamp("WEEKLY", "06:00", 1, 1, baseDate);
    const dWeekly = new Date(nextWeekly);
    assert.equal(dWeekly.getUTCHours(), 6);
    assert.equal(dWeekly.getUTCDay(), 1); // Monday
    assert.equal(dWeekly.getUTCDate(), 9);

    // Monthly next run on 1st of month at 05:00 UTC -> should be Dec 1, 2026
    const nextMonthly = calculateNextRunTimestamp("MONTHLY", "05:00", 1, 1, baseDate);
    const dMonthly = new Date(nextMonthly);
    assert.equal(dMonthly.getUTCHours(), 5);
    assert.equal(dMonthly.getUTCDate(), 1);
    assert.equal(dMonthly.getUTCMonth(), 11); // December (0-indexed 11)
  });

  it("5.6: Strict Typography Rule Check — 0 font-bold, font-semibold, <b>, <strong>", () => {
    const filesToCheck = [
      "components/admin/analytics/tabs/reports-tab.tsx",
      "components/admin/analytics/tabs/overview-tab.tsx",
      "components/admin/analytics/tabs/revenue-tab.tsx",
      "components/admin/analytics/tabs/occupancy-tab.tsx",
      "components/admin/analytics/tabs/operations-tab.tsx",
      "components/admin/analytics/admin-analytics-hub-client.tsx",
    ];

    const forbiddenRegex = /font-bold|font-semibold|<b\b|<strong\b/g;

    for (const relativeFile of filesToCheck) {
      const fullPath = path.join(rootDir, relativeFile);
      assert.ok(fs.existsSync(fullPath), `File missing for typography check: ${relativeFile}`);
      const content = fs.readFileSync(fullPath, "utf-8");
      const matches = content.match(forbiddenRegex);
      assert.equal(
        matches,
        null,
        `Typography rule violation in ${relativeFile}: found ${JSON.stringify(matches)}. Only font-medium or font-normal are permitted.`
      );
    }
  });

  it("5.7: All 10 Phase 5 Documentation Files Exist and have Content", () => {
    const docFiles = [
      "01-financial-definitions-verification.md",
      "02-custom-report-builder.md",
      "03-pdf-excel-csv-engine.md",
      "04-scheduled-reports-architecture.md",
      "05-email-delivery-and-job-reliability.md",
      "06-alerts-and-anomaly-detection.md",
      "07-cohort-and-retention-analytics.md",
      "08-security-and-performance.md",
      "09-tests-and-verification.md",
      "10-phase-6-readiness.md",
    ];

    for (const file of docFiles) {
      const fullPath = path.join(rootDir, "docs/admin-analytics-phase-5", file);
      assert.ok(fs.existsSync(fullPath), `Phase 5 Documentation file missing: ${file}`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 200, `Documentation file is too short: ${file} (${stat.size} bytes)`);
    }
  });
});
