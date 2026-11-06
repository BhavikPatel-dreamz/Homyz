"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { AdminSectionHeader } from "@/components/admin/ui/admin-section-header";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AnalyticsAreaChart } from "../charts/analytics-area-chart";
import { AnalyticsBarChart, type BarChartItem } from "../charts/analytics-bar-chart";
import { AnalyticsDonutChart, type DonutSegment } from "../charts/analytics-donut-chart";
import type { OperationsAnalyticsData } from "@/services/admin-analytics/operations.service";

interface OperationsTabProps {
  operationsData: OperationsAnalyticsData;
  timeframeLabel: string;
  comparisonLabel: string;
}

type OperationsTrendView = "created" | "resolved" | "closed";

const formatDuration = (minutes: number | null | undefined) => {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hrs = Math.floor(minutes / 60);
  const remainingMins = Math.round(minutes % 60);
  return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
};

const priorityColors: Record<string, string> = {
  URGENT: "#E11D48", // rose-600
  HIGH: "#F59E0B", // amber-500
  MEDIUM: "#0284C7", // sky-600
  LOW: "#6B7280", // gray-500
};

const statusColors: Record<string, string> = {
  OPEN: "#0284C7", // sky-600
  IN_REVIEW: "#8B5CF6", // purple-500
  WAITING_FOR_ADMIN: "#F59E0B", // amber-500
  WAITING_FOR_USER: "#64748B", // slate-500
  REOPENED: "#E11D48", // rose-600
  RESOLVED: "#10B981", // emerald-500
  CLOSED: "#6B7280", // gray-500
  ESCALATED: "#DC2626", // red-600
};

