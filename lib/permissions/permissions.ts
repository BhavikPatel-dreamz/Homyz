import type { AuthUser } from "@/lib/auth/types";
import { AppError } from "@/lib/api/errors";

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: "dashboard.view",

  // Hosts
  HOSTS_VIEW: "hosts.view",
  HOSTS_CREATE: "hosts.create",
  HOSTS_EDIT: "hosts.edit",
  HOSTS_VERIFY: "hosts.verify",
  HOSTS_SUSPEND: "hosts.suspend",
  HOSTS_DELETE: "hosts.delete",
  HOSTS_ACTIVITY: "hosts.activity",
  HOSTS_MANAGE_PERMISSIONS: "hosts.manage_permissions",

  // Host Registrations (Phase 1, Phase 2, Phase 3)
  HOST_REGISTRATION_VIEW: "host_registration.view",
  HOST_REGISTRATION_REVIEW: "host_registration.review",
  HOST_REGISTRATION_ASSIGN: "host_registration.assign",
  HOST_REGISTRATION_EDIT: "host_registration.edit",
  HOST_REGISTRATION_VIEW_DOCUMENTS: "host_registration.view_documents",
  HOST_REGISTRATION_VERIFY_DOCUMENTS: "host_registration.verify_documents",
  HOST_REGISTRATION_REJECT_DOCUMENTS: "host_registration.reject_documents",
  HOST_REGISTRATION_REQUEST_RESUBMISSION: "host_registration.request_resubmission",
  HOST_REGISTRATION_ADD_NOTES: "host_registration.add_notes",
  HOST_REGISTRATION_VIEW_COMPLIANCE: "host_registration.view_compliance",
  HOST_REGISTRATION_MANAGE_COMPLIANCE: "host_registration.manage_compliance",
  HOST_REGISTRATION_REQUEST_INFO: "host_registration.request_info",
  HOST_REGISTRATION_APPROVE: "host_registration.approve",
  HOST_REGISTRATION_REJECT: "host_registration.reject",
  HOST_REGISTRATION_REOPEN: "host_registration.reopen",

  // Host Onboarding (Phase 4)
  HOST_ONBOARDING_VIEW: "host_onboarding.view",
  HOST_ONBOARDING_MANAGE: "host_onboarding.manage",
  HOST_ONBOARDING_ASSIGN: "host_onboarding.assign",
  HOST_ONBOARDING_VIEW_ANALYTICS: "host_onboarding.view_analytics",

  // Host Ongoing Compliance & Monitoring (Phase 5)
  HOST_COMPLIANCE_VIEW: "host_compliance.view",
  HOST_COMPLIANCE_MANAGE: "host_compliance.manage",
  HOST_COMPLIANCE_REQUEST_VERIFICATION: "host_compliance.request_verification",
  HOST_COMPLIANCE_RESOLVE_ISSUE: "host_compliance.resolve_issue",
  HOST_COMPLIANCE_SUSPEND: "host_compliance.suspend",
  HOST_COMPLIANCE_VIEW_DOCUMENTS: "host_compliance.view_documents",

  // Host Onboarding Analytics & Operational Monitoring (Phase 6)
  HOST_OPERATIONS_VIEW: "host_operations.view",
  HOST_OPERATIONS_MANAGE_ALERTS: "host_operations.manage_alerts",
  HOST_OPERATIONS_VIEW_ANALYTICS: "host_operations.view_analytics",
  HOST_OPERATIONS_EXPORT: "host_operations.export",
  HOST_OPERATIONS_MANAGE_ASSIGNMENTS: "host_operations.manage_assignments",

  // Guests
  GUESTS_VIEW: "guests.view",
  GUESTS_CREATE: "guests.create",
  GUESTS_EDIT: "guests.edit",
  GUESTS_SUSPEND: "guests.suspend",
  GUESTS_DELETE: "guests.delete",
  GUESTS_ACTIVITY: "guests.activity",

  // Users (legacy/general)
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_EDIT: "users.edit",
  USERS_DELETE: "users.delete",
  USERS_EXPORT: "users.export",

  // Listings
  LISTINGS_VIEW: "listings.view",
  LISTINGS_CREATE: "listings.create",
  LISTINGS_EDIT: "listings.edit",
  LISTINGS_APPROVE: "listings.approve",
  LISTINGS_SUSPEND: "listings.suspend",
  LISTINGS_DELETE: "listings.delete",

  // Bookings / Reservations
  BOOKINGS_VIEW: "bookings.view",
  BOOKINGS_MANAGE: "bookings.manage",
  BOOKINGS_CANCEL: "bookings.cancel",
  RESERVATIONS_VIEW: "reservations.view",
  RESERVATIONS_CREATE: "reservations.create",
  RESERVATIONS_EDIT: "reservations.edit",
  RESERVATIONS_CANCEL: "reservations.cancel",
  RESERVATIONS_EXPORT: "reservations.export",

  // Payments & Payouts
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_MANAGE: "payments.manage",
  PAYMENTS_REFUND: "payments.refund",
  PAYOUTS_VIEW: "payouts.view",
  PAYOUTS_MANAGE: "payouts.manage",

  // Reviews
  REVIEWS_VIEW: "reviews.view",
  REVIEWS_MODERATE: "reviews.moderate",
  REVIEWS_DELETE: "reviews.delete",

  // Audit & Security Logs
  ACTIVITY_LOGS_VIEW: "activity_logs.view",
  ACTIVITY_LOGS_EXPORT: "activity_logs.export",
  SECURITY_LOGS_VIEW: "security_logs.view",

  // Reports
  REPORTS_VIEW: "reports.view",
  REPORTS_EXPORT: "reports.export",

  // Admin Management
  ADMINS_VIEW: "admins.view",
  ADMINS_CREATE: "admins.create",
  ADMINS_EDIT: "admins.edit",
  ADMINS_ACTIVATE: "admins.activate",
  ADMINS_DELETE: "admins.delete",
  ADMINS_MANAGE_PERMISSIONS: "admins.manage_permissions",

  // Roles & Permissions Matrix
  ROLES_VIEW: "roles.view",
  ROLES_CREATE: "roles.create",
  ROLES_EDIT: "roles.edit",
  ROLES_DELETE: "roles.delete",

  // Sessions & Settings
  SESSIONS_VIEW: "sessions.view",
  SESSIONS_REVOKE: "sessions.revoke",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_EDIT: "settings.edit",
} as const;

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionDefinition {
  slug: string;
  module: string;
  action: string;
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Dashboard
  { slug: PERMISSIONS.DASHBOARD_VIEW, module: "Dashboard", action: "View", description: "Access admin dashboard overview" },

  // Hosts Module
  { slug: PERMISSIONS.HOSTS_VIEW, module: "Hosts", action: "View", description: "View registered host profiles and details" },
  { slug: PERMISSIONS.HOSTS_CREATE, module: "Hosts", action: "Create", description: "Create host accounts" },
  { slug: PERMISSIONS.HOSTS_EDIT, module: "Hosts", action: "Edit", description: "Edit host profiles and contact details" },
  { slug: PERMISSIONS.HOSTS_VERIFY, module: "Hosts", action: "Verify", description: "Approve or review host identity verifications" },
  { slug: PERMISSIONS.HOSTS_SUSPEND, module: "Hosts", action: "Suspend", description: "Suspend or reactivate host accounts" },
  { slug: PERMISSIONS.HOSTS_DELETE, module: "Hosts", action: "Delete", description: "Permanently delete host accounts" },
  { slug: PERMISSIONS.HOSTS_ACTIVITY, module: "Hosts", action: "View Activity", description: "View host activity and audit history" },
  { slug: PERMISSIONS.HOSTS_MANAGE_PERMISSIONS, module: "Hosts", action: "Manage Permissions", description: "Manage individual host permission overrides" },

  // Host Registrations Module
  { slug: PERMISSIONS.HOST_REGISTRATION_VIEW, module: "Host Registrations", action: "View", description: "View host registration applications" },
  { slug: PERMISSIONS.HOST_REGISTRATION_REVIEW, module: "Host Registrations", action: "Review", description: "Start and manage review for host applications" },
  { slug: PERMISSIONS.HOST_REGISTRATION_ASSIGN, module: "Host Registrations", action: "Assign", description: "Assign or reassign reviewers to host registration requests" },
  { slug: PERMISSIONS.HOST_REGISTRATION_EDIT, module: "Host Registrations", action: "Edit", description: "Edit host registration application information" },
  { slug: PERMISSIONS.HOST_REGISTRATION_VIEW_DOCUMENTS, module: "Host Registrations", action: "View Documents", description: "View and download submitted host verification documents" },
  { slug: PERMISSIONS.HOST_REGISTRATION_VERIFY_DOCUMENTS, module: "Host Registrations", action: "Verify Documents", description: "Verify submitted host verification documents" },
  { slug: PERMISSIONS.HOST_REGISTRATION_REJECT_DOCUMENTS, module: "Host Registrations", action: "Reject Documents", description: "Reject submitted host verification documents with reason" },
  { slug: PERMISSIONS.HOST_REGISTRATION_REQUEST_RESUBMISSION, module: "Host Registrations", action: "Request Resubmission", description: "Request document resubmission from host" },
  { slug: PERMISSIONS.HOST_REGISTRATION_ADD_NOTES, module: "Host Registrations", action: "Add Notes", description: "Add internal reviewer notes to registration application" },
  { slug: PERMISSIONS.HOST_REGISTRATION_VIEW_COMPLIANCE, module: "Host Registrations", action: "View Compliance", description: "View compliance checks, checklist, and issues" },
  { slug: PERMISSIONS.HOST_REGISTRATION_MANAGE_COMPLIANCE, module: "Host Registrations", action: "Manage Compliance", description: "Update compliance checks and create/resolve compliance issues" },
  { slug: PERMISSIONS.HOST_REGISTRATION_REQUEST_INFO, module: "Host Registrations", action: "Request Info", description: "Request additional information from host applicant" },
  { slug: PERMISSIONS.HOST_REGISTRATION_APPROVE, module: "Host Registrations", action: "Approve Application", description: "Approve host registration application and activate host account" },
  { slug: PERMISSIONS.HOST_REGISTRATION_REJECT, module: "Host Registrations", action: "Reject Application", description: "Reject host registration application with mandatory reason" },
  { slug: PERMISSIONS.HOST_REGISTRATION_REOPEN, module: "Host Registrations", action: "Reopen Application", description: "Reopen an approved or rejected host registration application" },

  // Guests Module
  { slug: PERMISSIONS.GUESTS_VIEW, module: "Guests", action: "View", description: "View registered guest profiles and details" },
  { slug: PERMISSIONS.GUESTS_CREATE, module: "Guests", action: "Create", description: "Create guest accounts" },
  { slug: PERMISSIONS.GUESTS_EDIT, module: "Guests", action: "Edit", description: "Edit guest profiles and contact details" },
  { slug: PERMISSIONS.GUESTS_SUSPEND, module: "Guests", action: "Suspend", description: "Suspend or reactivate guest accounts" },
  { slug: PERMISSIONS.GUESTS_DELETE, module: "Guests", action: "Delete", description: "Permanently delete guest accounts" },
  { slug: PERMISSIONS.GUESTS_ACTIVITY, module: "Guests", action: "View Activity", description: "View guest activity and booking history" },

  // Listings Module
  { slug: PERMISSIONS.LISTINGS_VIEW, module: "Listings", action: "View", description: "View property listings" },
  { slug: PERMISSIONS.LISTINGS_CREATE, module: "Listings", action: "Create", description: "Create property listings" },
  { slug: PERMISSIONS.LISTINGS_EDIT, module: "Listings", action: "Edit", description: "Edit property listings" },
  { slug: PERMISSIONS.LISTINGS_APPROVE, module: "Listings", action: "Approve", description: "Approve pending property listings" },
  { slug: PERMISSIONS.LISTINGS_SUSPEND, module: "Listings", action: "Suspend", description: "Suspend property listings" },
  { slug: PERMISSIONS.LISTINGS_DELETE, module: "Listings", action: "Delete", description: "Delete property listings" },

  // Bookings Module
  { slug: PERMISSIONS.BOOKINGS_VIEW, module: "Bookings", action: "View", description: "View reservations and bookings" },
  { slug: PERMISSIONS.BOOKINGS_MANAGE, module: "Bookings", action: "Manage", description: "Modify reservation dates and details" },
  { slug: PERMISSIONS.BOOKINGS_CANCEL, module: "Bookings", action: "Cancel", description: "Cancel active guest bookings" },

  // Payments Module
  { slug: PERMISSIONS.PAYMENTS_VIEW, module: "Payments", action: "View Payments", description: "View payment transactions and invoices" },
  { slug: PERMISSIONS.PAYMENTS_MANAGE, module: "Payments", action: "Manage Payments", description: "Manage billing and transaction records" },
  { slug: PERMISSIONS.PAYMENTS_REFUND, module: "Payments", action: "Refund Payments", description: "Process guest payment refunds" },
  { slug: PERMISSIONS.PAYOUTS_VIEW, module: "Payments", action: "View Payouts", description: "View host payout schedules" },
  { slug: PERMISSIONS.PAYOUTS_MANAGE, module: "Payments", action: "Manage Payouts", description: "Release or hold host payouts" },

  // Reviews Module
  { slug: PERMISSIONS.REVIEWS_VIEW, module: "Reviews", action: "View", description: "View property and host reviews" },
  { slug: PERMISSIONS.REVIEWS_MODERATE, module: "Reviews", action: "Moderate", description: "Moderate or approve user reviews" },
  { slug: PERMISSIONS.REVIEWS_DELETE, module: "Reviews", action: "Delete", description: "Delete or hide inappropriate reviews" },

  // Audit Logs Module
  { slug: PERMISSIONS.ACTIVITY_LOGS_VIEW, module: "Audit Logs", action: "View", description: "View platform audit and activity logs" },
  { slug: PERMISSIONS.ACTIVITY_LOGS_EXPORT, module: "Audit Logs", action: "Export", description: "Export audit log records" },

  // Reports Module
  { slug: PERMISSIONS.REPORTS_VIEW, module: "Reports", action: "View Reports", description: "View system analytics and financial reports" },
  { slug: PERMISSIONS.REPORTS_EXPORT, module: "Reports", action: "Export Reports", description: "Export reports data" },

  // Admin Management Module
  { slug: PERMISSIONS.ADMINS_VIEW, module: "Admin Management", action: "View Admins", description: "View administrator accounts list" },
  { slug: PERMISSIONS.ADMINS_CREATE, module: "Admin Management", action: "Create Admins", description: "Create new administrator accounts" },
  { slug: PERMISSIONS.ADMINS_EDIT, module: "Admin Management", action: "Edit Admins", description: "Edit administrator details and assign roles" },
  { slug: PERMISSIONS.ADMINS_ACTIVATE, module: "Admin Management", action: "Activate/Deactivate", description: "Activate or suspend administrator accounts" },
  { slug: PERMISSIONS.ADMINS_MANAGE_PERMISSIONS, module: "Admin Management", action: "Manage Admin Permissions", description: "Manage individual admin permission overrides" },
];

