import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { auditService } from "./audit.service";
import type { AuthUser } from "@/lib/auth/types";
import { Role } from "@/generated/prisma/enums";
import { sendHostApplicationSubmittedEmail } from "@/lib/services/email";
import { deleteManagedMediaUrl, readPrivateMedia, savePrivateMedia } from "@/lib/storage/media";

export const REQUIRED_HOST_DOCUMENT_TYPES = [
  "GOVERNMENT_ID",
  "PROOF_OF_ADDRESS",
  "BUSINESS_LICENSE",
  "PROPERTY_DEED",
] as const;

export type HostDocumentType = (typeof REQUIRED_HOST_DOCUMENT_TYPES)[number] | "TAX_CERTIFICATE" | "OTHER";

export interface SaveHostDraftInput {
  applicantName?: string;
  applicantEmail?: string;
  applicantPhone?: string;
  registrationType?: string; // "INDIVIDUAL" | "BUSINESS" | "PROPERTY_MANAGER"
  businessName?: string;
  propertyCount?: number;
  location?: string;
  notes?: string;
}

export interface SubmitHostApplicationInput {
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  registrationType: string;
  businessName?: string;
  propertyCount: number;
  location: string;
  notes?: string;
}


export class HostApplicationService {
  /**
   * Helper: Calculates completion sections out of 6 total standard sections
   */
  private calculateProgress(req: any) {
    let completedSections = 0;
    const totalSections = 6;

    if (req.applicantName && req.applicantName.trim().length > 0) completedSections++;
    if (req.applicantEmail && req.applicantPhone && req.applicantPhone.trim().length > 0) completedSections++;
    if (req.registrationType) completedSections++;
    if (req.location && req.location.trim().length > 0 && req.propertyCount > 0) completedSections++;

    const docs: any[] = (req as any).documents || [];
    const hasGovId = docs.some((d: any) => d.documentType === "GOVERNMENT_ID");
    const hasAddress = docs.some((d: any) => d.documentType === "PROOF_OF_ADDRESS");
    if (hasGovId && hasAddress) completedSections++;

    if (req.status !== "DRAFT" && req.onboardingStage !== "DRAFT") completedSections = 6;

    return {
      completedSections,
      totalSections,
      percent: Math.round((completedSections / totalSections) * 100),
    };
  }

