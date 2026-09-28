"use server";

import path from "node:path";
import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { personalInfoService } from "@/services/personal-info.service";
import { savePrivateMedia } from "@/lib/storage/media";
import {
  addressSchema,
  emergencyContactSchema,
  legalNameSchema,
  postalAddressSchema,
  preferredNameSchema,
  updateEmailSchema,
  updatePhoneSchema,
  type AddressInput,
  type EmergencyContactInput,
  type LegalNameInput,
  type PostalAddressInput,
  type PreferredNameInput,
  type UpdateEmailInput,
  type UpdatePhoneInput,
} from "@/lib/validation/personal-info";

const IDENTITY_DOCUMENT_TYPES = ["passport", "license", "national_id"] as const;
type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

function isIdentityDocumentType(value: string): value is IdentityDocumentType {
  return IDENTITY_DOCUMENT_TYPES.some((type) => type === value);
}

export async function getPersonalInfoAction() {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required to access personal information");
    return personalInfoService.getPersonalInfo(actor.id);
  });
}

export async function updateLegalNameAction(input: LegalNameInput) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    const parsed = legalNameSchema.parse(input);
    const updated = await personalInfoService.updateLegalName(actor.id, parsed);
    revalidatePath("/account-settings/personal-info");
    revalidatePath("/profile");
    return updated;
  });
}

export async function updatePreferredNameAction(input: PreferredNameInput) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    const parsed = preferredNameSchema.parse(input);
    const updated = await personalInfoService.updatePreferredFirstName(actor.id, parsed);
    revalidatePath("/account-settings/personal-info");
    return updated;
  });
}

export async function updateEmailAction(input: UpdateEmailInput) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    const parsed = updateEmailSchema.parse(input);
    const updated = await personalInfoService.updateEmail(actor.id, parsed);
    revalidatePath("/account-settings/personal-info");
    return updated;
  });
}

export async function updatePhoneAction(input: UpdatePhoneInput) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    const parsed = updatePhoneSchema.parse(input);
    const updated = await personalInfoService.updatePhone(actor.id, parsed);
    revalidatePath("/account-settings/personal-info");
    return updated;
  });
}

export async function updateResidentialAddressAction(input: AddressInput) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    const parsed = addressSchema.parse(input);
    const updated = await personalInfoService.updateResidentialAddress(actor.id, parsed);
    revalidatePath("/account-settings/personal-info");
    return updated;
  });
}

export async function updatePostalAddressAction(input: PostalAddressInput) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    const parsed = postalAddressSchema.parse(input);
    const updated = await personalInfoService.updatePostalAddress(actor.id, parsed);
    revalidatePath("/account-settings/personal-info");
    return updated;
  });
}

export async function updateEmergencyContactAction(input: EmergencyContactInput) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    const parsed = emergencyContactSchema.parse(input);
    const updated = await personalInfoService.updateEmergencyContact(actor.id, parsed);
    revalidatePath("/account-settings/personal-info");
    return updated;
  });
}

export async function uploadIdentityDocumentAction(formData: FormData) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");

    const file = formData.get("file") as File | null;
    const documentType = (formData.get("documentType") as string | null) || "passport";

    if (!file || typeof file === "string") {
      throw AppError.badRequest("Please select a document file to upload.");
    }

    if (!isIdentityDocumentType(documentType)) {
      throw AppError.badRequest("Invalid document type selected.");
    }

    const allowedMimes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);

    if (!allowedMimes.has(file.type)) {
      throw AppError.badRequest("Only JPEG, PNG, WebP, and PDF documents are supported.");
    }

    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size <= 0 || file.size > MAX_SIZE) {
      throw AppError.badRequest("Document file must be between 1 byte and 15 MB.");
    }

    const uploadedExtension = path.extname(file.name).toLowerCase();
    const extensionByMimeType: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "application/pdf": ".pdf",
    };
    const cleanExt = extensionByMimeType[file.type] || uploadedExtension || ".jpg";
    const safeBaseName = `id_${actor.id}_${documentType}_${Date.now()}${cleanExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const saved = await savePrivateMedia({
      kind: "host-documents",
      fileName: safeBaseName,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });

    const updated = await personalInfoService.uploadIdentityDocument(actor.id, {
      documentType,
      fileName: file.name,
      fileUrl: `/api/v1/users/personal-info/identity-document/file/${saved.storagePath}`,
    });

    revalidatePath("/account-settings/personal-info");
    revalidatePath("/profile");
    return updated;
  });
}
