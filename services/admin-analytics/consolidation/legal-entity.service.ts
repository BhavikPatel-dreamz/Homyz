import type { LegalEntity } from "./consolidation-contracts";

export class LegalEntityService {
  private static instance: LegalEntityService;
  private entities: Map<string, LegalEntity> = new Map();

  private constructor() {
    this.seedDefaultEntities();
  }

  public static getInstance(): LegalEntityService {
    if (!LegalEntityService.instance) {
      LegalEntityService.instance = new LegalEntityService();
    }
    return LegalEntityService.instance;
  }

  private seedDefaultEntities(): void {
    const parentGlobal: LegalEntity = {
      entityId: "HOMYZ_GLOBAL_INC",
      legalName: "Homyz Global Technologies Inc.",
      countryCode: "US",
      functionalCurrency: "USD",
      parentEntityId: null,
      taxRegistrationNumber: "US-EIN-94-3829104",
      erpProvider: "QUICKBOOKS",
      erpTenantId: "tenant_homyz_global",
      status: "ACTIVE",
    };

    const subSaudi: LegalEntity = {
      entityId: "HOMYZ_SA_LTD",
      legalName: "Homyz Arabia Commercial Brokerage LLC",
      countryCode: "SA",
      functionalCurrency: "SAR",
      parentEntityId: "HOMYZ_GLOBAL_INC",
      taxRegistrationNumber: "310492819200003", // 15-digit ZATCA VAT number
      erpProvider: "QUICKBOOKS",
      erpTenantId: "tenant_homyz_saudi",
      status: "ACTIVE",
    };

    const subUK: LegalEntity = {
      entityId: "HOMYZ_UK_LTD",
      legalName: "Homyz UK Property Services Ltd",
      countryCode: "GB",
      functionalCurrency: "GBP",
      parentEntityId: "HOMYZ_GLOBAL_INC",
      taxRegistrationNumber: "GB-948-2019-34",
      erpProvider: "XERO",
      erpTenantId: "tenant_homyz_uk",
      status: "ACTIVE",
    };

    this.entities.set(parentGlobal.entityId, parentGlobal);
    this.entities.set(subSaudi.entityId, subSaudi);
    this.entities.set(subUK.entityId, subUK);
  }

  public listEntities(): LegalEntity[] {
    return Array.from(this.entities.values());
  }

  public getEntityById(entityId: string): LegalEntity | null {
    return this.entities.get(entityId) || null;
  }

  public registerEntity(entity: LegalEntity): LegalEntity {
    this.entities.set(entity.entityId, entity);
    return entity;
  }

  /**
   * Enforces legal entity data isolation:
   * SUPER_ADMIN or GLOBAL_FINANCE can access all entities.
   * Scoped entity finance managers can only access their assigned entity.
   */
  public verifyEntityAccess(
    actorRole: string,
    actorAssignedEntityId: string | null | undefined,
    targetEntityId: string
  ): boolean {
    if (actorRole === "SUPER_ADMIN" || actorRole === "ADMIN" || actorRole === "GLOBAL_FINANCE") {
      return true;
    }
    if (!actorAssignedEntityId) return false;
    return actorAssignedEntityId === targetEntityId;
  }
}

export const legalEntityService = LegalEntityService.getInstance();

