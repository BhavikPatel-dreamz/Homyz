// Centralized cache-key definitions. EVERY key used by the app is built here so
// naming stays consistent and private data is always namespaced by its owner's
// id (spec §12, §22). Never hand-write key strings elsewhere.
//
// All keys are prefixed so multiple apps/environments can share one Redis
// instance without colliding.

const NS = "homyz";

export const keys = {
  /** Public, single listing detail. */
  listing: (id: string) => `${NS}:listing:${id}`,

  /**
   * Public paginated catalogue. Version-tagged: bumping the version (INCR of
   * `listingsPublicVersion`) invalidates every page in O(1), and the stale
   * versioned keys simply expire — no SCAN over the keyspace on each mutation.
   */
  listingsPublicVersion: () => `${NS}:listings:published:ver`,
  listingsPublic: (ver: number, skip: number, take: number) =>
    `${NS}:listings:published:v${ver}:s${skip}:t${take}`,

  /**
   * A user's PUBLIC profile (no secrets — see toPublicUser). Keyed by the
   * target user's id; the payload is identical for every authorized viewer, so
   * this key is safe to share across callers (authorization happens before the
   * read). If getById ever returns viewer-dependent fields, this MUST be
   * re-keyed by viewer.
   */
  userProfile: (id: string) => `${NS}:user:${id}:profile`,

  /** Global platform counts for the admin dashboard (TTL-only, low churn). */
  statsGlobal: () => `${NS}:stats:global`,
} as const;
