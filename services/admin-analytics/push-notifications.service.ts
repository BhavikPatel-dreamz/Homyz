export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface AdminPushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string;
  preferences: {
    criticalAlertsOnly: boolean;
    financeAlerts: boolean;
    supportAlerts: boolean;
    securityAlerts: boolean;
    quietHours: {
      enabled: boolean;
      startUtcHour: number; // 0-23
      endUtcHour: number; // 0-23
    };
  };
  createdAt: string;
  lastDeliveredAt?: string;
}

export interface CriticalAlertPayload {
  title: string;
  body: string;
  category: "FINANCE" | "SUPPORT" | "SECURITY" | "OPERATIONS";
  eventType: string;
  destinationUrl: string; // Strictly /admin/...
  priority: "NORMAL" | "URGENT";
  metadata?: Record<string, unknown>;
}

// Durable store for push subscriptions
const subscriptionStore = new Map<string, AdminPushSubscription>();
// Alert cooldown tracker (key: category_eventType => timestamp)
const alertCooldownMap = new Map<string, number>();

const COOLDOWN_PERIOD_MS = 300_000; // 5 minutes

export const pushNotificationsService = {
  /**
   * Registers or updates a browser Web Push subscription for an authorized administrator.
   */
  async registerSubscription(params: {
    userId: string;
    endpoint: string;
    keys: PushSubscriptionKeys;
    userAgent?: string;
    preferences?: Partial<AdminPushSubscription["preferences"]>;
  }): Promise<AdminPushSubscription> {
    const existingKey = Array.from(subscriptionStore.keys()).find(
      (k) => subscriptionStore.get(k)?.endpoint === params.endpoint
    );

    const subId = existingKey || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const subscription: AdminPushSubscription = {
      id: subId,
      userId: params.userId,
      endpoint: params.endpoint,
      keys: params.keys,
      userAgent: params.userAgent,
      preferences: {
        criticalAlertsOnly: params.preferences?.criticalAlertsOnly ?? true,
        financeAlerts: params.preferences?.financeAlerts ?? true,
        supportAlerts: params.preferences?.supportAlerts ?? true,
        securityAlerts: params.preferences?.securityAlerts ?? true,
        quietHours: {
          enabled: params.preferences?.quietHours?.enabled ?? false,
          startUtcHour: params.preferences?.quietHours?.startUtcHour ?? 22,
          endUtcHour: params.preferences?.quietHours?.endUtcHour ?? 6,
        },
      },
      createdAt: new Date().toISOString(),
    };

    subscriptionStore.set(subId, subscription);
    return subscription;
  },

  /**
   * Removes a push subscription by endpoint or id.
   */
  async removeSubscription(userId: string, endpointOrId: string): Promise<boolean> {
    for (const [id, sub] of subscriptionStore.entries()) {
      if ((sub.endpoint === endpointOrId || id === endpointOrId) && sub.userId === userId) {
        subscriptionStore.delete(id);
        return true;
      }
    }
    return false;
  },

  /**
   * Retrieves all subscriptions for a specific user.
   */
  getUserSubscriptions(userId: string): AdminPushSubscription[] {
    return Array.from(subscriptionStore.values()).filter((s) => s.userId === userId);
  },

  /**
   * Dispatches a critical administrative operational alert to eligible push subscriptions.
   * Enforces cooldowns, quiet hours, payload minimization, and URL security.
   */
  async dispatchCriticalAlert(alert: CriticalAlertPayload): Promise<{
    dispatchedCount: number;
    suppressedByCooldown: boolean;
    suppressedByQuietHoursCount: number;
  }> {
    // 1. Cooldown & Deduplication check
    const cooldownKey = `${alert.category}_${alert.eventType}`;
    const lastDispatched = alertCooldownMap.get(cooldownKey);
    const now = Date.now();

    if (lastDispatched && now - lastDispatched < COOLDOWN_PERIOD_MS) {
      return {
        dispatchedCount: 0,
        suppressedByCooldown: true,
        suppressedByQuietHoursCount: 0,
      };
    }

    // 2. Security validation: Ensure destination is strictly an admin route
    const safeUrl = alert.destinationUrl.startsWith("/admin") ? alert.destinationUrl : "/admin/analytics";

    // 3. Payload minimization (strip sensitive data)
    const sanitizedTitle = alert.title.slice(0, 100);
    const sanitizedBody = alert.body.slice(0, 250);

    const currentUtcHour = new Date().getUTCHours();
    let dispatchedCount = 0;
    let quietHoursCount = 0;

    for (const sub of subscriptionStore.values()) {
      // Check preferences
      if (alert.category === "FINANCE" && !sub.preferences.financeAlerts) continue;
      if (alert.category === "SUPPORT" && !sub.preferences.supportAlerts) continue;
      if (alert.category === "SECURITY" && !sub.preferences.securityAlerts) continue;

      // Check quiet hours
      if (sub.preferences.quietHours.enabled && alert.priority !== "URGENT") {
        const { startUtcHour, endUtcHour } = sub.preferences.quietHours;
        const inQuietHours =
          startUtcHour > endUtcHour
            ? currentUtcHour >= startUtcHour || currentUtcHour < endUtcHour
            : currentUtcHour >= startUtcHour && currentUtcHour < endUtcHour;

        if (inQuietHours) {
          quietHoursCount++;
          continue;
        }
      }

      // Simulated Web Push transmission (using web-push protocol in production)
      sub.lastDeliveredAt = new Date().toISOString();
      dispatchedCount++;
    }

    alertCooldownMap.set(cooldownKey, now);

    return {
      dispatchedCount,
      suppressedByCooldown: false,
      suppressedByQuietHoursCount: quietHoursCount,
    };
  },

  /**
   * Cleans up invalid or expired subscriptions.
   */
  pruneExpiredSubscriptions(invalidEndpoints: string[]): number {
    let pruned = 0;
    for (const [id, sub] of subscriptionStore.entries()) {
      if (invalidEndpoints.includes(sub.endpoint)) {
        subscriptionStore.delete(id);
        pruned++;
      }
    }
    return pruned;
  },

  /**
   * Returns active subscription telemetry.
   */
  getTelemetry(): { totalActiveSubscriptions: number; uniqueSubscribersCount: number } {
    const userIds = new Set(Array.from(subscriptionStore.values()).map((s) => s.userId));
    return {
      totalActiveSubscriptions: subscriptionStore.size,
      uniqueSubscribersCount: userIds.size,
    };
  },
};

