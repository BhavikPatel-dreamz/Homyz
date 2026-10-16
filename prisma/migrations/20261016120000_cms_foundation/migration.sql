-- Migration: 20261016120000_cms_foundation
-- Description: Phase 3 & 4 Admin CMS Foundation, Revisions, Publications, Media Assets, and Scheduling.
-- Additive only: Does not alter or drop any existing tables, columns, or constraints.

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE "CmsContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CmsContentTypeEnum" AS ENUM (
    'HOMEPAGE_BANNER',
    'HERO_SECTION',
    'FEATURED_CITIES',
    'FEATURED_LISTINGS',
    'PROPERTY_COLLECTION',
    'PROMOTIONAL_CAMPAIGN',
    'FAQ_CATEGORY',
    'FAQ_ITEM',
    'STATIC_PAGE',
    'SEO_LANDING_PAGE',
    'NAVIGATION_CONFIG',
    'FOOTER_CONFIG',
    'ANNOUNCEMENT_BAR'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CmsScheduledStatus" AS ENUM ('PENDING', 'RUNNING', 'EXECUTED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CmsScheduledActionType" AS ENUM ('PUBLISH', 'UNPUBLISH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create CmsContent
CREATE TABLE IF NOT EXISTS "CmsContent" (
  "id" TEXT NOT NULL,
  "type" "CmsContentTypeEnum" NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "status" "CmsContentStatus" NOT NULL DEFAULT 'DRAFT',
  "draftVersionId" TEXT,
  "publishedVersionId" TEXT,
  "metadata" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CmsContent_pkey" PRIMARY KEY ("id")
);

-- 3. Create CmsContentVersion
CREATE TABLE IF NOT EXISTS "CmsContentVersion" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "payload" JSONB NOT NULL,
  "changeSummary" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CmsContentVersion_pkey" PRIMARY KEY ("id")
);

-- 4. Create CmsPublication
CREATE TABLE IF NOT EXISTS "CmsPublication" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unpublishAt" TIMESTAMP(3),

  CONSTRAINT "CmsPublication_pkey" PRIMARY KEY ("id")
);

-- 5. Create CmsMediaAsset
CREATE TABLE IF NOT EXISTS "CmsMediaAsset" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "title" TEXT,
  "altText" TEXT,
  "uploaderId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CmsMediaAsset_pkey" PRIMARY KEY ("id")
);

-- 6. Create CmsMediaVariant
CREATE TABLE IF NOT EXISTS "CmsMediaVariant" (
  "id" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "variantName" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CmsMediaVariant_pkey" PRIMARY KEY ("id")
);

-- 7. Create CmsMediaReference
CREATE TABLE IF NOT EXISTS "CmsMediaReference" (
  "id" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "fieldPath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CmsMediaReference_pkey" PRIMARY KEY ("id")
);

-- 8. Create CmsScheduledAction
CREATE TABLE IF NOT EXISTS "CmsScheduledAction" (
  "id" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "versionId" TEXT,
  "actionType" "CmsScheduledActionType" NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "CmsScheduledStatus" NOT NULL DEFAULT 'PENDING',
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "executedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CmsScheduledAction_pkey" PRIMARY KEY ("id")
);

-- Indexes & Unique Constraints
CREATE INDEX IF NOT EXISTS "CmsContent_type_status_idx" ON "CmsContent"("type", "status");
CREATE INDEX IF NOT EXISTS "CmsContent_status_idx" ON "CmsContent"("status");
CREATE INDEX IF NOT EXISTS "CmsContent_slug_idx" ON "CmsContent"("slug");
CREATE INDEX IF NOT EXISTS "CmsContent_slug_locale_idx" ON "CmsContent"("slug", "locale");
CREATE INDEX IF NOT EXISTS "CmsContent_createdAt_idx" ON "CmsContent"("createdAt");
CREATE INDEX IF NOT EXISTS "CmsContent_createdById_idx" ON "CmsContent"("createdById");

