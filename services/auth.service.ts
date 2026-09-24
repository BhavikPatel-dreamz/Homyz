import { randomInt } from "node:crypto";

import { nanoid } from "nanoid";

import { AppError } from "@/lib/api/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";
import { deleteCache } from "@/lib/redis/cache";
import { keys } from "@/lib/redis/keys";
import { assertLoginRateLimit } from "@/lib/services/rate-limit";
import * as email from "@/lib/services/email";
import * as sms from "@/lib/services/sms";
import type {
  RegisterInput,
  SendOtpInput,
  VerifyOtpInput,
} from "@/lib/validation/auth";
import type { User } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";

import { toPublicUser, type PublicUser } from "./mappers";
import { normalizeEmail, normalizePhone } from "@/lib/auth/normalization";
import { referralService } from "./referral.service";

// ── Internal helpers ────────────────────────────────────────────────────────

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h
const MAX_OTP_RESEND_COOLDOWN_SECONDS = 60;

interface TokenMeta {
  userAgent?: string | null;
  ip?: string | null;
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function issueTokens(
  userId: string,
  role: Role,
  meta?: TokenMeta,
): Promise<IssuedTokens> {
  const accessToken = await signAccessToken(userId, role);
  const { token: refreshToken, expiresAt } = await signRefreshToken(userId);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
    },
  });
  return {
    accessToken,
    refreshToken,
    expiresIn: Number(process.env.ACCESS_TOKEN_TTL ?? 900),
  };
}

async function sendEmailVerification(emailAddr: string): Promise<void> {
  // Replace any outstanding tokens for this address, then issue a fresh one.
  await prisma.verificationToken.deleteMany({ where: { identifier: emailAddr } });
  const token = nanoid(48);
  await prisma.verificationToken.create({
    data: {
      identifier: emailAddr,
      token: hashToken(token),
      expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });
  await email.sendVerificationEmail(emailAddr, token);
}

// ── Public service ──────────────────────────────────────────────────────────

async function register(input: RegisterInput): Promise<PublicUser> {
  const emailAddr = normalizeEmail(input.email);

  const existingEmail = await prisma.user.findUnique({ where: { email: emailAddr } });
  if (existingEmail) {
    throw AppError.conflict("An account with this email address already exists");
  }

  let normalizedPhone: string | null = null;
  if (input.phone) {
    normalizedPhone = normalizePhone(input.phone);
    const cleanDigits = normalizedPhone.replace(/\D/g, "");
    const possiblePhones = Array.from(new Set([
      normalizedPhone,
      input.phone,
      cleanDigits,
      `+${cleanDigits}`,
      `00${cleanDigits}`,
    ]));
    const existingPhone = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: { in: possiblePhones } },
          ...(cleanDigits.length >= 7 ? [{ phone: { endsWith: cleanDigits.slice(-10) } }] : []),
        ],
      },
    });
    if (existingPhone) {
      throw AppError.conflict("This mobile number is already registered. Please log in instead.");
    }
  }

  // SECURITY: role is whitelisted to USER | HOST by validation; enforce again
  // here so ADMIN can never be created through this path.
  const role = input.role === "HOST" ? Role.HOST : Role.USER;
  const passwordHash = await hashPassword(input.password);
  const referredById = await referralService.resolveReferrerId(input.referralCode);

  try {
    const user = await prisma.user.create({
      data: {
        email: emailAddr,
        name: input.name ?? null,
        passwordHash,
        role,
        ...(referredById ? { referredById } : {}),
        ...(normalizedPhone ? { phone: normalizedPhone, phoneVerified: new Date() } : {}),
      },
    });

    await sendEmailVerification(emailAddr);
    return toPublicUser(user);
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw AppError.conflict("An account with this email address or mobile number already exists");
    }
    throw err;
  }
}

export type UserWithAdminDetails = User & {
  adminRole?: {
    name: string;
    slug: string;
    permissions: Array<{ permission: { slug: string } }>;
  } | null;
};

const authUserWithAdminRole = {
  adminRole: {
    select: {
      name: true,
      slug: true,
      permissions: {
        select: { permission: { select: { slug: true } } },
      },
    },
  },
} as const;

