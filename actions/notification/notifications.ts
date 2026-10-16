"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { notificationService, type NotificationFilter } from "@/services/notification.service";
import type { NotificationType } from "@/generated/prisma/enums";

export async function getNotificationsAction(filter?: {
  type?: NotificationType | "ALL";
  unreadOnly?: boolean;
  skip?: number;
  take?: number;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required to view notifications");
    return notificationService.listForUser(actor.id, filter as NotificationFilter);
  });
}

export async function markNotificationReadAction(notificationId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    const updated = await notificationService.markAsRead(actor.id, notificationId);
    revalidatePath("/profile/tab/notifications");
    return updated;
  });
}

export async function markNotificationUnreadAction(notificationId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    const updated = await notificationService.markAsUnread(actor.id, notificationId);
    revalidatePath("/profile/tab/notifications");
    return updated;
  });
}

export async function markAllNotificationsReadAction() {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    const result = await notificationService.markAllAsRead(actor.id);
    revalidatePath("/profile/tab/notifications");
    return result;
  });
}

export async function deleteNotificationAction(notificationId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized("Authentication required");
    await notificationService.deleteNotification(actor.id, notificationId);
    revalidatePath("/profile/tab/notifications");
    return { success: true };
  });
}

