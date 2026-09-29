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

type FilterTab = "ALL" | "UNREAD" | NotificationType;

interface NotificationsViewProps {
  initialData?: {
    items: NotificationDTO[];
    total: number;
    unreadCount: number;
  };
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
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
) {
  switch (type) {
    case NotificationType.BOOKING: {
      const isHost =
        entityType === "host_booking" ||
        (metadata as { role?: string } | null)?.role === "host";

      if (isHost) {
        return {
          label: "Host Reservation",
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
        label: "Trip Booking",
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
        label: "Message",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
        bgClass: "bg-blue-100 text-blue-800 border-blue-200",
      };
    case NotificationType.PROMOTION:
      return {
        label: "Offer",
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
        label: "System",
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
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDTO[]>(
    initialData?.items || [],
  );
  const [unreadCount, setUnreadCount] = useState<number>(
    initialData?.unreadCount ?? 0,
  );
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, startTransition] = useTransition();

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNotificationsAction({ skip: 0, take: 20 });
      if (!res.ok) {
        setError(res.error || "Failed to load notifications.");
        return;
      }
      if (res.data) {
        setNotifications(res.data.items);
        setUnreadCount(res.data.unreadCount);
        setTotal(res.data.total);
      }
    } catch {
      setError("An unexpected error occurred while fetching notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      loadNotifications();
    }
  }, [initialData, loadNotifications]);

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

    startTransition(async () => {
      try {
        const res = await markAllNotificationsReadAction();
        if (!res.ok) {
          setNotifications(previousNotifications);
          setUnreadCount(previousUnreadCount);
          setError(res.error || "Failed to mark notifications as read.");
        }
      } catch {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
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
    setUnreadCount((prev) => (newIsRead ? Math.max(0, prev - 1) : prev + 1));

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
      setUnreadCount((prev) => Math.max(0, prev - 1));

      startTransition(async () => {
        try {
          const res = await markNotificationReadAction(item.id);
          if (!res.ok) {
            setNotifications((prev) =>
              prev.map((n) => (n.id === item.id ? { ...n, isRead: false, readAt: null } : n)),
            );
            setUnreadCount((prev) => prev + 1);
            setError(res.error || "Failed to update the notification.");
          }
        } catch {
          setNotifications((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, isRead: false, readAt: null } : n)),
          );
          setUnreadCount((prev) => prev + 1);
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
              Notifications
            </h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-[#1F1F1F] text-white text-xs font-semibold px-2.5 py-0.5 shadow-2xs">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-5 text-[#727272] sm:text-base sm:leading-6">
            Stay updated on booking confirmations, messages from hosts, promotions, and system alerts.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded-full border border-[#D7D7D7] bg-white px-4 py-2 text-xs font-semibold text-[#1F1F1F] hover:bg-zinc-50 hover:border-zinc-400 transition-all self-start sm:self-auto cursor-pointer shadow-2xs shrink-0"
          >
            Mark all as read
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
            Retry
          </button>
        </div>
      )}

      {/* Filter Category Pills */}
      <div className="mb-6 flex w-full min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap">
        {[
          { id: "ALL" as FilterTab, label: `All (${notifications.length})` },
          { id: "UNREAD" as FilterTab, label: `Unread (${unreadCount})` },
          { id: NotificationType.BOOKING as FilterTab, label: `Bookings (${bookingCount})` },
          { id: NotificationType.MESSAGE as FilterTab, label: `Messages (${messageCount})` },
          { id: NotificationType.PROMOTION as FilterTab, label: `Offers (${promoCount})` },
          { id: NotificationType.SYSTEM as FilterTab, label: `System (${systemCount})` },
        ].map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => setFilter(btn.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filter === btn.id
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
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#1F1F1F]">No notifications found</p>
          <p className="mt-1 text-xs text-[#727272]">
            {filter === "UNREAD"
              ? "You have read all of your notifications."
              : "You are all caught up! When updates arrive, they will appear here."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-200/80 rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
          {filtered.map((item) => {
            const badge = getTypeBadge(item.type, item.entityType, item.metadata);
            const isClickable = Boolean(item.link || item.entityId);

            return (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`group flex items-start gap-4 p-4 sm:p-5 transition-all cursor-pointer ${
                  !item.isRead
                    ? "bg-[#FFFDF7] hover:bg-[#FFF8E8] border-l-4 border-l-amber-400"
                    : "hover:bg-zinc-50/80 border-l-4 border-l-transparent"
                }`}
              >
                {/* Unread indicator dot */}
                <div className="mt-1.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                  {!item.isRead ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100 animate-pulse" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-transparent" />
                  )}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${badge.bgClass}`}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>

                      <h3
                        className={`text-sm sm:text-base leading-snug truncate ${
                          !item.isRead
                            ? "font-semibold text-[#1F1F1F]"
                            : "font-medium text-zinc-800"
                        }`}
                      >
                        {item.title}
                      </h3>
                    </div>

                    <span className="shrink-0 text-xs text-zinc-400">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed text-[#727272] break-words">
                    {item.message}
                  </p>

                  {/* Action row */}
                  <div className="mt-2.5 flex items-center gap-3">
                    {isClickable && (
                      <span className="text-xs font-semibold text-[#1F1F1F] group-hover:underline inline-flex items-center gap-1">
                        <span>View details</span>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleToggleRead(e, item)}
                      className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors ml-auto cursor-pointer"
                      title={item.isRead ? "Mark as unread" : "Mark as read"}
                    >
                      {item.isRead ? "Mark as unread" : "Mark as read"}
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