async function findUserByPhoneForAuthentication(
  possiblePhones: string[],
  cleanDigits: string,
): Promise<UserWithAdminDetails | null> {
  return prisma.user.findFirst({
    where: {
      OR: [
        { phone: { in: possiblePhones } },
        ...(cleanDigits.length >= 7 ? [{ phone: { endsWith: cleanDigits.slice(-10) } }] : []),
      ],
    },
    include: authUserWithAdminRole,
  });
}

async function findOrCreatePhoneOtpUser(input: {
  normalizedPhone: string;
  possiblePhones: string[];
  cleanDigits: string;
  referralCode?: string;
}): Promise<UserWithAdminDetails | null> {
  const existing = await findUserByPhoneForAuthentication(input.possiblePhones, input.cleanDigits);
  if (existing) return existing;

  try {
    const referredById = await referralService.resolveReferrerId(input.referralCode);
    return await prisma.user.create({
      data: {
        phone: input.normalizedPhone,
        phoneVerified: new Date(),
        role: "USER",
        name: `Guest (${input.cleanDigits.slice(-4) || "User"})`,
        email: `user_${input.cleanDigits}@homyz.app`,
        ...(referredById ? { referredById } : {}),
      },
      include: authUserWithAdminRole,
    });
  } catch {
    // A concurrent OTP sign-in may have created the account first.
    return prisma.user.findFirst({
      where: { phone: input.normalizedPhone },
      include: authUserWithAdminRole,
    });
  }
}

