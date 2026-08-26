import type { Role } from "@/generated/prisma/enums";

// The single normalized identity used by the permission + service layers,
// regardless of surface (web NextAuth cookie or mobile Bearer token).
export interface AuthUser {
  id: string;
  role: Role;
  email: string | null;
}
