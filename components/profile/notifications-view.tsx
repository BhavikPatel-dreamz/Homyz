"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  NotificationDTO,
} from "@/services/notification.service";
import {
  markNotificationReadAction,
  markNotificationUnreadAction,
  markAllNotificationsReadAction,
  getNotificationsAction,
} from "@/actions/notification/notifications";
import { NotificationsSkeleton } from "@/components/dashboard/section-skeletons";
import { NotificationType } from "@/generated/prisma/enums";
import { useLanguage, type TranslationKey } from "@/lib/i18n/language-context";
import { publishUnreadNotificationCount } from "@/lib/notifications/unread-count-store";

type FilterTab = "ALL" | "UNREAD" | NotificationType;

interface NotificationsViewProps {
  initialData?: {
    items: NotificationDTO[];
    total: number;
    unreadCount: number;
  };
}

type Translator = (key: TranslationKey, fallback?: string) => string;

function formatRelativeTime(dateStr: string, t?: Translator): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t ? t("profile_notif_time_just_now", "Just now") : "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return t ? t("profile_notif_time_yesterday", "Yesterday") : "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateStr;
  }
}

function getTypeBadge(
  type: NotificationType,
  entityType?: string | null,
  metadata?: Record<string, unknown> | null,
  t?: Translator,
) {
  switch (type) {
    case NotificationType.BOOKING: {
      const isHost =
        entityType === "host_booking" ||
        (metadata as { role?: string } | null)?.role === "host";

      if (isHost) {
        return {
          label: t ? t("profile_notif_type_host_res", "Host Reservation") : "Host Reservation",
          icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          ),
          bgClass: "bg-purple-100 text-purple-800 border-purple-200",
        };
      }

      return {
        label: t ? t("profile_notif_type_trip_booking", "Trip Booking") : "Trip Booking",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
        bgClass: "bg-amber-100 text-amber-800 border-amber-200",
      };
    }
    case NotificationType.MESSAGE:
      return {
        label: t ? t("profile_notif_type_message", "Message") : "Message",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
        bgClass: "bg-blue-100 text-blue-800 border-blue-200",
      };
    case NotificationType.PROMOTION:
      return {
        label: t ? t("profile_notif_type_offer", "Offer") : "Offer",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ),
        bgClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    case NotificationType.SYSTEM:
    default:
      return {
        label: t ? t("profile_notif_type_system", "System") : "System",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ),
        bgClass: "bg-zinc-100 text-zinc-800 border-zinc-200",
      };
  }
}

