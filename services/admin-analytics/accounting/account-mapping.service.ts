import { AppError } from "@/lib/api/errors";
import type { AccountingProvider } from "./accounting-contracts";

export type HomyzLedgerRole =
  | "OPERATING_BANK"
  | "GATEWAY_CLEARING"
  | "ACCOUNTS_RECEIVABLE"
  | "HOST_PAYOUT_LIABILITY"
  | "TAX_PAYABLE"
  | "PLATFORM_COMMISSION"
  | "GATEWAY_FEE_EXPENSE"
  | "REFUND_EXPENSE";

export type AllowedAccountCategory = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | "BANK";

export interface HomyzRoleDefinition {
  role: HomyzLedgerRole;
  defaultCode: string;
  defaultName: string;
  requiredCategory: AllowedAccountCategory;
  normalBalance: "DEBIT" | "CREDIT";
  description: string;
}

export const HOMYZ_LEDGER_ROLES: Record<HomyzLedgerRole, HomyzRoleDefinition> = {
  OPERATING_BANK: {
    role: "OPERATING_BANK",
    defaultCode: "1010",
    defaultName: "Operating Cash / Bank Account (SARIE Rail)",
    requiredCategory: "ASSET",
    normalBalance: "DEBIT",
    description: "Primary corporate settlement account holding cleared marketplace liquidity",
  },
  GATEWAY_CLEARING: {
    role: "GATEWAY_CLEARING",
    defaultCode: "1020",
    defaultName: "Payment Gateway In-Transit Clearing",
    requiredCategory: "ASSET",
    normalBalance: "DEBIT",
    description: "In-transit captured funds awaiting multi-day gateway settlement sweep",
  },
  ACCOUNTS_RECEIVABLE: {
    role: "ACCOUNTS_RECEIVABLE",
    defaultCode: "1030",
    defaultName: "Guest Accounts Receivable",
    requiredCategory: "ASSET",
    normalBalance: "DEBIT",
    description: "Committed reservations pending gateway payment capture",
  },
  HOST_PAYOUT_LIABILITY: {
    role: "HOST_PAYOUT_LIABILITY",
    defaultCode: "2010",
    defaultName: "Host Payout Obligations Payable",
    requiredCategory: "LIABILITY",
    normalBalance: "CREDIT",
    description: "Net accommodation and cleaning obligations owed to primary and co-hosts",
  },
  TAX_PAYABLE: {
    role: "TAX_PAYABLE",
    defaultCode: "2030",
    defaultName: "Hospitality & VAT Tax Payable",
    requiredCategory: "LIABILITY",
    normalBalance: "CREDIT",
    description: "VAT (15%) and municipal tourism fees owed to ZATCA",
  },
  PLATFORM_COMMISSION: {
    role: "PLATFORM_COMMISSION",
    defaultCode: "4010",
    defaultName: "Platform Marketplace Commission Revenue",
    requiredCategory: "REVENUE",
    normalBalance: "CREDIT",
    description: "Net marketplace service fees and guest commission earnings",
  },
  GATEWAY_FEE_EXPENSE: {
    role: "GATEWAY_FEE_EXPENSE",
    defaultCode: "5010",
    defaultName: "Merchant Processing & Gateway Interchange Fees",
    requiredCategory: "EXPENSE",
    normalBalance: "DEBIT",
    description: "Interchange and payment gateway per-transaction fees deducted at source",
  },
  REFUND_EXPENSE: {
    role: "REFUND_EXPENSE",
    defaultCode: "5020",
    defaultName: "Guest Cancellation Refund Losses",
    requiredCategory: "EXPENSE",
    normalBalance: "DEBIT",
    description: "Disputed chargeback allowances and unrecovered guest refund expense",
  },
};

export interface ProviderAccountDescriptor {
  id: string;
  code: string;
  name: string;
  category: AllowedAccountCategory;
  currency?: string;
  isActive: boolean;
}

