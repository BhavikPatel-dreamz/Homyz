import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { zatcaEinvoicingService } from "@/services/admin-analytics/tax/zatca-einvoicing.service";
import { hmrcVatService } from "@/services/admin-analytics/tax/hmrc-vat.service";
import type { ZatcaInvoiceType, ZatcaLineItem, ZatcaParty } from "@/services/admin-analytics/tax/zatca-contracts";

/**
 * Government Tax Compliance API (ZATCA FATOORA & HMRC MTD VAT) - Phase 11
 * GET /api/v1/admin/analytics/tax
 * POST /api/v1/admin/analytics/tax
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "overview";

    if (action === "overview") {
      const [zatcaInvoices, hmrcObligations, hmrcReturns, hmrcFinances] = await Promise.all([
        zatcaEinvoicingService.getInvoices({ limit: 10 }),
        hmrcVatService.getObligations(),
        hmrcVatService.getReturns(),
        hmrcVatService.getLiabilitiesAndPayments(),
      ]);

      return NextResponse.json({
        success: true,
        overview: {
          saudiZatca: {
            entityId: "HOMYZ_SA_LTD",
            jurisdiction: "Saudi Arabia (ZATCA)",
            vatNumber: "310492819200003",
            phase: "FATOORA Phase 2",
            supportedInvoiceTypes: ["STANDARD_B2B", "SIMPLIFIED_B2C", "CREDIT_NOTE", "DEBIT_NOTE"],
            recentInvoicesCount: zatcaInvoices.length,
            recentInvoices: zatcaInvoices,
            complianceDisclaimer:
              "ZATCA FATOORA Phase 2: Electronic invoice clearance certifies transactional integrity and does NOT replace direct tax remittance.",
          },
          ukHmrc: {
            entityId: "HOMYZ_UK_LTD",
            jurisdiction: "United Kingdom (HMRC)",
            vatNumber: "GB-948-2019-34",
            regime: "Making Tax Digital (MTD) VAT",
            openObligationsCount: hmrcObligations.filter((o) => o.status === "O").length,
            obligations: hmrcObligations,
            returns: hmrcReturns,
            liabilities: hmrcFinances.liabilities,
            payments: hmrcFinances.payments,
            complianceDisclaimer:
              "HMRC MTD VAT: Submitting 9-box return fulfills mandatory reporting obligations; bank payment must be arranged separately.",
          },
        },
      });
    }

    if (action === "zatca_invoices") {
      const type = searchParams.get("type") as ZatcaInvoiceType | undefined;
      const status = searchParams.get("status") || undefined;
      const invoices = await zatcaEinvoicingService.getInvoices({
        invoiceType: type,
        status,
      });
      return NextResponse.json({ success: true, count: invoices.length, invoices });
    }

    if (action === "zatca_invoice") {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ success: false, error: "Missing invoice id" }, { status: 400 });
      }
      const invoice = await zatcaEinvoicingService.getInvoice(id);
      if (!invoice) {
        return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, invoice });
    }

    if (action === "hmrc_obligations") {
      const status = (searchParams.get("status") as "O" | "F") || undefined;
      const obligations = await hmrcVatService.getObligations(status);
      return NextResponse.json({ success: true, count: obligations.length, obligations });
    }

    if (action === "hmrc_returns") {
      const returns = await hmrcVatService.getReturns();
      return NextResponse.json({ success: true, count: returns.length, returns });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    const actorUser: AuthUser = {
      id: body.actorId || "usr_tax_controller",
      role: Role.ADMIN,
      email: "tax-admin@homyz.internal",
      name: "Tax Controller",
    };

    // ZATCA Actions
    if (action === "zatca_create_invoice") {
      const { invoiceType = "SIMPLIFIED", buyer, lineItems } = body;
      if (!buyer || !lineItems || lineItems.length === 0) {
        return NextResponse.json(
          { success: false, error: "Missing buyer or lineItems" },
          { status: 400 }
        );
      }

      const invoice = await zatcaEinvoicingService.createInvoice({
        invoiceType: invoiceType as ZatcaInvoiceType,
        buyer: buyer as ZatcaParty | { legalName: string; buyerType: "INDIVIDUAL_GUEST" },
        lineItems: lineItems as ZatcaLineItem[],
      });

      return NextResponse.json({ success: true, invoice });
    }

    if (action === "zatca_create_credit_note") {
      const { originalInvoiceUuid, refundReason, refundAmountMinor, buyer } = body;
      if (!originalInvoiceUuid || !refundReason || !refundAmountMinor || !buyer) {
        return NextResponse.json(
          { success: false, error: "Missing required credit note parameters" },
          { status: 400 }
        );
      }

      const creditNote = await zatcaEinvoicingService.createCreditNoteForRefund({
        originalInvoiceUuid,
        refundReason,
        refundAmountMinor,
        buyer,
      });

      return NextResponse.json({ success: true, creditNote });
    }

    if (action === "zatca_submit") {
      const { invoiceId } = body;
      if (!invoiceId) {
        return NextResponse.json({ success: false, error: "Missing invoiceId" }, { status: 400 });
      }

      const result = await zatcaEinvoicingService.submitInvoiceToZatca(invoiceId);
      return NextResponse.json({ success: result.validationPassed, result });
    }

    // HMRC Actions
    if (action === "hmrc_prepare_return") {
      const { periodKey = "26A3", quarterLabel = "2026-Q3", taxableSalesMinor, inputPurchasesMinor } = body;

      const record = await hmrcVatService.prepareVatReturn({
        periodKey,
        quarterLabel,
        taxableSalesMinor,
        inputPurchasesMinor,
        user: actorUser,
      });

      return NextResponse.json({ success: true, vatReturn: record });
    }

    if (action === "hmrc_approve_return") {
      const { returnId, declarationSigned = true } = body;
      if (!returnId) {
        return NextResponse.json({ success: false, error: "Missing returnId" }, { status: 400 });
      }

      const approved = await hmrcVatService.approveReturn(returnId, actorUser, {
        declarationSigned,
      });

      return NextResponse.json({ success: true, vatReturn: approved });
    }

    if (action === "hmrc_submit_return") {
      const { returnId, customHeaders } = body;
      if (!returnId) {
        return NextResponse.json({ success: false, error: "Missing returnId" }, { status: 400 });
      }

      const submission = await hmrcVatService.submitReturnToHmrc(returnId, actorUser, customHeaders);
      return NextResponse.json({ success: submission.success, submission });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

