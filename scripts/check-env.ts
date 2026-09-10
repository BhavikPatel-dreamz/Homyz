import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// Load .env file into process.env if present
function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

export const envSchema = z.object({
  // Core Infrastructure & Database
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required for PostgreSQL connection"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_URL: z.string().url().optional(),

  // Auth & Token Security
  NEXTAUTH_SECRET: z
    .string()
    .min(16, "NEXTAUTH_SECRET must be at least 16 characters for security"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_TTL: z
    .string()
    .default("900")
    .transform((val) => Number(val))
    .pipe(z.number().positive()),
  REFRESH_TOKEN_TTL: z
    .string()
    .default("2592000")
    .transform((val) => Number(val))
    .pipe(z.number().positive()),

  // Redis Configuration (Optional)
  REDIS_URL: z.string().optional(),
  REDIS_ENABLED: z.enum(["true", "false"]).default("true"),
  REDIS_DEFAULT_TTL: z
    .string()
    .default("300")
    .transform((val) => Number(val))
    .pipe(z.number().positive()),
  REDIS_CONNECT_TIMEOUT: z
    .string()
    .default("2000")
    .transform((val) => Number(val))
    .pipe(z.number().positive()),

  // Rate Limiting & OTP Settings
  LOGIN_RATE_LIMIT_MAX: z
    .string()
    .default("10")
    .transform((val) => Number(val))
    .pipe(z.number().positive()),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z
    .string()
    .default("900")
    .transform((val) => Number(val))
    .pipe(z.number().positive()),
  OTP_RESEND_COOLDOWN_SECONDS: z
    .string()
    .default("60")
    .transform((val) => Number(val))
    .pipe(z.number().positive()),
  OTP_TTL_SECONDS: z
    .string()
    .default("300")
    .transform((val) => Number(val))
    .pipe(z.number().positive()),
  OTP_MAX_ATTEMPTS: z
    .string()
    .default("5")
    .transform((val) => Number(val))
    .pipe(z.number().positive()),

  // Third-Party Delivery Services (Optional in Dev)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Homyz <no-reply@homyz.local>"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),

  // OAuth Providers (Optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),

  MEDIA_SERVER_URL: z.string().optional(),
  MEDIA_SERVER_SECRET: z.string().optional(),
  MEDIA_PUBLIC_BASE_URL: z.string().optional(),

  // AWS S3 media (optional; when set, Next.js talks to S3 directly)
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().optional(),
  SERVER_ACTION_ALLOWED_ORIGINS: z.string().optional(),
  PORT: z.string().optional(),
  HOSTNAME: z.string().optional(),

  // Seed Admin Account Settings
  ADMIN_EMAIL: z.string().email().default("admin@homyz.local"),
  ADMIN_PASSWORD: z.string().min(8).default("ChangeMe!123"),
});

export function validateEnv() {
  console.log("=================================================");
  console.log("🔍 Checking Environment Keys Across Homyz Project");
  console.log("=================================================\n");
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Environment validation failed with errors:");
    const formatted = result.error.format();
    for (const [key, val] of Object.entries(formatted)) {
      if (key === "_errors") continue;
      const errObj = val as { _errors?: string[] };
      if (errObj._errors && errObj._errors.length > 0) {
        console.error(`   - ${key}: ${errObj._errors.join(", ")}`);
      }
    }
    console.error("\n💡 Please update your .env file with the missing keys.");
    process.exit(1);
  }

  const data = result.data;
  console.log("✅ All Environment Keys Validated Successfully!\n");
  console.log("📊 Environment Summary:");
  console.log("-------------------------------------------------");
  console.log(`• DATABASE_URL:                    ${data.DATABASE_URL.replace(/:\/\/.*@/, "://***:***@")}`);
  console.log(`• NODE_ENV:                        ${data.NODE_ENV}`);
  console.log(`• APP_URL:                         ${data.APP_URL}`);
  console.log(`• NEXTAUTH_SECRET:                 [CONFIGURED] (${data.NEXTAUTH_SECRET.length} chars)`);
  console.log(`• JWT_ACCESS_SECRET:               [CONFIGURED] (${data.JWT_ACCESS_SECRET.length} chars)`);
  console.log(`• JWT_REFRESH_SECRET:              [CONFIGURED] (${data.JWT_REFRESH_SECRET.length} chars)`);
  console.log(`• ACCESS_TOKEN_TTL:                ${data.ACCESS_TOKEN_TTL} seconds`);
  console.log(`• REFRESH_TOKEN_TTL:               ${data.REFRESH_TOKEN_TTL} seconds`);
  console.log(`• REDIS Cache:                     ${data.REDIS_URL ? "ENABLED" : "DISABLED (Fallback to DB)"}`);
  console.log(`• LOGIN_RATE_LIMIT_MAX:            ${data.LOGIN_RATE_LIMIT_MAX} max attempts`);
  console.log(`• LOGIN_RATE_LIMIT_WINDOW_SECONDS: ${data.LOGIN_RATE_LIMIT_WINDOW_SECONDS} seconds`);
  console.log(`• OTP_RESEND_COOLDOWN_SECONDS:     ${data.OTP_RESEND_COOLDOWN_SECONDS} seconds`);
  console.log(`• OTP_TTL_SECONDS:                 ${data.OTP_TTL_SECONDS} seconds`);
  console.log(`• OTP_MAX_ATTEMPTS:                ${data.OTP_MAX_ATTEMPTS} attempts`);
  console.log(`• RESEND Email Provider:          ${data.RESEND_API_KEY ? "CONFIGURED" : "NOT SET (Dev Console Mode)"}`);
  console.log(`• TWILIO SMS Provider:            ${data.TWILIO_ACCOUNT_SID ? "CONFIGURED" : "NOT SET (Dev Console Mode)"}`);
  console.log(`• GOOGLE OAuth:                    ${data.GOOGLE_CLIENT_ID ? "ENABLED" : "DISABLED"}`);
  console.log(`• FACEBOOK OAuth:                  ${data.FACEBOOK_CLIENT_ID ? "ENABLED" : "DISABLED"}`);
  console.log(`• APPLE OAuth:                     ${data.APPLE_CLIENT_ID ? "ENABLED" : "DISABLED"}`);
  console.log(`• Seed Admin Account:              ${data.ADMIN_EMAIL}`);
  console.log(`• Media server:                    ${data.MEDIA_SERVER_URL ? data.MEDIA_SERVER_URL : "DISABLED"}`);
  console.log(`• Media public URL:                ${data.MEDIA_PUBLIC_BASE_URL || "same-origin /uploads"}`);
  console.log(`• S3 Media:                        ${data.S3_BUCKET ? "ENABLED" : "DISABLED"}`);
  console.log("-------------------------------------------------\n");

  return data;
}

validateEnv();
