-- Public review pages always constrain listing, visibility, direction, and
-- chronological order. This composite index matches that read path.
CREATE INDEX IF NOT EXISTS "Review_listingId_status_direction_createdAt_idx"
  ON "Review"("listingId", "status", "direction", "createdAt" DESC);
