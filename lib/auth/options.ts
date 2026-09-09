import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";

import { prisma } from "@/lib/db/prisma";
import { assertLoginRateLimit } from "@/lib/services/rate-limit";
import { loginSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";
import { auditService } from "@/services/audit.service";
import type { Role } from "@/generated/prisma/enums";
import { normalizeEmail, normalizePhone } from "@/lib/auth/normalization";

// Build the provider list from whatever credentials are present in the
// environment. OAuth providers are only added when their keys are set, so the
// app runs fine locally with just email/password.
function buildProviders(): NextAuthOptions["providers"] {
  const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      name: "Email, Phone OTP, or Social",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        phone: { label: "Phone", type: "text" },
        otpCode: { label: "OTP Code", type: "text" },
        provider: { label: "Provider", type: "text" },
      },
      async authorize(credentials, req) {
        const headers = req?.headers as Record<string, string | string[] | undefined> | undefined;
        const rawIp = headers?.["x-forwarded-for"] || headers?.["x-real-ip"] || null;
        const ip = Array.isArray(rawIp) ? rawIp[0] : rawIp;
        const rawUa = headers?.["user-agent"] || null;
        const userAgent = Array.isArray(rawUa) ? rawUa[0] : rawUa;

        // 1. Phone OTP Verification Sign-In
        if (credentials?.phone && credentials?.otpCode) {
          const normalizedPhone = normalizePhone(credentials.phone);
          const cleanDigits = normalizedPhone.replace(/\D/g, "");
          const possiblePhones = Array.from(new Set([
            normalizedPhone,
            credentials.phone,
            cleanDigits,
            `+${cleanDigits}`,
            `00${cleanDigits}`,
          ]));

          const verified = await authService.verifyOtp({
            identifier: normalizedPhone,
            code: credentials.otpCode,
            purpose: "LOGIN",
          }).catch(async () => {
            // Also attempt verification under PHONE_VERIFICATION purpose if LOGIN purpose OTP was issued for signup
            return await authService.verifyOtp({
              identifier: normalizedPhone,
              code: credentials.otpCode,
              purpose: "PHONE_VERIFICATION",
            });
          });

          if (!verified?.success) {
            return null;
          }

          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { phone: { in: possiblePhones } },
                ...(cleanDigits.length >= 7 ? [{ phone: { endsWith: cleanDigits.slice(-10) } }] : []),
              ],
            },
            include: {
              adminRole: {
                select: {
                  name: true,
                  slug: true,
                  permissions: { select: { permission: { select: { slug: true } } } },
                },
              },
            },
          });

          if (!user) {
            const canonicalEmail = `user_${cleanDigits}@homyz.app`;
            try {
              user = await prisma.user.create({
                data: {
                  phone: normalizedPhone,
                  phoneVerified: new Date(),
                  role: "USER",
                  name: `Guest (${cleanDigits.slice(-4) || "User"})`,
                  email: canonicalEmail,
                },
                include: {
                  adminRole: {
                    select: {
                      name: true,
                      slug: true,
                      permissions: { select: { permission: { select: { slug: true } } } },
                    },
                  },
                },
              });
            } catch (err: any) {
              user = await prisma.user.findFirst({
                where: { phone: normalizedPhone },
                include: {
                  adminRole: {
                    select: {
                      name: true,
                      slug: true,
                      permissions: { select: { permission: { select: { slug: true } } } },
                    },
                  },
                },
              });
            }
          }

          if (!user) return null;

          if (user.status === "SUSPENDED") {
            throw new Error("Your account is currently unavailable. Please contact support.");
          }

          const { getEffectivePermissionsForUser } = await import("@/lib/permissions/admin-permission-service");
          const effectivePermissions = await getEffectivePermissionsForUser(user.id, user.role, user.adminRole?.slug);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            status: user.status,
            adminRoleSlug: user.adminRole?.slug ?? null,
            permissions: effectivePermissions,
          };
        }

        // 2. Social Provider Fallback Sign-In (Demo/Development Mode Only)
        if (credentials?.provider && (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_SOCIAL === "true")) {
          const providerName = credentials.provider.toLowerCase();
          const demoEmail = normalizeEmail(`${providerName}.user@homyz.app`);
          let user = await prisma.user.findUnique({
            where: { email: demoEmail },
            include: {
              adminRole: {
                select: {
                  name: true,
                  slug: true,
                  permissions: { select: { permission: { select: { slug: true } } } },
                },
              },
            },
          });

          if (!user) {
            try {
              user = await prisma.user.create({
                data: {
                  email: demoEmail,
                  name: `${providerName.charAt(0).toUpperCase() + providerName.slice(1)} User`,
                  role: "USER",
                  emailVerified: new Date(),
                },
                include: {
                  adminRole: {
                    select: {
                      name: true,
                      slug: true,
                      permissions: { select: { permission: { select: { slug: true } } } },
                    },
                  },
                },
              });
            } catch {
              user = await prisma.user.findUnique({
                where: { email: demoEmail },
                include: {
                  adminRole: {
                    select: {
                      name: true,
                      slug: true,
                      permissions: { select: { permission: { select: { slug: true } } } },
                    },
                  },
                },
              });
            }
          }

          if (!user) return null;

          const { getEffectivePermissionsForUser } = await import("@/lib/permissions/admin-permission-service");
          const effectivePermissions = await getEffectivePermissionsForUser(user.id, user.role, user.adminRole?.slug);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            status: user.status,
            adminRoleSlug: user.adminRole?.slug ?? null,
            permissions: effectivePermissions,
          };
        }


        // 3. Email & Password Sign-In
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Throttle before touching the password hash.
        assertLoginRateLimit(email.toLowerCase());

        const user = await authService.verifyCredentials(email, password);
        if (!user) {
          await auditService.record({
            action: "LOGIN_FAILED",
            resourceType: "Auth",
            actorEmail: email.toLowerCase(),
            description: `Failed login attempt for ${email.toLowerCase()}`,
            status: "FAILURE",
            ip: typeof ip === "string" ? ip : null,
            userAgent: typeof userAgent === "string" ? userAgent : null,
          });
          return null;
        }

        const { getEffectivePermissionsForUser } = await import("@/lib/permissions/admin-permission-service");
        const effectivePermissions = await getEffectivePermissionsForUser(user.id, user.role, user.adminRole?.slug);

        await auditService.record({
          actorId: user.id,
          actorEmail: user.email,
          action: user.role === "ADMIN" || user.adminRole ? "ADMIN_LOGIN" : "USER_LOGIN",
          resourceType: "Auth",
          resourceId: user.id,
          description: `Successful login for ${user.email} (${user.adminRole?.name ?? user.role})`,
          ip: typeof ip === "string" ? ip : null,
          userAgent: typeof userAgent === "string" ? userAgent : null,
        });

        // Non-secret fields + role & permissions flow into JWT.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          status: user.status,
          adminRoleSlug: user.adminRole?.slug ?? null,
          permissions: effectivePermissions,
        };
      },
    }),
  ];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push(
      FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  // Apple's clientSecret is a short-lived ES256 JWT. Supply a pre-generated one
  // via APPLE_CLIENT_SECRET; the provider is skipped when it is absent.
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    providers.push(
      AppleProvider({
        clientId: process.env.APPLE_CLIENT_ID,
        clientSecret: process.env.APPLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  // The adapter is typed against @prisma/client's PrismaClient; our client is
  // generated to a custom output path, so cast to the adapter's expected type.
  adapter: PrismaAdapter(
    prisma as unknown as Parameters<typeof PrismaAdapter>[0],
  ),
  // JWT sessions are required for the Credentials provider and unify web
  // (cookie) + mobile (Bearer) since both carry the same signed claims.
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  // Over plain HTTP (such as testing with live IP http://8.213.86.216:3000), browsers reject
  // any cookie with Secure flag or __Secure- prefix. Only enable secure cookies when using HTTPS.
  useSecureCookies:
    process.env.NEXTAUTH_URL?.startsWith("https://") ||
    process.env.APP_URL?.startsWith("https://") ||
    false,
  providers: buildProviders(),
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs without forcing NEXTAUTH_URL origin
      if (url.startsWith("/")) {
        return url;
      }
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) {
          return url;
        }
        // If the URL has a path on a different host (e.g. localhost vs server IP), extract internal relative path
        if (parsed.pathname) {
          return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      } catch {}
      return baseUrl;
    },
    async signIn({ user, account, profile }) {
      // For OAuth sign-ins, allow linking and ensure user exists in DB
      if (account && account.provider !== "credentials" && profile?.email) {
        const normalizedEmail = normalizeEmail(profile.email);
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });

          if (existingUser) {
            // Link the OAuth account to the existing user if not already linked
            const existingAccount = await prisma.account.findFirst({
              where: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            });

            if (!existingAccount) {
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                },
              });
            }

            // Update user profile with Google avatar/name if not set
            if (!existingUser.image && (user as { image?: string })?.image) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                  image: (user as { image?: string }).image,
                  emailVerified: existingUser.emailVerified ?? new Date(),
                },
              });
            }
          }
        } catch (err) {
          console.error("OAuth signIn linking error:", err);
          // Don't block sign-in on linking errors
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // `user` is only present at sign-in. Persist id, role, status, adminRoleSlug, tokenVersion, and permissions.
      if (user) {
        const userImage = (user as { image?: string | null; picture?: string | null })?.image ?? (user as { picture?: string | null })?.picture ?? null;
        if (userImage) {
          (token as { picture?: string | null }).picture = userImage;
        }
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? token.role;
        token.status = (user as { status?: string }).status;
        token.adminRoleSlug = (user as { adminRoleSlug?: string | null }).adminRoleSlug;
        token.permissions = (user as { permissions?: string[] }).permissions;
        token.tokenVersion = (user as { tokenVersion?: number }).tokenVersion ?? 0;
        return token;
      }

      // Sync status, tokenVersion, and effective permissions from DB so changes take effect immediately
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              status: true,
              role: true,
              image: true,
              tokenVersion: true,
              adminRole: { select: { slug: true } },
            },
          });
          if (dbUser) {
            if (dbUser.image) {
              (token as { picture?: string | null }).picture = dbUser.image;
            }
            if (
              token.tokenVersion !== undefined &&
              token.tokenVersion < dbUser.tokenVersion
            ) {
              token.isRevoked = true;
              token.status = "REVOKED";
            } else {
              token.status = dbUser.status;
              token.role = dbUser.role;
              token.adminRoleSlug = dbUser.adminRole?.slug ?? null;
              token.tokenVersion = dbUser.tokenVersion;

              const { getEffectivePermissionsForUser } = await import("@/lib/permissions/admin-permission-service");
              token.permissions = await getEffectivePermissionsForUser(token.id as string, dbUser.role, dbUser.adminRole?.slug);
            }
          }
        } catch {
          // Keep existing claims if DB query fails
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.status = token.status as string | undefined;
        session.user.adminRoleSlug = token.adminRoleSlug as string | null | undefined;
        session.user.permissions = token.permissions as string[] | undefined;
        session.user.tokenVersion = token.tokenVersion as number | undefined;
        session.user.image = ((token as { picture?: string | null }).picture ?? session.user.image) as string | undefined;
      }
      return session;
    },
  },
};
