import type {
  CalculatedTaxItem,
  HostPayoutBreakdown,
  ListingTaxDTO,
  TaxCalculationParams,
  TaxCalculationResult,
  TaxRuleDTO,
  TaxType,
} from "./types";

/**
 * Deterministic, server-side monetary calculation engine.
 * Calculates all taxes, exemptions, and host payout breakdowns in minor currency units (cents/halalas)
 * with zero floating-point drift.
 */
export class TaxCalculator {
  /**
   * Calculates the full tax and payout breakdown for a reservation quote or checkout.
   */
  static calculateTaxes(params: TaxCalculationParams): TaxCalculationResult {
    const nights = Math.max(1, params.nights);
    const guests = Math.max(1, params.guests ?? 1);
    const currency = params.currency || "SAR";

    const nightlySubtotal = Math.max(0, params.nightlySubtotal);
    const discountAmount = Math.max(0, params.discountAmount ?? 0);
    const accommodationSubtotal = Math.max(0, nightlySubtotal - discountAmount);
    const cleaningFee = Math.max(0, params.cleaningFee ?? 0);
    const petFee = Math.max(0, params.petFee ?? 0);
    const extraGuestFee = Math.max(0, params.extraGuestFee ?? 0);

    const calculatedTaxes: CalculatedTaxItem[] = [];
    const processedTaxTypes = new Set<TaxType>();

    // 1. Process System-Managed Rules first (Platform Priority)
    const systemRules = (params.rules || []).filter((r) => r.isActive);
    for (const rule of systemRules) {
      const taxItem = this.evaluateRule({
        rule,
        nights,
        guests,
        accommodationSubtotal,
        cleaningFee,
        petFee,
        extraGuestFee,
        currency,
      });

      calculatedTaxes.push(taxItem);
      processedTaxTypes.add(rule.taxType);
    }

    // 2. Process Host-Configured Listing Taxes (Avoiding duplicate tax types)
    const hostTaxes = (params.hostTaxes || []).filter((t) => t.isActive);
    for (const hostTax of hostTaxes) {
      // Prevent duplicate tax if platform already collected this tax type
      if (processedTaxTypes.has(hostTax.taxType)) {
        continue;
      }

      const taxItem = this.evaluateHostTax({
        hostTax,
        nights,
        guests,
        accommodationSubtotal,
        cleaningFee,
        petFee,
        extraGuestFee,
        currency,
      });

      calculatedTaxes.push(taxItem);
      processedTaxTypes.add(hostTax.taxType);
    }

    // 3. Aggregate Tax Totals
    let taxTotal = 0;
    let platformRemittedTaxTotal = 0;
    let hostRemittedTaxTotal = 0;

    for (const item of calculatedTaxes) {
      if (!item.isExempt) {
        taxTotal += item.taxAmount;
        if (item.remittanceResponsibility === "PLATFORM") {
          platformRemittedTaxTotal += item.taxAmount;
        } else {
          hostRemittedTaxTotal += item.taxAmount;
        }
      }
    }

    // 4. Host Payout Calculation
    // Host receives accommodation subtotal + cleaning + pet fee + any taxes collected for the host
    // Less platform service fee (e.g., standard 3% host commission on accommodation)
    const platformServiceFee = Math.round(accommodationSubtotal * 0.03);
    const netHostPayout =
      accommodationSubtotal +
      cleaningFee +
      petFee +
      hostRemittedTaxTotal -
      platformServiceFee;

    const payoutBreakdown: HostPayoutBreakdown = {
      accommodationSubtotal,
      cleaningFee,
      petFee,
      taxesCollectedForHost: hostRemittedTaxTotal,
      taxesRemittedByPlatform: platformRemittedTaxTotal,
      platformServiceFee,
      netHostPayout: Math.max(0, netHostPayout),
      currency,
    };

    // 5. Total Guest Charge = Accommodation + Cleaning + Pet + Extra Guest + Taxes
    const guestTotal =
      accommodationSubtotal + cleaningFee + petFee + extraGuestFee + taxTotal;

    return {
      taxes: calculatedTaxes,
      taxTotal,
      platformRemittedTaxTotal,
      hostRemittedTaxTotal,
      guestTotal,
      payoutBreakdown,
      currency,
    };
  }

  /**
   * Evaluates a system-managed TaxRule.
   */
  private static evaluateRule(opts: {
    rule: TaxRuleDTO;
    nights: number;
    guests: number;
    accommodationSubtotal: number;
    cleaningFee: number;
    petFee: number;
    extraGuestFee: number;
    currency: string;
  }): CalculatedTaxItem {
    const { rule, nights, guests, currency } = opts;

    // Check Long-Stay Exemption
    if (
      rule.longStayExemptionNights &&
      nights >= rule.longStayExemptionNights
    ) {
      const taxableBase = this.calculateTaxableBase(opts, rule.taxableComponents);
      return {
        taxRuleId: rule.id,
        taxRuleVersion: rule.version,
        taxName: rule.name,
        taxType: rule.taxType,
        calculationMethod: rule.calculationMethod,
        rate: rule.rate,
        amount: rule.amount,
        taxableBase,
        taxAmount: 0,
        currency,
        remittanceResponsibility: rule.remittanceResponsibility,
        isInclusive: rule.isInclusive,
        isExempt: true,
        exemptionReason: `Exempt for extended stays of ${rule.longStayExemptionNights}+ nights`,
      };
    }

    // Calculate Tax Amount
    const taxableBase = this.calculateTaxableBase(opts, rule.taxableComponents);
    const taxAmount = this.computeAmount({
      method: rule.calculationMethod,
      rate: rule.rate,
      fixedAmount: rule.amount,
      taxableBase,
      nights,
      guests,
    });

    return {
      taxRuleId: rule.id,
      taxRuleVersion: rule.version,
      taxName: rule.name,
      taxType: rule.taxType,
      calculationMethod: rule.calculationMethod,
      rate: rule.rate,
      amount: rule.amount,
      taxableBase,
      taxAmount,
      currency,
      remittanceResponsibility: rule.remittanceResponsibility,
      isInclusive: rule.isInclusive,
      isExempt: false,
    };
  }