export function OperationsTab({
  operationsData,
  timeframeLabel,
  comparisonLabel,
}: OperationsTabProps) {
  const [trendView, setTrendView] = useState<OperationsTrendView>("created");

  const { kpis, byCategory, byPriority, byStatus, dailyTrends } = operationsData;

  // Chart series mapping
  const chartSeries = dailyTrends.map((d) => {
    let value = 0;
    if (trendView === "created") value = d.createdCount;
    else if (trendView === "resolved") value = d.resolvedCount;
    else if (trendView === "closed") value = d.closedCount;

    return {
      dateKey: d.dateKey,
      label: d.label,
      value,
    };
  });

  const chartColor =
    trendView === "created" ? "amber" : trendView === "resolved" ? "emerald" : "sky";

  // Donut data for Priority
  const prioritySegments: DonutSegment[] = byPriority.map((p) => ({
    id: p.priority,
    label: p.priority,
    value: p.count,
    color: priorityColors[p.priority] || "#94A3B8",
  }));

  // Donut data for Status
  const statusSegments: DonutSegment[] = byStatus.map((s) => ({
    id: s.status,
    label: s.status.replace(/_/g, " "),
    value: s.count,
    color: statusColors[s.status] || "#94A3B8",
  }));

  // Bar chart data for Categories
  const categoryBarItems: BarChartItem[] = byCategory.slice(0, 7).map((c) => ({
    id: c.category,
    label: c.category.replace(/_/g, " "),
    value: c.count,
    formattedValue: `${c.count} (${c.percentage.toFixed(0)}%)`,
    color: "#D97706",
  }));

  return (
    <div className="flex flex-col gap-8 font-sans">
      {/* 1. Primary Operational KPIs (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <AdminStatCard
          label="Total Cases Created"
          value={kpis.totalCasesCreated.current.toLocaleString()}
          delta={
            kpis.totalCasesCreated.percentageChange !== null
              ? { value: kpis.totalCasesCreated.percentageChange }
              : null
          }
          comparisonText={comparisonLabel}
          accentColor="amber"
        />
        <AdminStatCard
          label="Active Backlog"
          value={kpis.activeBacklogCases.toLocaleString()}
          comparisonText="Open & in review"
          accentColor="sky"
        />
        <AdminStatCard
          label="Overdue SLA Cases"
          value={kpis.overdueCasesCount.toLocaleString()}
          comparisonText={kpis.overdueCasesCount > 0 ? "Requires action" : "All SLAs on track"}
          accentColor={kpis.overdueCasesCount > 0 ? "rose" : "emerald"}
        />
        <AdminStatCard
          label="First Response SLA"
          value={`${kpis.firstResponseSlaCompliancePercentage.current.toFixed(1)}%`}
          delta={
            kpis.firstResponseSlaCompliancePercentage.percentageChange !== null
              ? {
                  value: kpis.firstResponseSlaCompliancePercentage.percentageChange,
                  isPercentagePoint: kpis.firstResponseSlaCompliancePercentage.isPercentagePoint,
                }
              : null
          }
          comparisonText="Target ≥ 95%"
          accentColor="emerald"
        />
        <AdminStatCard
          label="Resolution SLA"
          value={`${kpis.resolutionSlaCompliancePercentage.current.toFixed(1)}%`}
          delta={
            kpis.resolutionSlaCompliancePercentage.percentageChange !== null
              ? {
                  value: kpis.resolutionSlaCompliancePercentage.percentageChange,
                  isPercentagePoint: kpis.resolutionSlaCompliancePercentage.isPercentagePoint,
                }
              : null
          }
          comparisonText="Target ≥ 90%"
          accentColor="emerald"
        />
        <AdminStatCard
          label="Avg Resolution Time"
          value={formatDuration(kpis.averageResolutionMinutes)}
          comparisonText={
            kpis.medianResolutionMinutes !== null
              ? `Median ${formatDuration(kpis.medianResolutionMinutes)}`
              : "Cases in period"
          }
          accentColor="violet"
        />
      </div>

      {/* Operational Attention Alert if Overdue or Escalated Cases Exist */}
      {(kpis.overdueCasesCount > 0 || kpis.escalatedCases.current > 0) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <div>
              <p className="text-rose-900 font-medium">
                {kpis.overdueCasesCount} Overdue SLA Cases & {kpis.escalatedCases.current} Escalated Incidents
              </p>
              <p className="text-rose-700 font-normal mt-0.5">
                Support cases have breached target response or resolution times. Prioritize pending mediation tickets.
              </p>
            </div>
          </div>
          <Link
            href="/admin/support?status=ESCALATED"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shrink-0 transition-colors shadow-2xs"
          >
            Open Support Queue →
          </Link>
        </div>
      )}

      {/* 2. Operations Activity Trend & SLA Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Support Trends Chart (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <AdminSectionHeader
                  title="Support Ticket Activity Trend"
                  subtitle={`Daily volume of cases created, resolved, and closed for ${timeframeLabel}`}
                  className="mb-0"
                />
              </div>

              {/* View Switcher Pills */}
              <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-secondary)] p-1 border border-[var(--border)] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTrendView("created")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    trendView === "created"
                      ? "bg-[var(--surface)] text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cases Created
                </button>
                <button
                  type="button"
                  onClick={() => setTrendView("resolved")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    trendView === "resolved"
                      ? "bg-[var(--surface)] text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cases Resolved
                </button>
                <button
                  type="button"
                  onClick={() => setTrendView("closed")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    trendView === "closed"
                      ? "bg-[var(--surface)] text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cases Closed
                </button>
              </div>
            </div>

            {/* Area Chart */}
            <div className="h-64 w-full">
              <AnalyticsAreaChart
                data={chartSeries}
                color={chartColor}
                valueFormatter={(val) => `${val.toLocaleString()} cases`}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between text-xs text-muted-foreground">
            <span className="font-normal">
              Continuous database aggregation via Prisma groupBy (no client truncation)
            </span>
            <span className="font-medium text-foreground">
              Total Created: {kpis.totalCasesCreated.current} | Resolved: {kpis.resolvedCases.current}
            </span>
          </div>
        </div>

        {/* Priority & Escalation Breakdown (1 col) */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col">
          <AdminSectionHeader
            title="Ticket Priority Distribution"
            subtitle="Current queue breakdown by severity level"
            className="mb-4"
          />

          <div className="my-auto">
            <AnalyticsDonutChart
              segments={prioritySegments}
              centerLabel="Active Tickets"
              centerValue={kpis.totalCasesCreated.current.toLocaleString()}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border)] text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-normal text-muted-foreground">Active Mediation Disputes</span>
              <span className="font-medium text-foreground">{kpis.activeDisputesCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-normal text-muted-foreground">Escalated to Leadership</span>
              <span className="font-medium text-amber-600">{kpis.escalatedCases.current}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Incident Categories and Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Support Categories Ranking (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col">
          <AdminSectionHeader
            title="Complaint & Support Categories"
            subtitle="Top inquiry themes reported by guests and hosts"
            className="mb-4"
          />

          {byCategory.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No recorded support cases for the selected date range.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <AnalyticsBarChart items={categoryBarItems} />
              </div>
              <div className="space-y-2 border-t md:border-t-0 md:border-l border-[var(--border)] pt-4 md:pt-0 md:pl-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Top Inquiry Types
                </p>
                {byCategory.slice(0, 5).map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between text-xs py-1">
                    <span className="text-foreground font-normal truncate max-w-[160px]">
                      {cat.category.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium text-muted-foreground">
                      {cat.count} ({cat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Case Status Distribution (1 col) */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col">
          <AdminSectionHeader
            title="Resolution Status"
            subtitle="Current operational lifecycle state"
            className="mb-4"
          />

          <div className="my-auto">
            <AnalyticsDonutChart
              segments={statusSegments}
              centerLabel="Total Tickets"
              centerValue={kpis.totalCasesCreated.current.toLocaleString()}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
            <span className="font-normal text-muted-foreground">Resolved in window</span>
            <span className="font-medium text-emerald-600">
              {kpis.resolvedCases.current.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

