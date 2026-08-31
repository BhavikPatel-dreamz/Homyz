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

// Build the provider list from whatever credentials are present in the
// environment. OAuth providers are only added when their keys are set, so the
// app runs fine locally with just email/password.
function buildProviders(): NextAuthOptions["providers"] {
  const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Throttle before touching the password hash.
        assertLoginRateLimit(email.toLowerCase());

        const headers = req?.headers as Record<string, string | string[] | undefined> | undefined;
        const rawIp = headers?.["x-forwarded-for"] || headers?.["x-real-ip"] || null;
        const ip = Array.isArray(rawIp) ? rawIp[0] : rawIp;
        const rawUa = headers?.["user-agent"] || null;
        const userAgent = Array.isArray(rawUa) ? rawUa[0] : rawUa;

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
      }),
    );
  }

  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push(
      FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
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
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present at sign-in. Persist id, role, status, adminRoleSlug, tokenVersion, and permissions.
      if (user) {
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
              tokenVersion: true,
              adminRole: { select: { slug: true } },
            },
          });
          if (dbUser) {
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
      }
      return session;
    },
  },
};
