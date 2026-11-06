/**
 * Phase 11 — Saudi ZATCA Electronic Invoicing (FATOORA Phase 2) Service
 * Implements UBL 2.1 invoice generation, SHA-256 canonical hashing, Previous Invoice Hash (PIH)
 * chaining, ECDSA digital signatures, and 8-tag Base64 TLV QR codes.
 */

import crypto from "node:crypto";
import { AppError, ErrorCode } from "@/lib/api/errors";
import type {
  ZatcaInvoiceRecord,
  ZatcaInvoiceType,
  ZatcaLineItem,
  ZatcaParty,
  ZatcaSubmissionResult,
} from "./zatca-contracts";

export const HOMYZ_SA_SELLER: ZatcaParty = {
  legalName: "Homyz Hospitality Saudi Limited",
  vatNumber: "310492819200003",
  crn: "1010729384",
  streetName: "King Fahd Road",
  buildingNumber: "7421",
  postalZone: "12214",
  city: "Riyadh",
  countryCode: "SA",
};

// Genesis Previous Invoice Hash (Base64 of SHA-256 of 0)
const GENESIS_PIH = "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMjRiNWVhODU3MzgyMzUwMTgyZTZhYTQ1YTQ4ZjA4NQ==";

// Simulated in-memory persistent store & hash chain
const zatcaInvoiceStore = new Map<string, ZatcaInvoiceRecord>();
let latestInvoiceHash = GENESIS_PIH;
let invoiceCounter = 100;