  /**
   * Evaluates a host-configured ListingTax.
   */
  private static evaluateHostTax(opts: {
    hostTax: ListingTaxDTO;
    nights: number;
    guests: number;
    accommodationSubtotal: number;
    cleaningFee: number;
    petFee: number;
    extraGuestFee: number;
    currency: string;
  }): CalculatedTaxItem {
    const { hostTax, nights, guests, currency } = opts;

    // Check Long-Stay Exemption
    if (
      hostTax.longStayExemptionNights &&
      nights >= hostTax.longStayExemptionNights
    ) {
      const taxableBase = this.calculateTaxableBase(opts, hostTax.taxableComponents);
      return {
        id: hostTax.id,
        taxRuleVersion: 1,
        taxName: hostTax.customName || this.getDefaultTaxName(hostTax.taxType),
        taxType: hostTax.taxType,
        calculationMethod: hostTax.calculationMethod,
        rate: hostTax.rate,
        amount: hostTax.amount,
        taxableBase,
        taxAmount: 0,
        currency,
        remittanceResponsibility: hostTax.remittanceResponsibility,
        isInclusive: false,
        isExempt: true,
        exemptionReason: `Exempt for extended stays of ${hostTax.longStayExemptionNights}+ nights`,
      };
    }

    const taxableBase = this.calculateTaxableBase(opts, hostTax.taxableComponents);
    const taxAmount = this.computeAmount({
      method: hostTax.calculationMethod,
      rate: hostTax.rate,
      fixedAmount: hostTax.amount,
      taxableBase,
      nights,
      guests,
    });

    return {
      id: hostTax.id,
      taxRuleVersion: 1,
      taxName: hostTax.customName || this.getDefaultTaxName(hostTax.taxType),
      taxType: hostTax.taxType,
      calculationMethod: hostTax.calculationMethod,
      rate: hostTax.rate,
      amount: hostTax.amount,
      taxableBase,
      taxAmount,
      currency,
      remittanceResponsibility: hostTax.remittanceResponsibility,
      isInclusive: false,
      isExempt: false,
    };
  }

  /**
   * Sums the taxable components according to the rule configuration.
   */
  private static calculateTaxableBase(
    amounts: {
      accommodationSubtotal: number;
      cleaningFee: number;
      petFee: number;
      extraGuestFee: number;
    },
    components: string[]
  ): number {
    let base = 0;
    const set = new Set(components);

    if (set.has("BASE_PRICE")) {
      base += amounts.accommodationSubtotal;
    }
    if (set.has("CLEANING_FEE")) {
      base += amounts.cleaningFee;
    }
    if (set.has("PET_FEE")) {
      base += amounts.petFee;
    }
    if (set.has("GUEST_FEE")) {
      base += amounts.extraGuestFee;
    }

    return base;
  }

  /**
   * Computes the calculated tax amount in minor units (cents) with deterministic rounding.
   */
  private static computeAmount(opts: {
    method: TaxRuleDTO["calculationMethod"];
    rate: number | null;
    fixedAmount: number | null;
    taxableBase: number;
    nights: number;
    guests: number;
  }): number {
    const { method, rate, fixedAmount, taxableBase, nights, guests } = opts;

    switch (method) {
      case "PERCENTAGE": {
        const percentage = Math.max(0, rate ?? 0);
        return Math.round((taxableBase * percentage) / 100);
      }
      case "FLAT_PER_BOOKING": {
        return Math.max(0, fixedAmount ?? 0);
      }
      case "AMOUNT_PER_NIGHT": {
        return Math.max(0, fixedAmount ?? 0) * nights;
      }
      case "AMOUNT_PER_GUEST": {
        return Math.max(0, fixedAmount ?? 0) * guests;
      }
      case "AMOUNT_PER_GUEST_PER_NIGHT": {
        return Math.max(0, fixedAmount ?? 0) * guests * nights;
      }
      default:
        return 0;
    }
  }

  private static getDefaultTaxName(type: TaxType): string {
    switch (type) {
      case "VAT":
        return "Value-Added Tax (VAT)";
      case "GST":
        return "Goods and Services Tax (GST)";
      case "TOURIST_TAX":
        return "City Tourist Tax";
      case "OCCUPANCY_TAX":
        return "Transient Occupancy Tax";
      case "LODGING_TAX":
        return "Lodging Tax";
      case "SALES_TAX":
        return "Sales Tax";
      case "CITY_TAX":
        return "Municipal Accommodation Tax";
      default:
        return "Local Accommodation Tax";
    }
  }
}

