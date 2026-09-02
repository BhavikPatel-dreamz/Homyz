// Centralized TTL definitions (in seconds) according to data volatility.
// See Specification §6.

export const CACHE_TTL = {
  /** User profiles, account settings: 5 minutes */
  USER_PROFILE: 300,

  /** Single listing details: 5 minutes */
  LISTING_DETAIL: 300,

  /** Published listing search & catalogue queries: 3 minutes */
  LISTING_SEARCH: 180,

  /** User & Host booking lists: 2 minutes */
  BOOKING_LIST: 120,

  /** Single booking detail: 3 minutes */
  BOOKING_DETAIL: 180,

  /** High-turnover dashboard metrics & stats: 1 minute (60s) */
  DASHBOARD_STATS: 60,

  /** Operational alerts & action queues: 30 seconds */
  SHORT_LIVED: 30,

  /** Reference config & permissions data: 30 minutes (1800s) */
  REFERENCE_DATA: 1800,
} as const;
