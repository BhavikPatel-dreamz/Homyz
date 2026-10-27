export interface HostResponseMetrics {
  totalGuestInquiries: number;
  respondedCount: number;
  respondedWithin24hCount: number;
  // A rate cannot be inferred until there has been at least one qualifying
  // inquiry. Presentation must not turn this into a fabricated zero-percent rate.
  responseRatePercentage: number | null;
  averageResponseTimeMinutes: number | null;
}

export interface ResponseMetricMessage {
  senderId: string | null;
  type: string;
  createdAt: Date;
}

export interface ResponseMetricConversation {
  guestId: string;
  messages: ResponseMetricMessage[];
}

/**
 * Computes the established first-inquiry response metric for an already scoped
 * set of conversations. Query scope remains the responsibility of
 * messagingService; keeping this reducer pure lets the exact 24-hour boundary,
 * system-message exclusion, and per-conversation de-duplication be tested
 * without adding another response-rate calculation.
 *
 * Product has not yet defined whether later guest messages in an existing
 * conversation should create another Superhost SLA row. This intentionally
 * preserves the current one-inquiry-per-conversation behavior until that
 * policy is approved.
 */
export function calculateHostResponseMetricsFromConversations(
  hostId: string,
  conversations: ResponseMetricConversation[],
): HostResponseMetrics {
  let totalGuestInquiries = 0;
  let respondedCount = 0;
  let respondedWithin24hCount = 0;
  let totalResponseTimeMinutes = 0;
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  for (const conversation of conversations) {
    const firstGuestMessage = conversation.messages.find(
      (message) => message.senderId === conversation.guestId && message.type !== "SYSTEM",
    );
    if (!firstGuestMessage) continue;

    totalGuestInquiries++;
    const firstHostReply = conversation.messages.find(
      (message) => message.senderId === hostId && message.createdAt > firstGuestMessage.createdAt,
    );
    if (!firstHostReply) continue;

    respondedCount++;
    const responseTimeMs = firstHostReply.createdAt.getTime() - firstGuestMessage.createdAt.getTime();
    totalResponseTimeMinutes += Math.max(1, Math.round(responseTimeMs / (60 * 1000)));
    if (responseTimeMs <= twentyFourHoursMs) respondedWithin24hCount++;
  }

  return {
    totalGuestInquiries,
    respondedCount,
    respondedWithin24hCount,
    responseRatePercentage:
      totalGuestInquiries > 0 ? (respondedWithin24hCount / totalGuestInquiries) * 100 : null,
    averageResponseTimeMinutes:
      respondedCount > 0 ? Math.round(totalResponseTimeMinutes / respondedCount) : null,
  };
}
