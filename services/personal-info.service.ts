import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { invalidateUserCache } from "@/lib/redis/invalidation";
import {
  type AddressInput,
  type EmergencyContactInput,
  type LegalNameInput,
  type PostalAddressInput,
  type PreferredNameInput,
  type UpdateEmailInput,
  type UpdatePhoneInput,
} from "@/lib/validation/personal-info";
import type { Prisma } from "@/generated/prisma/client";

export type IdentityStatus = "NOT_STARTED" | "PENDING" | "VERIFIED" | "REJECTED";

export interface AddressData {
  street: string;
  apt: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  formatted?: string;
}

export interface EmergencyContactData {
  name: string;
  relationship: string;
  countryCode: string;
  phoneNumber: string;
  email?: string;
  preferredLanguage?: string;
}

export interface IdentityDocumentData {
  documentType: "passport" | "license" | "national_id";
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface PersonalInfoDTO {
  legalFirstName: string;
  legalLastName: string;
  legalName: string;
  preferredFirstName: string;
  email: string;
  phone: string;
  identityStatus: IdentityStatus;
  identityDocument?: IdentityDocumentData | null;
  residentialAddress: AddressData | null;
  postalAddress: AddressData | null;
  sameAsResidential: boolean;
  emergencyContact: EmergencyContactData | null;
}

interface StoredPersonalInfo {
  legalFirstName?: string;
  legalLastName?: string;
  preferredFirstName?: string;
  identityStatus?: IdentityStatus;
  identityDocument?: IdentityDocumentData;
  residentialAddress?: AddressData;
  postalAddress?: AddressData;
  sameAsResidential?: boolean;
  emergencyContact?: EmergencyContactData;
}

function parseStoredPersonalInfo(raw: unknown): StoredPersonalInfo {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as StoredPersonalInfo;
}

export class PersonalInfoService {
  /**
   * Fetch personal information for the given user.
   * Strictly authorized to the user themselves.
   */
  async getPersonalInfo(userId: string): Promise<PersonalInfoDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        personalInfo: true,
      },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const info = parseStoredPersonalInfo(user.personalInfo);

    let legalFirstName = info.legalFirstName || "";
    let legalLastName = info.legalLastName || "";

    // Fallback: if not explicitly configured in personalInfo, derive from user.name
    if (!legalFirstName && !legalLastName && user.name) {
      const parts = user.name.trim().split(" ");
      legalFirstName = parts[0] || "";
      legalLastName = parts.slice(1).join(" ") || "";
    }

    const legalName =
      legalFirstName || legalLastName
        ? `${legalFirstName} ${legalLastName}`.trim()
        : user.name || "Not provided";

