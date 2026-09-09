"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import { Role } from "@/generated/prisma/enums";
import {
  createHostTaxSchema,
  saveTaxRegistrationSchema,
  taxPreviewInputSchema,
  taxReportFilterSchema,
  updateHostTaxSchema,
} from "@/lib/validation/tax";
import { taxService } from "@/services/tax.service";

export async function getListingTaxOverviewAction(listingId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    return await taxService.getListingTaxOverview(actor, listingId);
  });
}

export async function createHostTaxAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const data = createHostTaxSchema.parse(input);
    const result = await taxService.createHostTax(actor, data);
    revalidatePath(`/host/listings/${data.listingId}`);
    return result;
  });
}

export async function updateHostTaxAction(
  listingId: string,
  taxId: string,
  input: unknown
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const data = updateHostTaxSchema.parse(input);
    const result = await taxService.updateHostTax(actor, listingId, taxId, data);
    revalidatePath(`/host/listings/${listingId}`);
    return result;
  });
}

export async function deleteHostTaxAction(listingId: string, taxId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const result = await taxService.deleteHostTax(actor, listingId, taxId);
    revalidatePath(`/host/listings/${listingId}`);
    return result;
  });
}

export async function saveTaxRegistrationAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const data = saveTaxRegistrationSchema.parse(input);
    return await taxService.saveTaxRegistration(actor, data);
  });
}

export async function simulateTaxPreviewAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const data = taxPreviewInputSchema.parse(input);
    return await taxService.simulateTaxPreview(data);
  });
}

export async function getTaxReportAction(filters: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const data = taxReportFilterSchema.parse(filters);
    return await taxService.getTaxReport(actor, data);
  });
}

export async function generateTaxInvoiceAction(bookingId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    return await taxService.generateTaxInvoice(actor, bookingId);
  });
}