  /**
   * Check existing account & get/create Host Application for authenticated user.
   */
  async getApplicationForUser(user: AuthUser) {
    const userEmail = user.email || "";

    // 1. Check if user is already an active APPROVED host
    if (user.role === Role.HOST) {
      const activeHostReq = await prisma.hostRegistrationRequest.findFirst({
        where: {
          OR: [{ hostId: user.id }, ...(userEmail ? [{ applicantEmail: userEmail }] : [])],
        },
        include: { documents: true, infoRequests: true },
        orderBy: { createdAt: "desc" },
      });

      if (activeHostReq) {
        const progress = this.calculateProgress(activeHostReq);
        return {
          application: activeHostReq,
          progress,
          accountState: "APPROVED_HOST" as const,
          message: "Your host account is approved and active.",
        };
      }
    }

    // 2. Look for existing host registration request for this user by hostId or email
    let req = await prisma.hostRegistrationRequest.findFirst({
      where: {
        OR: [{ hostId: user.id }, ...(userEmail ? [{ applicantEmail: userEmail }] : [])],
      },
      include: {
        documents: { orderBy: { uploadedAt: "desc" } },
        infoRequests: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. If no application exists, create an initial DRAFT application
    if (!req) {
      const yearStr = new Date().getFullYear();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const applicationId = `HOST-${yearStr}-${randomSuffix}`;

      req = await prisma.hostRegistrationRequest.create({
        data: {
          applicationId,
          applicantName: user.name || "",
          applicantEmail: userEmail,
          applicantPhone: (user as any).phone || "",
          registrationType: "INDIVIDUAL",
          propertyCount: 1,
          location: "",
          status: "PENDING",
          onboardingStage: "DRAFT",
          hostId: user.id,
        },
        include: {
          documents: true,
          infoRequests: true,
        },
      });

      await auditService.record({
        actorId: user.id,
        actorEmail: userEmail,
        action: "HOST_REGISTRATION_CREATED",
        resourceType: "HostRegistrationRequest",
        resourceId: req.id,
        description: `Created initial host application draft (${req.applicationId})`,
      });
    } else {
      // Sync hostId, name, or phone if missing in existing draft request
      const updateData: Record<string, any> = {};
      if (!req.hostId) updateData.hostId = user.id;
      if (!req.applicantName && user.name) updateData.applicantName = user.name;
      if (!req.applicantPhone && (user as any).phone) updateData.applicantPhone = (user as any).phone;

      if (Object.keys(updateData).length > 0) {
        req = await prisma.hostRegistrationRequest.update({
          where: { id: req.id },
          data: updateData,
          include: { documents: { orderBy: { uploadedAt: "desc" } }, infoRequests: true },
        });
      }
    }

    const progress = this.calculateProgress(req);

    // Determine account/application state for host UI
    let accountState: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "ACTION_REQUIRED" | "APPROVED" | "REJECTED" = "DRAFT";

    const docs: any[] = (req as any).documents || [];
    const reqInfo: any[] = (req as any).infoRequests || [];

    if (req.status === "APPROVED") {
      accountState = "APPROVED";
    } else if (req.status === "REJECTED") {
      accountState = "REJECTED";
    } else if (
      req.status === "WAITING_FOR_DOCUMENTS" ||
      req.onboardingStage === "ACTION_REQUIRED" ||
      docs.some((d: any) => d.status === "REJECTED" || d.resubmissionRequested) ||
      reqInfo.some((i: any) => i.status === "PENDING")
    ) {
      accountState = "ACTION_REQUIRED";
    } else if (req.status === "IN_REVIEW" || req.status === "DOCUMENTS_UNDER_REVIEW") {
      accountState = "IN_REVIEW";
    } else if (req.status === "PENDING" && req.onboardingStage !== "DRAFT") {
      accountState = "SUBMITTED";
    }

    return {
      application: req,
      progress,
      accountState,
      message:
        accountState === "DRAFT"
          ? "Complete your host application to submit for review."
          : accountState === "SUBMITTED"
          ? "Your application has been submitted and is in queue."
          : accountState === "IN_REVIEW"
          ? "Our administrative team is reviewing your application."
          : accountState === "ACTION_REQUIRED"
          ? "Action required: Please update requested documents or details."
          : accountState === "APPROVED"
          ? "Your application is approved! You are an active Host."
          : `Application rejected: ${req.rejectionReason || "Criteria not met."}`,
    };
  }

  /**
   * Save draft application (Partial validation allowed, keeps in DRAFT state)
   */
  async saveDraft(user: AuthUser, input: SaveHostDraftInput) {
    const { application: req } = await this.getApplicationForUser(user);

    if (req.status === "APPROVED") {
      throw AppError.badRequest("Application is already approved and active.");
    }

    const updated = await prisma.hostRegistrationRequest.update({
      where: { id: req.id },
      data: {
        ...(input.applicantName !== undefined && { applicantName: input.applicantName.trim() }),
        ...(input.applicantEmail !== undefined && { applicantEmail: input.applicantEmail.trim().toLowerCase() }),
        ...(input.applicantPhone !== undefined && { applicantPhone: input.applicantPhone.trim() }),
        ...(input.registrationType !== undefined && { registrationType: input.registrationType }),
        ...(input.businessName !== undefined && { businessName: input.businessName.trim() }),
        ...(input.propertyCount !== undefined && { propertyCount: Number(input.propertyCount) || 1 }),
        ...(input.location !== undefined && { location: input.location.trim() }),
        ...(input.notes !== undefined && { notes: input.notes.trim() }),
        onboardingStage: req.status === "PENDING" && req.onboardingStage === "DRAFT" ? "DRAFT" : req.onboardingStage,
        hostId: user.id,
      },
      include: {
        documents: { orderBy: { uploadedAt: "desc" } },
        infoRequests: true,
      },
    });

    await auditService.record({
      actorId: user.id,
      actorEmail: user.email || "",
      action: "HOST_APPLICATION_DRAFT_SAVED",
      resourceType: "HostRegistrationRequest",
      resourceId: req.id,
      description: `Saved host application draft (${req.applicationId})`,
    });

    return {
      application: updated,
      progress: this.calculateProgress(updated),
    };
  }

  /**
   * Validate and Submit Application for Admin Review
   */
  async submitApplication(user: AuthUser, input: SubmitHostApplicationInput) {
    const { application: req } = await this.getApplicationForUser(user);

    if (req.status === "APPROVED") {
      throw AppError.badRequest("Application is already approved.");
    }
    if (req.status === "IN_REVIEW" || (req.status === "PENDING" && req.onboardingStage !== "DRAFT")) {
      throw AppError.badRequest("Application has already been submitted and is currently in review.");
    }

    // 1. Strict Validation of required fields
    const errors: Record<string, string> = {};

    if (!input.applicantName || !input.applicantName.trim()) {
      errors.applicantName = "Full name is required.";
    }
    if (!input.applicantEmail || !input.applicantEmail.trim() || !input.applicantEmail.includes("@")) {
      errors.applicantEmail = "Valid email address is required.";
    }
    if (!input.applicantPhone || !input.applicantPhone.trim()) {
      errors.applicantPhone = "Phone number is required.";
    }
    if (!input.location || !input.location.trim()) {
      errors.location = "Property/business address or location is required.";
    }
    if (!input.propertyCount || input.propertyCount < 1) {
      errors.propertyCount = "Property count must be at least 1.";
    }

    // 2. Validate required documents present
    const docs: any[] = (req as any).documents || [];
    const hasGovId = docs.some((d: any) => d.documentType === "GOVERNMENT_ID");
    const hasAddress = docs.some((d: any) => d.documentType === "PROOF_OF_ADDRESS");

    if (!hasGovId) {
      errors.governmentId = "Government ID document is required for submission.";
    }
    if (!hasAddress) {
      errors.proofOfAddress = "Proof of Address document is required for submission.";
    }

    if (Object.keys(errors).length > 0) {
      throw AppError.badRequest(`Application validation failed: ${Object.values(errors).join(" ")}`);
    }

    // 3. Update state to Submitted (PENDING status, REGISTRATION_SUBMITTED stage)
    const updated = await prisma.hostRegistrationRequest.update({
      where: { id: req.id },
      data: {
        applicantName: input.applicantName.trim(),
        applicantEmail: input.applicantEmail.trim().toLowerCase(),
        applicantPhone: input.applicantPhone.trim(),
        registrationType: input.registrationType || "INDIVIDUAL",
        businessName: input.businessName ? input.businessName.trim() : null,
        propertyCount: Number(input.propertyCount),
        location: input.location.trim(),
        notes: input.notes ? input.notes.trim() : null,
        status: "PENDING",
        onboardingStage: "REGISTRATION_SUBMITTED",
        complianceStatus: "PENDING",
        hostId: user.id,
      },
      include: {
        documents: { orderBy: { uploadedAt: "desc" } },
        infoRequests: true,
      },
    });

    await auditService.record({
      actorId: user.id,
      actorEmail: user.email || "",
      action: "HOST_APPLICATION_SUBMITTED",
      resourceType: "HostRegistrationRequest",
      resourceId: req.id,
      description: `Host application submitted (${req.applicationId})`,
    });

    // 4. Dispatch Email Notification
    await sendHostApplicationSubmittedEmail({
      to: updated.applicantEmail,
      applicantName: updated.applicantName,
      applicationId: updated.applicationId,
    });

    return {
      application: updated,
      progress: this.calculateProgress(updated),
    };
  }

  /**
   * Secure document upload for host
   */
  async uploadDocument(
    user: AuthUser,
    documentType: string,
    file: { buffer: Buffer; fileName: string; mimeType: string; fileSize: number }
  ) {
    const { application: req } = await this.getApplicationForUser(user);

    if (req.status === "APPROVED") {
      throw AppError.badRequest("Cannot upload documents to an already approved application.");
    }

    // Check file size (max 10MB)
    const maxBytes = 10 * 1024 * 1024;
    if (file.fileSize > maxBytes) {
      throw AppError.badRequest("File size exceeds maximum allowed limit of 10MB.");
    }

    // Check mime type (PDF, JPEG, PNG, WEBP)
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimeType)) {
      throw AppError.badRequest("Invalid file type. Allowed formats: PDF, JPEG, PNG, WEBP.");
    }

    const fileExt = path.extname(file.fileName) || (file.mimeType === "application/pdf" ? ".pdf" : ".jpg");
    const safeBaseName = `${req.applicationId}_${documentType.toLowerCase()}_${Date.now()}${fileExt}`;
    await savePrivateMedia({
      kind: "host-documents",
      fileName: safeBaseName,
      body: file.buffer,
      contentType: file.mimeType,
    });

    const relativeUrl = `/api/v1/host/application/documents/file/${safeBaseName}`;

    // Check if existing document of this type exists for this request
    const existingDoc = await prisma.hostRegistrationDocument.findFirst({
      where: {
        requestId: req.id,
        documentType,
      },
    });

    let doc;
    if (existingDoc) {
      const previousFileUrl = existingDoc.fileUrl;
      doc = await prisma.hostRegistrationDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileName: file.fileName,
          fileUrl: relativeUrl,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          status: "PENDING",
          uploadedAt: new Date(),
          rejectedById: null,
          rejectedAt: null,
          rejectionReason: null,
          resubmissionRequested: false,
          version: existingDoc.version + 1,
        },
      });

