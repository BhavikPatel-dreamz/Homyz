export type HostDashboardRecommendationPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface HostDashboardRecommendation {
  id: string;
  priority: HostDashboardRecommendationPriority;
  category: "RELIABILITY" | "MESSAGING" | "REVIEWS" | "OCCUPANCY" | "LISTING";
  title: string;
  description: string;
  actionLabel: string;
  actionHref: "/host/calendar" | "/host/listings" | "/host/messages";
}

export interface HostDashboardRecommendationInput {
  hostCancellationRatePercentage: number;
  responseRatePercentage: number | null;
  overallRating: number | null;
  totalReviewsCount: number;
  futureAvailableNights: number;
  futureWindowDays: number;
  listings: Array<{
    id: string;
    title: string;
    missingFields: string[];
  }>;
}

const priorityRank: Record<HostDashboardRecommendationPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * Produces bounded, deterministic host recommendations from already-authoritative
 * dashboard metrics. It intentionally makes no claims about revenue, demand,
 * competitors, or conversion that the platform does not measure.
 */
export function buildHostDashboardRecommendations(
  input: HostDashboardRecommendationInput,
): HostDashboardRecommendation[] {
  const recommendations: HostDashboardRecommendation[] = [];

  if (input.hostCancellationRatePercentage > 1) {
    recommendations.push({
      id: "host-cancellation-rate",
      priority: "CRITICAL",
      category: "RELIABILITY",
      title: "Review host cancellations",
      description: `Your host cancellation rate is ${input.hostCancellationRatePercentage}%, above the 1% Superhost threshold.`,
      actionLabel: "Review reservations",
      actionHref: "/host/calendar",
    });
  }

  if (input.responseRatePercentage !== null && input.responseRatePercentage < 90) {
    recommendations.push({
      id: "response-rate",
      priority: "HIGH",
      category: "MESSAGING",
      title: "Reply to guest inquiries faster",
      description: `Your first-response rate within 24 hours is ${input.responseRatePercentage}%. The Superhost target is 90%.`,
      actionLabel: "Open messages",
      actionHref: "/host/messages",
    });
  }

  if (input.overallRating !== null && input.totalReviewsCount > 0 && input.overallRating < 4.8) {
    recommendations.push({
      id: "review-rating",
      priority: "HIGH",
      category: "REVIEWS",
      title: "Review recent guest feedback",
      description: `Your current published-review average is ${input.overallRating.toFixed(2)} across ${input.totalReviewsCount} review${input.totalReviewsCount === 1 ? "" : "s"}.`,
      actionLabel: "Improve listing details",
      actionHref: "/host/listings",
    });
  }

  if (input.futureAvailableNights >= 3) {
    recommendations.push({
      id: "upcoming-availability",
      priority: "MEDIUM",
      category: "OCCUPANCY",
      title: "Fill upcoming open nights",
      description: `You have ${input.futureAvailableNights} open bookable night${input.futureAvailableNights === 1 ? "" : "s"} in the next ${input.futureWindowDays} days.`,
      actionLabel: "Open calendar",
      actionHref: "/host/calendar",
    });
  }

  const incompleteListing = input.listings.find((listing) => listing.missingFields.length > 0);
  if (incompleteListing) {
    const firstMissing = incompleteListing.missingFields.slice(0, 2).join(" and ");
    recommendations.push({
      id: `listing-completeness-${incompleteListing.id}`,
      priority: "LOW",
      category: "LISTING",
      title: `Complete ${incompleteListing.title}`,
      description: `This listing still needs ${firstMissing}.`,
      actionLabel: "Edit listing",
      actionHref: "/host/listings",
    });
  }

  return recommendations
    .sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority])
    .slice(0, 4);
}
