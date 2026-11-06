import type { AuthUser } from "@/lib/auth/types";

export type AnalyticsEventType =
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "PAYMENT_CAPTURED"
  | "PAYMENT_FAILED"
  | "REFUND_SUCCEEDED"
  | "PAYOUT_SETTLED"
  | "PAYOUT_FAILED"
  | "LISTING_SUBMITTED"
  | "LISTING_PUBLISHED"
  | "SUPPORT_CASE_CREATED"
  | "SUPPORT_CASE_ESCALATED"
  | "SLA_BREACHED"
  | "OPERATIONAL_ALERT_TRIGGERED";

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  occurredAt: string;
  entityType: "BOOKING" | "PAYMENT" | "REFUND" | "PAYOUT" | "LISTING" | "SUPPORT_CASE" | "ALERT";
  entityId: string;
  scope: string; // "GLOBAL" or "LISTING:[id]" or "CITY:[city]"
  version: number;
  payload: Record<string, unknown>; // Zero private card data or guest secrets
}

type EventSubscriber = (event: AnalyticsEvent) => void;

// In-memory bounded replay buffer (keeps the last 100 events)
const MAX_REPLAY_EVENTS = 100;
const eventReplayBuffer: AnalyticsEvent[] = [];
const subscribers = new Set<EventSubscriber>();

// Seed initial system startup event if empty
if (eventReplayBuffer.length === 0) {
  eventReplayBuffer.push({
    id: `evt_init_${Date.now()}`,
    type: "OPERATIONAL_ALERT_TRIGGERED",
    occurredAt: new Date().toISOString(),
    entityType: "ALERT",
    entityId: "system",
    scope: "GLOBAL",
    version: 1,
    payload: { message: "Real-time analytics event pipeline initialized." },
  });
}

export const analyticsEventsService = {
  /**
   * Publishes an operational analytics event to all active SSE subscribers and appends to replay buffer.
   * If an event with the same ID already exists in the replay buffer, it is treated as a duplicate and ignored.
   */
  publishEvent(
    eventData: Partial<AnalyticsEvent> & { type: AnalyticsEventType }
  ): AnalyticsEvent {
    const id = eventData.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Idempotency / deduplication check
    const existing = eventReplayBuffer.find((e) => e.id === id);
    if (existing) {
      return existing;
    }

    const event: AnalyticsEvent = {
      id,
      type: eventData.type,
      occurredAt: eventData.occurredAt || new Date().toISOString(),
      entityType: eventData.entityType || "BOOKING",
      entityId: eventData.entityId || (eventData as any).aggregateId || "unknown",
      scope: eventData.scope || "GLOBAL",
      version: eventData.version || 1,
      payload: eventData.payload || (eventData as any).metadata || {},
      ...((eventData as any).amountCents !== undefined ? { amountCents: (eventData as any).amountCents } : {}),
      ...((eventData as any).currency ? { currency: (eventData as any).currency } : {}),
    } as AnalyticsEvent;

    // Maintain bounded replay buffer
    eventReplayBuffer.push(event);
    if (eventReplayBuffer.length > MAX_REPLAY_EVENTS) {
      eventReplayBuffer.shift();
    }

    // Broadcast to active SSE listeners
    for (const listener of subscribers) {
      try {
        listener(event);
      } catch (err) {
        console.warn("[analytics-events] Error dispatching to subscriber:", err);
      }
    }

    return event;
  },

  /**
   * Alias for publishEvent
   */
  publish(eventData: any): AnalyticsEvent {
    return this.publishEvent(eventData);
  },

  /**
   * Subscribes a listener callback to real-time events. Returns an unsubscribe teardown function.
   */
  subscribe(listener: EventSubscriber): () => void {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  },

  /**
   * Retrieves recent events from the replay buffer, optionally after a given lastEventId or constrained to a numeric count.
   */
  getRecentEvents(lastEventIdOrLimit?: string | number | null): AnalyticsEvent[] {
    if (typeof lastEventIdOrLimit === "number") {
      return eventReplayBuffer.slice(-lastEventIdOrLimit);
    }
    if (!lastEventIdOrLimit) {
      return [...eventReplayBuffer];
    }
    const idx = eventReplayBuffer.findIndex((e) => e.id === lastEventIdOrLimit);
    if (idx === -1) {
      return [...eventReplayBuffer];
    }
    return eventReplayBuffer.slice(idx + 1);
  },

  /**
   * Returns current active subscriber connection count.
   */
  getActiveSubscriberCount(): number {
    return subscribers.size;
  },
};