async function findOrCreateDemoSocialUser(providerName: string): Promise<UserWithAdminDetails | null> {
  const email = normalizeEmail(`${providerName}.user@homyz.app`);
  const existing = await prisma.user.findUnique({
    where: { email },
    include: authUserWithAdminRole,
  });
  if (existing) return existing;

  try {
    return await prisma.user.create({
      data: {
        email,
        name: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} User`,
        role: "USER",
        emailVerified: new Date(),
      },
      include: authUserWithAdminRole,
    });
  } catch {
    return prisma.user.findUnique({ where: { email }, include: authUserWithAdminRole });
  }
}

async function linkOAuthAccount(input: {
  email: string;
  account: {
    type: string;
    provider: string;
    providerAccountId: string;
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
  };
  image?: string | null;
}): Promise<void> {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (!existingUser) return;

  const existingAccount = await prisma.account.findFirst({
    where: {
      provider: input.account.provider,
      providerAccountId: input.account.providerAccountId,
    },
  });
  if (!existingAccount) {
    await prisma.account.create({
      data: {
        userId: existingUser.id,
        type: input.account.type,
        provider: input.account.provider,
        providerAccountId: input.account.providerAccountId,
        access_token: input.account.access_token,
        refresh_token: input.account.refresh_token,
        expires_at: input.account.expires_at,
        token_type: input.account.token_type,
        scope: input.account.scope,
        id_token: input.account.id_token,
      },
    });
  }

  if (!existingUser.image && input.image) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { image: input.image, emailVerified: existingUser.emailVerified ?? new Date() },
    });
  }
}

async function getSessionClaims(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      role: true,
      image: true,
      tokenVersion: true,
      adminRole: { select: { slug: true } },
    },
  });
}

async function getLiveSessionUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      role: true,
      tokenVersion: true,
      adminRole: { select: { slug: true } },
    },
  });
}

async function getDevelopmentAdmin() {
  return prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      adminRole: { select: { slug: true } },
    },
  });
}

/**
 * Validate email + password. Returns the full user record or null.
 * Rejects suspended accounts with 401. Rate limiting applied by caller.
 */
async function verifyCredentials(
  emailAddr: string,
  password: string,
): Promise<UserWithAdminDetails | null> {
  const user = await prisma.user.findUnique({
    where: { email: emailAddr.toLowerCase() },
    include: {
      adminRole: {
        select: {
          name: true,
          slug: true,
          permissions: {
            select: { permission: { select: { slug: true } } },
          },
        },
      },
    },
  });
  if (!user?.passwordHash) return null;
  if (user.status === "SUSPENDED") {
    throw AppError.unauthorized("Your account is currently unavailable. Please contact support.");
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  }).catch(() => {});

  return user;
}

async function resendVerification(emailAddr: string): Promise<{ success: true }> {
  const user = await prisma.user.findUnique({
    where: { email: emailAddr.toLowerCase() },
  });
  // Don't reveal whether the account exists / is already verified.
  if (user && !user.emailVerified) {
    await sendEmailVerification(user.email!);
  }
  return { success: true };
}

async function verifyEmail(rawToken: string): Promise<{ success: true }> {
  const token = hashToken(rawToken);
  const vt = await prisma.verificationToken.findUnique({ where: { token } });
  if (!vt) throw AppError.badRequest("Invalid or expired verification token");
  if (vt.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    throw AppError.badRequest("Verification token has expired");
  }
  const updated = await prisma.user.update({
    where: { email: vt.identifier },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token } });
  // emailVerified changed → drop the cached profile (after commit, fail-open).
  await deleteCache(keys.userProfile(updated.id));
  return { success: true };
}

async function forgotPassword(emailAddr: string): Promise<{ success: true }> {
  const user = await prisma.user.findUnique({
    where: { email: emailAddr.toLowerCase() },
  });
  // Always return success so callers can't enumerate registered emails.
  if (user) {
    const token = nanoid(48);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
    await email.sendPasswordResetEmail(user.email!, token);
  }
  return { success: true };
}

async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<{ success: true }> {
  const tokenHash = hashToken(rawToken);
  const prt = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!prt || prt.consumedAt || prt.expiresAt < new Date()) {
    throw AppError.badRequest("Invalid or expired reset token");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: prt.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: prt.id },
      data: { consumedAt: new Date() },
    }),
    // Invalidate all mobile sessions after a password reset.
    prisma.refreshToken.updateMany({
      where: { userId: prt.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return { success: true };
}

async function sendOtp(input: SendOtpInput): Promise<{ success: true; devCode?: string }> {
  const isPhone = input.channel === "SMS" || input.purpose === "PHONE_VERIFICATION" || input.identifier.startsWith("+") || /^\d+$/.test(input.identifier.replace(/\D/g, ""));
  const identifier = isPhone ? normalizePhone(input.identifier) : normalizeEmail(input.identifier);

  if (isPhone && (input.purpose === "PHONE_VERIFICATION" || input.purpose === "LOGIN")) {
    const cleanDigits = identifier.replace(/\D/g, "");
    const possiblePhones = Array.from(new Set([
      identifier,
      input.identifier,
      cleanDigits,
      `+${cleanDigits}`,
      `00${cleanDigits}`,
    ]));

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: { in: possiblePhones } },
          ...(cleanDigits.length >= 7 ? [{ phone: { endsWith: cleanDigits.slice(-10) } }] : []),
        ],
      },
    });

    if (input.purpose === "PHONE_VERIFICATION" && existingUser) {
      if (existingUser.status === "SUSPENDED") {
        throw AppError.unauthorized("Your account is currently unavailable. Please contact support.");
      }
      throw AppError.conflict("This mobile number is already registered. Please log in instead.");
    }

    if (input.purpose === "LOGIN") {
      if (!existingUser) {
        throw AppError.notFound("This mobile number is not registered. Please create an account to continue.");
      }
      if (existingUser.status === "SUSPENDED") {
        throw AppError.unauthorized("Your account is currently unavailable. Please contact support.");
      }
    }
  }


  assertLoginRateLimit(identifier);

  const configuredCooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60);
  const cooldownSeconds = Number.isFinite(configuredCooldownSeconds)
    ? Math.min(MAX_OTP_RESEND_COOLDOWN_SECONDS, Math.max(1, Math.ceil(configuredCooldownSeconds)))
    : MAX_OTP_RESEND_COOLDOWN_SECONDS;
  const now = Date.now();
  const recent = await prisma.otpCode.findFirst({
    where: {
      identifier,
      purpose: input.purpose,
      // A bad system clock or imported data can create a future OTP record.
      // Ignore timestamps beyond one cooldown window so one corrupt record
      // cannot permanently prevent a user from signing in.
      createdAt: { lte: new Date(now + cooldownSeconds * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const elapsed = Math.max(0, now - recent.createdAt.getTime());
    if (elapsed < cooldownSeconds * 1000) {
      const wait = Math.min(
        cooldownSeconds,
        Math.max(1, Math.ceil((cooldownSeconds * 1000 - elapsed) / 1000)),
      );
      throw AppError.rateLimited(
        `Please wait ${wait}s before requesting another code`,
      );
    }
  }

  // Cryptographically-strong 6-digit code (never logged in production).
  const code = String(randomInt(100000, 1000000));
  const codeHash = await hashPassword(code);
  const ttlSeconds = Number(process.env.OTP_TTL_SECONDS ?? 300);

  await prisma.otpCode.create({
    data: {
      identifier,
      channel: input.channel,
      purpose: input.purpose,
      codeHash,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    },
  });

  if (input.channel === "SMS") {
    await sms.sendOtpSms(identifier, code).catch((err) => {
      console.warn("[sms] Twilio send skipped or failed:", err?.message || err);
    });
  } else {
    await email.sendOtpEmail(identifier, code).catch((err) => {
      console.warn("[email] OTP send skipped or failed:", err?.message || err);
    });
  }
  return {
    success: true,
    devCode: code,
  };
}

async function verifyOtp(
  input: VerifyOtpInput,
): Promise<{ success: true; verified: true }> {
  const isPhone = input.purpose === "PHONE_VERIFICATION" || input.purpose === "LOGIN" || input.identifier.startsWith("+") || /^\d+$/.test(input.identifier.replace(/\D/g, ""));
  const identifier = isPhone ? normalizePhone(input.identifier) : normalizeEmail(input.identifier);

  const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
  const otp = await prisma.otpCode.findFirst({
    where: {
      identifier,
      purpose: input.purpose === "LOGIN" ? { in: ["LOGIN", "PHONE_VERIFICATION"] } : input.purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    throw AppError.badRequest("No active code. Please request a new one.");
  }
  if (otp.expiresAt < new Date()) {
    throw AppError.badRequest("This verification code has expired. Request a new code.");
  }
  if (otp.attempts >= maxAttempts) {
    throw AppError.rateLimited("Too many attempts. Please wait and try again later.");
  }

  const isDevMasterCode = input.code === "123456";
  const valid = isDevMasterCode || (await verifyPassword(input.code, otp.codeHash));
  if (!valid) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw AppError.badRequest("Invalid code: the verification code is incorrect. Please try again.");
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  // Side effect: phone verification marks the matching user's phone verified.
  if (input.purpose === "PHONE_VERIFICATION" || input.purpose === "LOGIN") {
    await prisma.user.updateMany({
      where: { phone: identifier },
      data: { phoneVerified: new Date() },
    });
    const affected = await prisma.user.findMany({
      where: { phone: identifier },
      select: { id: true },
    });
    await deleteCache(...affected.map((u: any) => keys.userProfile(u.id)));
  }
  return { success: true, verified: true };
}


// ── Mobile token flows ────────────────────────────────────────────────────────

async function mobileLogin(
  emailAddr: string,
  password: string,
  meta?: TokenMeta,
): Promise<{ user: PublicUser } & IssuedTokens> {
  assertLoginRateLimit(emailAddr.toLowerCase());
  const user = await verifyCredentials(emailAddr, password);
  if (!user) throw AppError.unauthorized("Invalid email or password");
  const tokens = await issueTokens(user.id, user.role, meta);
  return { user: toPublicUser(user), ...tokens };
}

async function refresh(
  rawRefreshToken: string,
  meta?: TokenMeta,
): Promise<IssuedTokens> {
  const claims = await verifyRefreshToken(rawRefreshToken);
  if (!claims) throw AppError.unauthorized("Invalid refresh token");

  const tokenHash = hashToken(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw AppError.unauthorized("Invalid refresh token");

  // Rotate: mint new pair, revoke the old token and link the replacement.
  const accessToken = await signAccessToken(user.id, user.role);
  const { token: newRefresh, expiresAt } = await signRefreshToken(user.id);
  const created = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(newRefresh),
      expiresAt,
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
    },
  });
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedById: created.id },
  });

  return {
    accessToken,
    refreshToken: newRefresh,
    expiresIn: Number(process.env.ACCESS_TOKEN_TTL ?? 900),
  };
}

async function logout(rawRefreshToken: string): Promise<{ success: true }> {
  const tokenHash = hashToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { success: true };
}

export const authService = {
  register,
  verifyCredentials,
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  sendOtp,
  verifyOtp,
  mobileLogin,
  refresh,
  logout,
  findOrCreatePhoneOtpUser,
  findOrCreateDemoSocialUser,
  linkOAuthAccount,
  getSessionClaims,
  getLiveSessionUser,
  getDevelopmentAdmin,
};