export interface TenantAccountMapping {
  id: string;
  mappingId?: string;
  tenantId: string; // Tenant / Organization ID
  provider: AccountingProvider;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  mappings: any;
  activatedAt?: string | null;
  createdByActorId: string;
  createdAt: string;
  updatedAt: string;
}

// Multi-tenant isolated storage for Chart of Accounts mappings (keyed by mappingId)
const tenantMappingStore = new Map<string, TenantAccountMapping>();

export const erpAccountMappingService = {
  /**
   * Retrieves all 8 canonical ledger roles for display and mapping UI
   */
  getSupportedLedgerRoles(): Array<{
    roleCode: string;
    role: HomyzLedgerRole;
    name: string;
    category: AllowedAccountCategory;
  }> {
    return Object.values(HOMYZ_LEDGER_ROLES).map((def) => ({
      roleCode: def.defaultCode,
      role: def.role,
      name: def.defaultName,
      category: def.requiredCategory,
    }));
  },

  /**
   * Retrieves active mapping configuration for an isolated tenant organization.
   */
  async getActiveMapping(tenantId: string, provider: AccountingProvider): Promise<TenantAccountMapping | null> {
    const list = Array.from(tenantMappingStore.values()).filter(
      (m) => m.tenantId === tenantId && m.provider === provider && m.status === "ACTIVE"
    );
    if (list.length === 0) return null;
    return list.sort((a, b) => b.version - a.version)[0];
  },

  /**
   * Retrieves all mapping versions for a tenant.
   */
  async listMappingVersions(tenantId: string, provider: AccountingProvider): Promise<TenantAccountMapping[]> {
    return Array.from(tenantMappingStore.values())
      .filter((m) => m.tenantId === tenantId && m.provider === provider)
      .sort((a, b) => b.version - a.version);
  },

  /**
   * Creates a draft mapping configuration for a tenant.
   */
  createDraftMapping(
    tenantIdOrParams: string | { tenantId: string; provider: AccountingProvider; actorId: string; initialMappings?: any },
    provider?: AccountingProvider,
    customMappingsList?: any[],
    actorId?: string
  ): TenantAccountMapping {
    let tenantId: string;
    let prov: AccountingProvider;
    let actor: string;
    let listInput: any = customMappingsList;

    if (typeof tenantIdOrParams === "object") {
      tenantId = tenantIdOrParams.tenantId;
      prov = tenantIdOrParams.provider;
      actor = tenantIdOrParams.actorId;
      listInput = tenantIdOrParams.initialMappings;
    } else {
      tenantId = tenantIdOrParams;
      prov = provider!;
      actor = actorId || "admin";
    }

    const versions = Array.from(tenantMappingStore.values()).filter(
      (m) => m.tenantId === tenantId && m.provider === prov
    );
    const nextVersion = versions.length > 0 ? versions.length + 1 : 1;

    // Check custom mappings array vs object
    const mappings: any = {};
    const rolesList = Object.values(HOMYZ_LEDGER_ROLES);

    if (Array.isArray(listInput)) {
      for (const item of listInput) {
        const matchingDef = rolesList.find((r) => r.defaultCode === item.roleCode || r.role === item.role);
        if (matchingDef) {
          // Compatibility validation:
          const isCategoryCompatible =
            (matchingDef.requiredCategory === "ASSET" && (item.externalAccountCategory === "ASSET" || item.externalAccountCategory === "BANK")) ||
            (matchingDef.requiredCategory === item.externalAccountCategory);

          if (!isCategoryCompatible) {
            throw new Error(
              `Category mismatch: Ledger role ${matchingDef.defaultCode} (${matchingDef.role}) requires category ${matchingDef.requiredCategory}, received ${item.externalAccountCategory}`
            );
          }

          mappings[matchingDef.role] = {
            roleCode: matchingDef.defaultCode,
            role: matchingDef.role,
            providerAccountId: item.externalAccountId,
            providerAccountCode: item.roleCode || matchingDef.defaultCode,
            providerAccountName: item.externalAccountName,
            providerAccountCategory: item.externalAccountCategory,
          };
        }
      }
    } else if (listInput) {
      Object.assign(mappings, listInput);
    }

    // Fill in defaults for missing roles
    for (const def of rolesList) {
      if (!mappings[def.role]) {
        mappings[def.role] = {
          roleCode: def.defaultCode,
          role: def.role,
          providerAccountId: `acc_${def.defaultCode}`,
          providerAccountCode: def.defaultCode,
          providerAccountName: def.defaultName,
          providerAccountCategory: def.requiredCategory,
        };
      }
    }

    const mappingId = `map_${prov.toLowerCase()}_${tenantId}_v${nextVersion}`;
    const draft: TenantAccountMapping = {
      id: mappingId,
      mappingId,
      tenantId,
      provider: prov,
      version: nextVersion,
      status: "DRAFT",
      mappings: Array.isArray(listInput) ? Object.values(mappings) : mappings,
      activatedAt: null,
      createdByActorId: actor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tenantMappingStore.set(mappingId, draft);
    return draft;
  },

  /**
   * Validates account mapping compatibility against provider catalog rules.
   */
  validateMapping(mapping: TenantAccountMapping, availableAccounts?: ProviderAccountDescriptor[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const mappedCodes = new Set<string>();

    const mappingValues = Array.isArray(mapping.mappings) ? mapping.mappings : Object.values(mapping.mappings);

    for (const def of Object.values(HOMYZ_LEDGER_ROLES)) {
      const mapped = mappingValues.find((m: any) => m.roleCode === def.defaultCode || m.role === def.role);

      if (!mapped || !mapped.providerAccountId) {
        errors.push(`Mandatory ledger role '${def.role}' is not mapped to any provider account.`);
        continue;
      }

      // Check category compatibility
      const isCompat =
        (def.requiredCategory === "ASSET" && (mapped.providerAccountCategory === "ASSET" || mapped.providerAccountCategory === "BANK")) ||
        (mapped.providerAccountCategory === def.requiredCategory);

      if (!isCompat) {
        errors.push(
          `Incompatible mapping for '${def.role}': requires category '${def.requiredCategory}', but mapped to '${mapped.providerAccountCategory}'.`
        );
      }

      if (mappedCodes.has(mapped.providerAccountCode)) {
        warnings.push(`Provider account code '${mapped.providerAccountCode}' is mapped to multiple ledger roles.`);
      }
      mappedCodes.add(mapped.providerAccountCode);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Activates a draft mapping configuration after verifying zero validation errors.
   * Archives any previously active mapping for that tenant.
   */
  activateMapping(
    mappingId: string,
    tenantIdOrAccounts?: string | ProviderAccountDescriptor[],
    maybeAvailableAccounts?: ProviderAccountDescriptor[]
  ): TenantAccountMapping {
    const target = tenantMappingStore.get(mappingId);
    if (!target) {
      throw AppError.notFound(`Account mapping ${mappingId} not found.`);
    }

    const tenantId = typeof tenantIdOrAccounts === "string" ? tenantIdOrAccounts : undefined;
    const availableAccounts = Array.isArray(tenantIdOrAccounts) ? tenantIdOrAccounts : maybeAvailableAccounts;

    if (tenantId && target.tenantId !== tenantId) {
      throw new Error(`Forbidden: Mapping does not belong to tenant ${tenantId}`);
    }

    const validation = this.validateMapping(target, availableAccounts);
    if (!validation.isValid) {
      throw AppError.badRequest(
        `Cannot activate account mapping due to validation errors: ${validation.errors.join("; ")}`
      );
    }

    // Archive current active mapping for this tenant
    for (const [id, m] of tenantMappingStore.entries()) {
      if (m.tenantId === target.tenantId && m.provider === target.provider && m.status === "ACTIVE") {
        m.status = "ARCHIVED";
        m.updatedAt = new Date().toISOString();
        tenantMappingStore.set(id, m);
      }
    }

    target.status = "ACTIVE";
    target.activatedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    tenantMappingStore.set(mappingId, target);

    return target;
  },
};
