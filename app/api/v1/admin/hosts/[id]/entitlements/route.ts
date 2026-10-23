import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostEntitlementService } from "@/services/host-entitlement.service";
import { NextRequest } from "next/server";

// GET /api/v1/admin/hosts/[id]/entitlements
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  await requireApiPermission(req, [
    PERMISSIONS.HOSTS_VIEW,
    PERMISSIONS.HOSTS_MANAGE_PERMISSIONS,
  ]);
  const { id } = await params;
  const data = await hostEntitlementService.getHostEntitlementSummary(id);
  return ok(data);
});

// POST /api/v1/admin/hosts/[id]/entitlements (Grant complimentary Plus)
export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const admin = await requireApiPermission(req, [
    PERMISSIONS.HOSTS_MANAGE_PERMISSIONS,
    PERMISSIONS.HOSTS_EDIT,
  ]);
  const { id } = await params;
  const body = await req.json();

  const startsAt = body.startsAt ? new Date(body.startsAt) : undefined;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const result = await hostEntitlementService.grantComplimentaryPlus({
    hostId: id,
    adminId: admin.id,
    adminEmail: admin.email,
    startsAt,
    expiresAt,
    reason: body.reason,
    notes: body.notes,
    ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    userAgent: req.headers.get("user-agent"),
  });

  return ok(result);
});

// DELETE /api/v1/admin/hosts/[id]/entitlements (Revoke complimentary Plus)
export const DELETE = apiHandler(async (req: NextRequest, { params }) => {
  const admin = await requireApiPermission(req, [
    PERMISSIONS.HOSTS_MANAGE_PERMISSIONS,
    PERMISSIONS.HOSTS_EDIT,
  ]);
  const { id } = await params;
  let reason: string | undefined;
  try {
    const body = await req.json();
    reason = body?.reason;
  } catch {
    // Optional body
  }

  const result = await hostEntitlementService.revokeComplimentaryPlus({
    hostId: id,
    adminId: admin.id,
    adminEmail: admin.email,
    reason,
    ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    userAgent: req.headers.get("user-agent"),
  });

  return ok(result);
});

// PATCH /api/v1/admin/hosts/[id]/entitlements (Update expiration or switch to standard only)
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  const admin = await requireApiPermission(req, [
    PERMISSIONS.HOSTS_MANAGE_PERMISSIONS,
    PERMISSIONS.HOSTS_EDIT,
  ]);
  const { id } = await params;
  const body = await req.json();

  if (body.action === "STANDARD_ONLY") {
    const result = await hostEntitlementService.setStandardOnly({
      hostId: id,
      adminId: admin.id,
      adminEmail: admin.email,
      reason: body.reason,
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      userAgent: req.headers.get("user-agent"),
    });
    return ok(result);
  }

  // Otherwise update expiration date
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const result = await hostEntitlementService.updateGrantExpiration({
    hostId: id,
    adminId: admin.id,
    adminEmail: admin.email,
    expiresAt,
    reason: body.reason,
    notes: body.notes,
    ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    userAgent: req.headers.get("user-agent"),
  });

  return ok(result);
});

