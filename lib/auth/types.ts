import type { Role } from "@/generated/prisma/enums";
import type { RequiredProfileField } from "./profile-completion";

// The single normalized identity used by the permission + service layers,
// regardless of surface (web NextAuth cookie or mobile Bearer token).
export interface AuthUser {
  id: string;
  role: Role;
  email: string | null;
  name?: string | null;
  image?: string | null;
  status?: string;
  adminRoleSlug?: string | null;
  permissions?: string[];
  tokenVersion?: number;
  profileComplete?: boolean;
  missingProfileFields?: RequiredProfileField[];
}
