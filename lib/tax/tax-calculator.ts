import type {
  CalculatedTaxItem,
  HostPayoutBreakdown,
  ListingTaxDTO,
  TaxCalculationMethod,
  TaxCalculationParams,
  TaxCalculationResult,
  TaxType,
  TaxZeroReason,
  TaxableComponent,
} from "./types";

type TaxableAmounts = {
  accommodationSubtotal: number;
  petFee: number;
  extraGuestFee: number;
  feeAmounts: Partial<Record<TaxableComponent, number>>;
};

type TaxEvaluation = {
  taxId?: string;
  taxRuleId?: string | null;
  taxRuleVersion: number;
  taxName: string;
  taxType: TaxType;
  calculationMethod: TaxCalculationMethod;
  rate: number | null;
  amount: number | null;
  taxableComponents: string[];
  remittanceResponsibility: CalculatedTaxItem["remittanceResponsibility"];
  isInclusive: boolean;
  nights: number;
  guests: number;
  currency: string;
  amounts: TaxableAmounts;
  nightlyRatePrefix: number[];
  partialStayExemptionNights?: number | null;
  fullStayExemptionNights?: number | null;
  maximumAmountPerPersonPerNight?: number | null;
};

/** Adults and children are taxable guests. Infants and pets are excluded. */
export function getTaxableGuestCount(input: { guests?: number; infants?: number; pets?: number }): number {
  return Math.max(1, Math.trunc(input.guests ?? 1));
}

/** Deterministic server-side tax engine. Money remains in minor units. */
export class TaxCalculator {
  static calculateTaxes(params: TaxCalculationParams): TaxCalculationResult {
    const nights = Math.max(1, Math.trunc(params.nights));
    const guests = getTaxableGuestCount({ guests: params.guests });
    const currency = params.currency || "SAR";
    const nightlySubtotal = Math.max(0, Math.round(params.nightlySubtotal));
    const discountAmount = Math.max(0, Math.round(params.discountAmount ?? 0));
    const accommodationSubtotal = Math.max(0, nightlySubtotal - discountAmount);
    const petFee = Math.max(0, Math.round(params.petFee ?? 0));
    const extraGuestFee = Math.max(0, Math.round(params.extraGuestFee ?? 0));
    const nightlyRates = this.normalizeNightlyRates(params.nightlyRates, nights, nightlySubtotal);
    const nightlyRatePrefix = this.buildPrefixSums(nightlyRates);
    const amounts: TaxableAmounts = {
      accommodationSubtotal,
      petFee,
      extraGuestFee,
      feeAmounts: params.feeAmounts || {},
    };

    const calculatedTaxes: CalculatedTaxItem[] = [];
    const platformManagedTaxTypes = new Set<TaxType>();

    for (const rule of (params.rules || []).filter((item) => item.isActive)) {
      calculatedTaxes.push(this.evaluate({
        taxRuleId: rule.id,
        taxRuleVersion: rule.version,
        taxName: rule.name,
        taxType: rule.taxType,
        calculationMethod: rule.calculationMethod,
        rate: rule.rate,
        amount: rule.amount,
        taxableComponents: rule.taxableComponents,
        remittanceResponsibility: rule.remittanceResponsibility,
        isInclusive: rule.isInclusive,
        nights,
        guests,
        currency,
        amounts,
        nightlyRatePrefix,
        fullStayExemptionNights: rule.longStayExemptionNights,
      }));
      platformManagedTaxTypes.add(rule.taxType);
    }

    const seenHostTaxIds = new Set<string>();
    for (const hostTax of (params.hostTaxes || []).filter((item) => item.isActive)) {
      if (seenHostTaxIds.has(hostTax.id) || platformManagedTaxTypes.has(hostTax.taxType)) continue;
      seenHostTaxIds.add(hostTax.id);
      calculatedTaxes.push(this.evaluateHostTax(hostTax, {
        nights,
        guests,
        currency,
        amounts,
        nightlyRatePrefix,
      }));
    }

    let taxTotal = 0;
    let platformRemittedTaxTotal = 0;
    let hostRemittedTaxTotal = 0;
    for (const item of calculatedTaxes) {
      taxTotal += item.taxAmount;
      if (item.remittanceResponsibility === "PLATFORM") platformRemittedTaxTotal += item.taxAmount;
      else hostRemittedTaxTotal += item.taxAmount;
    }

    const hasExplicitHostFee = params.hostServiceFee !== undefined
      || params.hostServiceFeePercentage !== undefined;
    const hostServiceFeePercentage = params.hostServiceFeePercentage
      ?? (hasExplicitHostFee ? 15 : 3);
    const hostServiceFee = params.hostServiceFee !== undefined
      ? Math.max(0, Math.round(params.hostServiceFee))
      : Math.round(accommodationSubtotal * (hostServiceFeePercentage / 100));
    const netHostPayout = accommodationSubtotal + petFee + extraGuestFee
      + hostRemittedTaxTotal - hostServiceFee;

    const payoutBreakdown: HostPayoutBreakdown = {
      accommodationSubtotal,
      petFee,
      taxesCollectedForHost: hostRemittedTaxTotal,
      taxesRemittedByPlatform: platformRemittedTaxTotal,
      platformServiceFee: hostServiceFee,
      hostServiceFee,
      netHostPayout: Math.max(0, netHostPayout),
      currency,
    };

    return {
      taxes: calculatedTaxes,
      taxTotal,
      platformRemittedTaxTotal,
      hostRemittedTaxTotal,
      hostServiceFee,
      hostServiceFeePercentage,
      guestTotal: accommodationSubtotal + petFee + extraGuestFee + taxTotal,
      payoutBreakdown,
      currency,
    };
  }

