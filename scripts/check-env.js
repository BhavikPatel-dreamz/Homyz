/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// Load .env file into process.env if present
function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
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

    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

const definitions = [
  // 1. Core & Database
  { key: 'DATABASE_URL', required: true, description: 'PostgreSQL Connection URL' },
  { key: 'NODE_ENV', required: false, default: 'development', description: 'Environment mode (development/production/test)' },
  { key: 'APP_URL', required: false, default: 'http://localhost:3000', description: 'Base Application URL' },
  { key: 'NEXTAUTH_URL', required: false, default: 'http://localhost:3000', description: 'NextAuth Base URL' },

  // 2. Auth & Tokens
  { key: 'NEXTAUTH_SECRET', required: true, minLength: 16, description: 'NextAuth Session Encryption Secret' },
  { key: 'JWT_ACCESS_SECRET', required: true, minLength: 16, description: 'Mobile Access Token JWT Secret' },
  { key: 'JWT_REFRESH_SECRET', required: true, minLength: 16, description: 'Mobile Refresh Token JWT Secret' },
  { key: 'ACCESS_TOKEN_TTL', required: false, default: '900', description: 'Access Token Expiration (seconds)' },
  { key: 'REFRESH_TOKEN_TTL', required: false, default: '2592000', description: 'Refresh Token Expiration (seconds)' },

  // 3. Redis Cache (Optional)
  { key: 'REDIS_URL', required: false, default: '', description: 'Redis Connection URL (Optional performance layer)' },
  { key: 'REDIS_ENABLED', required: false, default: 'true', description: 'Redis Kill Switch (true/false)' },
  { key: 'REDIS_DEFAULT_TTL', required: false, default: '300', description: 'Redis Default TTL (seconds)' },
  { key: 'REDIS_CONNECT_TIMEOUT', required: false, default: '2000', description: 'Redis Connection Timeout (ms)' },

  // 4. Rate Limiting & OTP
  { key: 'LOGIN_RATE_LIMIT_MAX', required: false, default: '10', description: 'Max Login Attempts' },
  { key: 'LOGIN_RATE_LIMIT_WINDOW_SECONDS', required: false, default: '900', description: 'Login Rate Limit Window (seconds)' },
  { key: 'OTP_RESEND_COOLDOWN_SECONDS', required: false, default: '60', description: 'OTP Resend Cooldown (seconds)' },
  { key: 'OTP_TTL_SECONDS', required: false, default: '300', description: 'OTP Validity Window (seconds)' },
  { key: 'OTP_MAX_ATTEMPTS', required: false, default: '5', description: 'Max OTP Verification Attempts' },

  // 5. External Services
  { key: 'RESEND_API_KEY', required: false, default: '', description: 'Resend API Key (Email Delivery)' },
  { key: 'EMAIL_FROM', required: false, default: 'Homyz <no-reply@homyz.local>', description: 'Default Sender Email Address' },
  { key: 'TWILIO_ACCOUNT_SID', required: false, default: '', description: 'Twilio Account SID (SMS Delivery)' },
  { key: 'TWILIO_AUTH_TOKEN', required: false, default: '', description: 'Twilio Auth Token (SMS Delivery)' },
  { key: 'TWILIO_FROM', required: false, default: '', description: 'Twilio Sender Phone Number' },

  // 6. OAuth Providers
  { key: 'GOOGLE_CLIENT_ID', required: false, default: '', description: 'Google OAuth Client ID' },
  { key: 'GOOGLE_CLIENT_SECRET', required: false, default: '', description: 'Google OAuth Client Secret' },
  { key: 'FACEBOOK_CLIENT_ID', required: false, default: '', description: 'Facebook OAuth Client ID' },
  { key: 'FACEBOOK_CLIENT_SECRET', required: false, default: '', description: 'Facebook OAuth Client Secret' },
  { key: 'APPLE_CLIENT_ID', required: false, default: '', description: 'Apple OAuth Client ID' },
  { key: 'APPLE_CLIENT_SECRET', required: false, default: '', description: 'Apple OAuth Client Secret' },

  { key: 'MEDIA_SERVER_URL', required: false, default: '', description: 'Dedicated media service base URL' },
  { key: 'MEDIA_SERVER_SECRET', required: false, default: '', description: 'Shared secret for the media service' },
  { key: 'MEDIA_PUBLIC_BASE_URL', required: false, default: '', description: 'Public image origin (e.g. https://media.homyz.co)' },

  // 7. AWS S3 media (optional in development)
  { key: 'S3_BUCKET', required: false, default: '', description: 'S3 bucket for uploads' },
  { key: 'S3_REGION', required: false, default: '', description: 'S3 region' },
  { key: 'S3_PUBLIC_BASE_URL', required: false, default: '', description: 'Public CDN/S3 base URL' },
  { key: 'AWS_REGION', required: false, default: '', description: 'AWS region (instance role / SDK default)' },
  { key: 'AWS_ACCESS_KEY_ID', required: false, default: '', description: 'AWS access key (prefer instance role in production)' },
  { key: 'AWS_SECRET_ACCESS_KEY', required: false, default: '', description: 'AWS secret key (prefer instance role in production)' },
  { key: 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', required: false, default: '', description: 'Shared Server Action encryption key for multi-instance' },
  { key: 'SERVER_ACTION_ALLOWED_ORIGINS', required: false, default: '', description: 'Extra Server Action origins (Docker build-time)' },
  { key: 'PORT', required: false, default: '3000', description: 'Listen port' },
  { key: 'HOSTNAME', required: false, default: '0.0.0.0', description: 'Listen hostname' },

  // 8. Seed Admin Credentials
  { key: 'ADMIN_EMAIL', required: false, default: 'admin@homyz.local', description: 'Seed Script Admin Email' },
  { key: 'ADMIN_PASSWORD', required: false, default: 'ChangeMe!123', description: 'Seed Script Admin Password' },
];

function checkEnv() {
  console.log('=================================================');
  console.log('🔍 Checking Environment Keys Across Homyz Project');
  console.log('=================================================\n');

  const errors = [];
  const report = [];

  for (const def of definitions) {
    const val = process.env[def.key] ?? def.default ?? '';

    if (def.required && (!val || val.trim() === '')) {
      errors.push(`Missing required key: ${def.key} (${def.description})`);
    } else if (def.minLength && val.length < def.minLength) {
      errors.push(`Key ${def.key} is too short: expected >= ${def.minLength} chars, got ${val.length}`);
    }

    const status = val ? (def.key.includes('SECRET') || def.key.includes('PASSWORD') || def.key.includes('TOKEN') || def.key.includes('KEY') ? '[CONFIGURED - SECRET]' : val) : '[NOT SET / OPTIONAL]';
    report.push({ key: def.key, status, description: def.description, required: def.required });
  }

  if (errors.length > 0) {
    console.error('❌ Environment validation failed with errors:\n');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    console.error('\n💡 Please check your .env file and set the required keys.');
    process.exit(1);
  }

  console.log('✅ All Environment Keys Checked and Validated Successfully!\n');
  console.log('📊 Environment Configuration Breakdown:');
  console.log('-------------------------------------------------');
  for (const item of report) {
    const keyPadded = item.key.padEnd(32, ' ');
    const reqFlag = item.required ? '(Required)' : '(Optional)';
    console.log(`• ${keyPadded} ${item.status} ${reqFlag}`);
  }
  console.log('-------------------------------------------------\n');
}

checkEnv();
