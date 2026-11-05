"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { OperationalTaskStatus } from "@/generated/prisma/enums";

type OperationsData = Awaited<
  ReturnType<typeof import("@/services/host-operational-records.service")["hostOperationalRecordsService"]["overview"]>
>;

const money = (cents: number | null | undefined, currency = "SAR") => {
  if (cents === null || cents === undefined || cents === 0) return `${currency} 0`;
  const val = Math.round(cents / 100);
  return `${currency} ${val.toLocaleString("en-US")}`;
};

export function HostOperationsClient({
  initialData,
  initialListingId,
  initialCurrency,
}: {
  initialData: OperationsData;
  initialListingId: string;
  initialCurrency: string;
}) {
  const [data, setData] = useState<OperationsData>(initialData);
  const [filterListingId, setFilterListingId] = useState(initialListingId || "");
  const [taskListingId, setTaskListingId] = useState(initialListingId || initialData.listings[0]?.id || "");
  const [maintListingId, setMaintListingId] = useState(initialListingId || initialData.listings[0]?.id || "");

  // Form states - Cleaning
  const [cleaningTitle, setCleaningTitle] = useState("");
  const [cleaningScheduledFor, setCleaningScheduledFor] = useState("");
  const [cleaningCostSAR, setCleaningCostSAR] = useState("");
  const [cleaningNotes, setCleaningNotes] = useState("");
  const [cleaningBookingId, setCleaningBookingId] = useState("");

  // Form states - Maintenance
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceEquipment, setMaintenanceEquipment] = useState("");
  const [maintenanceServiceDate, setMaintenanceServiceDate] = useState("");
  const [maintenanceNextServiceDate, setMaintenanceNextServiceDate] = useState("");
  const [maintenanceCostSAR, setMaintenanceCostSAR] = useState("");
  const [maintenanceUsageReading, setMaintenanceUsageReading] = useState("");
  const [maintenanceUsageUnit, setMaintenanceUsageUnit] = useState("hours");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");

  // Filter tabs
  const [cleaningTab, setCleaningTab] = useState<"ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE">("ALL");
  const [maintTab, setMaintTab] = useState<"ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED">("ALL");

  // Cost modal state for quick completion
  const [completionModal, setCompletionModal] = useState<{
    type: "CLEANING" | "MAINTENANCE";
    id: string;
    title: string;
    costSAR: string;
  } | null>(null);

  const [saving, setSaving] = useState<"CLEANING" | "MAINTENANCE" | "UPDATING" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const currency = data.currency || initialCurrency || "SAR";

  const reload = async (listingId = filterListingId) => {
    const params = new URLSearchParams();
    if (listingId) params.set("listingId", listingId);
    if (currency) params.set("currency", currency);
    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(`/api/v1/host/operations${query}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || "Could not load operations data.");
    setData(payload.data);
  };

  const changeFilter = async (listingId: string) => {
    setFilterListingId(listingId);
    if (listingId) {
      setTaskListingId(listingId);
      setMaintListingId(listingId);
    }
    setError(null);
    setSuccess(null);

    // Update browser URL query without reload
    const url = new URL(window.location.href);
    if (listingId) {
      url.searchParams.set("listingId", listingId);
    } else {
      url.searchParams.delete("listingId");
      url.searchParams.delete("propertyId");
    }
    window.history.replaceState({}, "", url.toString());

    startTransition(async () => {
      try {
        await reload(listingId);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not filter operations.");
      }
    });
  };

  const onSelectCheckout = (checkoutId: string) => {
    setCleaningBookingId(checkoutId);
    const found = data.recentCheckouts.find((c) => c.bookingId === checkoutId);
    if (found) {
      setTaskListingId(found.listingId);
      setCleaningTitle(`Turnover clean: ${found.guestName}`);
      setCleaningScheduledFor(`${found.checkoutDate}T11:00`);
    }
  };

  const createCleaningTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskListingId || !cleaningTitle.trim()) {
      setError("Please choose a property and provide a task title.");
      return;
    }
    setSaving("CLEANING");
    setError(null);
    setSuccess(null);

    const costCents = cleaningCostSAR ? Math.round(Number.parseFloat(cleaningCostSAR) * 100) : null;
    if (costCents !== null && (Number.isNaN(costCents) || costCents < 0)) {
      setError("Cleaning cost must be a valid non-negative number.");
      setSaving(null);
      return;
    }

    try {
      const response = await fetch("/api/v1/host/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: taskListingId,
          bookingId: cleaningBookingId || null,
          title: cleaningTitle.trim(),
          scheduledFor: cleaningScheduledFor ? new Date(cleaningScheduledFor).toISOString() : null,
          actualExpenseCents: costCents,
          notes: cleaningNotes.trim() || null,
          currency,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Could not create cleaning task.");

      setCleaningTitle("");
      setCleaningScheduledFor("");
      setCleaningCostSAR("");
      setCleaningNotes("");
      setCleaningBookingId("");
      setSuccess("Cleaning task created successfully.");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create cleaning task.");
    } finally {
      setSaving(null);
    }
  };

  const createMaintenanceRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!maintListingId || !maintenanceTitle.trim()) {
      setError("Please choose a property and provide a maintenance title.");
      return;
    }
    setSaving("MAINTENANCE");
    setError(null);
    setSuccess(null);

    const costCents = maintenanceCostSAR ? Math.round(Number.parseFloat(maintenanceCostSAR) * 100) : null;
    if (costCents !== null && (Number.isNaN(costCents) || costCents < 0)) {
      setError("Maintenance cost must be a valid non-negative number.");
      setSaving(null);
      return;
    }

    const usageReading = maintenanceUsageReading ? Math.round(Number.parseFloat(maintenanceUsageReading)) : null;

    try {
      const response = await fetch("/api/v1/host/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MAINTENANCE",
          listingId: maintListingId,
          title: maintenanceTitle.trim(),
          equipmentReference: maintenanceEquipment.trim() || null,
          serviceDate: maintenanceServiceDate ? new Date(maintenanceServiceDate).toISOString() : null,
          nextServiceDate: maintenanceNextServiceDate ? new Date(maintenanceNextServiceDate).toISOString() : null,
          actualExpenseCents: costCents,
          usageReading,
          usageUnit: usageReading !== null ? maintenanceUsageUnit : null,
          notes: maintenanceNotes.trim() || null,
          currency,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Could not create maintenance record.");

      setMaintenanceTitle("");
      setMaintenanceEquipment("");
      setMaintenanceServiceDate("");
      setMaintenanceNextServiceDate("");
      setMaintenanceCostSAR("");
      setMaintenanceUsageReading("");
      setMaintenanceNotes("");
      setSuccess("Maintenance record created successfully.");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create maintenance record.");
    } finally {
      setSaving(null);
    }
  };

  const updateCleaningStatus = async (id: string, status: OperationalTaskStatus, expenseCents?: number | null) => {
    setError(null);
    setSuccess(null);
    setSaving("UPDATING");
    try {
      const body: Record<string, unknown> = { status };
      if (expenseCents !== undefined) {
        body.actualExpenseCents = expenseCents;
      }
      const response = await fetch(`/api/v1/host/operations/cleaning/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Could not update cleaning task.");
      setSuccess(`Task updated to ${status.replaceAll("_", " ")}.`);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the cleaning task.");
    } finally {
      setSaving(null);
    }
  };

  const deleteCleaningTask = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this cleaning task?")) return;
    setError(null);
    setSuccess(null);
    setSaving("UPDATING");
    try {
      const response = await fetch(`/api/v1/host/operations/cleaning/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete cleaning task.");
      setSuccess("Cleaning task deleted.");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete cleaning task.");
    } finally {
      setSaving(null);
    }
  };

  const updateMaintenanceStatus = async (id: string, status: OperationalTaskStatus, expenseCents?: number | null) => {
    setError(null);
    setSuccess(null);
    setSaving("UPDATING");
    try {
      const body: Record<string, unknown> = { status };
      if (expenseCents !== undefined) {
        body.actualExpenseCents = expenseCents;
      }
      const response = await fetch(`/api/v1/host/operations/maintenance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Could not update maintenance record.");
      setSuccess(`Maintenance record updated to ${status.replaceAll("_", " ")}.`);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update maintenance record.");
    } finally {
      setSaving(null);
    }
  };

  const deleteMaintenanceRecord = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this maintenance record?")) return;
    setError(null);
    setSuccess(null);
    setSaving("UPDATING");
    try {
      const response = await fetch(`/api/v1/host/operations/maintenance/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete maintenance record.");
      setSuccess("Maintenance record deleted.");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete maintenance record.");
    } finally {
      setSaving(null);
    }
  };

  const submitCompletionWithCost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!completionModal) return;
    const costCents = completionModal.costSAR ? Math.round(Number.parseFloat(completionModal.costSAR) * 100) : 0;
    if (Number.isNaN(costCents) || costCents < 0) {
      setError("Please enter a valid non-negative cost.");
      return;
    }

    if (completionModal.type === "CLEANING") {
      await updateCleaningStatus(completionModal.id, OperationalTaskStatus.COMPLETED, costCents);
    } else {
      await updateMaintenanceStatus(completionModal.id, OperationalTaskStatus.COMPLETED, costCents);
    }
    setCompletionModal(null);
  };

  // Filtered task lists
  const now = new Date();
  const filteredCleaningTasks = data.cleaning.tasks.filter((t) => {
    if (cleaningTab === "COMPLETED") return t.status === OperationalTaskStatus.COMPLETED;
    if (cleaningTab === "IN_PROGRESS") return t.status === OperationalTaskStatus.IN_PROGRESS;
    if (cleaningTab === "PENDING") {
      return t.status === OperationalTaskStatus.PENDING || t.status === OperationalTaskStatus.SCHEDULED;
    }
    if (cleaningTab === "OVERDUE") {
      return (
        t.status !== OperationalTaskStatus.COMPLETED &&
        t.status !== OperationalTaskStatus.CANCELLED &&
        t.scheduledFor &&
        new Date(t.scheduledFor) < now
      );
    }
    return true;
  });

  const filteredMaintenanceRecords = data.maintenance.records.filter((m) => {
    if (maintTab === "COMPLETED") return m.status === OperationalTaskStatus.COMPLETED;
    if (maintTab === "IN_PROGRESS") return m.status === OperationalTaskStatus.IN_PROGRESS;
    if (maintTab === "PENDING") {
      return m.status === OperationalTaskStatus.PENDING || m.status === OperationalTaskStatus.SCHEDULED;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* ── 1. Top Header & Property Filter ── */}
      <header className="border-b border-zinc-200 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-800">
                DASHBOARD PLUS · PROPERTY OPERATIONS
              </span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-medium tracking-tight text-zinc-950">
              Property operations & turnover
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500 font-normal leading-relaxed max-w-2xl">
              Manage turnover cleaning workflows, track preventative maintenance, and record operational expenses that
              feed directly into your financial analytics.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/host/earnings/analytics"
              className="text-xs font-medium text-zinc-600 hover:text-zinc-950 underline underline-offset-4 transition"
            >
              Advanced Earnings & Profit
            </Link>
            <span className="text-zinc-300">·</span>
            <Link
              href="/host/dashboard"
              className="text-xs font-medium text-zinc-600 hover:text-zinc-950 underline underline-offset-4 transition"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <label className="block text-xs font-medium text-zinc-700">
            <span>Filter by property:</span>
            <select
              aria-label="Filter operations by property"
              value={filterListingId}
              onChange={(event) => void changeFilter(event.target.value)}
              className="mt-1 block min-w-[260px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal text-zinc-900 shadow-2xs focus:border-zinc-950 focus:outline-hidden"
            >
              <option value="">All authorized listings ({data.listings.length})</option>
              {data.listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title}
                </option>
              ))}
            </select>
          </label>

          {data.selectedListingId && (
            <button
              type="button"
              onClick={() => void changeFilter("")}
              className="mt-5 text-xs font-medium text-amber-800 hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      </header>

      {/* ── Alerts ── */}
      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-normal text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-600 hover:text-rose-950 font-medium ml-4">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-normal text-emerald-800 flex items-center justify-between">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-950 font-medium ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* ── 2. Top 5 Operational KPI Cards ── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Cleaning tasks"
          value={data.cleaning.total}
          subtitle={`${data.cleaning.inProgress} in progress`}
        />
        <MetricCard
          label="Completed"
          value={data.cleaning.completed}
          subtitle={
            data.cleaning.averageCompletionHours !== null
              ? `Avg ${data.cleaning.averageCompletionHours}h turnaround`
              : "No completion records"
          }
        />
        <MetricCard
          label="Pending / Scheduled"
          value={data.cleaning.pending}
          subtitle="Awaiting turnover"
        />
        <MetricCard
          label="Overdue cleaning"
          value={data.cleaning.delayed}
          alert={data.cleaning.delayed > 0}
          subtitle={data.cleaning.delayed > 0 ? "Action required" : "All tasks on time"}
        />
        <MetricCard
          label="Total operations cost"
          value={money(data.financialSummary.totalOperationsExpenseCents, currency)}
          subtitle={`Cleaning: ${money(data.financialSummary.recordedCleaningExpensesCents, currency)} · Maint: ${money(data.financialSummary.recordedMaintenanceExpensesCents, currency)}`}
        />
      </section>

      {/* ── 3. Cleaning Tasks Workflow Section ── */}
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] items-start">
        {/* Left: Cleaning Tasks List */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-800">Turnover workflow</p>
              <h2 className="mt-0.5 text-lg font-medium text-zinc-950">Cleaning tasks</h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setCleaningTab("ALL")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  cleaningTab === "ALL" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                All ({data.cleaning.total})
              </button>
              <button
                type="button"
                onClick={() => setCleaningTab("PENDING")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  cleaningTab === "PENDING" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                Pending ({data.cleaning.pending})
              </button>
              <button
                type="button"
                onClick={() => setCleaningTab("IN_PROGRESS")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  cleaningTab === "IN_PROGRESS" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                In Progress ({data.cleaning.inProgress})
              </button>
              <button
                type="button"
                onClick={() => setCleaningTab("COMPLETED")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  cleaningTab === "COMPLETED" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                Completed ({data.cleaning.completed})
              </button>
              {data.cleaning.delayed > 0 && (
                <button
                  type="button"
                  onClick={() => setCleaningTab("OVERDUE")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition text-rose-700 ${
                    cleaningTab === "OVERDUE" ? "bg-rose-50 shadow-2xs" : "hover:text-rose-900"
                  }`}
                >
                  Overdue ({data.cleaning.delayed})
                </button>
              )}
            </div>
          </div>

          {/* Task List Items */}
          <div className="mt-4 divide-y divide-zinc-100">
            {filteredCleaningTasks.length > 0 ? (
              filteredCleaningTasks.map((task) => {
                const isOverdue =
                  task.status !== OperationalTaskStatus.COMPLETED &&
                  task.status !== OperationalTaskStatus.CANCELLED &&
                  task.scheduledFor &&
                  new Date(task.scheduledFor) < now;

                return (
                  <div key={task.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full shrink-0 ${
                            task.status === "COMPLETED"
                              ? "bg-emerald-500"
                              : task.status === "IN_PROGRESS"
                                ? "bg-blue-500"
                                : task.status === "CANCELLED"
                                  ? "bg-zinc-300"
                                  : isOverdue
                                    ? "bg-rose-500"
                                    : "bg-amber-400"
                          }`}
                        />
                        <p className="text-sm font-medium text-zinc-950 truncate">{task.title}</p>
                        {isOverdue && (
                          <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                            Overdue
                          </span>
                        )}
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                            task.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-800"
                              : task.status === "IN_PROGRESS"
                                ? "bg-blue-50 text-blue-800"
                                : task.status === "CANCELLED"
                                  ? "bg-zinc-100 text-zinc-600"
                                  : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {task.status.replaceAll("_", " ")}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 font-normal">
                        <span>{task.listingTitle}</span>
                        <span>·</span>
                        <span>
                          {task.scheduledFor
                            ? new Date(task.scheduledFor).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "No scheduled date"}
                        </span>
                        {task.actualExpenseCents !== null && task.actualExpenseCents !== undefined && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-zinc-900">
                              Cost: {money(task.actualExpenseCents, task.currency || currency)}
                            </span>
                          </>
                        )}
                      </div>

                      {task.guestName && (
                        <p className="mt-1 text-[11px] text-zinc-500 font-normal">
                          Linked stay: {task.guestName} ({task.bookingDates})
                        </p>
                      )}

                      {task.notes && (
                        <p className="mt-1 text-xs text-zinc-600 font-normal italic bg-zinc-50 p-2 rounded-lg">
                          &ldquo;{task.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
                        <>
                          {task.status !== "IN_PROGRESS" && (
                            <button
                              type="button"
                              onClick={() => void updateCleaningStatus(task.id, OperationalTaskStatus.IN_PROGRESS)}
                              disabled={saving !== null}
                              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
                            >
                              Start
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setCompletionModal({
                                type: "CLEANING",
                                id: task.id,
                                title: task.title,
                                costSAR: task.actualExpenseCents ? (task.actualExpenseCents / 100).toString() : "",
                              })
                            }
                            disabled={saving !== null}
                            className="rounded-lg bg-zinc-950 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition"
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateCleaningStatus(task.id, OperationalTaskStatus.CANCELLED)}
                            disabled={saving !== null}
                            className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {task.status === "COMPLETED" && (
                        <button
                          type="button"
                          onClick={() =>
                            setCompletionModal({
                              type: "CLEANING",
                              id: task.id,
                              title: task.title,
                              costSAR: task.actualExpenseCents ? (task.actualExpenseCents / 100).toString() : "",
                            })
                          }
                          disabled={saving !== null}
                          className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
                        >
                          Edit cost
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void deleteCleaningTask(task.id)}
                        disabled={saving !== null}
                        className="rounded-lg p-1.5 text-xs text-zinc-400 hover:text-rose-600 transition"
                        aria-label="Delete cleaning task"
                      >
                        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center text-xs text-zinc-500 font-normal">
                <p>No cleaning tasks found in this view.</p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Completed stays do not automatically complete cleaning tasks. Turnover cleaning is an explicit operational action.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Add Cleaning Task Form */}
        <form onSubmit={createCleaningTask} className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-5 sm:p-6 shadow-2xs">
          <p className="text-[11px] font-medium uppercase tracking-wider text-amber-800">New turnover task</p>
          <h2 className="mt-0.5 text-lg font-medium text-zinc-950">Add cleaning task</h2>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Property</label>
              <select
                aria-label="Select property for cleaning task"
                value={taskListingId}
                onChange={(e) => setTaskListingId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
              >
                {data.listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>

            {data.recentCheckouts.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-zinc-700">
                  Link to checkout stay (optional)
                </label>
                <select
                  aria-label="Link to checkout stay"
                  value={cleaningBookingId}
                  onChange={(e) => onSelectCheckout(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
                >
                  <option value="">Select a reservation to auto-populate...</option>
                  {data.recentCheckouts.map((c) => (
                    <option key={c.bookingId} value={c.bookingId}>
                      {c.listingTitle} · {c.guestName} (Checkout {c.checkoutDate})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-700">Task title *</label>
              <input
                value={cleaningTitle}
                onChange={(e) => setCleaningTitle(e.target.value)}
                placeholder="e.g. Turnover clean & linen change"
                required
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Scheduled date & time</label>
              <input
                type="datetime-local"
                value={cleaningScheduledFor}
                onChange={(e) => setCleaningScheduledFor(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Cleaning cost ({currency}) (optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cleaningCostSAR}
                onChange={(e) => setCleaningCostSAR(e.target.value)}
                placeholder="e.g. 150"
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
              />
              <span className="mt-0.5 text-[10px] text-zinc-400 font-normal block">
                Recorded cleaning costs automatically sync into Dashboard Plus operating expenses.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Notes (optional)</label>
              <textarea
                value={cleaningNotes}
                onChange={(e) => setCleaningNotes(e.target.value)}
                rows={2}
                placeholder="Special instructions or supplies needed..."
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
              />
            </div>

            <button
              type="submit"
              disabled={saving !== null}
              className="mt-2 w-full rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              {saving === "CLEANING" ? "Creating task…" : "Create cleaning task"}
            </button>
          </div>
        </form>
      </section>

      {/* ── 4. Maintenance Service Records Section ── */}
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] items-start">
        {/* Left: Maintenance Records List */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-800">Asset upkeep</p>
              <h2 className="mt-0.5 text-lg font-medium text-zinc-950">Maintenance & service records</h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setMaintTab("ALL")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  maintTab === "ALL" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                All ({data.maintenance.total})
              </button>
              <button
                type="button"
                onClick={() => setMaintTab("PENDING")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  maintTab === "PENDING" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                Pending ({data.maintenance.pending})
              </button>
              <button
                type="button"
                onClick={() => setMaintTab("IN_PROGRESS")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  maintTab === "IN_PROGRESS" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                In Progress ({data.maintenance.inProgress})
              </button>
              <button
                type="button"
                onClick={() => setMaintTab("COMPLETED")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  maintTab === "COMPLETED" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                Completed ({data.maintenance.completed})
              </button>
            </div>
          </div>

          <div className="mt-4 divide-y divide-zinc-100">
            {filteredMaintenanceRecords.length > 0 ? (
              filteredMaintenanceRecords.map((record) => {
                const isOverdue =
                  record.status !== OperationalTaskStatus.COMPLETED &&
                  record.status !== OperationalTaskStatus.CANCELLED &&
                  ((record.serviceDate && new Date(record.serviceDate) < now) ||
                    (record.nextServiceDate && new Date(record.nextServiceDate) < now));

                return (
                  <div key={record.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full shrink-0 ${
                            record.status === "COMPLETED"
                              ? "bg-emerald-500"
                              : record.status === "IN_PROGRESS"
                                ? "bg-blue-500"
                                : record.status === "CANCELLED"
                                  ? "bg-zinc-300"
                                  : isOverdue
                                    ? "bg-rose-500"
                                    : "bg-amber-400"
                          }`}
                        />
                        <p className="text-sm font-medium text-zinc-950 truncate">{record.title}</p>
                        {record.equipmentReference && (
                          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                            {record.equipmentReference}
                          </span>
                        )}
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                            record.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-800"
                              : record.status === "IN_PROGRESS"
                                ? "bg-blue-50 text-blue-800"
                                : record.status === "CANCELLED"
                                  ? "bg-zinc-100 text-zinc-600"
                                  : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {record.status.replaceAll("_", " ")}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 font-normal">
                        <span>{record.listingTitle}</span>
                        <span>·</span>
                        <span>
                          {record.serviceDate
                            ? `Service: ${new Date(record.serviceDate).toLocaleDateString()}`
                            : "Service date not set"}
                        </span>
                        {record.nextServiceDate && (
                          <>
                            <span>·</span>
                            <span className={isOverdue ? "text-rose-700 font-medium" : ""}>
                              Next service: {new Date(record.nextServiceDate).toLocaleDateString()}
                            </span>
                          </>
                        )}
                        {record.actualExpenseCents !== null && record.actualExpenseCents !== undefined && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-zinc-900">
                              Cost: {money(record.actualExpenseCents, record.currency || currency)}
                            </span>
                          </>
                        )}
                        {record.usageReading !== null && record.usageReading !== undefined && (
                          <>
                            <span>·</span>
                            <span>
                              Meter: {record.usageReading} {record.usageUnit || "units"}
                            </span>
                          </>
                        )}
                      </div>

                      {record.notes && (
                        <p className="mt-1 text-xs text-zinc-600 font-normal italic bg-zinc-50 p-2 rounded-lg">
                          &ldquo;{record.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {record.status !== "COMPLETED" && record.status !== "CANCELLED" && (
                        <>
                          {record.status !== "IN_PROGRESS" && (
                            <button
                              type="button"
                              onClick={() => void updateMaintenanceStatus(record.id, OperationalTaskStatus.IN_PROGRESS)}
                              disabled={saving !== null}
                              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
                            >
                              Start
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setCompletionModal({
                                type: "MAINTENANCE",
                                id: record.id,
                                title: record.title,
                                costSAR: record.actualExpenseCents ? (record.actualExpenseCents / 100).toString() : "",
                              })
                            }
                            disabled={saving !== null}
                            className="rounded-lg bg-zinc-950 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition"
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateMaintenanceStatus(record.id, OperationalTaskStatus.CANCELLED)}
                            disabled={saving !== null}
                            className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {record.status === "COMPLETED" && (
                        <button
                          type="button"
                          onClick={() =>
                            setCompletionModal({
                              type: "MAINTENANCE",
                              id: record.id,
                              title: record.title,
                              costSAR: record.actualExpenseCents ? (record.actualExpenseCents / 100).toString() : "",
                            })
                          }
                          disabled={saving !== null}
                          className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
                        >
                          Edit cost
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void deleteMaintenanceRecord(record.id)}
                        disabled={saving !== null}
                        className="rounded-lg p-1.5 text-xs text-zinc-400 hover:text-rose-600 transition"
                        aria-label="Delete maintenance record"
                      >
                        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center text-xs text-zinc-500 font-normal">
                <p>No maintenance records found in this view.</p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {data.maintenance.message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Add Maintenance Record Form */}
        <form onSubmit={createMaintenanceRecord} className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-5 sm:p-6 shadow-2xs">
          <p className="text-[11px] font-medium uppercase tracking-wider text-amber-800">Preventative maintenance</p>
          <h2 className="mt-0.5 text-lg font-medium text-zinc-950">Add maintenance record</h2>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Property</label>
              <select
                aria-label="Select property for maintenance record"
                value={maintListingId}
                onChange={(e) => setMaintListingId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
              >
                {data.listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Service title *</label>
              <input
                value={maintenanceTitle}
                onChange={(e) => setMaintenanceTitle(e.target.value)}
                placeholder="e.g. AC service & coolant refill"
                required
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Equipment / Asset reference</label>
              <input
                value={maintenanceEquipment}
                onChange={(e) => setMaintenanceEquipment(e.target.value)}
                placeholder="e.g. Living Room AC, Water Heater"
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Service date</label>
                <input
                  type="date"
                  value={maintenanceServiceDate}
                  onChange={(e) => setMaintenanceServiceDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700">Next service due</label>
                <input
                  type="date"
                  value={maintenanceNextServiceDate}
                  onChange={(e) => setMaintenanceNextServiceDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Service cost ({currency}) (optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={maintenanceCostSAR}
                onChange={(e) => setMaintenanceCostSAR(e.target.value)}
                placeholder="e.g. 350"
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
              />
              <span className="mt-0.5 text-[10px] text-zinc-400 font-normal block">
                Recorded maintenance costs automatically sync into Dashboard Plus operating expenses.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Meter / Usage reading</label>
                <input
                  type="number"
                  min="0"
                  value={maintenanceUsageReading}
                  onChange={(e) => setMaintenanceUsageReading(e.target.value)}
                  placeholder="e.g. 2400"
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700">Unit</label>
                <input
                  value={maintenanceUsageUnit}
                  onChange={(e) => setMaintenanceUsageUnit(e.target.value)}
                  placeholder="e.g. hours, cycles"
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Notes (optional)</label>
              <textarea
                value={maintenanceNotes}
                onChange={(e) => setMaintenanceNotes(e.target.value)}
                rows={2}
                placeholder="Technician details, invoice number, warranty notes..."
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-normal"
              />
            </div>

            <button
              type="submit"
              disabled={saving !== null}
              className="mt-2 w-full rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              {saving === "MAINTENANCE" ? "Creating record…" : "Create maintenance record"}
            </button>
          </div>
        </form>
      </section>

      {/* ── Quick Completion / Cost Modal ── */}
      {completionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitCompletionWithCost}
            className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl space-y-4"
          >
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-800">
                {completionModal.type === "CLEANING" ? "Turnover Completion" : "Maintenance Completion"}
              </p>
              <h3 className="mt-1 text-base font-medium text-zinc-950">{completionModal.title}</h3>
              <p className="mt-1 text-xs text-zinc-500 font-normal">
                Confirm completion and record the actual expense paid. This expense will flow directly into your Dashboard Plus operating costs.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Actual expense amount ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={completionModal.costSAR}
                onChange={(e) => setCompletionModal({ ...completionModal, costSAR: e.target.value })}
                placeholder="e.g. 150 (leave empty or 0 if no direct expense)"
                className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-normal focus:border-zinc-950 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompletionModal(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving !== null}
                className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50"
              >
                {saving === "UPDATING" ? "Saving…" : "Save & Complete"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  alert,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 transition ${alert ? "border-rose-200 bg-rose-50/40" : "border-zinc-200 bg-white"}`}>
      <p className="text-xs font-normal text-zinc-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-medium tracking-tight ${alert ? "text-rose-700" : "text-zinc-950"}`}>
        {value}
      </p>
      {subtitle && <p className="mt-1 text-[11px] font-normal text-zinc-400">{subtitle}</p>}
    </div>
  );
}