  private static evaluateHostTax(
    hostTax: ListingTaxDTO,
    shared: Pick<TaxEvaluation, "nights" | "guests" | "currency" | "amounts" | "nightlyRatePrefix">,
  ): CalculatedTaxItem {
    return this.evaluate({
      ...shared,
      taxId: hostTax.id,
      taxRuleId: hostTax.taxRuleId,
      taxRuleVersion: 1,
      taxName: hostTax.customName || this.getDefaultTaxName(hostTax.taxType),
      taxType: hostTax.taxType,
      calculationMethod: hostTax.calculationMethod,
      rate: hostTax.rate,
      amount: hostTax.amount,
      taxableComponents: hostTax.taxableComponents,
      remittanceResponsibility: hostTax.remittanceResponsibility,
      isInclusive: false,
      partialStayExemptionNights: hostTax.partialStayExemptionNights,
      // Legacy long-stay values are read only when the explicit full-stay
      // field is absent. New form writes clear the legacy alias.
      fullStayExemptionNights:
        hostTax.fullStayExemptionNights ?? hostTax.longStayExemptionNights,
      maximumAmountPerPersonPerNight: hostTax.maximumAmountPerPersonPerNight,
    });
  }

  private static evaluate(opts: TaxEvaluation): CalculatedTaxItem {
    const fullTaxableBase = this.calculateTaxableBase(opts.amounts, opts.taxableComponents);
    const grossTax = this.computeAmount({
      method: opts.calculationMethod,
      rate: opts.rate,
      fixedAmount: opts.amount,
      taxableBase: fullTaxableBase,
      nights: opts.nights,
      guests: opts.guests,
    });

    const fullThreshold = this.positiveInteger(opts.fullStayExemptionNights);
    if (fullThreshold !== null && opts.nights >= fullThreshold) {
      return this.toCalculatedItem(opts, {
        taxableBaseBeforeExemption: fullTaxableBase,
        taxableBase: fullTaxableBase,
        taxableNights: 0,
        exemptNights: opts.nights,
        grossTax,
        exemptionAmount: grossTax,
        capAdjustment: 0,
        finalTax: 0,
        exemptionApplied: true,
        exemptionReason: `Entire stay exempt at ${fullThreshold}+ ${fullThreshold === 1 ? "night" : "nights"}`,
        zeroReason: "EXEMPTION_APPLIED",
      });
    }

    const partialThreshold = this.supportsPartialExemption(opts.calculationMethod)
      ? this.positiveInteger(opts.partialStayExemptionNights)
      : null;
    const taxableNights = partialThreshold === null
      ? opts.nights
      : Math.min(opts.nights, partialThreshold);
    const exemptNights = Math.max(0, opts.nights - taxableNights);
    const exemptionApplied = exemptNights > 0;
    const taxableAmounts = exemptionApplied ? this.prorateAmounts(opts, taxableNights) : opts.amounts;
    const taxableBase = this.calculateTaxableBase(taxableAmounts, opts.taxableComponents);
    const taxAfterExemption = this.computeAmount({
      method: opts.calculationMethod,
      rate: opts.rate,
      fixedAmount: opts.amount,
      taxableBase,
      nights: taxableNights,
      guests: opts.guests,
    });

    const cap = this.positiveInteger(opts.maximumAmountPerPersonPerNight);
    const capApplies = cap !== null && this.supportsPerPersonPerNightCap(opts.calculationMethod);
    const cappedTax = capApplies
      ? Math.min(taxAfterExemption, cap * opts.guests * taxableNights)
      : taxAfterExemption;
    const exemptionAmount = Math.max(0, grossTax - taxAfterExemption);
    const capAdjustment = Math.max(0, taxAfterExemption - cappedTax);
    const exemptionReason = exemptionApplied
      ? `Tax applies to first ${taxableNights} of ${opts.nights} nights; ${exemptNights} ${exemptNights === 1 ? "night" : "nights"} exempt`
      : undefined;
    const zeroReason = this.getZeroReason({
      finalTax: cappedTax,
      taxableBase,
      taxableNights,
      exemptionApplied,
      grossTax,
    });

    return this.toCalculatedItem(opts, {
      taxableBaseBeforeExemption: fullTaxableBase,
      taxableBase,
      taxableNights,
      exemptNights,
      grossTax,
      exemptionAmount,
      capAdjustment,
      finalTax: cappedTax,
      exemptionApplied,
      exemptionReason,
      zeroReason,
    });
  }