    return {
      legalFirstName,
      legalLastName,
      legalName,
      preferredFirstName: info.preferredFirstName || "",
      email: user.email || "",
      phone: user.phone || "",
      identityStatus: info.identityStatus || "NOT_STARTED",
      identityDocument: info.identityDocument || null,
      residentialAddress: info.residentialAddress || null,
      postalAddress: info.postalAddress || null,
      sameAsResidential: info.sameAsResidential ?? false,
      emergencyContact: info.emergencyContact || null,
    };
  }

  /**
   * Update legal name (first and last name)
   */
  async updateLegalName(userId: string, input: LegalNameInput): Promise<PersonalInfoDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalInfo: true },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const existingInfo = parseStoredPersonalInfo(user.personalInfo);
    const updatedInfo: StoredPersonalInfo = {
      ...existingInfo,
      legalFirstName: input.firstName.trim(),
      legalLastName: input.lastName.trim(),
    };

    const combinedName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: combinedName,
        personalInfo: updatedInfo as unknown as Prisma.InputJsonValue,
      },
    });

    await invalidateUserCache(userId);
    return this.getPersonalInfo(userId);
  }

  /**
   * Update preferred first name
   */
  async updatePreferredFirstName(userId: string, input: PreferredNameInput): Promise<PersonalInfoDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalInfo: true },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const existingInfo = parseStoredPersonalInfo(user.personalInfo);
    const updatedInfo: StoredPersonalInfo = {
      ...existingInfo,
      preferredFirstName: input.preferredFirstName ? input.preferredFirstName.trim() : "",
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        personalInfo: updatedInfo as unknown as Prisma.InputJsonValue,
      },
    });

    await invalidateUserCache(userId);
    return this.getPersonalInfo(userId);
  }

  /**
   * Update email address with conflict checking
   */
  async updateEmail(userId: string, input: UpdateEmailInput): Promise<PersonalInfoDTO> {
    const normalized = input.email.trim().toLowerCase();

    // Check conflict
    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: normalized, mode: "insensitive" },
        NOT: { id: userId },
      },
      select: { id: true },
    });

    if (existing) {
      throw AppError.conflict("This email address is already in use by another account.");
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: normalized,
        emailVerified: null, // Reset verification on new email
      },
    });

    await invalidateUserCache(userId);
    return this.getPersonalInfo(userId);
  }

  /**
   * Update phone number with conflict checking
   */
  async updatePhone(userId: string, input: UpdatePhoneInput): Promise<PersonalInfoDTO> {
    const trimmed = input.phone.trim();

    // Check conflict
    const existing = await prisma.user.findFirst({
      where: {
        phone: trimmed,
        NOT: { id: userId },
      },
      select: { id: true },
    });

    if (existing) {
      throw AppError.conflict("This phone number is already registered to another account.");
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        phone: trimmed,
        phoneVerified: null, // Reset verification on changed phone
      },
    });

    await invalidateUserCache(userId);
    return this.getPersonalInfo(userId);
  }

  /**
   * Update identity verification status
   */
  async updateIdentityStatus(userId: string, status: IdentityStatus): Promise<PersonalInfoDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalInfo: true },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const existingInfo = parseStoredPersonalInfo(user.personalInfo);
    const updatedInfo: StoredPersonalInfo = {
      ...existingInfo,
      identityStatus: status,
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        personalInfo: updatedInfo as unknown as Prisma.InputJsonValue,
      },
    });

    await invalidateUserCache(userId);
    return this.getPersonalInfo(userId);
  }

  /**
   * Upload identity document file and set identity verification to PENDING review.
   * Users cannot self-verify; verification requires administrative approval.
   */
  async uploadIdentityDocument(
    userId: string,
    input: {
      documentType: "passport" | "license" | "national_id";
      fileName: string;
      fileUrl: string;
    },
  ): Promise<PersonalInfoDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalInfo: true },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const existingInfo = parseStoredPersonalInfo(user.personalInfo);
    const updatedInfo: StoredPersonalInfo = {
      ...existingInfo,
      identityStatus: "PENDING",
      identityDocument: {
        documentType: input.documentType,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        uploadedAt: new Date().toISOString(),
      },
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        personalInfo: updatedInfo as unknown as Prisma.InputJsonValue,
      },
    });

    await invalidateUserCache(userId);
    return this.getPersonalInfo(userId);
  }

  /**
   * Update residential address
   */
  async updateResidentialAddress(userId: string, input: AddressInput): Promise<PersonalInfoDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalInfo: true },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const existingInfo = parseStoredPersonalInfo(user.personalInfo);
    const addressData: AddressData = {
      street: input.street?.trim() || "",
      apt: input.apt?.trim() || "",
      city: input.city?.trim() || "",
      state: input.state?.trim() || "",
      postalCode: input.postalCode?.trim() || "",
      country: input.country?.trim() || "",
    };

    const updatedInfo: StoredPersonalInfo = {
      ...existingInfo,
      residentialAddress: addressData,
      // If sameAsResidential was enabled, sync postal address
      ...(existingInfo.sameAsResidential ? { postalAddress: addressData } : {}),
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        personalInfo: updatedInfo as unknown as Prisma.InputJsonValue,
      },
    });

    await invalidateUserCache(userId);
    return this.getPersonalInfo(userId);
  }

  /**
   * Update postal address
   */
  async updatePostalAddress(userId: string, input: PostalAddressInput): Promise<PersonalInfoDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalInfo: true },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const existingInfo = parseStoredPersonalInfo(user.personalInfo);

    let updatedInfo: StoredPersonalInfo;

    if (input.sameAsResidential) {
      const residential = existingInfo.residentialAddress || {
        street: "",
        apt: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
      };
      updatedInfo = {
        ...existingInfo,
        sameAsResidential: true,
        postalAddress: residential,
      };
    } else {
      const addressData: AddressData = {
        street: input.street?.trim() || "",
        apt: input.apt?.trim() || "",
        city: input.city?.trim() || "",
        state: input.state?.trim() || "",
        postalCode: input.postalCode?.trim() || "",
        country: input.country?.trim() || "",
      };
      updatedInfo = {
        ...existingInfo,
        sameAsResidential: false,
        postalAddress: addressData,
      };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        personalInfo: updatedInfo as unknown as Prisma.InputJsonValue,
      },
    });

    await invalidateUserCache(userId);
    return this.getPersonalInfo(userId);
  }

  /**
   * Update emergency contact
   */
  async updateEmergencyContact(userId: string, input: EmergencyContactInput): Promise<PersonalInfoDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { personalInfo: true },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const existingInfo = parseStoredPersonalInfo(user.personalInfo);
    const contactData: EmergencyContactData = {
      name: input.name.trim(),
      relationship: input.relationship.trim(),
      countryCode: input.countryCode?.trim() || "",
      phoneNumber: input.phoneNumber.trim(),
      email: input.email?.trim() || undefined,
      preferredLanguage: input.preferredLanguage?.trim() || undefined,
    };

    const updatedInfo: StoredPersonalInfo = {
      ...existingInfo,
      emergencyContact: contactData,
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        personalInfo: updatedInfo as unknown as Prisma.InputJsonValue,
      },
    });

    await invalidateUserCache(userId);
    return this.getPersonalInfo(userId);
  }
}

export const personalInfoService = new PersonalInfoService();

