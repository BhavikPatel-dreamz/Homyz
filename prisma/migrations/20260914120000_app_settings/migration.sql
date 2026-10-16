-- Create AppSettings table for global application configuration
CREATE TABLE IF NOT EXISTS "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "key" TEXT NOT NULL UNIQUE,
    "value" TEXT,
    "description" TEXT,
    "dataType" TEXT NOT NULL DEFAULT 'STRING',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient lookups
CREATE INDEX "AppSettings_key_idx" ON "AppSettings"("key");
CREATE INDEX "AppSettings_category_idx" ON "AppSettings"("category");

-- Insert default Host Service Fee setting (15% as default)
INSERT INTO "AppSettings" ("key", "value", "description", "dataType", "category", "isPublic", "createdAt", "updatedAt")
VALUES (
    'HOST_SERVICE_FEE_PERCENTAGE',
    '15',
    'Platform service fee charged to hosts as a percentage of Base price',
    'NUMBER',
    'PRICING',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT("key") DO NOTHING;
