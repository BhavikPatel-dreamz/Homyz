import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Phase 3 — UI/UX Implementation Verification", () => {
  const rootDir = process.cwd();

  it("3.1: All 10 Phase 3 documentation files exist and have content", () => {
    const docFiles = [
      "01-ui-architecture.md",
      "02-design-system-and-components.md",
      "03-executive-dashboard.md",
      "04-revenue-dashboard.md",
      "05-occupancy-dashboard.md",
      "06-operations-dashboard.md",
      "07-reports-and-filters.md",
      "08-responsive-and-accessibility.md",
      "09-testing-and-verification.md",
      "10-phase-4-readiness.md",
    ];

    for (const file of docFiles) {
      const fullPath = path.join(rootDir, "docs/admin-analytics-phase-3", file);
      assert.ok(fs.existsSync(fullPath), `Documentation file missing: ${file}`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 200, `Documentation file is too short: ${file}`);
    }
  });

  it("3.2: Reusable native SVG charts and date picker popover exist", () => {
    const componentFiles = [
      "components/admin/analytics/charts/analytics-area-chart.tsx",
      "components/admin/analytics/charts/analytics-bar-chart.tsx",
      "components/admin/analytics/charts/analytics-donut-chart.tsx",
      "components/admin/analytics/analytics-date-picker-popover.tsx",
    ];

    for (const file of componentFiles) {
      const fullPath = path.join(rootDir, file);
      assert.ok(fs.existsSync(fullPath), `Component file missing: ${file}`);
    }
  });

  it("3.3: All 5 modular domain tabs exist", () => {
    const tabFiles = [
      "components/admin/analytics/tabs/overview-tab.tsx",
      "components/admin/analytics/tabs/revenue-tab.tsx",
      "components/admin/analytics/tabs/occupancy-tab.tsx",
      "components/admin/analytics/tabs/operations-tab.tsx",
      "components/admin/analytics/tabs/reports-tab.tsx",
    ];

    for (const file of tabFiles) {
      const fullPath = path.join(rootDir, file);
      assert.ok(fs.existsSync(fullPath), `Tab file missing: ${file}`);
    }
  });

  it("3.4: Strict Typography Rule Check — 0 font-bold, font-semibold, <b>, <strong>", () => {
    const targetDirs = [
      "components/admin/analytics",
      "components/admin/analytics/tabs",
      "components/admin/analytics/charts",
    ];

    const forbiddenPatterns = [/font-bold\b/, /font-semibold\b/, /<b\b/, /<strong\b/];

    for (const dir of targetDirs) {
      const fullDir = path.join(rootDir, dir);
      const files = fs.readdirSync(fullDir).filter((f) => f.endsWith(".tsx"));

      for (const file of files) {
        const filePath = path.join(fullDir, file);
        const content = fs.readFileSync(filePath, "utf-8");

        for (const pattern of forbiddenPatterns) {
          const match = content.match(pattern);
          assert.strictEqual(
            match,
            null,
            `Typography rule violation in ${file}: matched forbidden pattern ${pattern}`
          );
        }
      }
    }
  });
});