/** Helper function to calculate whether user is Super Admin */
export function isSuperAdmin(user: { role?: string; adminRoleSlug?: string | null } | null | undefined): boolean {
  if (!user) return false;
  if (user.role !== "ADMIN") return false;
  if (user.adminRoleSlug === "super_admin" || user.adminRoleSlug === "super-admin") {
    return true;
  }
  return false;
}

export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  // Hosts
  [PERMISSIONS.HOSTS_CREATE]: [PERMISSIONS.HOSTS_VIEW],
  [PERMISSIONS.HOSTS_EDIT]: [PERMISSIONS.HOSTS_VIEW],
  [PERMISSIONS.HOSTS_VERIFY]: [PERMISSIONS.HOSTS_VIEW],
  [PERMISSIONS.HOSTS_SUSPEND]: [PERMISSIONS.HOSTS_VIEW],
  [PERMISSIONS.HOSTS_DELETE]: [PERMISSIONS.HOSTS_VIEW],
  [PERMISSIONS.HOSTS_ACTIVITY]: [PERMISSIONS.HOSTS_VIEW],
  [PERMISSIONS.HOSTS_MANAGE_PERMISSIONS]: [PERMISSIONS.HOSTS_VIEW],

  // Host Registrations
  [PERMISSIONS.HOST_REGISTRATION_REVIEW]: [PERMISSIONS.HOST_REGISTRATION_VIEW],
  [PERMISSIONS.HOST_REGISTRATION_ASSIGN]: [PERMISSIONS.HOST_REGISTRATION_VIEW],
  [PERMISSIONS.HOST_REGISTRATION_EDIT]: [PERMISSIONS.HOST_REGISTRATION_VIEW],
  [PERMISSIONS.HOST_REGISTRATION_VERIFY_DOCUMENTS]: [PERMISSIONS.HOST_REGISTRATION_VIEW_DOCUMENTS, PERMISSIONS.HOST_REGISTRATION_VIEW],
  [PERMISSIONS.HOST_REGISTRATION_REJECT_DOCUMENTS]: [PERMISSIONS.HOST_REGISTRATION_VIEW_DOCUMENTS, PERMISSIONS.HOST_REGISTRATION_VIEW],
  [PERMISSIONS.HOST_REGISTRATION_REQUEST_RESUBMISSION]: [PERMISSIONS.HOST_REGISTRATION_VIEW_DOCUMENTS],
  [PERMISSIONS.HOST_REGISTRATION_MANAGE_COMPLIANCE]: [PERMISSIONS.HOST_REGISTRATION_VIEW_COMPLIANCE],
  [PERMISSIONS.HOST_REGISTRATION_APPROVE]: [PERMISSIONS.HOST_REGISTRATION_VIEW],
  [PERMISSIONS.HOST_REGISTRATION_REJECT]: [PERMISSIONS.HOST_REGISTRATION_VIEW],
  [PERMISSIONS.HOST_REGISTRATION_REOPEN]: [PERMISSIONS.HOST_REGISTRATION_VIEW],


  // Guests
  [PERMISSIONS.GUESTS_CREATE]: [PERMISSIONS.GUESTS_VIEW],
  [PERMISSIONS.GUESTS_EDIT]: [PERMISSIONS.GUESTS_VIEW],
  [PERMISSIONS.GUESTS_SUSPEND]: [PERMISSIONS.GUESTS_VIEW],
  [PERMISSIONS.GUESTS_DELETE]: [PERMISSIONS.GUESTS_VIEW],
  [PERMISSIONS.GUESTS_ACTIVITY]: [PERMISSIONS.GUESTS_VIEW],

  // Listings
  [PERMISSIONS.LISTINGS_CREATE]: [PERMISSIONS.LISTINGS_VIEW],
  [PERMISSIONS.LISTINGS_EDIT]: [PERMISSIONS.LISTINGS_VIEW],
  [PERMISSIONS.LISTINGS_APPROVE]: [PERMISSIONS.LISTINGS_VIEW],
  [PERMISSIONS.LISTINGS_SUSPEND]: [PERMISSIONS.LISTINGS_VIEW],
  [PERMISSIONS.LISTINGS_DELETE]: [PERMISSIONS.LISTINGS_VIEW],

  // Bookings
  [PERMISSIONS.BOOKINGS_MANAGE]: [PERMISSIONS.BOOKINGS_VIEW],
  [PERMISSIONS.BOOKINGS_CANCEL]: [PERMISSIONS.BOOKINGS_VIEW],

  // Payments
  [PERMISSIONS.PAYMENTS_MANAGE]: [PERMISSIONS.PAYMENTS_VIEW],
  [PERMISSIONS.PAYMENTS_REFUND]: [PERMISSIONS.PAYMENTS_VIEW],
  [PERMISSIONS.PAYOUTS_MANAGE]: [PERMISSIONS.PAYOUTS_VIEW],

  // Reviews
  [PERMISSIONS.REVIEWS_MODERATE]: [PERMISSIONS.REVIEWS_VIEW],
  [PERMISSIONS.REVIEWS_DELETE]: [PERMISSIONS.REVIEWS_VIEW],

  // Admin Management
  [PERMISSIONS.ADMINS_CREATE]: [PERMISSIONS.ADMINS_VIEW],
  [PERMISSIONS.ADMINS_EDIT]: [PERMISSIONS.ADMINS_VIEW],
  [PERMISSIONS.ADMINS_ACTIVATE]: [PERMISSIONS.ADMINS_VIEW],
  [PERMISSIONS.ADMINS_MANAGE_PERMISSIONS]: [PERMISSIONS.ADMINS_VIEW],

  // Roles
  [PERMISSIONS.ROLES_CREATE]: [PERMISSIONS.ROLES_VIEW],
  [PERMISSIONS.ROLES_EDIT]: [PERMISSIONS.ROLES_VIEW],
  [PERMISSIONS.ROLES_DELETE]: [PERMISSIONS.ROLES_VIEW],
};

/** Get any parent permissions required by the specified permission slug */
export function getRequiredDependencies(permissionSlug: string): string[] {
  return PERMISSION_DEPENDENCIES[permissionSlug] || [];
}

/** Check whether user has specific permission. Super Admin has ALL permissions automatically. */
export function hasPermission(user: AuthUser | null | undefined, permission: PermissionSlug | string): boolean {
  if (!user) return false;
  // Super Admin / default Admin has fixed full access
  if (isSuperAdmin(user)) return true;

  // Check explicit wildcard or permission slug
  if (user.permissions?.includes("*") || user.permissions?.includes(permission)) {
    return true;
  }

  // Admin role fallback if no explicit permission overrides exist
  if (user.role === "ADMIN" && (!user.permissions || user.permissions.length === 0)) {
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
