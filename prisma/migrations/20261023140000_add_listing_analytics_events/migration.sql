-- Durable, privacy-preserving listing funnel telemetry. Session identifiers are
-- hashed by the application before persistence; this table never stores IPs.
CREATE TABLE IF NOT EXISTS "ListingAnalyticsEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "listingId" TEXT,
  "hostId" TEXT,
  "visitorHash" TEXT,
  "sessionHash" TEXT,
  "isBot" BOOLEAN NOT NULL DEFAULT false,
  "dedupeKey" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ListingAnalyticsEvent_dedupeKey_key"
  ON "ListingAnalyticsEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "ListingAnalyticsEvent_listingId_eventType_occurredAt_idx"
  ON "ListingAnalyticsEvent"("listingId", "eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "ListingAnalyticsEvent_hostId_eventType_occurredAt_idx"
  ON "ListingAnalyticsEvent"("hostId", "eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "ListingAnalyticsEvent_eventType_occurredAt_idx"
  ON "ListingAnalyticsEvent"("eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "ListingAnalyticsEvent_occurredAt_idx"
  ON "ListingAnalyticsEvent"("occurredAt");

ALTER TABLE "ListingAnalyticsEvent"
  ADD CONSTRAINT "ListingAnalyticsEvent_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