      await auditService.record({
        actorId: user.id,
        actorEmail: user.email || "",
        action: "HOST_DOCUMENT_REPLACED",
        resourceType: "HostRegistrationDocument",
        resourceId: doc.id,
        description: `Replaced host document ${documentType} (${file.fileName}) for application ${req.applicationId}`,
      });
      if (previousFileUrl && previousFileUrl !== relativeUrl) {
        await deleteManagedMediaUrl(previousFileUrl);
      }
    } else {
      doc = await prisma.hostRegistrationDocument.create({
        data: {
          requestId: req.id,
          documentType,
          fileName: file.fileName,
          fileUrl: relativeUrl,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          status: "PENDING",
          uploadedAt: new Date(),
        },
      });

      await auditService.record({
        actorId: user.id,
        actorEmail: user.email || "",
        action: "HOST_DOCUMENT_UPLOADED",
        resourceType: "HostRegistrationDocument",
        resourceId: doc.id,
        description: `Uploaded host document ${documentType} (${file.fileName}) for application ${req.applicationId}`,
      });
    }

    return doc;
  }

  /**
   * Remove host document before submission
   */
  async removeDocument(user: AuthUser, documentId: string) {
    const doc = await prisma.hostRegistrationDocument.findUnique({
      where: { id: documentId },
      include: { request: true },
    });

    if (!doc) {
      throw AppError.notFound("Document not found.");
    }

    // Ownership check
    if (doc.request.hostId !== user.id && doc.request.applicantEmail !== user.email && user.role !== Role.ADMIN) {
      throw AppError.forbidden("You do not have permission to remove this document.");
    }

    if (doc.request.status === "APPROVED") {
      throw AppError.badRequest("Cannot remove documents from an approved application.");
    }

    await prisma.hostRegistrationDocument.delete({
      where: { id: documentId },
    });
    await deleteManagedMediaUrl(doc.fileUrl);

    await auditService.record({
      actorId: user.id,
      actorEmail: user.email || "",
      action: "HOST_DOCUMENT_REMOVED",
      resourceType: "HostRegistrationDocument",
      resourceId: documentId,
      description: `Removed host document ${doc.documentType} (${doc.fileName}) for application ${doc.request.applicationId}`,
    });

    return { success: true };
  }

  /**
   * Resubmit host application after action items / rejected document replacement
   */
  async resubmitApplication(user: AuthUser) {
    const { application: req } = await this.getApplicationForUser(user);

    if (req.status === "APPROVED") {
      throw AppError.badRequest("Application is already approved.");
    }

    // Check that there are no unresolved rejected documents
    const docs: any[] = (req as any).documents || [];
    const rejectedDocs = docs.filter((d: any) => d.status === "REJECTED" || d.resubmissionRequested);
    if (rejectedDocs.length > 0) {
      throw AppError.badRequest(
        `Please replace all rejected documents (${rejectedDocs.map((d: any) => d.documentType).join(", ")}) before resubmitting.`
      );
    }

    const updated = await prisma.hostRegistrationRequest.update({
      where: { id: req.id },
      data: {
        status: "DOCUMENTS_UNDER_REVIEW",
        onboardingStage: "DOCUMENT_VERIFICATION",
        complianceStatus: "UNDER_REVIEW",
        updatedAt: new Date(),
      },
    });

    await auditService.record({
      actorId: user.id,
      actorEmail: user.email || "",
      action: "HOST_APPLICATION_RESUBMITTED",
      resourceType: "HostRegistrationRequest",
      resourceId: req.id,
      description: `Resubmitted host application ${req.applicationId} after updates.`,
    });

    return updated;
  }

  /**
   * Secure document file preview / download (checks ownership)
   */
  async getSecureDocumentFile(user: AuthUser, fileName: string) {
    const safeBaseName = path.basename(fileName);

    // Ownership check via DB
    const doc = await prisma.hostRegistrationDocument.findFirst({
      where: {
        fileUrl: { contains: safeBaseName },
      },
      include: { request: true },
    });

    if (doc) {
      const isOwner = doc.request.hostId === user.id || doc.request.applicantEmail === user.email;
      const isAdmin = user.role === Role.ADMIN;

      if (!isOwner && !isAdmin) {
        throw AppError.forbidden("Access denied: You are not authorized to view this document.");
      }
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readPrivateMedia("host-documents", safeBaseName);
    } catch {
      throw AppError.notFound("Requested document file not found.");
    }

    const ext = path.extname(safeBaseName).toLowerCase();
    let mimeType = "application/octet-stream";
    if (ext === ".pdf") mimeType = "application/pdf";
    else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".png") mimeType = "image/png";
    else if (ext === ".webp") mimeType = "image/webp";

    return { fileBuffer, mimeType, fileName: safeBaseName };
  }

  /**
   * Instantly convert user role to HOST and approve host application.
   */
  async convertToHost(user: AuthUser) {
    // 1. Upgrade user role in DB
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: Role.HOST,
        status: "ACTIVE",
      },
    });

    // 2. Find or create host registration request and mark APPROVED
    let req = await prisma.hostRegistrationRequest.findFirst({
      where: {
        OR: [{ hostId: user.id }, ...(user.email ? [{ applicantEmail: user.email }] : [])],
      },
    });

    if (req) {
      await prisma.hostRegistrationRequest.update({
        where: { id: req.id },
        data: {
          status: "APPROVED",
          onboardingStage: "COMPLETED",
          complianceStatus: "COMPLIANT",
          hostId: user.id,
          approvedAt: new Date(),
        },
      });
    } else {
      const yearStr = new Date().getFullYear();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const applicationId = `HOST-${yearStr}-${randomSuffix}`;

      await prisma.hostRegistrationRequest.create({
        data: {
          applicationId,
          applicantName: user.name || user.email || "Host User",
          applicantEmail: user.email || "",
          applicantPhone: (user as any).phone || "",
          registrationType: "INDIVIDUAL",
          propertyCount: 1,
          location: "Global",
          status: "APPROVED",
          onboardingStage: "COMPLETED",
          complianceStatus: "COMPLIANT",
          hostId: user.id,
          approvedAt: new Date(),
        },
      });
    }

    await auditService.record({
      actorId: user.id,
      actorEmail: user.email || "",
      action: "USER_CONVERTED_TO_HOST",
      resourceType: "User",
      resourceId: user.id,
      description: `User ${user.email} converted account to HOST role`,
    });

    return {
      success: true,
      user: updatedUser,
      message: "Congratulations! Your account has been converted to a Host account.",
    };
  }
}

export const hostApplicationService = new HostApplicationService();
