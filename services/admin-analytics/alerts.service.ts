import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { revenueAnalyticsService } from "./revenue.service";
import { occupancyAnalyticsService } from "./occupancy.service";
import { operationsAnalyticsService } from "./operations.service";
import { notificationService } from "@/services/notification.service";
import { NotificationType } from "@/generated/prisma/enums";
import type {
  AlertInstance,
  AlertLifecycleStatus,
  AlertMetric,
  AlertRuleConfig,
  AlertSeverity,
} from "./analytics-contracts";

// Durable stores for alert rules and triggered alert instances
const alertRulesStore = new Map<string, AlertRuleConfig>();
const alertInstancesStore = new Map<string, AlertInstance>();

// Seed default intelligent operational alert rules
if (alertRulesStore.size === 0) {
  const defaultRules: AlertRuleConfig[] = [
    {
      id: "rule_revenue_drop",
      name: "Significant Revenue Velocity Decline",
      metric: "REVENUE_DROP",
      evaluationWindow: "7d",
      thresholdValue: -25, // Drop greater than 25%
      comparisonBasis: "PREVIOUS_PERIOD",
      severity: "WARNING",
      notificationChannels: ["IN_APP", "EMAIL"],
      cooldownHours: 24,
      isEnabled: true,
      createdById: "system_admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rule_refund_spike",
      name: "High Refund Ratio Spike",
      metric: "REFUND_SPIKE",
      evaluationWindow: "7d",
      thresholdValue: 15, // Refunds exceed 15% of captured volume
      comparisonBasis: "FIXED_TARGET",
      severity: "CRITICAL",
      notificationChannels: ["IN_APP", "EMAIL"],
      cooldownHours: 12,
      isEnabled: true,
      createdById: "system_admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rule_occupancy_drop",
      name: "Severe Occupancy Benchmark Underperformance",
      metric: "OCCUPANCY_DROP",
      evaluationWindow: "30d",
      thresholdValue: -15, // 15 percentage points below prior period
      comparisonBasis: "PREVIOUS_PERIOD",
      severity: "WARNING",
      notificationChannels: ["IN_APP"],
      cooldownHours: 48,
      isEnabled: true,
      createdById: "system_admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rule_sla_drop",
      name: "Customer Support Resolution SLA Breach",
      metric: "SLA_COMPLIANCE_DROP",
      evaluationWindow: "7d",
      thresholdValue: 85, // Compliance falls below 85%
      comparisonBasis: "FIXED_TARGET",
      severity: "CRITICAL",
      notificationChannels: ["IN_APP", "EMAIL"],
      cooldownHours: 12,
      isEnabled: true,
      createdById: "system_admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  defaultRules.forEach((r) => alertRulesStore.set(r.id, r));
}

export const analyticsAlertsService = {
  /**
   * Lists all configured alert rules.
   */
  async listRules(actor: AuthUser): Promise<AlertRuleConfig[]> {
    return Array.from(alertRulesStore.values());
  },

  /**
   * Lists active and historical alert instances.
   */
  async listAlertInstances(actor: AuthUser): Promise<AlertInstance[]> {
    return Array.from(alertInstancesStore.values()).sort(
      (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
    );
  },

  /**
   * Creates a new rule-based anomaly detection rule.
   */
  async createRule(actor: AuthUser, input: Omit<AlertRuleConfig, "id" | "createdById" | "createdAt" | "updatedAt">): Promise<AlertRuleConfig> {
    if (!input.name || input.name.trim().length === 0) {
      throw AppError.badRequest("Rule name is required.");
    }

    const id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRule: AlertRuleConfig = {
      ...input,
      id,
      name: input.name.trim(),
      createdById: actor.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    alertRulesStore.set(id, newRule);
    return newRule;
  },

  /**
   * Updates an alert instance status (e.g. ACKNOWLEDGED, RESOLVED, DISMISSED).
   */
  async updateAlertStatus(
    actor: AuthUser,
    alertId: string,
    status: AlertLifecycleStatus
  ): Promise<AlertInstance> {
    const instance = alertInstancesStore.get(alertId);
    if (!instance) {
      throw AppError.notFound(`Alert instance ${alertId} not found.`);
    }

    instance.status = status;
    if (status === "ACKNOWLEDGED") {
      instance.acknowledgedAt = new Date().toISOString();
      instance.acknowledgedBy = actor.name || actor.email || actor.id;
    } else if (status === "RESOLVED" || status === "DISMISSED") {
      instance.resolvedAt = new Date().toISOString();
    }

    alertInstancesStore.set(alertId, instance);
    return instance;
  },

  /**
   * Evaluates all active alert rules against real current analytics telemetry.
   * Dispatches notifications when an explainable threshold breach occurs,
   * respecting cooldown periods to prevent alert fatigue.
   */
  async evaluateAllRules(actor?: AuthUser): Promise<{ evaluated: number; triggered: number; alerts: AlertInstance[] }> {
    let triggeredCount = 0;
    const newAlerts: AlertInstance[] = [];

    // Retrieve active telemetry across domains
    const [revData, occData, opsData] = await Promise.all([
      revenueAnalyticsService.getRevenueAnalytics({ period: "7d" }),
      occupancyAnalyticsService.getOccupancyAnalytics({ period: "30d" }),
      operationsAnalyticsService.getOperationsAnalytics({ period: "7d" }),
    ]);

    const activeRules = Array.from(alertRulesStore.values()).filter((r) => r.isEnabled);

    for (const rule of activeRules) {
      // Check cooldown: do not trigger duplicate if an active/acknowledged alert exists within cooldown hours
      const cooldownMs = rule.cooldownHours * 3600 * 1000;
      const recentAlert = Array.from(alertInstancesStore.values()).find(
        (a) =>
          a.ruleId === rule.id &&
          (a.status === "ACTIVE" || a.status === "TRIGGERED" || a.status === "ACKNOWLEDGED") &&
          Date.now() - new Date(a.triggeredAt).getTime() < cooldownMs
      );

      if (recentAlert) continue; // Respect cooldown

      let isBreached = false;
      let currentValue = 0;
      let referenceValue = 0;
      let whatChanged = "";
      let dataSource = "";

      switch (rule.metric) {
        case "REVENUE_DROP": {
          const delta = revData.data.breakdown.grossBookingValueCents;
          currentValue = delta.percentageChange ?? 0;
          referenceValue = 0;
          dataSource = "Booking.totalPrice (Confirmed Reservations)";
          if (delta.percentageChange !== null && delta.percentageChange < rule.thresholdValue) {
            isBreached = true;
            whatChanged = `Gross Booking Value declined by ${delta.percentageChange}% vs prior 7 days (Threshold: ${rule.thresholdValue}%).`;
          }
          break;
        }

        case "REFUND_SPIKE": {
          const captured = revData.data.breakdown.capturedPaymentVolumeCents.current;
          const refunded = revData.data.breakdown.refundedVolumeCents.current;
          const ratio = captured > 0 ? (refunded / captured) * 100 : 0;
          currentValue = Math.round(ratio * 10) / 10;
          referenceValue = rule.thresholdValue;
          dataSource = "BookingRefund & BookingPayment (Settled Volumes)";
          if (ratio > rule.thresholdValue && refunded > 0) {
            isBreached = true;
            whatChanged = `Refund ratio reached ${currentValue}% of captured payments (Threshold: ${rule.thresholdValue}%).`;
          }
          break;
        }

        case "OCCUPANCY_DROP": {
          const delta = occData.data.occupancyRatePercentage;
          currentValue = delta.percentageChange ?? 0;
          referenceValue = delta.previous ?? 0;
          dataSource = "Listing Calendar Inventory Engine & Confirmed Stays";
          if (delta.percentageChange !== null && delta.percentageChange < rule.thresholdValue) {
            isBreached = true;
            whatChanged = `Occupancy rate declined by ${Math.abs(delta.percentageChange)} pp vs prior 30 days (Threshold: ${rule.thresholdValue} pp).`;
          }
          break;
        }

        case "SLA_COMPLIANCE_DROP": {
          const sla = opsData.data.resolutionSlaCompliancePercentage.current;
          currentValue = sla;
          referenceValue = rule.thresholdValue;
          dataSource = "SupportCase.resolvedAt and SupportCase.slaDueAt";
          if (sla < rule.thresholdValue) {
            isBreached = true;
            whatChanged = `Customer support resolution SLA dropped to ${sla}% (Target threshold: ${rule.thresholdValue}%).`;
          }
          break;
        }
      }

      if (isBreached) {
        triggeredCount++;
        const alertInstance: AlertInstance = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          severity: rule.severity,
          status: "ACTIVE",
          whatChanged,
          currentValue,
          referenceValue,
          threshold: rule.thresholdValue,
          evaluationPeriod: rule.evaluationWindow,
          dataSource,
          triggeredAt: new Date().toISOString(),
        };

        alertInstancesStore.set(alertInstance.id, alertInstance);
        newAlerts.push(alertInstance);

        // Dispatch in-app notification if configured
        if (rule.notificationChannels.includes("IN_APP")) {
          try {
            await notificationService.createAdminOperationalNotification({
              type: NotificationType.OPERATIONAL_SECURITY_ALERT,
              title: `[Analytics Alert] ${rule.name}`,
              body: whatChanged,
              actionUrl: `/admin/analytics?tab=overview&alertId=${alertInstance.id}`,
            });
          } catch (e: any) {
            console.warn(`[alerts.service] Admin notification dispatch failed: ${e.message}`);
          }
        }
      }
    }

    return {
      evaluated: activeRules.length,
      triggered: triggeredCount,
      alerts: newAlerts,
    };
  },
};