  private static toCalculatedItem(
    opts: TaxEvaluation,
    result: {
      taxableBaseBeforeExemption: number;
      taxableBase: number;
      taxableNights: number;
      exemptNights: number;
      grossTax: number;
      exemptionAmount: number;
      capAdjustment: number;
      finalTax: number;
      exemptionApplied: boolean;
      exemptionReason?: string;
      zeroReason?: TaxZeroReason;
    },
  ): CalculatedTaxItem {
    return {
      ...(opts.taxId ? { id: opts.taxId, taxId: opts.taxId } : {}),
      taxRuleId: opts.taxRuleId,
      taxRuleVersion: opts.taxRuleVersion,
      taxName: opts.taxName,
      taxType: opts.taxType,
      calculationMethod: opts.calculationMethod,
      rate: opts.rate,
      amount: opts.amount,
      taxableBaseBeforeExemption: result.taxableBaseBeforeExemption,
      taxableBase: result.taxableBase,
      taxableNights: result.taxableNights,
      exemptNights: result.exemptNights,
      taxableGuests: opts.guests,
      grossTax: result.grossTax,
      exemptionAmount: result.exemptionAmount,
      capAdjustment: result.capAdjustment,
      finalTax: result.finalTax,
      taxAmount: result.finalTax,
      currency: opts.currency,
      remittanceResponsibility: opts.remittanceResponsibility,
      isInclusive: opts.isInclusive,
      isExempt: result.finalTax === 0 && result.exemptionApplied,
      exemptionApplied: result.exemptionApplied,
      ...(result.exemptionReason ? { exemptionReason: result.exemptionReason } : {}),
      ...(result.zeroReason ? { zeroReason: result.zeroReason } : {}),
    };
  }

  private static prorateAmounts(opts: TaxEvaluation, taxableNights: number): TaxableAmounts {
    const ratio = opts.nights > 0 ? taxableNights / opts.nights : 0;
    const totalNightlyRates = opts.nightlyRatePrefix[opts.nights] ?? 0;
    const taxableNightlyRates = opts.nightlyRatePrefix[taxableNights] ?? 0;
    const accommodationSubtotal = totalNightlyRates > 0
      ? Math.round(opts.amounts.accommodationSubtotal * (taxableNightlyRates / totalNightlyRates))
      : Math.round(opts.amounts.accommodationSubtotal * ratio);
    const feeAmounts = Object.fromEntries(
      Object.entries(opts.amounts.feeAmounts).map(([key, amount]) => [
        key,
        Math.round(Math.max(0, amount ?? 0) * ratio),
      ]),
    ) as Partial<Record<TaxableComponent, number>>;
    return {
      accommodationSubtotal,
      petFee: Math.round(opts.amounts.petFee * ratio),
      extraGuestFee: Math.round(opts.amounts.extraGuestFee * ratio),
      feeAmounts,
    };
  }

