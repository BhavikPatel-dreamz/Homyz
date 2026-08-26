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
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Throttle before touching the password hash.
        assertLoginRateLimit(email.toLowerCase());

        const user = await authService.verifyCredentials(email, password);
        if (!user) return null;

        // Only non-secret fields flow into the JWT.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
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
      // `user` is only present at sign-in (Credentials return value or the
      // adapter user for OAuth). Persist id + role into the token.
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? token.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};
