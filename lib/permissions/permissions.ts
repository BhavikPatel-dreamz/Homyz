import type { AuthUser } from "@/lib/auth/types";
import { AppError } from "@/lib/api/errors";

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: "dashboard.view",

  // Users
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_EDIT: "users.edit",
  USERS_DELETE: "users.delete",
  USERS_EXPORT: "users.export",

  // Admins
  ADMINS_VIEW: "admins.view",
  ADMINS_CREATE: "admins.create",
  ADMINS_EDIT: "admins.edit",
  ADMINS_DELETE: "admins.delete",

  // Roles & Permissions
  ROLES_VIEW: "roles.view",
  ROLES_CREATE: "roles.create",
  ROLES_EDIT: "roles.edit",
  ROLES_DELETE: "roles.delete",

  // Reservations / Bookings
  RESERVATIONS_VIEW: "reservations.view",
  RESERVATIONS_CREATE: "reservations.create",
  RESERVATIONS_EDIT: "reservations.edit",
  RESERVATIONS_CANCEL: "reservations.cancel",
  RESERVATIONS_EXPORT: "reservations.export",

  // Listings
  LISTINGS_VIEW: "listings.view",
  LISTINGS_CREATE: "listings.create",
  LISTINGS_EDIT: "listings.edit",
  LISTINGS_DELETE: "listings.delete",

  // Reports
  REPORTS_VIEW: "reports.view",
  REPORTS_EXPORT: "reports.export",

  // Logs & Security
  ACTIVITY_LOGS_VIEW: "activity_logs.view",
  ACTIVITY_LOGS_EXPORT: "activity_logs.export",
  SECURITY_LOGS_VIEW: "security_logs.view",

  // Sessions
  SESSIONS_VIEW: "sessions.view",
  SESSIONS_REVOKE: "sessions.revoke",

  // Settings
  SETTINGS_VIEW: "settings.view",
  SETTINGS_EDIT: "settings.edit",
} as const;

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionDefinition {
  slug: PermissionSlug;
  module: string;
  action: string;
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Dashboard
  { slug: PERMISSIONS.DASHBOARD_VIEW, module: "Dashboard", action: "View", description: "Access admin dashboard overview" },

  // Users
  { slug: PERMISSIONS.USERS_VIEW, module: "Users", action: "View", description: "View registered users and details" },
  { slug: PERMISSIONS.USERS_CREATE, module: "Users", action: "Create", description: "Create new user accounts" },
  { slug: PERMISSIONS.USERS_EDIT, module: "Users", action: "Edit", description: "Edit user profiles, roles, and status" },
  { slug: PERMISSIONS.USERS_DELETE, module: "Users", action: "Delete", description: "Delete user accounts" },
  { slug: PERMISSIONS.USERS_EXPORT, module: "Users", action: "Export", description: "Export user lists and data" },

  // Admins
  { slug: PERMISSIONS.ADMINS_VIEW, module: "Admins", action: "View", description: "View administrators list" },
  { slug: PERMISSIONS.ADMINS_CREATE, module: "Admins", action: "Create", description: "Create new administrators" },
  { slug: PERMISSIONS.ADMINS_EDIT, module: "Admins", action: "Edit", description: "Modify administrator roles and permissions" },
  { slug: PERMISSIONS.ADMINS_DELETE, module: "Admins", action: "Delete", description: "Deactivate or remove administrators" },

  // Roles
  { slug: PERMISSIONS.ROLES_VIEW, module: "Roles", action: "View", description: "View custom roles and permission matrix" },
  { slug: PERMISSIONS.ROLES_CREATE, module: "Roles", action: "Create", description: "Create new administrative roles" },
  { slug: PERMISSIONS.ROLES_EDIT, module: "Roles", action: "Edit", description: "Modify role permissions" },
  { slug: PERMISSIONS.ROLES_DELETE, module: "Roles", action: "Delete", description: "Delete non-system roles" },

  // Reservations
  { slug: PERMISSIONS.RESERVATIONS_VIEW, module: "Reservations", action: "View", description: "View guest bookings and reservations" },
  { slug: PERMISSIONS.RESERVATIONS_CREATE, module: "Reservations", action: "Create", description: "Create bookings manually" },
  { slug: PERMISSIONS.RESERVATIONS_EDIT, module: "Reservations", action: "Edit", description: "Modify reservation dates and details" },
  { slug: PERMISSIONS.RESERVATIONS_CANCEL, module: "Reservations", action: "Cancel", description: "Cancel active reservations" },
  { slug: PERMISSIONS.RESERVATIONS_EXPORT, module: "Reservations", action: "Export", description: "Export booking data" },

  // Listings
  { slug: PERMISSIONS.LISTINGS_VIEW, module: "Listings", action: "View", description: "View all property listings" },
  { slug: PERMISSIONS.LISTINGS_CREATE, module: "Listings", action: "Create", description: "Create new property listings" },
  { slug: PERMISSIONS.LISTINGS_EDIT, module: "Listings", action: "Edit", description: "Edit property listings" },
  { slug: PERMISSIONS.LISTINGS_DELETE, module: "Listings", action: "Delete", description: "Delete property listings" },

  // Reports
  { slug: PERMISSIONS.REPORTS_VIEW, module: "Reports", action: "View", description: "View analytical reports and summaries" },
  { slug: PERMISSIONS.REPORTS_EXPORT, module: "Reports", action: "Export", description: "Export platform reports" },

  // Logs
  { slug: PERMISSIONS.ACTIVITY_LOGS_VIEW, module: "Activity Logs", action: "View", description: "View admin audit and activity logs" },
  { slug: PERMISSIONS.ACTIVITY_LOGS_EXPORT, module: "Activity Logs", action: "Export", description: "Export audit logs" },
  { slug: PERMISSIONS.SECURITY_LOGS_VIEW, module: "Security Logs", action: "View", description: "Monitor security events and login audits" },

  // Sessions
  { slug: PERMISSIONS.SESSIONS_VIEW, module: "Sessions", action: "View", description: "View active user and admin sessions" },
  { slug: PERMISSIONS.SESSIONS_REVOKE, module: "Sessions", action: "Revoke", description: "Revoke active sessions remotely" },

  // Settings
  { slug: PERMISSIONS.SETTINGS_VIEW, module: "Settings", action: "View", description: "View system configurations" },
  { slug: PERMISSIONS.SETTINGS_EDIT, module: "Settings", action: "Edit", description: "Update system settings" },
];

/** Check whether user has specific permission. Super Admin (or Role.ADMIN without explicit restrictions) has all permissions. */
export function hasPermission(user: AuthUser | null | undefined, permission: PermissionSlug | string): boolean {
  if (!user) return false;
  // Role.ADMIN or super_admin bypasses / possesses all permissions
  if (user.role === "ADMIN" && (!user.permissions || user.permissions.length === 0 || user.adminRoleSlug === "super_admin")) {
    return true;
  }
  if (user.permissions?.includes("*") || user.permissions?.includes(permission)) {
    return true;
  }
  return false;
}

export function hasAnyPermission(user: AuthUser | null | undefined, permissions: (PermissionSlug | string)[]): boolean {
  if (!user) return false;
  return permissions.some((p) => hasPermission(user, p));
}

export function assertPermission(user: AuthUser | null | undefined, permission: PermissionSlug | string): asserts user is AuthUser {
  if (!user) throw AppError.unauthorized();
  if (!hasPermission(user, permission)) {
    throw AppError.forbidden(`Missing required permission: ${permission}`);
  }
}