CREATE UNIQUE INDEX IF NOT EXISTS "CmsContentVersion_contentId_versionNumber_key" ON "CmsContentVersion"("contentId", "versionNumber");
CREATE INDEX IF NOT EXISTS "CmsContentVersion_contentId_idx" ON "CmsContentVersion"("contentId");
CREATE INDEX IF NOT EXISTS "CmsContentVersion_createdAt_idx" ON "CmsContentVersion"("createdAt");
CREATE INDEX IF NOT EXISTS "CmsContentVersion_createdById_idx" ON "CmsContentVersion"("createdById");

CREATE UNIQUE INDEX IF NOT EXISTS "CmsPublication_contentId_key" ON "CmsPublication"("contentId");
CREATE INDEX IF NOT EXISTS "CmsPublication_contentId_idx" ON "CmsPublication"("contentId");
CREATE INDEX IF NOT EXISTS "CmsPublication_versionId_idx" ON "CmsPublication"("versionId");
CREATE INDEX IF NOT EXISTS "CmsPublication_publishedAt_idx" ON "CmsPublication"("publishedAt");
CREATE INDEX IF NOT EXISTS "CmsPublication_publishedById_idx" ON "CmsPublication"("publishedById");

CREATE UNIQUE INDEX IF NOT EXISTS "CmsMediaAsset_key_key" ON "CmsMediaAsset"("key");
CREATE INDEX IF NOT EXISTS "CmsMediaAsset_mimeType_idx" ON "CmsMediaAsset"("mimeType");
CREATE INDEX IF NOT EXISTS "CmsMediaAsset_uploaderId_idx" ON "CmsMediaAsset"("uploaderId");
CREATE INDEX IF NOT EXISTS "CmsMediaAsset_createdAt_idx" ON "CmsMediaAsset"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CmsMediaVariant_mediaAssetId_variantName_key" ON "CmsMediaVariant"("mediaAssetId", "variantName");
CREATE INDEX IF NOT EXISTS "CmsMediaVariant_mediaAssetId_idx" ON "CmsMediaVariant"("mediaAssetId");

CREATE UNIQUE INDEX IF NOT EXISTS "CmsMediaReference_mediaAssetId_versionId_fieldPath_key" ON "CmsMediaReference"("mediaAssetId", "versionId", "fieldPath");
CREATE INDEX IF NOT EXISTS "CmsMediaReference_mediaAssetId_idx" ON "CmsMediaReference"("mediaAssetId");
CREATE INDEX IF NOT EXISTS "CmsMediaReference_versionId_idx" ON "CmsMediaReference"("versionId");

CREATE INDEX IF NOT EXISTS "CmsScheduledAction_status_scheduledFor_idx" ON "CmsScheduledAction"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "CmsScheduledAction_contentId_idx" ON "CmsScheduledAction"("contentId");
CREATE INDEX IF NOT EXISTS "CmsScheduledAction_scheduledFor_idx" ON "CmsScheduledAction"("scheduledFor");
CREATE INDEX IF NOT EXISTS "CmsScheduledAction_createdById_idx" ON "CmsScheduledAction"("createdById");

-- Foreign Keys
ALTER TABLE "CmsContent" ADD CONSTRAINT "CmsContent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CmsContent" ADD CONSTRAINT "CmsContent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CmsContentVersion" ADD CONSTRAINT "CmsContentVersion_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CmsContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CmsContentVersion" ADD CONSTRAINT "CmsContentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CmsPublication" ADD CONSTRAINT "CmsPublication_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CmsContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CmsPublication" ADD CONSTRAINT "CmsPublication_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CmsContentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CmsPublication" ADD CONSTRAINT "CmsPublication_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CmsMediaAsset" ADD CONSTRAINT "CmsMediaAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CmsMediaVariant" ADD CONSTRAINT "CmsMediaVariant_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "CmsMediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CmsMediaReference" ADD CONSTRAINT "CmsMediaReference_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "CmsMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CmsMediaReference" ADD CONSTRAINT "CmsMediaReference_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CmsContentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CmsScheduledAction" ADD CONSTRAINT "CmsScheduledAction_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CmsContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CmsScheduledAction" ADD CONSTRAINT "CmsScheduledAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

