"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import type { OperationalAlertItem, AlertStatus, AlertSeverity } from "@/services/host-operations.service";

export function HostAlertsCenter() {
  const [alerts, setAlerts] = useState<OperationalAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);

  async function loadAlerts() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/hosts/operations/alerts").then((r) => r.json());
      if (res.success) {
        setAlerts(res.data);
      }
    } catch (err) {
      console.error("Failed to load operational alerts:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  async function handleStatusChange(alertId: string, newStatus: AlertStatus) {
    setUpdatingAlertId(alertId);
    try {
      const res = await fetch(`/api/v1/admin/hosts/operations/alerts/${alertId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }).then((r) => r.json());

      if (res.success) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
        );
      } else {
        alert(res.error?.message || "Failed to update alert status");
      }
    } catch (err) {
      alert("Failed to update alert status");
    } finally {
      setUpdatingAlertId(null);
    }
  }

  const filteredAlerts = alerts.filter((a) => {
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
    return true;
  });

  const countByStatus = {
    NEW: alerts.filter((a) => a.status === "NEW").length,
    ACKNOWLEDGED: alerts.filter((a) => a.status === "ACKNOWLEDGED").length,
    IN_PROGRESS: alerts.filter((a) => a.status === "IN_PROGRESS").length,
    RESOLVED: alerts.filter((a) => a.status === "RESOLVED").length,
    DISMISSED: alerts.filter((a) => a.status === "DISMISSED").length,
  };

  return (
    <Container className="py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1>Operational Alerts Center</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
              Live Monitoring
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Real-time alerts for overdue applications, document expirations, critical compliance issues, and workload limits.
          </p>
        </div>

        <button
          onClick={loadAlerts}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-all shadow-xs"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Alerts
        </button>
      </div>

      {/* Alert Status Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: "NEW", label: "New Alerts", count: countByStatus.NEW, color: "text-rose-600", bg: "bg-rose-50" },
          { key: "ACKNOWLEDGED", label: "Acknowledged", count: countByStatus.ACKNOWLEDGED, color: "text-amber-600", bg: "bg-amber-50" },
          { key: "IN_PROGRESS", label: "In Progress", count: countByStatus.IN_PROGRESS, color: "text-blue-600", bg: "bg-blue-50" },
          { key: "RESOLVED", label: "Resolved", count: countByStatus.RESOLVED, color: "text-emerald-600", bg: "bg-emerald-50" },
          { key: "DISMISSED", label: "Dismissed", count: countByStatus.DISMISSED, color: "text-zinc-500", bg: "bg-zinc-100" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setStatusFilter(statusFilter === item.key ? "ALL" : item.key)}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              statusFilter === item.key ? "ring-2 ring-amber-500 border-amber-500 shadow-xs" : "border-zinc-200/80 bg-white"
            }`}
          >
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{item.label}</div>
            <div className={`text-xl font-semibold mt-1 ${item.color}`}>{item.count}</div>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-zinc-200/80 shadow-2xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-zinc-500">Filter Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-zinc-500">Filter Severity:</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 focus:outline-hidden"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-8 rounded-2xl text-center text-zinc-400">Loading operational alerts...</div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center text-zinc-400 border border-zinc-200/80">
            No operational alerts matching selected filters.
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 rounded-2xl border bg-white shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                alert.severity === "CRITICAL" ? "border-l-4 border-l-rose-500 border-zinc-200/80" :
                alert.severity === "HIGH" ? "border-l-4 border-l-amber-500 border-zinc-200/80" :
                "border-zinc-200/80"
              }`}
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    alert.severity === "CRITICAL" ? "bg-rose-100 text-rose-800" :
                    alert.severity === "HIGH" ? "bg-amber-100 text-amber-800" :
                    "bg-blue-100 text-blue-800"
                  }`}>
                    {alert.severity}
                  </span>

                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    {alert.alertType.replace(/_/g, " ")}
                  </span>

                  <span className="text-xs text-zinc-400 font-mono">
                    • {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-[#1F1F1F]">{alert.title}</h3>
                <p className="text-xs text-zinc-600">{alert.details}</p>
                <div className="text-xs text-zinc-400 mt-1">
                  Host: <strong className="text-zinc-700">{alert.hostName}</strong> ({alert.applicationId}) | Assigned: {alert.assignedUser?.name || "Unassigned"}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <Link
                  href={alert.actionUrl}
                  className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-800 text-xs font-semibold hover:bg-zinc-200 transition-colors"
                >
                  View Workflow →
                </Link>

                {alert.status !== "ACKNOWLEDGED" && alert.status !== "RESOLVED" && (
                  <button
                    onClick={() => handleStatusChange(alert.id, "ACKNOWLEDGED")}
                    disabled={updatingAlertId === alert.id}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                )}

                {alert.status !== "IN_PROGRESS" && alert.status !== "RESOLVED" && (
                  <button
                    onClick={() => handleStatusChange(alert.id, "IN_PROGRESS")}
                    disabled={updatingAlertId === alert.id}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Mark In Progress
                  </button>
                )}

                {alert.status !== "RESOLVED" && (
                  <button
                    onClick={() => handleStatusChange(alert.id, "RESOLVED")}
                    disabled={updatingAlertId === alert.id}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    Resolve Alert
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Container>
  );
}
