import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import {
  Role,
  TaxpayerType,
  TaxpayerVerificationStatus,
  HostTaxDocumentType,
  TaxRegistrationStatus,
  BookingStatus,
} from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { assertRole } from "@/lib/permissions/authorize";
import { auditService } from "@/services/audit.service";
import {
  encryptAccountIdentifier,
  decryptAccountIdentifier,
} from "@/lib/security/payout-encryption";
import {
  maskTaxIdentifier,
  validateSaudiTaxIdentifier,
  validateSaudiVatNumber,
  type saveTaxpayerProfileSchema,
  type saveVatRegistrationInputSchema,
} from "@/lib/validation/tax";
import { SimplePdfDocument } from "@/lib/export/pdf-generator";
import { taxService } from "@/services/tax.service";
import type { z } from "zod";

// ============================================================================
// Types & DTOs
// ============================================================================

export interface HostTaxpayerProfileDTO {
  id: string;
  hostId: string;
  taxpayerType: "INDIVIDUAL" | "BUSINESS";
  legalName: string;
  businessName?: string | null;
  businessRegistrationNumber?: string | null;
  countryCode: string;
  taxIdentifierType: string;
  maskedTaxIdentifier: string;
  taxIdentifierLast4: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  status: "DRAFT" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HostVatRegistrationDTO {
  id: string;
  hostId: string;
  countryCode: string;
  taxType: string;
  registrationNumberMasked: string;
  rawRegistrationNumber?: string;
  businessName?: string | null;
  businessAddress?: string | null;
  documentUrl?: string | null;
  status: "UNVERIFIED" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HostTaxDocumentDTO {
  id: string;
  hostId: string;
  taxpayerProfileId?: string | null;
  taxRegistrationId?: string | null;
  bookingId?: string | null;
  documentType: "ANNUAL_TAX_SUMMARY" | "BOOKING_TAX_INVOICE" | "VAT_CERTIFICATE" | "TAX_REGISTRATION_RECORD";
  title: string;
  description?: string | null;
  taxYear: number;
  taxPeriod?: string | null;
  fileFormat: string;
  fileSize?: number | null;
  status: string;
  documentVersion: number;
  generatedAt: string;
  downloadUrl: string;
  createdAt: string;
}

// ============================================================================
// Host Tax Service
// ============================================================================

export class HostTaxService {
  /**
   * Asserts actor has ownership of the target host account or holds ADMIN role.
   */
  private assertHostAccess(actor: AuthUser, targetHostId: string) {
    if (actor.role === Role.ADMIN) return;
    if (actor.id !== targetHostId) {
      throw AppError.forbidden("You are not authorized to view or modify tax information for this account.");
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Taxpayer Profile Operations
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves the current taxpayer profile for a host.
   */
  async getHostTaxpayerProfile(
    actor: AuthUser,
    hostId?: string,
  ): Promise<HostTaxpayerProfileDTO | null> {
    const targetHostId = hostId || actor.id;
    this.assertHostAccess(actor, targetHostId);

    const profile = await prisma.hostTaxpayerProfile.findUnique({
      where: { hostId: targetHostId },
    });

    if (!profile) return null;

    return {
      id: profile.id,
      hostId: profile.hostId,
      taxpayerType: profile.taxpayerType as "INDIVIDUAL" | "BUSINESS",
      legalName: profile.legalName,
      businessName: profile.businessName,
      businessRegistrationNumber: profile.businessRegistrationNumber,
      countryCode: profile.countryCode,
      taxIdentifierType: profile.taxIdentifierType,
      maskedTaxIdentifier: profile.maskedTaxIdentifier,
      taxIdentifierLast4: profile.taxIdentifierLast4,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      region: profile.region,
      postalCode: profile.postalCode,
      status: profile.status as any,
      verifiedAt: profile.verifiedAt?.toISOString() || null,
      rejectionReason: profile.rejectionReason,
      notes: profile.notes,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  /**
   * Saves or updates a host's taxpayer profile with AES-256-GCM encryption.
   */
  async saveHostTaxpayerProfile(
    actor: AuthUser,
    input: z.infer<typeof saveTaxpayerProfileSchema>,
    targetHostId?: string,
  ): Promise<HostTaxpayerProfileDTO> {
    const hostId = targetHostId || actor.id;
    this.assertHostAccess(actor, hostId);

    // Clean tax identifier
    const cleanId = input.taxIdentifier.replace(/[\s\-_]/g, "");

    // Additional country-specific verification
    if (input.countryCode === "SA") {
      const saCheck = validateSaudiTaxIdentifier(input.taxIdentifierType as any, cleanId);
      if (!saCheck.valid) {
        throw AppError.badRequest(saCheck.error || "Invalid tax identification number for Saudi Arabia.");
      }
    }

    // Encrypt sensitive tax identifier using AES-256-GCM
    const encryptedTaxIdentifier = encryptAccountIdentifier(cleanId);
    const maskedTaxIdentifier = maskTaxIdentifier(cleanId);
    const taxIdentifierLast4 = cleanId.slice(-4);

    const existing = await prisma.hostTaxpayerProfile.findUnique({
      where: { hostId },
    });

    const now = new Date();

    const profile = await prisma.$transaction(async (tx) => {
      let saved: any;
      if (existing) {
        // If updating an already verified profile, reset to PENDING_VERIFICATION unless admin edited
        const newStatus =
          actor.role === Role.ADMIN && existing.status === "VERIFIED"
            ? existing.status
            : TaxpayerVerificationStatus.PENDING_VERIFICATION;

        saved = await tx.hostTaxpayerProfile.update({
          where: { hostId },
          data: {
            taxpayerType: input.taxpayerType as TaxpayerType,
            legalName: input.legalName.trim(),
            businessName: input.businessName?.trim() || null,
            businessRegistrationNumber: input.businessRegistrationNumber?.trim() || null,
            countryCode: input.countryCode.toUpperCase(),
            taxIdentifierType: input.taxIdentifierType,
            encryptedTaxIdentifier,
            maskedTaxIdentifier,
            taxIdentifierLast4,
            addressLine1: input.addressLine1?.trim() || null,
            addressLine2: input.addressLine2?.trim() || null,
            city: input.city?.trim() || null,
            region: input.region?.trim() || null,
            postalCode: input.postalCode?.trim() || null,
            status: newStatus,
            rejectionReason: null, // Clear past rejection on new update
          },
        });
      } else {
        saved = await tx.hostTaxpayerProfile.create({
          data: {
            hostId,
            taxpayerType: input.taxpayerType as TaxpayerType,
            legalName: input.legalName.trim(),
            businessName: input.businessName?.trim() || null,
            businessRegistrationNumber: input.businessRegistrationNumber?.trim() || null,
            countryCode: input.countryCode.toUpperCase(),
            taxIdentifierType: input.taxIdentifierType,
            encryptedTaxIdentifier,
            maskedTaxIdentifier,
            taxIdentifierLast4,
            addressLine1: input.addressLine1?.trim() || null,
            addressLine2: input.addressLine2?.trim() || null,
            city: input.city?.trim() || null,
            region: input.region?.trim() || null,
            postalCode: input.postalCode?.trim() || null,
            status: TaxpayerVerificationStatus.PENDING_VERIFICATION,
          },
        });
      }

      // Link any existing TaxRegistration for this host to the profile
      await tx.taxRegistration.updateMany({
        where: { hostId, taxpayerProfileId: null },
        data: { taxpayerProfileId: saved.id },
      });

      return saved;
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: existing ? "UPDATE_TAXPAYER_PROFILE" : "CREATE_TAXPAYER_PROFILE",
      resourceType: "TAXPAYER_PROFILE",
      resourceId: profile.id,
      description: `Host taxpayer profile ${existing ? "updated" : "created"} (${profile.taxpayerType}, ${profile.countryCode})`,
      status: "SUCCESS",
      metadata: {
        hostId,
        taxpayerType: profile.taxpayerType,
        countryCode: profile.countryCode,
        taxIdentifierType: profile.taxIdentifierType,
        maskedTaxIdentifier: profile.maskedTaxIdentifier,
      },
    });

    return {
      id: profile.id,
      hostId: profile.hostId,
      taxpayerType: profile.taxpayerType as "INDIVIDUAL" | "BUSINESS",
      legalName: profile.legalName,
      businessName: profile.businessName,
      businessRegistrationNumber: profile.businessRegistrationNumber,
      countryCode: profile.countryCode,
      taxIdentifierType: profile.taxIdentifierType,
      maskedTaxIdentifier: profile.maskedTaxIdentifier,
      taxIdentifierLast4: profile.taxIdentifierLast4,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      region: profile.region,
      postalCode: profile.postalCode,
      status: profile.status as any,
      verifiedAt: profile.verifiedAt?.toISOString() || null,
      rejectionReason: profile.rejectionReason,
      notes: profile.notes,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. VAT / GST Registration Operations
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves active VAT/GST registrations for a host.
   */
  async getHostVatRegistrations(
    actor: AuthUser,
    hostId?: string,
  ): Promise<HostVatRegistrationDTO[]> {
    const targetHostId = hostId || actor.id;
    this.assertHostAccess(actor, targetHostId);

    const registrations = await prisma.taxRegistration.findMany({
      where: {
        hostId: targetHostId,
        taxType: { in: ["VAT_ID", "GST_NUMBER", "VAT"] },
      },
      orderBy: { createdAt: "desc" },
    });

    return registrations.map((r) => ({
      id: r.id,
      hostId: r.hostId,
      countryCode: "SA", // Default to SA or jurisdiction country
      taxType: r.taxType,
      registrationNumberMasked: maskTaxIdentifier(r.registrationNumber),
      businessName: r.businessName,
      businessAddress: r.businessAddress,
      documentUrl: r.documentUrl,
      status: r.status as any,
      verifiedAt: r.verifiedAt?.toISOString() || null,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Saves or updates a host's VAT registration.
   */
  async saveHostVatRegistration(
    actor: AuthUser,
    input: z.infer<typeof saveVatRegistrationInputSchema>,
    targetHostId?: string,
  ): Promise<HostVatRegistrationDTO | { isVatRegistered: false }> {
    const hostId = targetHostId || actor.id;
    this.assertHostAccess(actor, hostId);

    if (!input.isVatRegistered) {
      // Mark or clear existing VAT registration
      await prisma.taxRegistration.deleteMany({
        where: {
          hostId,
          taxType: { in: ["VAT_ID", "VAT"] },
        },
      });

      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "DEACTIVATE_VAT_REGISTRATION",
        resourceType: "TAX_REGISTRATION",
        resourceId: hostId,
        description: "Host indicated they are not VAT registered.",
        status: "SUCCESS",
        metadata: { hostId },
      });

      return { isVatRegistered: false };
    }

    const rawVat = input.vatNumber?.trim() || "";
    const cleanVat = rawVat.replace(/[\s\-_]/g, "");

    // Validate Saudi ZATCA 15-digit VAT number
    if (input.countryCode === "SA") {
      const saVatCheck = validateSaudiVatNumber(cleanVat);
      if (!saVatCheck.valid) {
        throw AppError.badRequest(saVatCheck.error || "Invalid Saudi ZATCA 15-digit VAT registration number.");
      }
    }

    // Duplicate check: Prevent duplicate registration across hosts
    const duplicate = await prisma.taxRegistration.findFirst({
      where: {
        registrationNumber: cleanVat,
        hostId: { not: hostId },
        status: { in: [TaxRegistrationStatus.VERIFIED, TaxRegistrationStatus.PENDING_VERIFICATION] },
      },
    });

    if (duplicate) {
      throw AppError.conflict("This VAT registration number is already registered to another host account.");
    }

    // Lookup host's taxpayer profile if exists
    const taxpayerProfile = await prisma.hostTaxpayerProfile.findUnique({
      where: { hostId },
      select: { id: true, businessName: true },
    });

    const existingVat = await prisma.taxRegistration.findFirst({
      where: {
        hostId,
        taxType: { in: ["VAT_ID", "VAT"] },
      },
    });

    const reg = existingVat
      ? await prisma.taxRegistration.update({
          where: { id: existingVat.id },
          data: {
            registrationNumber: cleanVat,
            businessName: input.businessName || taxpayerProfile?.businessName || null,
            businessAddress: input.businessAddress || null,
            documentUrl: input.documentUrl || null,
            status: TaxRegistrationStatus.PENDING_VERIFICATION,
            rejectionReason: null,
            taxpayerProfileId: taxpayerProfile?.id || null,
          },
        })
      : await prisma.taxRegistration.create({
          data: {
            hostId,
            taxType: "VAT_ID",
            registrationNumber: cleanVat,
            businessName: input.businessName || taxpayerProfile?.businessName || null,
            businessAddress: input.businessAddress || null,
            documentUrl: input.documentUrl || null,
            status: TaxRegistrationStatus.PENDING_VERIFICATION,
            taxpayerProfileId: taxpayerProfile?.id || null,
          },
        });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: existingVat ? "UPDATE_VAT_REGISTRATION" : "ADD_VAT_REGISTRATION",
      resourceType: "TAX_REGISTRATION",
      resourceId: reg.id,
      description: `VAT registration saved for host ${hostId} (${maskTaxIdentifier(cleanVat)})`,
      status: "SUCCESS",
      metadata: {
        hostId,
        registrationId: reg.id,
        maskedVat: maskTaxIdentifier(cleanVat),
      },
    });

    return {
      id: reg.id,
      hostId: reg.hostId,
      countryCode: input.countryCode,
      taxType: reg.taxType,
      registrationNumberMasked: maskTaxIdentifier(reg.registrationNumber),
      businessName: reg.businessName,
      businessAddress: reg.businessAddress,
      documentUrl: reg.documentUrl,
      status: reg.status as any,
      verifiedAt: reg.verifiedAt?.toISOString() || null,
      rejectionReason: reg.rejectionReason,
      createdAt: reg.createdAt.toISOString(),
      updatedAt: reg.updatedAt.toISOString(),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Tax Documents Repository & Generation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Lists authorized tax documents for a host.
   */
  async getHostTaxDocuments(
    actor: AuthUser,
    options?: {
      taxYear?: number;
      documentType?: string;
      hostId?: string;
    },
  ): Promise<HostTaxDocumentDTO[]> {
    const targetHostId = options?.hostId || actor.id;
    this.assertHostAccess(actor, targetHostId);

    const where: any = { hostId: targetHostId };

    if (options?.taxYear) {
      where.taxYear = options.taxYear;
    }

    if (options?.documentType && options.documentType !== "ALL") {
      where.documentType = options.documentType;
    }

    const documents = await prisma.hostTaxDocument.findMany({
      where,
      orderBy: [{ taxYear: "desc" }, { createdAt: "desc" }],
    });

    return documents.map((d) => ({
      id: d.id,
      hostId: d.hostId,
      taxpayerProfileId: d.taxpayerProfileId,
      taxRegistrationId: d.taxRegistrationId,
      bookingId: d.bookingId,
      documentType: d.documentType as any,
      title: d.title,
      description: d.description,
      taxYear: d.taxYear,
      taxPeriod: d.taxPeriod,
      fileFormat: d.fileFormat,
      fileSize: d.fileSize,
      status: d.status,
      documentVersion: d.documentVersion,
      generatedAt: d.generatedAt.toISOString(),
      downloadUrl: `/api/v1/host/tax-documents/${d.id}/download`,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  /**
   * Generates or retrieves an Annual Tax Summary PDF document.
   */
  async generateAnnualTaxSummary(
    actor: AuthUser,
    taxYear: number,
    hostId?: string,
  ): Promise<{ document: HostTaxDocumentDTO; pdfBuffer: Buffer }> {
    const targetHostId = hostId || actor.id;
    this.assertHostAccess(actor, targetHostId);

    // Fetch taxpayer profile
    const taxpayerProfile = await prisma.hostTaxpayerProfile.findUnique({
      where: { hostId: targetHostId },
    });

    const startOfYear = new Date(Date.UTC(taxYear, 0, 1, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(taxYear, 11, 31, 23, 59, 59));

    // Fetch all confirmed bookings for this host in taxYear
    const bookings = await prisma.booking.findMany({
      where: {
        listing: { hostId: targetHostId },
        status: BookingStatus.CONFIRMED,
        startDate: { gte: startOfYear, lte: endOfYear },
      },
      include: {
        taxes: true,
        listing: { select: { title: true, city: true } },
      },
      orderBy: { startDate: "asc" },
    });

    // Compute aggregated figures
    let totalReservations = bookings.length;
    let totalNights = 0;
    let grossEarningsCents = 0;
    let cleaningFeesCents = 0;
    let platformFeesCents = 0;
    let netPayoutCents = 0;
    let taxesCollectedCents = 0;

    const monthlyBreakdown: Record<number, { revenue: number; platformFee: number; tax: number; reservations: number }> = {};
    for (let m = 0; m < 12; m++) {
      monthlyBreakdown[m] = { revenue: 0, platformFee: 0, tax: 0, reservations: 0 };
    }

    for (const b of bookings) {
      const pb = (b.priceBreakdown as Record<string, any>) || {};
      const payout = pb.payoutBreakdown || {};

      const nights = Math.max(
        1,
        Math.round((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / (1000 * 60 * 60 * 24)),
      );
      totalNights += nights;

      const subtotal = payout.accommodationSubtotal || b.totalPrice || 0;
      const cleanFee = payout.cleaningFee || b.cleaningFee || 0;
      const hostFee = payout.hostServiceFee || 0;
      const net = payout.netHostPayout || (subtotal - hostFee);

      grossEarningsCents += subtotal;
      cleaningFeesCents += cleanFee;
      platformFeesCents += hostFee;
      netPayoutCents += net;

      let bookingTax = 0;
      for (const t of b.taxes) {
        bookingTax += t.taxAmount;
      }
      taxesCollectedCents += bookingTax;

      const month = new Date(b.startDate).getUTCMonth();
      monthlyBreakdown[month].revenue += subtotal + cleanFee;
      monthlyBreakdown[month].platformFee += hostFee;
      monthlyBreakdown[month].tax += bookingTax;
      monthlyBreakdown[month].reservations += 1;
    }

    const hostDisplayName = taxpayerProfile?.legalName || actor.name || "Homyz Host";
    const hostTaxIdDisplay = taxpayerProfile?.maskedTaxIdentifier || "Not Provided";

    // Build PDF Document
    const pdf = new SimplePdfDocument({
      title: `${taxYear} Annual Tax Summary`,
      subtitle: "Consolidated Host Rental Income & Tax Overview",
      periodLabel: `Calendar Year ${taxYear}`,
      hostName: hostDisplayName,
      currency: "SAR",
      generatedAt: new Date().toISOString().slice(0, 10),
      footerNote: "This document is an authoritative accounting summary generated by Homyz. It does not replace official government tax filings.",
    });

    pdf.addHeader();

    // Section 1: Taxpayer Identification
    pdf.addSectionTitle("1. Taxpayer & Legal Entity Information");
    pdf.addSummaryGrid([
      { label: "Taxpayer Legal Name", value: hostDisplayName, isHighlight: true },
      { label: "Entity Type", value: taxpayerProfile?.taxpayerType || "Individual" },
      { label: "Tax Identifier", value: hostTaxIdDisplay },
      { label: "Tax Residence", value: taxpayerProfile?.countryCode || "Saudi Arabia (SA)" },
    ]);

    // Section 2: Annual Financial Performance
    pdf.addSectionTitle("2. Consolidated Earnings & Deductions (SAR)");
    pdf.addSummaryGrid([
      { label: "Completed Bookings", value: totalReservations.toString() },
      { label: "Total Hosted Nights", value: totalNights.toString() },
      { label: "Gross Receipts", value: (grossEarningsCents / 100).toFixed(2), isHighlight: true },
      { label: "Cleaning Fee Income", value: (cleaningFeesCents / 100).toFixed(2) },
    ]);

    pdf.addSummaryGrid([
      { label: "Platform Commission", value: (platformFeesCents / 100).toFixed(2) },
      { label: "Taxes Collected", value: (taxesCollectedCents / 100).toFixed(2) },
      { label: "Net Host Disbursed", value: (netPayoutCents / 100).toFixed(2), isHighlight: true },
      { label: "Currency", value: "SAR" },
    ]);

    // Section 3: Monthly Breakdown Table
    pdf.addSectionTitle("3. Monthly Revenue & Tax Breakdown");
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    const tableRows = monthNames.map((name, idx) => {
      const data = monthlyBreakdown[idx];
      return {
        month: name,
        reservations: data.reservations.toString(),
        gross: (data.revenue / 100).toFixed(2),
        platformFee: (data.platformFee / 100).toFixed(2),
        tax: (data.tax / 100).toFixed(2),
        net: ((data.revenue - data.platformFee) / 100).toFixed(2),
      };
    });

    pdf.addTable(
      [
        { header: "Month", key: "month", width: 100, align: "left" },
        { header: "Stays", key: "reservations", width: 50, align: "center" },
        { header: "Gross SAR", key: "gross", width: 90, align: "right" },
        { header: "Fee SAR", key: "platformFee", width: 85, align: "right" },
        { header: "Tax SAR", key: "tax", width: 85, align: "right" },
        { header: "Net SAR", key: "net", width: 105, align: "right" },
      ],
      tableRows,
    );

    pdf.addNotes([
      "All figures are expressed in Saudi Riyals (SAR) and calculated based on confirmed completed reservations.",
      "Taxes collected reflect municipality fees and VAT recorded per stay under applicable tax rules.",
      "Questions regarding municipal or ZATCA tax filings should be directed to your certified public accountant.",
    ]);

    const pdfBuffer = pdf.buildPdf();

    // Upsert HostTaxDocument record
    const title = `${taxYear} Annual Tax Summary`;
    const storageReference = `tax-documents/${targetHostId}/${taxYear}_Annual_Tax_Summary.pdf`;

    const existingDoc = await prisma.hostTaxDocument.findFirst({
      where: {
        hostId: targetHostId,
        documentType: HostTaxDocumentType.ANNUAL_TAX_SUMMARY,
        taxYear,
      },
    });

    const doc = existingDoc
      ? await prisma.hostTaxDocument.update({
          where: { id: existingDoc.id },
          data: {
            title,
            fileSize: pdfBuffer.length,
            generatedAt: new Date(),
            documentVersion: existingDoc.documentVersion + 1,
            taxpayerProfileId: taxpayerProfile?.id || null,
          },
        })
      : await prisma.hostTaxDocument.create({
          data: {
            hostId: targetHostId,
            taxpayerProfileId: taxpayerProfile?.id || null,
            documentType: HostTaxDocumentType.ANNUAL_TAX_SUMMARY,
            title,
            description: `Annual consolidated tax summary for calendar year ${taxYear}.`,
            taxYear,
            taxPeriod: "ANNUAL",
            fileFormat: "PDF",
            fileSize: pdfBuffer.length,
            storageReference,
            status: "READY",
            generatedAt: new Date(),
          },
        });

    return {
      document: {
        id: doc.id,
        hostId: doc.hostId,
        taxpayerProfileId: doc.taxpayerProfileId,
        taxRegistrationId: doc.taxRegistrationId,
        bookingId: doc.bookingId,
        documentType: doc.documentType as any,
        title: doc.title,
        description: doc.description,
        taxYear: doc.taxYear,
        taxPeriod: doc.taxPeriod,
        fileFormat: doc.fileFormat,
        fileSize: doc.fileSize,
        status: doc.status,
        documentVersion: doc.documentVersion,
        generatedAt: doc.generatedAt.toISOString(),
        downloadUrl: `/api/v1/host/tax-documents/${doc.id}/download`,
        createdAt: doc.createdAt.toISOString(),
      },
      pdfBuffer,
    };
  }

  /**
   * Generates a PDF Tax Invoice for a specific reservation.
   */
  async generateReservationTaxInvoicePdf(
    actor: AuthUser,
    bookingId: string,
  ): Promise<{ buffer: Buffer; invoiceNumber: string; filename: string }> {
    const invoiceData = await taxService.generateTaxInvoice(actor, bookingId);

    const pdf = new SimplePdfDocument({
      title: "TAX INVOICE",
      subtitle: `Invoice Number: ${invoiceData.invoiceNumber}`,
      periodLabel: `Stay: ${invoiceData.stayDates.checkIn} to ${invoiceData.stayDates.checkOut} (${invoiceData.stayDates.nights} nights)`,
      hostName: invoiceData.supplier.name,
      currency: invoiceData.currency,
      generatedAt: invoiceData.issueDate.slice(0, 10),
      footerNote: "Tax Invoice issued pursuant to applicable hospitality and VAT regulations.",
    });

    pdf.addHeader();

    // Supplier & Guest Info Grid
    pdf.addSectionTitle("1. Parties & Property");
    pdf.addSummaryGrid([
      { label: "Supplier / Host", value: invoiceData.supplier.name, isHighlight: true },
      { label: "Supplier Tax ID", value: invoiceData.supplier.taxId || "Not Registered" },
      { label: "Guest Name", value: invoiceData.guest.name },
      { label: "Property", value: invoiceData.property.title },
    ]);

    // Line Items Table
    pdf.addSectionTitle("2. Invoice Line Items");
    const itemRows = invoiceData.lineItems.map((item) => ({
      desc: item.description,
      qty: item.quantity.toString(),
      unitPrice: (item.unitPrice / 100).toFixed(2),
      total: (item.total / 100).toFixed(2),
    }));

    pdf.addTable(
      [
        { header: "Description", key: "desc", width: 260, align: "left" },
        { header: "Qty", key: "qty", width: 50, align: "center" },
        { header: "Unit (SAR)", key: "unitPrice", width: 100, align: "right" },
        { header: "Total (SAR)", key: "total", width: 105, align: "right" },
      ],
      itemRows,
    );

    // Taxes Breakdown Table
    if (invoiceData.taxBreakdown.length > 0) {
      pdf.addSectionTitle("3. Taxes & Applicable Fees Breakdown");
      const taxRows = invoiceData.taxBreakdown.map((t) => ({
        taxName: t.taxName,
        rate: t.rate ? `${t.rate}%` : "Fixed",
        base: (t.taxableBase / 100).toFixed(2),
        amount: (t.taxAmount / 100).toFixed(2),
      }));

      pdf.addTable(
        [
          { header: "Tax / Fee Name", key: "taxName", width: 220, align: "left" },
          { header: "Rate", key: "rate", width: 80, align: "center" },
          { header: "Taxable Base (SAR)", key: "base", width: 105, align: "right" },
          { header: "Tax Amount (SAR)", key: "amount", width: 110, align: "right" },
        ],
        taxRows,
      );
    }

    // Totals Grid
    pdf.addSectionTitle("4. Total Entitlement");
    pdf.addSummaryGrid([
      { label: "Subtotal", value: (invoiceData.subtotal / 100).toFixed(2) },
      { label: "Taxes Total", value: (invoiceData.taxTotal / 100).toFixed(2) },
      { label: "Grand Total", value: (invoiceData.grandTotal / 100).toFixed(2), isHighlight: true },
      { label: "Payment Status", value: "PAID IN FULL" },
    ]);

    const buffer = pdf.buildPdf();
    const filename = `${invoiceData.invoiceNumber}.pdf`;

    // Record in HostTaxDocument repository
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: { select: { hostId: true } } },
    });
    const targetHostId = booking?.listing?.hostId || actor.id;

    const existingDoc = await prisma.hostTaxDocument.findFirst({
      where: { hostId: targetHostId, bookingId },
    });

    if (!existingDoc) {
      await prisma.hostTaxDocument.create({
        data: {
          hostId: targetHostId,
          bookingId,
          documentType: HostTaxDocumentType.BOOKING_TAX_INVOICE,
          title: `Tax Invoice - ${invoiceData.invoiceNumber}`,
          description: `Reservation tax invoice for stay`,
          taxYear: booking?.startDate ? new Date(booking.startDate).getFullYear() : new Date().getFullYear(),
          taxPeriod: booking?.startDate ? new Date(booking.startDate).toISOString().slice(0, 7) : undefined,
          fileFormat: "PDF",
          fileSize: buffer.length,
          storageReference: `tax-invoices/${targetHostId}/${invoiceData.invoiceNumber}.pdf`,
          status: "READY",
        },
      });
    }

    return { buffer, invoiceNumber: invoiceData.invoiceNumber, filename };
  }

  /**
   * Securely downloads an authorized tax document.
   */
  async downloadTaxDocument(
    actor: AuthUser,
    documentId: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const doc = await prisma.hostTaxDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw AppError.notFound(`Tax document ${documentId} not found.`);
    }

    this.assertHostAccess(actor, doc.hostId);

    if (doc.documentType === HostTaxDocumentType.ANNUAL_TAX_SUMMARY) {
      const summary = await this.generateAnnualTaxSummary(actor, doc.taxYear, doc.hostId);
      return {
        buffer: summary.pdfBuffer,
        filename: `${doc.taxYear}_Annual_Tax_Summary_${doc.hostId.slice(-4)}.pdf`,
        contentType: "application/pdf",
      };
    }

    if (doc.documentType === HostTaxDocumentType.BOOKING_TAX_INVOICE && doc.bookingId) {
      const invoice = await this.generateReservationTaxInvoicePdf(actor, doc.bookingId);
      return {
        buffer: invoice.buffer,
        filename: invoice.filename,
        contentType: "application/pdf",
      };
    }

    // Default fallback PDF representation
    const summary = await this.generateAnnualTaxSummary(actor, doc.taxYear, doc.hostId);
    return {
      buffer: summary.pdfBuffer,
      filename: `${doc.title.replace(/[\s\-_]+/g, "_")}.pdf`,
      contentType: "application/pdf",
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Admin Tax Management Operations
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Admin verifies or rejects a host's taxpayer profile.
   */
  async verifyTaxpayerProfile(
    adminActor: AuthUser,
    identifier: string,
    statusOrInput:
      | "VERIFIED"
      | "REJECTED"
      | {
          status: "VERIFIED" | "REJECTED";
          reason?: string;
          rejectionReason?: string;
          notes?: string;
        },
    maybeReason?: string,
  ): Promise<HostTaxpayerProfileDTO> {
    assertRole(adminActor, [Role.ADMIN]);

    const status = typeof statusOrInput === "string" ? statusOrInput : statusOrInput.status;
    const reason =
      typeof statusOrInput === "string"
        ? maybeReason
        : statusOrInput.rejectionReason || statusOrInput.reason;
    const notes = typeof statusOrInput === "object" ? statusOrInput.notes : undefined;

    const profile = await prisma.hostTaxpayerProfile.findFirst({
      where: {
        OR: [{ id: identifier }, { hostId: identifier }],
      },
    });

    if (!profile) {
      throw AppError.notFound(`Taxpayer profile for ${identifier} not found.`);
    }

    if (status === "REJECTED" && !reason?.trim()) {
      throw AppError.badRequest("A rejection reason is mandatory when rejecting taxpayer information.");
    }

    const now = new Date();
    const updated = await prisma.hostTaxpayerProfile.update({
      where: { id: profile.id },
      data: {
        status: status === "VERIFIED" ? TaxpayerVerificationStatus.VERIFIED : TaxpayerVerificationStatus.REJECTED,
        verifiedAt: status === "VERIFIED" ? now : null,
        verifiedById: adminActor.id,
        rejectionReason: status === "REJECTED" ? reason?.trim() : null,
        ...(notes ? { notes } : {}),
      },
    });

    await auditService.record({
      actorId: adminActor.id,
      actorEmail: adminActor.email,
      action: "ADMIN_VERIFY_TAXPAYER_PROFILE",
      resourceType: "TAXPAYER_PROFILE",
      resourceId: profile.id,
      description: `Taxpayer profile for host ${profile.hostId} updated to ${status}.`,
      status: "SUCCESS",
      metadata: {
        hostId: profile.hostId,
        status,
        reason,
      },
    });

    return {
      id: updated.id,
      hostId: updated.hostId,
      taxpayerType: updated.taxpayerType as any,
      legalName: updated.legalName,
      businessName: updated.businessName,
      businessRegistrationNumber: updated.businessRegistrationNumber,
      countryCode: updated.countryCode,
      taxIdentifierType: updated.taxIdentifierType,
      maskedTaxIdentifier: updated.maskedTaxIdentifier,
      taxIdentifierLast4: updated.taxIdentifierLast4,
      addressLine1: updated.addressLine1,
      addressLine2: updated.addressLine2,
      city: updated.city,
      region: updated.region,
      postalCode: updated.postalCode,
      status: updated.status as any,
      verifiedAt: updated.verifiedAt?.toISOString() || null,
      rejectionReason: updated.rejectionReason,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Admin verifies or rejects a host's tax registration.
   */
  async verifyTaxRegistration(
    adminActor: AuthUser,
    registrationId: string,
    statusOrInput:
      | "VERIFIED"
      | "REJECTED"
      | {
          status: "VERIFIED" | "REJECTED";
          reason?: string;
          rejectionReason?: string;
          notes?: string;
        },
    maybeReason?: string,
  ): Promise<HostVatRegistrationDTO> {
    assertRole(adminActor, [Role.ADMIN]);

    const status = typeof statusOrInput === "string" ? statusOrInput : statusOrInput.status;
    const reason =
      typeof statusOrInput === "string"
        ? maybeReason
        : statusOrInput.rejectionReason || statusOrInput.reason;

    const reg = await prisma.taxRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!reg) {
      throw AppError.notFound(`Tax registration ${registrationId} not found.`);
    }

    if (status === "REJECTED" && !reason?.trim()) {
      throw AppError.badRequest("A rejection reason is mandatory when rejecting a tax registration.");
    }

    const now = new Date();
    const updated = await prisma.taxRegistration.update({
      where: { id: registrationId },
      data: {
        status: status === "VERIFIED" ? TaxRegistrationStatus.VERIFIED : TaxRegistrationStatus.REJECTED,
        verifiedAt: status === "VERIFIED" ? now : null,
        verifiedById: adminActor.id,
        rejectionReason: status === "REJECTED" ? reason?.trim() : null,
      },
    });

    await auditService.record({
      actorId: adminActor.id,
      actorEmail: adminActor.email,
      action: "ADMIN_VERIFY_TAX_REGISTRATION",
      resourceType: "TAX_REGISTRATION",
      resourceId: reg.id,
      description: `Tax registration ${registrationId} updated to ${status}.`,
      status: "SUCCESS",
      metadata: {
        registrationId,
        hostId: reg.hostId,
        status,
        reason,
      },
    });

    return {
      id: updated.id,
      hostId: updated.hostId,
      countryCode: "SA",
      taxType: updated.taxType,
      registrationNumberMasked: maskTaxIdentifier(updated.registrationNumber),
      businessName: updated.businessName,
      businessAddress: updated.businessAddress,
      documentUrl: updated.documentUrl,
      status: updated.status as any,
      verifiedAt: updated.verifiedAt?.toISOString() || null,
      rejectionReason: updated.rejectionReason,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

export const hostTaxService = new HostTaxService();
