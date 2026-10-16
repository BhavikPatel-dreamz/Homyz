import type { DefaultSession } from "next-auth";

import type { Role } from "@/generated/prisma/enums";
import type { RequiredProfileField } from "@/lib/auth/profile-completion";

// Module augmentation: carry our `id` and `role` through the NextAuth session
// and JWT. The `jwt` callback injects them (guarded by `if (user)`); the
// `session` callback forwards them. See lib/auth/options.ts.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      status?: string;
      adminRoleSlug?: string | null;
      permissions?: string[];
      tokenVersion?: number;
      profileComplete?: boolean;
      missingProfileFields?: RequiredProfileField[];
    } & DefaultSession["user"];
  }

  // Returned by the Credentials `authorize` callback and the adapter.
  interface User {
    role: Role;
    status?: string;
    adminRoleSlug?: string | null;
    permissions?: string[];
    tokenVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status?: string;
    adminRoleSlug?: string | null;
    permissions?: string[];
    tokenVersion?: number;
    isRevoked?: boolean;
    profileComplete?: boolean;
    missingProfileFields?: RequiredProfileField[];
  }
}
