-- Notification list, unread list, and idempotency lookups.
DROP INDEX IF EXISTS "Notification_userId_isRead_idx";
CREATE INDEX "Notification_userId_isRead_createdAt_idx"
ON "Notification"("userId", "isRead", "createdAt" DESC);
CREATE INDEX "Notification_userId_type_entityId_entityType_idx"
ON "Notification"("userId", "type", "entityId", "entityType");

-- Trip photos are scoped to a user and sorted newest-first.
DROP INDEX IF EXISTS "TripPhoto_userId_idx";
CREATE INDEX "TripPhoto_userId_createdAt_idx"
ON "TripPhoto"("userId", "createdAt" DESC);

-- Guest booking history is scoped to a user and sorted newest-first.
DROP INDEX IF EXISTS "Booking_userId_idx";
CREATE INDEX "Booking_userId_createdAt_idx"
ON "Booking"("userId", "createdAt" DESC);
