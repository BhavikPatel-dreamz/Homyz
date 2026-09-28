import path from "node:path";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { readPrivateMedia } from "@/lib/storage/media";
import { Role } from "@/generated/prisma/enums";
import { adminService } from "@/services/admin.service";
import type { AuthUser } from "@/lib/auth/types";

function canViewIdentityDocument(actor: AuthUser, targetRole: Role): boolean {
  const permissions =
    targetRole === Role.HOST
      ? [PERMISSIONS.HOSTS_VIEW, PERMISSIONS.HOST_REGISTRATION_VIEW_DOCUMENTS]
      : [PERMISSIONS.GUESTS_VIEW, PERMISSIONS.USERS_VIEW];
  return permissions.some((permission) => hasPermission(actor, permission));
}

function canReviewIdentityDocument(actor: AuthUser, targetRole: Role): boolean {
  const permissions =
    targetRole === Role.HOST
      ? [PERMISSIONS.HOSTS_VERIFY, PERMISSIONS.HOST_REGISTRATION_VERIFY_DOCUMENTS]
      : [PERMISSIONS.GUESTS_EDIT, PERMISSIONS.USERS_EDIT];
  return permissions.some((permission) => hasPermission(actor, permission));
}

function contentTypeFor(fileName: string): string {
  switch (path.extname(fileName).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export const GET = apiHandler(async (req, context) => {
  const actor = await requireApiRole(req, [Role.ADMIN]);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const record = await adminService.getPersonalIdentityDocument(id);

  if (!canViewIdentityDocument(actor, record.user.role)) {
    throw AppError.forbidden("You do not have permission to view this identity document");
  }

  const body = await readPrivateMedia("host-documents", record.storagePath);
  const downloadName = encodeURIComponent(record.document.fileName);

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentTypeFor(record.storagePath),
      "Content-Disposition": `inline; filename*=UTF-8''${downloadName}`,
      "Cache-Control": "private, max-age=0, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const PATCH = apiHandler(async (req, context) => {
  const actor = await requireApiRole(req, [Role.ADMIN]);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const record = await adminService.getPersonalIdentityDocument(id);

  if (!canReviewIdentityDocument(actor, record.user.role)) {
    throw AppError.forbidden("You do not have permission to review this identity document");
  }

  const body = (await req.json()) as { status?: unknown; rejectionReason?: unknown };
  if (body.status !== "VERIFIED" && body.status !== "REJECTED") {
    throw AppError.badRequest("Status must be VERIFIED or REJECTED");
  }
  const rejectionReason =
    typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : undefined;
  if (body.status === "REJECTED" && !rejectionReason) {
    throw AppError.badRequest("A rejection reason is required");
  }
  if (rejectionReason && rejectionReason.length > 500) {
    throw AppError.badRequest("Rejection reason must be 500 characters or fewer");
  }

  const personalInfo = await adminService.reviewPersonalIdentityDocument(
    actor,
    id,
    body.status,
    rejectionReason,
  );
  return ok(personalInfo);
});
