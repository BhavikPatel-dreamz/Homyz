"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import { Role } from "@/generated/prisma/enums";
import {
  createGuidebookSchema,
  updateGuidebookSchema,
  createGuidebookItemSchema,
  updateGuidebookItemSchema,
  reorderGuidebookItemsSchema,
  setGuidebookListingsSchema,
} from "@/lib/validation/guidebook";
import { guidebookService } from "@/services/guidebook.service";

export async function getGuidebooksAction() {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    return await guidebookService.getGuidebooksForHost(actor);
  });
}

export async function getGuidebookByIdAction(id: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    return await guidebookService.getGuidebookById(actor, id);
  });
}

export async function createGuidebookAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const data = createGuidebookSchema.parse(input);
    const guidebook = await guidebookService.create(actor, data);
    revalidatePath("/host/listings");
    revalidatePath(`/guidebooks/${guidebook.id}`);
    return guidebook;
  });
}

export async function updateGuidebookAction(id: string, input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const data = updateGuidebookSchema.parse(input);
    const guidebook = await guidebookService.update(actor, id, data);
    revalidatePath("/host/listings");
    revalidatePath(`/guidebooks/${id}`);
    return guidebook;
  });
}

export async function deleteGuidebookAction(id: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const result = await guidebookService.remove(actor, id);
    revalidatePath("/host/listings");
    return result;
  });
}

export async function addGuidebookItemAction(guidebookId: string, input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const data = createGuidebookItemSchema.parse(input);
    const item = await guidebookService.addItem(actor, guidebookId, data);
    revalidatePath(`/guidebooks/${guidebookId}`);
    return item;
  });
}

export async function updateGuidebookItemAction(
  guidebookId: string,
  itemId: string,
  input: unknown
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const data = updateGuidebookItemSchema.parse(input);
    const item = await guidebookService.updateItem(actor, guidebookId, itemId, data);
    revalidatePath(`/guidebooks/${guidebookId}`);
    return item;
  });
}

export async function deleteGuidebookItemAction(guidebookId: string, itemId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const result = await guidebookService.removeItem(actor, guidebookId, itemId);
    revalidatePath(`/guidebooks/${guidebookId}`);
    return result;
  });
}

export async function reorderGuidebookItemsAction(guidebookId: string, input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const { itemIds } = reorderGuidebookItemsSchema.parse(input);
    const result = await guidebookService.reorderItems(actor, guidebookId, itemIds);
    revalidatePath(`/guidebooks/${guidebookId}`);
    return result;
  });
}

export async function setGuidebookListingsAction(guidebookId: string, input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.USER, Role.HOST, Role.ADMIN]);
    const { listingIds } = setGuidebookListingsSchema.parse(input);
    const result = await guidebookService.setListingAssociations(actor, guidebookId, listingIds);
    revalidatePath(`/guidebooks/${guidebookId}`);
    return result;
  });
}