  private static calculateTaxableBase(amounts: TaxableAmounts, components: string[]): number {
    let base = 0;
    for (const component of new Set(components)) {
      switch (component) {
        case "BASE_PRICE": base += amounts.accommodationSubtotal; break;
        case "PET_FEE": base += amounts.petFee; break;
        case "GUEST_FEE": base += amounts.extraGuestFee; break;
        case "MANAGEMENT_FEE":
        case "COMMUNITY_FEE":
        case "LINEN_FEE":
        case "RESORT_FEE":
          base += Math.max(0, Math.round(amounts.feeAmounts[component] ?? 0));
          break;
        default: break; // Includes retired CLEANING_FEE selections.
      }
    }
    return base;
  }

  private static computeAmount(opts: {
    method: TaxCalculationMethod;
    rate: number | null;
    fixedAmount: number | null;
    taxableBase: number;
    nights: number;
    guests: number;
  }): number {
    const fixedAmount = Math.max(0, Math.round(opts.fixedAmount ?? 0));
    switch (opts.method) {
      case "PERCENTAGE": return Math.round((opts.taxableBase * Math.max(0, opts.rate ?? 0)) / 100);
      case "FLAT_PER_BOOKING": return opts.nights > 0 ? fixedAmount : 0;
      case "AMOUNT_PER_NIGHT": return fixedAmount * opts.nights;
      case "AMOUNT_PER_GUEST": return opts.nights > 0 ? fixedAmount * opts.guests : 0;
      case "AMOUNT_PER_GUEST_PER_NIGHT": return fixedAmount * opts.guests * opts.nights;
      default: return 0;
    }
  }

  private static normalizeNightlyRates(rates: number[] | undefined, nights: number, subtotal: number): number[] {
    if (rates && rates.length === nights && rates.every(Number.isFinite)) {
      return rates.map((amount) => Math.max(0, Math.round(amount)));
    }
    const base = Math.floor(subtotal / nights);
    const remainder = subtotal - base * nights;
    return Array.from({ length: nights }, (_, index) => base + (index < remainder ? 1 : 0));
  }

  private static buildPrefixSums(rates: number[]): number[] {
    const prefix = [0];
    for (const amount of rates) prefix.push(prefix[prefix.length - 1] + amount);
    return prefix;
  }

  private static positiveInteger(value: number | null | undefined): number | null {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
  }

  private static supportsPartialExemption(method: TaxCalculationMethod): boolean {
    return method === "PERCENTAGE" || method === "AMOUNT_PER_NIGHT"
      || method === "AMOUNT_PER_GUEST_PER_NIGHT";
  }

  private static supportsPerPersonPerNightCap(method: TaxCalculationMethod): boolean {
    return method === "PERCENTAGE" || method === "AMOUNT_PER_GUEST_PER_NIGHT";
  }

  private static getZeroReason(input: {
    finalTax: number;
    taxableBase: number;
    taxableNights: number;
    exemptionApplied: boolean;
    grossTax: number;
  }): TaxZeroReason | undefined {
    if (input.finalTax !== 0) return undefined;
    if (input.exemptionApplied) return "EXEMPTION_APPLIED";
    if (input.taxableNights === 0) return "NO_TAXABLE_NIGHTS";
    if (input.taxableBase === 0) return "NO_TAXABLE_BASE";
    if (input.grossTax === 0) return "RATE_ZERO";
    return undefined;
  }

  private static getDefaultTaxName(type: TaxType): string {
    switch (type) {
      case "VAT": return "Value-Added Tax (VAT)";
      case "GST": return "Goods and Services Tax (GST)";
      case "TOURIST_TAX": return "City Tourist Tax";
      case "OCCUPANCY_TAX": return "Transient Occupancy Tax";
      case "LODGING_TAX": return "Lodging Tax";
      case "SALES_TAX": return "Sales Tax";
      case "CITY_TAX": return "Municipal Accommodation Tax";
      default: return "Local Accommodation Tax";
    }
  }
}
