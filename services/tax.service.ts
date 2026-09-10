import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { resolveTaxJurisdiction } from "@/lib/tax/jurisdiction-resolver";
import { TaxCalculator } from "@/lib/tax/tax-calculator";
import type {
  ListingTaxDTO,
  TaxCalculationResult,
  TaxInvoiceData,
  TaxRegistrationDTO,
  TaxReportSummary,
  TaxRuleDTO,
} from "@/lib/tax/types";
import type {
  createHostTaxSchema,
  saveTaxRegistrationSchema,
  taxReportFilterSchema,
  updateHostTaxSchema,
} from "@/lib/validation/tax";
import type { z } from "zod";

export class TaxService {
  /**
   * Asserts that the actor is authorized to manage taxes for this listing.
   */
  private async assertListingOwnership(actor: AuthUser, listingId: string) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, hostId: true, city: true, country: true, address: true, postalCode: true, title: true, price: true, cleaningFee: true },
    });

    if (!listing) {
      throw AppError.notFound("Listing not found");
    }

    if (actor.role !== "ADMIN" && listing.hostId !== actor.id) {
      // Check co-host permissions
      const coHost = await prisma.listingCoHost.findFirst({
        where: {
          listingId,
          userId: actor.id,
          status: "ACCEPTED",
        },
      });

      if (!coHost) {
        throw AppError.forbidden("You are not authorized to manage tax settings for this listing");
      }
    }

    return listing;
  }

  /**
   * Retrieves the comprehensive tax overview for a listing.
   */
  async getListingTaxOverview(actor: AuthUser, listingId: string) {
    const listing = await this.assertListingOwnership(actor, listingId);

    // 1. Resolve Jurisdiction & Platform-Managed Rules
    const resolved = resolveTaxJurisdiction({
      country: listing.country,
      city: listing.city,
      postalCode: listing.postalCode,
      district: null,
    });

    // 2. Fetch Host-Configured Taxes from Database
    const dbListingTaxes = await prisma.listingTax.findMany({
      where: { listingId },
      orderBy: { createdAt: "desc" },
    });

    const hostTaxes: ListingTaxDTO[] = dbListingTaxes.map((t: any) => ({
      id: t.id,
      listingId: t.listingId,
      taxRuleId: t.taxRuleId,
      customName: t.customName,
      taxType: t.taxType,
      calculationMethod: t.calculationMethod,
      rate: t.rate,
      amount: t.amount,
      taxableComponents: t.taxableComponents as any,
      remittanceResponsibility: t.remittanceResponsibility,
      maximumAmountPerPersonPerNight: t.maximumAmountPerPersonPerNight,
      partialStayExemptionNights: t.partialStayExemptionNights,
      fullStayExemptionNights: t.fullStayExemptionNights,
      longStayExemptionNights: t.longStayExemptionNights,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    // 3. Fetch Host Tax Registrations
    const dbRegistrations = await prisma.taxRegistration.findMany({
      where: { hostId: listing.hostId },
      orderBy: { createdAt: "desc" },
    });

    const registrations: TaxRegistrationDTO[] = dbRegistrations.map((r: any) => ({
      id: r.id,
      hostId: r.hostId,
      jurisdictionId: r.jurisdictionId,
      taxType: r.taxType,
      registrationNumber: r.registrationNumber,
      businessName: r.businessName,
      businessAddress: r.businessAddress,
      documentUrl: r.documentUrl,
      status: r.status,
      verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    // 4. Check for Potential Duplicate Warnings
    const systemTaxTypes = new Set(resolved.systemRules.map((r) => r.taxType));
    const duplicateWarnings = hostTaxes
      .filter((ht) => systemTaxTypes.has(ht.taxType))
      .map((ht) => ({
        taxType: ht.taxType,
        message: `A ${ht.taxType} tax is already collected and remitted automatically by Homyz for this jurisdiction.`,
      }));

    return {
      listing: {
        id: listing.id,
        title: listing.title,
        city: listing.city,
        country: listing.country,
        price: listing.price,
        cleaningFee: listing.cleaningFee,
      },
      jurisdiction: resolved.jurisdiction,
      systemRules: resolved.systemRules,
      hostTaxes,
      registrations,
      duplicateWarnings,
    };
  }

  /**
   * Adds a host-configured custom tax to a listing with duplicate prevention.
   */
  async createHostTax(actor: AuthUser, input: z.infer<typeof createHostTaxSchema>) {
    const listing = await this.assertListingOwnership(actor, input.listingId);

    // 1. Resolve Jurisdiction
    const resolved = resolveTaxJurisdiction({
      country: listing.country,
      city: listing.city,
    });

    // Check if platform already manages this tax type automatically
    const isPlatformManaged = resolved.systemRules.some(
      (r) => r.taxType === input.taxType && r.isActive
    );

    if (isPlatformManaged) {
      throw AppError.conflict(
        `This tax (${input.taxType}) is already automatically collected and remitted by Homyz for this jurisdiction.`
      );
    }

    // A listing may have several taxes of the same broad type. The selected
    // tax name is its user-facing, per-listing identity.
    const existing = await prisma.listingTax.findFirst({
      where: {
        listingId: input.listingId,
        customName: input.customName || null,
      },
    });

    if (existing) {
      throw AppError.conflict(`A tax of type "${input.taxType}" already exists for this listing.`);
    }

    // Keep the listing-tax record and its audit event in one transaction. A
    // failed audit write must not make the client receive an error for a tax
    // that was actually persisted.
    const created = await prisma.$transaction(async (tx: any) => {
      const tax = await tx.listingTax.create({
        data: {
          listingId: input.listingId,
          taxType: input.taxType,
          customName: input.customName || null,
          calculationMethod: input.calculationMethod,
          rate: input.rate ?? null,
          amount: input.amount ?? null,
          taxableComponents: input.taxableComponents,
          remittanceResponsibility: input.remittanceResponsibility,
          maximumAmountPerPersonPerNight: input.maximumAmountPerPersonPerNight ?? null,
          partialStayExemptionNights: input.partialStayExemptionNights ?? null,
          fullStayExemptionNights: input.fullStayExemptionNights ?? null,
          longStayExemptionNights: input.longStayExemptionNights ?? null,
          isActive: true,
        },
      });

      await tx.taxAuditLog.create({
        data: {
          listingId: input.listingId,
          hostId: actor.id,
          action: "CREATE_TAX",
          newValues: tax as any,
        },
      });

      return tax;
    });

    return created;
  }

  /**
   * Updates an existing host-managed listing tax.
   */
  async updateHostTax(
    actor: AuthUser,
    listingId: string,
    taxId: string,
    input: z.infer<typeof updateHostTaxSchema>
  ) {
    await this.assertListingOwnership(actor, listingId);

    const existing = await prisma.listingTax.findFirst({
      where: { id: taxId, listingId },
    });

    if (!existing) {
      throw AppError.notFound("Tax configuration not found");
    }

    const updated = await prisma.listingTax.update({
      where: { id: taxId },
      data: {
        customName: input.customName !== undefined ? input.customName : existing.customName,
        calculationMethod: input.calculationMethod || existing.calculationMethod,
        rate: input.rate !== undefined ? input.rate : existing.rate,
        amount: input.amount !== undefined ? input.amount : existing.amount,
        taxableComponents: input.taxableComponents || existing.taxableComponents,
        remittanceResponsibility: input.remittanceResponsibility || existing.remittanceResponsibility,
        maximumAmountPerPersonPerNight:
          input.maximumAmountPerPersonPerNight !== undefined
            ? input.maximumAmountPerPersonPerNight
            : existing.maximumAmountPerPersonPerNight,
        partialStayExemptionNights:
          input.partialStayExemptionNights !== undefined
            ? input.partialStayExemptionNights
            : existing.partialStayExemptionNights,
        fullStayExemptionNights:
          input.fullStayExemptionNights !== undefined
            ? input.fullStayExemptionNights
            : existing.fullStayExemptionNights,
        longStayExemptionNights:
          input.longStayExemptionNights !== undefined
            ? input.longStayExemptionNights
            : existing.longStayExemptionNights,
        isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      },
    });

    // Audit Log
    await prisma.taxAuditLog.create({
      data: {
        listingId,
        hostId: actor.id,
        action: "UPDATE_TAX",
        oldValues: existing as any,
        newValues: updated as any,
      },
    });

    return updated;
  }

  /**
   * Deletes an existing host-managed tax configuration.
   */
  async deleteHostTax(actor: AuthUser, listingId: string, taxId: string) {
    await this.assertListingOwnership(actor, listingId);

    const existing = await prisma.listingTax.findFirst({
      where: { id: taxId, listingId },
    });

    if (!existing) {
      throw AppError.notFound("Tax configuration not found");
    }

    await prisma.listingTax.delete({
      where: { id: taxId },
    });

    // Audit Log
    await prisma.taxAuditLog.create({
      data: {
        listingId,
        hostId: actor.id,
        action: "DELETE_TAX",
        oldValues: existing as any,
      },
    });

    return { success: true };
  }

  /**
   * Saves or updates a host's tax registration (e.g. VAT ID, GST Number, License).
   */
  async saveTaxRegistration(actor: AuthUser, input: z.infer<typeof saveTaxRegistrationSchema>) {
    // Jurisdictions returned by the resolver are catalog entries and are not
    // necessarily persisted in TaxJurisdiction. TaxRegistration's relation is
    // optional, so retain an ID only when it is a real database record.
    const jurisdiction = input.jurisdictionId
      ? await prisma.taxJurisdiction.findUnique({
          where: { id: input.jurisdictionId },
          select: { id: true },
        })
      : null;
    const jurisdictionId = jurisdiction?.id ?? null;

    const existing = await prisma.taxRegistration.findFirst({
      where: {
        hostId: actor.id,
        taxType: input.taxType,
      },
    });

    const record = await prisma.$transaction(async (tx: any) => {
      const registration = existing
        ? await tx.taxRegistration.update({
            where: { id: existing.id },
            data: {
              registrationNumber: input.registrationNumber,
              businessName: input.businessName || null,
              businessAddress: input.businessAddress || null,
              documentUrl: input.documentUrl || null,
              jurisdictionId,
              status: "PENDING_VERIFICATION",
            },
          })
        : await tx.taxRegistration.create({
            data: {
              hostId: actor.id,
              taxType: input.taxType,
              registrationNumber: input.registrationNumber,
              businessName: input.businessName || null,
              businessAddress: input.businessAddress || null,
              documentUrl: input.documentUrl || null,
              jurisdictionId,
              status: "PENDING_VERIFICATION",
            },
          });

      await tx.taxAuditLog.create({
        data: {
          hostId: actor.id,
          action: existing ? "UPDATE_REGISTRATION" : "ADD_REGISTRATION",
          oldValues: existing as any,
          newValues: registration as any,
        },
      });

      return registration;
    });

    return record;
  }

  /**
   * Generates a tax calculation simulation/preview.
   */
  async simulateTaxPreview(opts: {
    listingId: string;
    nights: number;
    guests: number;
    pets?: number;
    baseNightlyPrice?: number;
    cleaningFee?: number;
  }): Promise<TaxCalculationResult> {
    const listing = await prisma.listing.findUnique({
      where: { id: opts.listingId },
      include: { taxes: { where: { isActive: true } } },
    });

    if (!listing) {
      throw AppError.notFound("Listing not found");
    }

    const resolved = resolveTaxJurisdiction({
      country: listing.country,
      city: listing.city,
    });

    const hostTaxes: ListingTaxDTO[] = (listing.taxes || []).map((t: any) => ({
      id: t.id,
      listingId: t.listingId,
      taxRuleId: t.taxRuleId,
      customName: t.customName,
      taxType: t.taxType,
      calculationMethod: t.calculationMethod,
      rate: t.rate,
      amount: t.amount,
      taxableComponents: t.taxableComponents as any,
      remittanceResponsibility: t.remittanceResponsibility,
      maximumAmountPerPersonPerNight: t.maximumAmountPerPersonPerNight,
      partialStayExemptionNights: t.partialStayExemptionNights,
      fullStayExemptionNights: t.fullStayExemptionNights,
      longStayExemptionNights: t.longStayExemptionNights,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    const nightlyPrice = opts.baseNightlyPrice ?? listing.price;
    const cleaningFee = opts.cleaningFee ?? (listing.cleaningFee || 0);
    const nights = Math.max(1, opts.nights);
    const nightlySubtotal = nightlyPrice * nights;

    return TaxCalculator.calculateTaxes({
      nights,
      nightlySubtotal,
      cleaningFee,
      guests: opts.guests,
      rules: resolved.systemRules,
      hostTaxes,
      currency: "SAR",
    });
  }

  /**
   * Aggregates tax history and reports across host's listings.
   */
  async getTaxReport(actor: AuthUser, filters: z.infer<typeof taxReportFilterSchema>): Promise<TaxReportSummary> {
    const whereClause: any = {
      booking: {
        listing: {
          hostId: actor.id,
        },
      },
    };

    if (filters.listingId) {
      whereClause.booking.listingId = filters.listingId;
    }

    if (filters.taxType) {
      whereClause.taxType = filters.taxType;
    }

    if (filters.remittanceResponsibility) {
      whereClause.remittanceResponsibility = filters.remittanceResponsibility;
    }

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {};
      if (filters.startDate) {
        whereClause.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        whereClause.createdAt.lte = new Date(filters.endDate);
      }
    }

    const reservationTaxes = await prisma.reservationTax.findMany({
      where: whereClause,
      include: {
        booking: {
          include: {
            listing: { select: { id: true, title: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalTaxableRevenue = 0;
    let totalTaxesCollected = 0;
    let taxesRemittedByPlatform = 0;
    let taxesPassedToHost = 0;
    let taxesRefunded = 0;

    const items = reservationTaxes.map((rt: any) => {
      totalTaxableRevenue += rt.taxableBase;
      totalTaxesCollected += rt.taxAmount;
      taxesRefunded += rt.refundedTax;

      if (rt.remittanceResponsibility === "PLATFORM") {
        taxesRemittedByPlatform += rt.taxAmount;
      } else {
        taxesPassedToHost += rt.taxAmount;
      }

      return {
        id: rt.id,
        bookingId: rt.bookingId,
        listingId: rt.booking.listing.id,
        listingTitle: rt.booking.listing.title,
        guestName: rt.booking.user?.name || "Guest",
        checkIn: rt.booking.startDate.toISOString(),
        checkOut: rt.booking.endDate.toISOString(),
        taxName: rt.taxName,
        taxType: rt.taxType,
        taxableBase: rt.taxableBase,
        rate: rt.rate,
        taxAmount: rt.taxAmount,
        refundedTax: rt.refundedTax,
        remittanceResponsibility: rt.remittanceResponsibility,
        currency: rt.currency,
        createdAt: rt.createdAt.toISOString(),
      };
    });

    const netTaxableRevenue = Math.max(0, totalTaxableRevenue - taxesRefunded);

    return {
      totalReservations: new Set(reservationTaxes.map((t: any) => t.bookingId)).size,
      totalTaxableRevenue,
      totalTaxesCollected,
      taxesRemittedByPlatform,
      taxesPassedToHost,
      taxesRefunded,
      netTaxableRevenue,
      currency: "SAR",
      items,
    };
  }

  /**
   * Generates a compliant Tax Invoice document for a completed booking.
   */
  async generateTaxInvoice(actor: AuthUser, bookingId: string): Promise<TaxInvoiceData> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: {
          include: {
            host: { select: { id: true, name: true, email: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
        taxes: true,
      },
    });

    if (!booking) {
      throw AppError.notFound("Booking not found");
    }

    // Only host or guest or admin can access invoice
    if (
      actor.role !== "ADMIN" &&
      booking.userId !== actor.id &&
      booking.listing.hostId !== actor.id
    ) {
      throw AppError.forbidden("Access denied");
    }

    const hostRegistration = await prisma.taxRegistration.findFirst({
      where: { hostId: booking.listing.hostId, status: "VERIFIED" },
    });

    const nights = Math.max(
      1,
      Math.round(
        (booking.endDate.getTime() - booking.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    const nightlySubtotal = (booking.nightlyPrice || 0) * nights;
    const cleaningFee = booking.cleaningFee || 0;

    const lineItems = [
      {
        description: `Accommodation (${nights} ${nights === 1 ? "night" : "nights"})`,
        quantity: nights,
        unitPrice: booking.nightlyPrice || 0,
        total: nightlySubtotal,
      },
    ];

    if (cleaningFee > 0) {
      lineItems.push({
        description: "Cleaning Fee",
        quantity: 1,
        unitPrice: cleaningFee,
        total: cleaningFee,
      });
    }

    const subtotal = nightlySubtotal + cleaningFee;
    let taxTotal = 0;

    const taxBreakdown = booking.taxes.map((t: any) => {
      taxTotal += t.taxAmount;
      return {
        taxName: t.taxName,
        taxType: t.taxType,
        rate: t.rate,
        taxableBase: t.taxableBase,
        taxAmount: t.taxAmount,
      };
    });

    return {
      invoiceNumber: `INV-${booking.id.slice(-8).toUpperCase()}`,
      issueDate: booking.createdAt.toISOString(),
      bookingId: booking.id,
      stayDates: {
        checkIn: booking.startDate.toISOString().split("T")[0],
        checkOut: booking.endDate.toISOString().split("T")[0],
        nights,
      },
      supplier: {
        name: booking.listing.host.name || "Homyz Host",
        taxId: hostRegistration?.registrationNumber || null,
        address: booking.listing.address || "Riyadh, Saudi Arabia",
      },
      guest: {
        name: booking.user?.name || "Guest",
        email: booking.user?.email || "guest@example.com",
      },
      property: {
        title: booking.listing.title,
        address: booking.listing.address || "Property Address",
        city: booking.listing.city || "Riyadh",
        country: booking.listing.country || "Saudi Arabia",
      },
      lineItems,
      taxBreakdown,
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal,
      currency: booking.currency || "SAR",
    };
  }
}

export const taxService = new TaxService();
