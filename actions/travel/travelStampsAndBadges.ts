"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/api/errors";
import {
  addTravelStampSelections,
  createManualTravelStamp,
  createCustomTravelStamp,
  deleteCustomTravelStamp,
  getTravelerStamps,
  getTravelStampPickerItems,
  removeTravelStamp,
  reorderTravelStamps,
  setStampPublic,
  toggleStampPinned,
  setStampsSectionVisibility,
  updateManualTravelStamp,
  updateCustomTravelStamp,
  TravelStampPickerItemDTO,
  UserTravelStampDTO,
} from "@/services/travel-stamp.service";
import {
  getTravelerDestinationStats,
  getTravelerVisitedDestinations,
  TravelerDestinationStatsDTO,
  VisitedCountryGroupDTO,
} from "@/services/travel-destination.service";
import {
  reconcileTravelerHistory,
  TravelerReconciliationSummary,
} from "@/services/travel-reconciliation.service";

export async function getTravelerStampsAction(): Promise<UserTravelStampDTO[]> {
  const user = await getSessionUser();
  if (!user?.id) {
    throw AppError.unauthorized("Authentication required");
  }
  return getTravelerStamps(user.id);
}

export async function toggleStampPinnedAction(userStampId: string): Promise<UserTravelStampDTO> {
  const user = await getSessionUser();
  if (!user?.id) {
    throw AppError.unauthorized("Authentication required");
  }
  const result = await toggleStampPinned(user.id, userStampId);
  revalidatePath("/travel-profile");
  return result;
}

export async function setStampsSectionVisibilityAction(showStamps: boolean): Promise<boolean> {
  const user = await getSessionUser();
  if (!user?.id) {
    throw AppError.unauthorized("Authentication required");
  }
  const result = await setStampsSectionVisibility(user.id, showStamps);
  revalidatePath("/travel-profile");
  return result;
}

export async function getTravelStampPickerItemsAction(search?: string, country?: string): Promise<TravelStampPickerItemDTO[]> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");
  return getTravelStampPickerItems(user.id, search, country);
}

export async function addTravelStampSelectionsAction(input: { catalogStampIds?: string[]; stampIds?: string[]; destinationIds?: string[] }): Promise<UserTravelStampDTO[]> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");
  const result = await addTravelStampSelections(user.id, input);
  revalidatePath("/travel-profile");
  revalidatePath("/travelers/[handle]", "page");
  return result;
}

export async function createCustomTravelStampAction(input: { displayName: string; country?: string | null; city?: string | null; artworkUrl?: string | null; sourcePhotoId?: string | null; isPublic?: boolean }): Promise<UserTravelStampDTO> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");
  const result = await createCustomTravelStamp(user.id, input);
  revalidatePath("/travel-profile");
  revalidatePath("/travelers/[handle]", "page");
  return result;
}

export async function updateCustomTravelStampAction(stampId: string, input: { displayName?: string | null; country?: string | null; city?: string | null; artworkUrl?: string | null; sourcePhotoId?: string | null }): Promise<UserTravelStampDTO> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");
  const result = await updateCustomTravelStamp(user.id, stampId, input);
  revalidatePath("/travel-profile");
  revalidatePath("/travelers/[handle]", "page");
  return result;
}

export async function deleteCustomTravelStampAction(stampId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");
  await deleteCustomTravelStamp(user.id, stampId);
  revalidatePath("/travel-profile");
  revalidatePath("/travelers/[handle]", "page");
}

export async function createManualTravelStampAction(input: { country: string; city?: string | null; visitDate?: string | null; description?: string | null }): Promise<UserTravelStampDTO> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");
  const result = await createManualTravelStamp(user.id, input);
  revalidatePath("/travel-profile");
  revalidatePath("/travelers/[handle]", "page");
  return result;
}

export async function updateManualTravelStampAction(userStampId: string, input: { country: string; city?: string | null; visitDate?: string | null; description?: string | null }): Promise<UserTravelStampDTO> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");
  const result = await updateManualTravelStamp(user.id, userStampId, input);
  revalidatePath("/travel-profile");
  revalidatePath("/travelers/[handle]", "page");
  return result;
}

export async function removeTravelStampAction(userStampId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");
  await removeTravelStamp(user.id, userStampId);
  revalidatePath("/travel-profile");
  revalidatePath("/travelers/[handle]", "page");
}

export async function setStampPublicAction(userStampId: string, isPublic: boolean): Promise<UserTravelStampDTO> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");
  const result = await setStampPublic(user.id, userStampId, isPublic);
  revalidatePath("/travel-profile");
  revalidatePath("/travelers/[handle]", "page");
  return result;
}

export async function reorderTravelStampsAction(userStampIds: string[]): Promise<UserTravelStampDTO[]> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");
  const result = await reorderTravelStamps(user.id, userStampIds);
  revalidatePath("/travel-profile");
  revalidatePath("/travelers/[handle]", "page");
  return result;
}

export async function getTravelerDestinationStatsAction(): Promise<TravelerDestinationStatsDTO> {
  const user = await getSessionUser();
  if (!user?.id) {
    throw AppError.unauthorized("Authentication required");
  }
  return getTravelerDestinationStats(user.id);
}

export async function getTravelerVisitedDestinationsAction(): Promise<VisitedCountryGroupDTO[]> {
  const user = await getSessionUser();
  if (!user?.id) {
    throw AppError.unauthorized("Authentication required");
  }
  return getTravelerVisitedDestinations(user.id);
}

export async function reconcileTravelerHistoryAction(): Promise<TravelerReconciliationSummary> {
  const user = await getSessionUser();
  if (!user?.id) {
    throw AppError.unauthorized("Authentication required");
  }
  const result = await reconcileTravelerHistory(user.id);
  revalidatePath("/travel-profile");
  return result;
}
