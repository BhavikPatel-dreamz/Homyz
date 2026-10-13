-- Migration: 20261010140000_admin_booking_foundation
-- Description: Establishes foundational data models for Admin Booking & Refund Management:
-- 1. Enums: PaymentStatus, PaymentProvider, RefundStatus
-- 2. Entities: BookingPayment, BookingRefund
-- 3. Indexes: Booking (status, status+createdAt, createdAt), AuditLog (resourceType+resourceId)
-- 4. Foreign key integrity: Restrict deletion of Booking with financial records

-- Create Enums
DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'VOIDED', 'PARTIALLY_REFUNDED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentProvider" AS ENUM ('MOCK', 'MOYASAR', 'DEFERRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create BookingPayment Table
CREATE TABLE IF NOT EXISTS "BookingPayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'DEFERRED',
    "providerPaymentId" TEXT,
    "idempotencyKey" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "amount" INTEGER NOT NULL,
    "capturedAmount" INTEGER NOT NULL DEFAULT 0,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "paymentMethodDetails" JSONB,
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPayment_pkey" PRIMARY KEY ("id")
);

-- Create BookingRefund Table
CREATE TABLE IF NOT EXISTS "BookingRefund" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "paymentId" TEXT,
    "refundReference" TEXT,
    "providerRefundId" TEXT,
    "idempotencyKey" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "adminNotes" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "succeededAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingRefund_pkey" PRIMARY KEY ("id")
);

-- Create Indexes for BookingPayment
CREATE UNIQUE INDEX IF NOT EXISTS "BookingPayment_providerPaymentId_key" ON "BookingPayment"("providerPaymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingPayment_idempotencyKey_key" ON "BookingPayment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "BookingPayment_bookingId_idx" ON "BookingPayment"("bookingId");
CREATE INDEX IF NOT EXISTS "BookingPayment_status_idx" ON "BookingPayment"("status");
CREATE INDEX IF NOT EXISTS "BookingPayment_providerPaymentId_idx" ON "BookingPayment"("providerPaymentId");
CREATE INDEX IF NOT EXISTS "BookingPayment_createdAt_idx" ON "BookingPayment"("createdAt");

-- Create Indexes for BookingRefund
CREATE UNIQUE INDEX IF NOT EXISTS "BookingRefund_refundReference_key" ON "BookingRefund"("refundReference");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingRefund_providerRefundId_key" ON "BookingRefund"("providerRefundId");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingRefund_idempotencyKey_key" ON "BookingRefund"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "BookingRefund_bookingId_idx" ON "BookingRefund"("bookingId");
CREATE INDEX IF NOT EXISTS "BookingRefund_paymentId_idx" ON "BookingRefund"("paymentId");
CREATE INDEX IF NOT EXISTS "BookingRefund_status_idx" ON "BookingRefund"("status");
CREATE INDEX IF NOT EXISTS "BookingRefund_createdAt_idx" ON "BookingRefund"("createdAt");

-- Performance Indexes on Booking table
CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status");
CREATE INDEX IF NOT EXISTS "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_createdAt_idx" ON "Booking"("createdAt");

-- Performance Index on AuditLog
CREATE INDEX IF NOT EXISTS "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- Foreign key constraints with RESTRICT behavior to protect financial auditability
DO $$ BEGIN
  ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingRefund" ADD CONSTRAINT "BookingRefund_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingRefund" ADD CONSTRAINT "BookingRefund_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "BookingPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

