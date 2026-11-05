import test from "node:test";
import assert from "node:assert/strict";
import { OperationalTaskStatus, OperatingExpenseCategory, OperatingExpenseStatus, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { hostOperationalRecordsService } from "@/services/host-operational-records.service";
import { hostEarningsAnalyticsService } from "@/services/host-earnings-analytics.service";

test("Host Operations Complete Workflow & Financial Analytics Integration", async (t) => {
  // Find test host
  const host = await prisma.user.findFirst({
    where: { email: "adams@gmail.com" },
    select: { id: true, role: true, email: true },
  });
  assert.ok(host, "Test host adams@gmail.com must exist");
  const actor = { id: host.id, role: host.role };

  // Find host non-deleted listing
  const listing = await prisma.listing.findFirst({
    where: { hostId: host.id, deletedAt: null },
    select: { id: true, title: true },
  });
  assert.ok(listing, "Host listing must exist");

  let createdTaskId: string | null = null;
  let createdMaintId: string | null = null;

  await t.test("1. Create cleaning task with scheduled date and expense", async () => {
    const scheduledDate = new Date(Date.now() + 2 * 86_400_000); // 2 days in future
    const task = await hostOperationalRecordsService.createCleaningTask(actor as any, {
      listingId: listing.id,
      title: "Automated Test Turnover Clean",
      scheduledFor: scheduledDate,
      actualExpenseCents: 12000, // SAR 120.00
      currency: "SAR",
      notes: "Clean master bedroom and replace towels",
      idempotencyKey: `test-task-${Date.now()}`,
    });

    assert.ok(task.id, "Task must have an ID");
    assert.equal(task.title, "Automated Test Turnover Clean");
    assert.equal(task.actualExpenseCents, 12000);
    assert.equal(task.status, OperationalTaskStatus.SCHEDULED);
    createdTaskId = task.id;

    // Verify canonical OperatingExpense was created automatically
    const expense = await prisma.operatingExpense.findFirst({
      where: { sourceReference: `cleaning-task:${task.id}` },
    });
    assert.ok(expense, "Operating expense must be created for cleaning task with expense");
    assert.equal(expense.amountCents, 12000);
    assert.equal(expense.category, OperatingExpenseCategory.CLEANING);
    assert.equal(expense.status, OperatingExpenseStatus.ACTIVE);
  });

  await t.test("2. Cleaning task lifecycle: start task (IN_PROGRESS)", async () => {
    assert.ok(createdTaskId);
    const updated = await hostOperationalRecordsService.updateCleaningTask(actor as any, createdTaskId, {
      status: OperationalTaskStatus.IN_PROGRESS,
    });
    assert.equal(updated.status, OperationalTaskStatus.IN_PROGRESS);
  });

  await t.test("3. Complete cleaning task and update actual expense", async () => {
    assert.ok(createdTaskId);
    const updated = await hostOperationalRecordsService.updateCleaningTask(actor as any, createdTaskId, {
      status: OperationalTaskStatus.COMPLETED,
      actualExpenseCents: 14000, // Updated to SAR 140.00
    });
    assert.equal(updated.status, OperationalTaskStatus.COMPLETED);
    assert.ok(updated.completedAt, "completedAt must be populated");
    assert.equal(updated.actualExpenseCents, 14000);

    // Verify OperatingExpense was updated to SAR 140.00
    const expense = await prisma.operatingExpense.findFirst({
      where: { sourceReference: `cleaning-task:${createdTaskId}` },
    });
    assert.ok(expense);
    assert.equal(expense.amountCents, 14000);
    assert.equal(expense.status, OperatingExpenseStatus.ACTIVE);
  });

  await t.test("4. Overdue calculation accurately identifies past unfinished tasks", async () => {
    // Create an overdue task (scheduled yesterday)
    const overdueDate = new Date(Date.now() - 86_400_000);
    const overdueTask = await hostOperationalRecordsService.createCleaningTask(actor as any, {
      listingId: listing.id,
      title: "Overdue Linen Wash",
      scheduledFor: overdueDate,
      idempotencyKey: `test-overdue-${Date.now()}`,
    });

    const overview = await hostOperationalRecordsService.overview(actor as any, {
      listingId: listing.id,
    });
    assert.ok(overview.cleaning.delayed >= 1, "Must detect at least 1 overdue cleaning task");

    // Clean up overdue task
    await hostOperationalRecordsService.deleteCleaningTask(actor as any, overdueTask.id);
  });

  await t.test("5. Create maintenance record with equipment reference and expense", async () => {
    const serviceDate = new Date();
    const nextService = new Date(Date.now() + 90 * 86_400_000);
    const record = await hostOperationalRecordsService.createMaintenanceRecord(actor as any, {
      listingId: listing.id,
      title: "AC Filter Cleaning & Freon Check",
      equipmentReference: "Daikin Inverter #1",
      serviceDate,
      nextServiceDate: nextService,
      actualExpenseCents: 25000, // SAR 250.00
      usageReading: 1850,
      usageUnit: "hours",
      notes: "Filter replaced, gas pressure normal",
      currency: "SAR",
    });

    assert.ok(record.id);
    assert.equal(record.title, "AC Filter Cleaning & Freon Check");
    assert.equal(record.equipmentReference, "Daikin Inverter #1");
    assert.equal(record.actualExpenseCents, 25000);
    assert.equal(record.usageReading, 1850);
    createdMaintId = record.id;

    // Verify canonical OperatingExpense was created for maintenance
    const expense = await prisma.operatingExpense.findFirst({
      where: { sourceReference: `maintenance-record:${record.id}` },
    });
    assert.ok(expense, "Operating expense must be created for maintenance record with expense");
    assert.equal(expense.amountCents, 25000);
    assert.equal(expense.category, OperatingExpenseCategory.MAINTENANCE);
    assert.equal(expense.status, OperatingExpenseStatus.ACTIVE);
  });

  await t.test("6. Maintenance record lifecycle & completion", async () => {
    assert.ok(createdMaintId);
    const updated = await hostOperationalRecordsService.updateMaintenanceRecord(actor as any, createdMaintId, {
      status: OperationalTaskStatus.COMPLETED,
    });
    assert.equal(updated.status, OperationalTaskStatus.COMPLETED);
    assert.ok(updated.completedAt);
  });

  await t.test("7. Financial Reconciliation: Operations costs reflect in Dashboard Plus analytics", async () => {
    const operationsOverview = await hostOperationalRecordsService.overview(actor as any, {
      listingId: listing.id,
      currency: "SAR",
    });

    // Cleaning expenses (SAR 140) + Maintenance expenses (SAR 250) = SAR 390
    assert.ok(operationsOverview.financialSummary.recordedCleaningExpensesCents >= 14000);
    assert.ok(operationsOverview.financialSummary.recordedMaintenanceExpensesCents >= 25000);
    assert.equal(
      operationsOverview.financialSummary.totalOperationsExpenseCents,
      operationsOverview.financialSummary.recordedCleaningExpensesCents +
        operationsOverview.financialSummary.recordedMaintenanceExpensesCents,
    );

    // Check integration with Dashboard Plus Earnings Analytics
    const earningsAnalytics = await hostEarningsAnalyticsService.getOverview(actor as any, {
      listingId: listing.id,
      currency: "SAR",
    });

    assert.equal(earningsAnalytics.costs.status, "AVAILABLE");
    assert.ok(earningsAnalytics.costs.totalRecordedOperatingCostsCents >= 39000);

    // Verify category breakdown includes CLEANING and MAINTENANCE
    const categories = earningsAnalytics.costs.categoryBreakdown.map((c) => c.category);
    assert.ok(categories.includes("CLEANING"), "Costs category must include CLEANING");
    assert.ok(categories.includes("MAINTENANCE"), "Costs category must include MAINTENANCE");
  });

  await t.test("8. Task Cancellation voids associated OperatingExpense", async () => {
    assert.ok(createdTaskId);
    await hostOperationalRecordsService.updateCleaningTask(actor as any, createdTaskId, {
      status: OperationalTaskStatus.CANCELLED,
    });

    const expense = await prisma.operatingExpense.findFirst({
      where: { sourceReference: `cleaning-task:${createdTaskId}` },
    });
    assert.ok(expense);
    assert.equal(expense.status, OperatingExpenseStatus.VOIDED, "Expense must be voided on task cancellation");
    assert.ok(expense.voidedAt);
  });

  await t.test("9. Cleanup test records safely", async () => {
    if (createdTaskId) {
      await hostOperationalRecordsService.deleteCleaningTask(actor as any, createdTaskId);
    }
    if (createdMaintId) {
      await hostOperationalRecordsService.deleteMaintenanceRecord(actor as any, createdMaintId);
    }
  });
});
