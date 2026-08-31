import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";

// GET /api/v1/admin/hosts/[id]
export const GET = apiHandler(async (req, { params }) => {
  await requireApiPermission(req, [
    PERMISSIONS.HOSTS_VIEW,
    PERMISSIONS.HOST_REGISTRATION_VIEW,
    PERMISSIONS.HOST_COMPLIANCE_VIEW,
    PERMISSIONS.HOST_ONBOARDING_VIEW,
  ]);
  const { id } = await params;
  const data = await adminService.getHostDetails(id);
  return ok(data);
});

// PATCH /api/v1/admin/hosts/[id]
export const PATCH = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.HOSTS_EDIT,
    PERMISSIONS.HOSTS_VERIFY,
    PERMISSIONS.HOST_REGISTRATION_EDIT,
    PERMISSIONS.HOST_REGISTRATION_REVIEW,
    PERMISSIONS.HOST_REGISTRATION_VERIFY_DOCUMENTS,
    PERMISSIONS.HOST_REGISTRATION_MANAGE_COMPLIANCE,
    PERMISSIONS.HOST_COMPLIANCE_MANAGE,
    PERMISSIONS.HOST_REGISTRATION_APPROVE,
    PERMISSIONS.HOST_REGISTRATION_REJECT,
  ]);
  const { id } = await params;
  const body = await req.json();

  if (body.action === "APPROVE_APPLICATION") {
    const result = await adminService.approveHostApplication(id, actor);
    return ok(result);
  }

  if (body.action === "REJECT_APPLICATION") {
    const result = await adminService.rejectHostApplication(id, body.reason, actor);
    return ok(result);
  }

  if (body.action === "REQUEST_ACTION") {
    const result = await adminService.requestHostAction(id, body.notes, actor);
    return ok(result);
  }

  if (body.action === "VERIFY_DOCUMENT") {
    const result = await adminService.updateDocumentStatus(body.documentId, body.status, body.reason, actor);
    return ok(result);
  }

  if (body.action === "UPDATE_COMPLIANCE_CHECK") {
    const result = await adminService.updateComplianceCheck(id, body.checkId, body.status, body.notes, actor);
    return ok(result);
  }

  if (body.action === "CREATE_COMPLIANCE_ISSUE") {
    const result = await adminService.createComplianceIssue(id, body.issueType, body.description, body.severity, actor);
    return ok(result);
  }

  if (body.action === "RESOLVE_COMPLIANCE_ISSUE") {
    const result = await adminService.resolveComplianceIssue(id, body.issueId, body.status, body.resolutionNotes, actor);
    return ok(result);
  }

  if (body.action === "UPDATE_COMPLIANCE_STATUS") {
    const result = await adminService.updateComplianceStatus(id, body.status, body.notes, actor);
    return ok(result);
  }

  if (body.action === "REQUEST_INFO") {
    const result = await adminService.requestInfo(id, body.informationRequired, body.reason, body.deadline, actor);
    return ok(result);
  }

  if (body.action === "SUSPEND") {
    const result = await adminService.toggleHostSuspension(id, true, body.reason, actor);
    return ok(result);
  }

  if (body.action === "UNSUSPEND") {
    const result = await adminService.toggleHostSuspension(id, false, undefined, actor);
    return ok(result);
  }

  if (body.action === "UPDATE_PROFILE") {
    const result = await adminService.updateHostProfile(id, body.data, actor);
    return ok(result);
  }

  const updated = await adminService.updateHostProfile(id, body, actor);
  return ok(updated);
});

// DELETE /api/v1/admin/hosts/[id]
export const DELETE = apiHandler(async (req, { params }) => {
  await requireApiPermission(req, [PERMISSIONS.HOSTS_DELETE, PERMISSIONS.HOSTS_EDIT]);
  const { id } = await params;
  const result = await adminService.deleteHost(id);
  return ok(result);
});