export function NotificationsView({ initialData }: NotificationsViewProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDTO[]>(
    initialData?.items || [],
  );
  const [unreadCount, setUnreadCount] = useState<number>(
    initialData?.unreadCount ?? 0,
  );
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (initialData) publishUnreadNotificationCount(initialData.unreadCount);
  }, [initialData]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNotificationsAction({ skip: 0, take: 20 });
      if (!res.ok) {
        setError(res.error || t("profile_notif_error_load", "Failed to load notifications."));
        return;
      }
      if (res.data) {
        setNotifications(res.data.items);
        setUnreadCount(res.data.unreadCount);
        setTotal(res.data.total);
        publishUnreadNotificationCount(res.data.unreadCount);
      }
    } catch {
      setError(t("profile_notif_error_unexpected", "An unexpected error occurred while fetching notifications."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadMore = async () => {
    if (loadingMore || notifications.length >= total) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await getNotificationsAction({
        skip: notifications.length,
        take: 20,
      });
      if (!res.ok) {
        setError(res.error || "Failed to load more notifications.");
        return;
      }
      const nextPage = res.data;
      setNotifications((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        return [...current, ...nextPage.items.filter((item) => !knownIds.has(item.id))];
      });
      setUnreadCount(nextPage.unreadCount);
      setTotal(nextPage.total);
      publishUnreadNotificationCount(nextPage.unreadCount);
    } catch {
      setError("An unexpected error occurred while fetching notifications.");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    publishUnreadNotificationCount(0);

    startTransition(async () => {
      try {
        const res = await markAllNotificationsReadAction();
        if (!res.ok) {
          setNotifications(previousNotifications);
          setUnreadCount(previousUnreadCount);
          publishUnreadNotificationCount(previousUnreadCount);
          setError(res.error || "Failed to mark notifications as read.");
        }
      } catch {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
        publishUnreadNotificationCount(previousUnreadCount);
        setError("Failed to mark notifications as read.");
      }
    });
  };

  const handleToggleRead = (e: React.MouseEvent, item: NotificationDTO) => {
    e.stopPropagation();
    const newIsRead = !item.isRead;
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === item.id
          ? {
            ...n,
            isRead: newIsRead,
            readAt: newIsRead ? new Date().toISOString() : null,
          }
          : n,
      ),
    );
    const nextUnreadCount = newIsRead
      ? Math.max(0, unreadCount - 1)
      : unreadCount + 1;
    setUnreadCount(nextUnreadCount);
    publishUnreadNotificationCount(nextUnreadCount);

    startTransition(async () => {
      try {
        if (newIsRead) {
          const res = await markNotificationReadAction(item.id);
          if (!res.ok) throw new Error(res.error);
        } else {
          const res = await markNotificationUnreadAction(item.id);
          if (!res.ok) throw new Error(res.error);
        }
      } catch {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
        publishUnreadNotificationCount(previousUnreadCount);
        setError("Failed to update the notification. Please try again.");
      }
    });
  };

  const handleNotificationClick = (item: NotificationDTO) => {
    // If unread, mark as read immediately
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      );
      const nextUnreadCount = Math.max(0, unreadCount - 1);
      setUnreadCount(nextUnreadCount);
      publishUnreadNotificationCount(nextUnreadCount);

      startTransition(async () => {
        try {
          const res = await markNotificationReadAction(item.id);
          if (!res.ok) {
            setNotifications((prev) =>
              prev.map((n) => (n.id === item.id ? { ...n, isRead: false, readAt: null } : n)),
            );
            setUnreadCount((prev) => prev + 1);
            publishUnreadNotificationCount(unreadCount);
            setError(res.error || "Failed to update the notification.");
          }
        } catch {
          setNotifications((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, isRead: false, readAt: null } : n)),
          );
          setUnreadCount((prev) => prev + 1);
          publishUnreadNotificationCount(unreadCount);
          setError("Failed to update the notification.");
        }
      });
    }

    // Context Navigation
    if (item.link) {
      router.push(item.link);
      return;
    }

    if (item.type === NotificationType.BOOKING) {
      router.push("/profile/tab/upcoming");
    } else if (item.type === NotificationType.MESSAGE) {
      router.push("/messages");
    } else if (item.type === NotificationType.PROMOTION) {

      router.push("/profile/tab/invite");
    }
  };

  // Filter items
  const filtered = notifications.filter((n) => {
    if (filter === "UNREAD") return !n.isRead;
    if (filter === "ALL") return true;
    return n.type === filter;
  });

  const bookingCount = notifications.filter(
    (n) => n.type === NotificationType.BOOKING,
  ).length;
  const messageCount = notifications.filter(
    (n) => n.type === NotificationType.MESSAGE,
  ).length;
  const promoCount = notifications.filter(
    (n) => n.type === NotificationType.PROMOTION,
  ).length;
  const systemCount = notifications.filter(
    (n) => n.type === NotificationType.SYSTEM,
  ).length;

  if (loading) {
    return <NotificationsSkeleton />;
  }

  return (
    <div className="flex min-w-0 w-full flex-col animate-in fade-in duration-300">
      {/* Title & Actions Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between xl:mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-[22px] leading-[30px] font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] xl:text-[36px] xl:leading-[44px]">
              {t("profile_notif_title", "Notifications")}
            </h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-[#1F1F1F] text-white text-xs font-normal px-2.5 py-1">
                {unreadCount} {t("profile_notif_new_badge", "new")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-5 text-[#727272] lg:text-base sm:leading-6">
            {t("profile_notif_subtitle", "Stay updated on booking confirmations, messages from hosts, promotions, and system alerts.")}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded-full border border-transparent bg-[#FCDF9C] px-4 py-2 text-sm font-medium text-[#1F1F1F] hover:text-white hover:bg-[#1f1f1f] hover:border-[#1f1f1f] transition-all duration-300 self-start sm:self-auto cursor-pointer shrink-0"
          >
            {t("profile_notif_mark_all_read", "Mark all as read")}
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-4">
          <p>{error}</p>
          <button
            type="button"
            onClick={loadNotifications}
            className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 transition-colors shrink-0"
          >
            {t("profile_notif_retry", "Retry")}
          </button>
        </div>
      )}

      {/* Filter Category Pills */}
      <div className="mb-6 flex w-full min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap">
        {[
          { id: "ALL" as FilterTab, label: `${t("profile_notif_filter_all", "All")} (${notifications.length})` },
          { id: "UNREAD" as FilterTab, label: `${t("profile_notif_filter_unread", "Unread")} (${unreadCount})` },
          { id: NotificationType.BOOKING as FilterTab, label: `${t("profile_notif_filter_bookings", "Bookings")} (${bookingCount})` },
          { id: NotificationType.MESSAGE as FilterTab, label: `${t("profile_notif_filter_messages", "Messages")} (${messageCount})` },
          { id: NotificationType.PROMOTION as FilterTab, label: `${t("profile_notif_filter_offers", "Offers")} (${promoCount})` },
          { id: NotificationType.SYSTEM as FilterTab, label: `${t("profile_notif_filter_system", "System")} (${systemCount})` },
        ].map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => setFilter(btn.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${filter === btn.id
                ? "bg-[#1F1F1F] text-white shadow-2xs"
                : "border border-[#D7D7D7] bg-white text-[#727272] hover:text-[#1F1F1F] hover:border-zinc-400"
              }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Notification Items List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/50 py-16 text-center my-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-[#727272] mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#1F1F1F]">{t("profile_notif_empty_title", "No notifications found")}</p>
          <p className="mt-1 text-xs text-[#727272]">
            {filter === "UNREAD"
              ? t("profile_notif_empty_unread", "You have read all of your notifications.")
              : t("profile_notif_empty_all", "You are all caught up! When updates arrive, they will appear here.")}
          </p>
        </div>
      ) : (
        <div className="visible-scrollbar max-h-[65dvh] divide-y divide-[#d7d7d7] overflow-y-auto overscroll-contain rounded-lg border border-[#d7d7d7] bg-white shadow-xs sm:max-h-[calc(100dvh-20rem)] sm:rounded-2xl">
          {filtered.map((item) => {
            const badge = getTypeBadge(item.type, item.entityType, item.metadata, t);
            const isClickable = Boolean(item.link || item.entityId);

            return (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`group flex items-start gap-4 p-4 sm:p-5 transition-all cursor-pointer ${!item.isRead
                    ? "bg-[#FEF3D7] hover:bg-[#FFF8E8] border-l-4 border-l-[#EBA900]"
                    : "hover:bg-zinc-50/80 border-l-4 border-l-transparent"
                  }`}
              >
                {/* Unread indicator dot */}
                <div className="mt-1.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                  {!item.isRead ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-[#EBA900] ring-4 ring-amber-200 animate-pulse" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-transparent" />
                  )}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 flex-col flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-normal ${badge.bgClass}`}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>

                      <h3
                        className={`text-sm sm:text-base leading-snug truncate ${!item.isRead
                          ? "font-normal text-[#1F1F1F]"
                          : "font-normal text-zinc-800"
                          }`}
                      >
                        {item.title}
                      </h3>
                    </div>

                    <span className="shrink-0 text-xs text-[#727272]">
                      {formatRelativeTime(item.createdAt, t)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed text-[#727272] break-words">
                    {item.message}
                  </p>

                  {/* Action row */}
                  <div className="mt-2.5 flex items-center gap-3">
                    {isClickable && (
                      <span className="text-sm font-medium text-[#1F1F1F] group-hover:underline inline-flex items-center gap-1">
                        <span>{t("profile_notif_view_details", "View details")}</span>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleToggleRead(e, item)}
                      className="text-sm text-[#727272] hover:text-[#1f1f1f] underline underline-offset-3 transition-colors duration-300 ml-auto cursor-pointer"
                      title={item.isRead ? t("profile_notif_mark_unread", "Mark as unread") : t("profile_notif_mark_read", "Mark as read")}
                    >
                      {item.isRead ? t("profile_notif_mark_unread", "Mark as unread") : t("profile_notif_mark_read", "Mark as read")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filter === "ALL" && notifications.length < total && (
            <div className="flex justify-center p-4">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-full border border-[#D7D7D7] bg-white px-5 py-2 text-xs font-semibold text-[#1F1F1F] transition-colors hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
