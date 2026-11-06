import { distributedEventBusService } from "../events/distributed-event-bus.service";
import type {
  OperationalAnomalyAlert,
  AnomalyCategory,
  AnomalyAlertStatus,
  RiskSeverity,
} from "./dispute-contracts";

export class AnomalyMonitorService {
  private static instance: AnomalyMonitorService;
  private alerts: Map<string, OperationalAnomalyAlert> = new Map();
  // Cooldown store: key -> last alert timestamp
  private cooldowns: Map<string, number> = new Map();
  private readonly COOLDOWN_WINDOW_MS = 60 * 60 * 1000; // 1 hour cooldown

  private constructor() {
    this.seedDefaultAlerts();
  }

  public static getInstance(): AnomalyMonitorService {
    if (!AnomalyMonitorService.instance) {
      AnomalyMonitorService.instance = new AnomalyMonitorService();
    }
    return AnomalyMonitorService.instance;
  }

  private seedDefaultAlerts(): void {
    const alert1: OperationalAnomalyAlert = {
      alertId: "alt_pay_spike_01",
      category: "PAYMENT",
      metric: "gateway_failure_rate_pct",
      actualValue: 34.5,
      baselineValue: 3.2,
      reportingPeriod: "Last 24 Hours",
      threshold: 15.0,
      severity: "HIGH",
      relevantEntities: ["Mada / Saudi Payment Gateway", "Stripe Middle East"],
      explanation: "Payment failure rate surged to 34.5% compared to 30-day baseline of 3.2%",
      dataQualityWarning: "Includes card decline retry bursts from 3 corporate guest accounts",
      status: "ACTIVE",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    };

    const alert2: OperationalAnomalyAlert = {
      alertId: "alt_sla_breach_02",
      category: "SUPPORT",
      metric: "unresolved_critical_cases_count",
      actualValue: 8,
      baselineValue: 1,
      reportingPeriod: "Last 12 Hours",
      threshold: 4,
      severity: "CRITICAL",
      relevantEntities: ["Tier-2 Escalations", "Case CAS-9012", "Case CAS-9015"],
      explanation: "8 high-priority customer support cases have exceeded maximum SLA target response time",
      status: "UNDER_REVIEW",
      acknowledgedBy: "usr_admin_ops",
      acknowledgedAt: new Date(Date.now() - 1800000).toISOString(),
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
    };

    this.alerts.set(alert1.alertId, alert1);
    this.alerts.set(alert2.alertId, alert2);
  }

  /**
   * Evaluates operational metrics and raises an anomaly alert if threshold is breached.
   * Respects cooldowns and deduplication rules.
   */
  public async evaluateAndRaiseAlert(params: {
    category: AnomalyCategory;
    metric: string;
    actualValue: number;
    baselineValue: number;
    threshold: number;
    severity: RiskSeverity;
    relevantEntities: string[];
    explanation: string;
    dataQualityWarning?: string;
  }): Promise<{ raised: boolean; alert?: OperationalAnomalyAlert; reason?: string }> {
    // 1. Threshold check
    if (params.actualValue < params.threshold) {
      return { raised: false, reason: "Metric within normal operational threshold." };
    }

    // 2. Cooldown & Deduplication check
    const cooldownKey = `${params.category}_${params.metric}`;
    const lastTriggered = this.cooldowns.get(cooldownKey);
    const now = Date.now();

    if (lastTriggered && now - lastTriggered < this.COOLDOWN_WINDOW_MS) {
      return {
        raised: false,
        reason: `Alert suppressed by active cooldown window (${Math.round((this.COOLDOWN_WINDOW_MS - (now - lastTriggered)) / 60000)} minutes remaining).`,
      };
    }

    this.cooldowns.set(cooldownKey, now);

    const alertId = `alt_${params.category.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const alert: OperationalAnomalyAlert = {
      alertId,
      category: params.category,
      metric: params.metric,
      actualValue: params.actualValue,
      baselineValue: params.baselineValue,
      reportingPeriod: "Current Evaluation Window",
      threshold: params.threshold,
      severity: params.severity,
      relevantEntities: params.relevantEntities,
      explanation: params.explanation,
      dataQualityWarning: params.dataQualityWarning,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.alerts.set(alertId, alert);

    // Broadcast across distributed event bus for real-time dashboard notifications
    try {
      await distributedEventBusService.publishEvent(
        "SUPPORT_ESCALATED",
        {
          alertId,
          category: params.category,
          severity: params.severity,
          explanation: params.explanation,
        },
        "anomaly_monitor"
      );
    } catch {
      // Offline fallback
    }

    return { raised: true, alert };
  }

  /**
   * Updates an alert lifecycle status
   */
  public updateAlertStatus(
    alertId: string,
    status: AnomalyAlertStatus,
    actorId: string
  ): OperationalAnomalyAlert {
    const alert = this.alerts.get(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found`);

    alert.status = status;
    alert.updatedAt = new Date().toISOString();

    if (status === "ACKNOWLEDGED") {
      alert.acknowledgedBy = actorId;
      alert.acknowledgedAt = new Date().toISOString();
    } else if (status === "RESOLVED" || status === "DISMISSED") {
      alert.resolvedAt = new Date().toISOString();
    }

    this.alerts.set(alertId, alert);
    return alert;
  }

  /**
   * Retrieves all alerts with optional filtering
   */
  public listAlerts(status?: AnomalyAlertStatus): OperationalAnomalyAlert[] {
    const list = Array.from(this.alerts.values());
    if (status) {
      return list.filter((a) => a.status === status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Clears alerts and cooldowns (for test isolation)
   */
  public reset(): void {
    this.alerts.clear();
    this.cooldowns.clear();
    this.seedDefaultAlerts();
  }
}

export const anomalyMonitorService = AnomalyMonitorService.getInstance();