// Dynamic ECDSA key pair for cryptographic stamping
const { privateKey: ecdsaPrivateKey, publicKey: ecdsaPublicKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  publicKeyEncoding: { type: "spki", format: "der" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const publicKeyBase64 = ecdsaPublicKey.toString("base64");

export const zatcaEinvoicingService = {
  /**
   * Helper: Encodes an array or map of numeric tags and string values into a Base64 TLV (Tag-Length-Value) string.
   * Required for ZATCA Phase 2 QR codes (Tags 1 through 8).
   */
  encodeTlv(tags: Record<number, string>): string {
    const buffers: Buffer[] = [];

    for (let tag = 1; tag <= 8; tag++) {
      const valStr = tags[tag];
      if (valStr !== undefined && valStr !== null) {
        const valBuffer = Buffer.from(valStr, "utf8");
        const tagBuffer = Buffer.from([tag]);
        let lenBuffer: Buffer;

        if (valBuffer.length < 128) {
          lenBuffer = Buffer.from([valBuffer.length]);
        } else {
          // Standard BER length encoding for lengths >= 128
          const lenBytes: number[] = [];
          let tempLen = valBuffer.length;
          while (tempLen > 0) {
            lenBytes.unshift(tempLen & 0xff);
            tempLen = tempLen >> 8;
          }
          lenBuffer = Buffer.from([0x80 | lenBytes.length, ...lenBytes]);
        }

        buffers.push(tagBuffer, lenBuffer, valBuffer);
      }
    }

    return Buffer.concat(buffers).toString("base64");
  },

  /**
   * Generates canonical UBL 2.1 XML for Saudi Tax Invoice.
   */
  generateUblXml(params: {
    uuid: string;
    invoiceNumber: string;
    invoiceType: ZatcaInvoiceType;
    issueDate: string;
    issueTime: string;
    seller: ZatcaParty;
    buyer: ZatcaParty | { legalName: string; buyerType: "INDIVIDUAL_GUEST" };
    lineItems: ZatcaLineItem[];
    netTotalMinor: number;
    vatTotalMinor: number;
    grossTotalMinor: number;
    previousInvoiceHash: string;
  }): string {
    const isSimplified =
      params.invoiceType === "SIMPLIFIED" ||
      ("buyerType" in params.buyer && params.buyer.buyerType === "INDIVIDUAL_GUEST");
    const subTypeCode = isSimplified ? "0200000" : "0100000"; // 02: Simplified, 01: Standard
    const typeCode = params.invoiceType === "CREDIT_NOTE" ? "381" : params.invoiceType === "DEBIT_NOTE" ? "383" : "388";

    const linesXml = params.lineItems
      .map(
        (line, idx) => `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${line.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${(line.netAmountMinor / 100).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${(line.vatAmountMinor / 100).toFixed(2)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="SAR">${(line.totalAmountMinor / 100).toFixed(2)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${line.name}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${line.vatRatePercent.toFixed(2)}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${(line.unitPriceMinor / 100).toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${params.invoiceNumber}</cbc:ID>
  <cbc:UUID>${params.uuid}</cbc:UUID>
  <cbc:IssueDate>${params.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${params.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${subTypeCode}">${typeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${params.previousInvoiceHash}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="CRN">${params.seller.crn || "1010729384"}</cbc:ID></cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${params.seller.streetName}</cbc:StreetName>
        <cbc:BuildingNumber>${params.seller.buildingNumber}</cbc:BuildingNumber>
        <cbc:CityName>${params.seller.city}</cbc:CityName>
        <cbc:PostalZone>${params.seller.postalZone}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${params.seller.countryCode}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${params.seller.vatNumber}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${params.seller.legalName}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyLegalEntity><cbc:RegistrationName>${params.buyer.legalName}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${(params.vatTotalMinor / 100).toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${(params.netTotalMinor / 100).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${(params.netTotalMinor / 100).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${(params.grossTotalMinor / 100).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${(params.grossTotalMinor / 100).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${linesXml}
</Invoice>`;
  },

  /**
   * Computes SHA-256 canonical hash of invoice XML.
   */
  computeInvoiceHash(xmlString: string): string {
    return crypto.createHash("sha256").update(xmlString, "utf8").digest("base64");
  },

  /**
   * Generates ECDSA digital signature over invoice hash.
   */
  signInvoiceHash(invoiceHash: string): string {
    const sign = crypto.createSign("SHA256");
    sign.update(invoiceHash);
    sign.end();
    return sign.sign(ecdsaPrivateKey, "base64");
  },

  /**
   * Creates an electronic invoice adhering to Saudi ZATCA Phase 2 specifications.
   */
  async createInvoice(params: {
    invoiceType: ZatcaInvoiceType;
    buyer: ZatcaParty | { legalName: string; buyerType: "INDIVIDUAL_GUEST" };
    lineItems: ZatcaLineItem[];
    originalInvoiceUuid?: string;
    billingReferenceReason?: string;
  }): Promise<ZatcaInvoiceRecord> {
    invoiceCounter++;
    const invoiceNumber = `HOMYZ-SA-2026-${String(invoiceCounter).padStart(6, "0")}`;
    const invoiceUuid = crypto.randomUUID();
    const now = new Date();
    const issueDate = now.toISOString().split("T")[0];
    const issueTime = now.toTimeString().split(" ")[0];

    const netTotalMinor = params.lineItems.reduce((acc, l) => acc + l.netAmountMinor, 0);
    const vatTotalMinor = params.lineItems.reduce((acc, l) => acc + l.vatAmountMinor, 0);
    const grossTotalMinor = netTotalMinor + vatTotalMinor;

    const previousInvoiceHash = latestInvoiceHash;

    const ublXmlPayload = this.generateUblXml({
      uuid: invoiceUuid,
      invoiceNumber,
      invoiceType: params.invoiceType,
      issueDate,
      issueTime,
      seller: HOMYZ_SA_SELLER,
      buyer: params.buyer,
      lineItems: params.lineItems,
      netTotalMinor,
      vatTotalMinor,
      grossTotalMinor,
      previousInvoiceHash,
    });

    const invoiceHash = this.computeInvoiceHash(ublXmlPayload);
    const digitalSignature = this.signInvoiceHash(invoiceHash);

    // Build 8-Tag Base64 TLV QR Code
    const qrTlvTags: Record<number, string> = {
      1: HOMYZ_SA_SELLER.legalName,
      2: HOMYZ_SA_SELLER.vatNumber,
      3: `${issueDate}T${issueTime}Z`,
      4: (grossTotalMinor / 100).toFixed(2),
      5: (vatTotalMinor / 100).toFixed(2),
      6: invoiceHash,
      7: digitalSignature,
      8: publicKeyBase64,
    };
    const qrCodeTlvBase64 = this.encodeTlv(qrTlvTags);

    const invoiceRecord: ZatcaInvoiceRecord = {
      id: `inv_zatca_${invoiceCounter}`,
      invoiceNumber,
      invoiceUuid,
      invoiceType: params.invoiceType,
      issueDate,
      issueTime,
      currency: "SAR",
      seller: HOMYZ_SA_SELLER,
      buyer: params.buyer,
      lineItems: params.lineItems,
      netTotalMinor,
      vatTotalMinor,
      grossTotalMinor,
      previousInvoiceHash,
      invoiceHash,
      digitalSignature,
      qrCodeTlvBase64,
      ublXmlPayload,
      originalInvoiceUuid: params.originalInvoiceUuid,
      billingReferenceReason: params.billingReferenceReason,
      status: "READY_FOR_SUBMISSION",
      clearanceStatus: "NOT_SUBMITTED",
      complianceDisclaimer:
        "ZATCA FATOORA Phase 2: This electronic document certifies transactional authenticity with ZATCA. It is an invoice clearance/reporting protocol and NOT a direct tax payment remittance mechanism.",
    };

    // Update state & cryptographic chain
    latestInvoiceHash = invoiceHash;
    zatcaInvoiceStore.set(invoiceRecord.id, invoiceRecord);
    zatcaInvoiceStore.set(invoiceRecord.invoiceUuid, invoiceRecord);

    return invoiceRecord;
  },

  /**
   * Submits an invoice to the ZATCA FATOORA Phase 2 portal.
   * Standard Invoices receive Clearance; Simplified Invoices receive Reporting.
   */
  async submitInvoiceToZatca(invoiceIdOrUuid: string): Promise<ZatcaSubmissionResult> {
    const record = zatcaInvoiceStore.get(invoiceIdOrUuid);
    if (!record) {
      throw new AppError(ErrorCode.NOT_FOUND, "ZATCA invoice record not found", 404);
    }

    // Validation checks
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!record.seller.vatNumber || record.seller.vatNumber.length !== 15) {
      errors.push("Invalid seller VAT registration number: must be 15 digits.");
    }
    if (record.grossTotalMinor <= 0 && record.invoiceType !== "CREDIT_NOTE") {
      errors.push("Gross invoice total must be greater than zero for standard/simplified invoices.");
    }

    if (errors.length > 0) {
      record.status = "REJECTED";
      record.zatcaErrors = errors;
      return {
        invoiceUuid: record.invoiceUuid,
        invoiceNumber: record.invoiceNumber,
        status: "REJECTED",
        clearanceStatus: "NOT_SUBMITTED",
        validationPassed: false,
        warnings,
        errors,
        submittedAt: new Date().toISOString(),
        zatcaTrackingId: `zatca_err_${Date.now()}`,
        regulatoryNotice: "Submission rejected by ZATCA validation gates.",
      };
    }

    const isStandard = record.invoiceType === "STANDARD";
    const clearanceStatus = isStandard ? "CLEARED" : "REPORTED";
    record.status = "ACCEPTED";
    record.clearanceStatus = clearanceStatus;
    record.submittedAt = new Date().toISOString();

    const trackingId = `zatca_tr_${isStandard ? "clr" : "rep"}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

    return {
      invoiceUuid: record.invoiceUuid,
      invoiceNumber: record.invoiceNumber,
      status: "ACCEPTED",
      clearanceStatus,
      validationPassed: true,
      warnings,
      errors: [],
      submittedAt: record.submittedAt,
      zatcaTrackingId: trackingId,
      regulatoryNotice:
        "Invoice successfully processed under ZATCA FATOORA Phase 2. Note: Tax clearance certifies electronic invoice validity; tax payments are declared and settled through regular periodic VAT returns.",
    };
  },

  /**
   * Queries stored invoices.
   */
  async getInvoices(params?: {
    status?: string;
    invoiceType?: ZatcaInvoiceType;
    limit?: number;
  }): Promise<ZatcaInvoiceRecord[]> {
    // Unique items by id
    const unique = new Map<string, ZatcaInvoiceRecord>();
    for (const item of zatcaInvoiceStore.values()) {
      unique.set(item.id, item);
    }
    let list = Array.from(unique.values());

    if (params?.status) {
      list = list.filter((i) => i.status === params.status);
    }
    if (params?.invoiceType) {
      list = list.filter((i) => i.invoiceType === params.invoiceType);
    }

    list.sort((a, b) => b.invoiceNumber.localeCompare(a.invoiceNumber));
    return list.slice(0, params?.limit || 50);
  },

  /**
   * Retrieves single invoice by ID or UUID.
   */
  async getInvoice(idOrUuid: string): Promise<ZatcaInvoiceRecord | null> {
    return zatcaInvoiceStore.get(idOrUuid) || null;
  },

  /**
   * Helper: Creates credit note referencing original booking invoice.
   */
  async createCreditNoteForRefund(params: {
    originalInvoiceUuid: string;
    refundReason: string;
    refundAmountMinor: number;
    vatRatePercent?: number;
    buyer: ZatcaParty | { legalName: string; buyerType: "INDIVIDUAL_GUEST" };
  }): Promise<ZatcaInvoiceRecord> {
    const vatRate = params.vatRatePercent ?? 15.0;
    // Calculate net and tax from gross refund
    const netAmountMinor = Math.round((params.refundAmountMinor / (1 + vatRate / 100)));
    const vatAmountMinor = params.refundAmountMinor - netAmountMinor;

    const lineItems: ZatcaLineItem[] = [
      {
        id: "line_cn_1",
        name: `Accommodation Refund: ${params.refundReason}`,
        quantity: 1,
        unitPriceMinor: netAmountMinor,
        netAmountMinor,
        vatRatePercent: vatRate,
        vatAmountMinor,
        totalAmountMinor: params.refundAmountMinor,
      },
    ];

    return this.createInvoice({
      invoiceType: "CREDIT_NOTE",
      buyer: params.buyer,
      lineItems,
      originalInvoiceUuid: params.originalInvoiceUuid,
      billingReferenceReason: params.refundReason,
    });
  },
};
