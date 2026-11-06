"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notification/notifications";
import type { NotificationDTO } from "@/services/notification.service";
import { NotificationType } from "@/generated/prisma/enums";
import {
  publishUnreadNotificationCount,
  useUnreadNotificationCount,
} from "@/lib/notifications/unread-count-store";
import {
  resolveHostNotificationDestination,
  resolveNotificationRoute,
} from "@/lib/notifications/host-destination";

export interface HostDrawerNotificationsProps {
  isActive: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
}

type FilterTab = "ALL" | "UNREAD";

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

function resolveNotificationIcon(
  type: NotificationType,
  entityType?: string | null,
) {
  switch (type) {
    case NotificationType.BOOKING: {
      const isDispute = entityType?.startsWith("dispute-");
      if (isDispute) {
        return {
          label: "Dispute",
          badgeClass:
            "bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200",
          icon: (
            <svg
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.002A11.959 11.959 0 0112 3.464zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          ),
        };
      }
      return {
        label: "Booking",
        badgeClass:
          "bg-purple-100 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200",
        icon: (
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.253M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
        ),
      };
    }
    case NotificationType.MESSAGE:
      return {
        label: "Message",
        badgeClass:
          "bg-sky-100 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200",
        icon: (
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-1.074-.827l.407-2.032A7.838 7.838 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
            />
          </svg>
        ),
      };
    case NotificationType.PROMOTION:
      return {
        label: "Offer",
        badgeClass:
          "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200",
        icon: (
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
        ),
      };
    case NotificationType.SYSTEM:
    default:
      return {
        label: "Update",
        badgeClass:
          "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200",
        icon: (
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
            />
          </svg>
        ),
      };
  }
}

export function HostDrawerNotifications({
  isActive,
  onClose,
  onNavigate,
}: HostDrawerNotificationsProps) {
  const globalUnreadCount = useUnreadNotificationCount();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [localUnreadCount, setLocalUnreadCount] = useState<number>(0);
  const unreadCount = globalUnreadCount ?? localUnreadCount;
  const [total, setTotal] = useState<number>(0);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const hasFetchedRef = useRef(false);
  const inFlightRef = useRef(false);

  const fetchNotifications = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      if (inFlightRef.current) return;
      if (!options?.silent) setLoading(true);
      setError(null);
      inFlightRef.current = true;

      try {
        const res = await getNotificationsAction({ skip: 0, take: 20 });
        if (!res.ok) {
          setError(res.error || "Failed to load notifications.");
          return;
        }
        if (res.data) {
          setNotifications(res.data.items);
          setLocalUnreadCount(res.data.unreadCount);
          setTotal(res.data.total);
          publishUnreadNotificationCount(res.data.unreadCount);
          hasFetchedRef.current = true;
        }
      } catch {
        setError("An unexpected error occurred while fetching notifications.");
      } finally {
        inFlightRef.current = false;
        if (!options?.silent) setLoading(false);
      }
    },
    [],
  );

  // Lazy fetch on first activation
  useEffect(() => {
    if (isActive && !hasFetchedRef.current) {
      void fetchNotifications();
    }
  }, [isActive, fetchNotifications]);

  // Listener for background notification updates
  useEffect(() => {
    const handleUpdated = () => {
      if (isActive && document.visibilityState === "visible") {
        void fetchNotifications({ silent: true });
      } else {
        hasFetchedRef.current = false;
      }
    };
    window.addEventListener("homyz:notifications-updated", handleUpdated);
    return () => {
      window.removeEventListener("homyz:notifications-updated", handleUpdated);
    };
  }, [isActive, fetchNotifications]);

  // Load more pagination
  const handleLoadMore = async () => {
    if (loadingMore || inFlightRef.current || notifications.length >= total) {
      return;
    }
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
        const existingIds = new Set(current.map((n) => n.id));
        return [
          ...current,
          ...nextPage.items.filter((item) => !existingIds.has(item.id)),
        ];
      });
      setLocalUnreadCount(nextPage.unreadCount);
      setTotal(nextPage.total);
      publishUnreadNotificationCount(nextPage.unreadCount);
    } catch {
      setError("An unexpected error occurred while loading more notifications.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      })),
    );
    setLocalUnreadCount(0);
    publishUnreadNotificationCount(0);
    window.dispatchEvent(new CustomEvent("homyz:notifications-updated"));

    startTransition(async () => {
      try {
        const res = await markAllNotificationsReadAction();
        if (!res.ok) {
          setNotifications(previousNotifications);
          setLocalUnreadCount(previousUnreadCount);
          publishUnreadNotificationCount(previousUnreadCount);
          setError(res.error || "Failed to mark notifications as read.");
        }
      } catch {
        setNotifications(previousNotifications);
        setLocalUnreadCount(previousUnreadCount);
        publishUnreadNotificationCount(previousUnreadCount);
        setError("Failed to mark notifications as read.");
      }
    });
  };

  // Single notification click
  const handleNotificationClick = (item: NotificationDTO) => {
    const destination = resolveHostNotificationDestination(item);
    const route = resolveNotificationRoute(item, { currentMode: "host" });
    const targetUrl = route.context === "TRAVELLER" ? route.targetUrl : destination;

    if (!item.isRead) {
      const nextUnreadCount = Math.max(0, unreadCount - 1);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n,
        ),
      );
      setLocalUnreadCount(nextUnreadCount);
      publishUnreadNotificationCount(nextUnreadCount);
      window.dispatchEvent(new CustomEvent("homyz:notifications-updated"));

      startTransition(async () => {
        try {
          const res = await markNotificationReadAction(item.id);
          if (!res.ok) {
            publishUnreadNotificationCount(unreadCount);
          }
        } catch {
          publishUnreadNotificationCount(unreadCount);
        }
      });
    }

    onClose();
    onNavigate(targetUrl);
  };

  const displayedNotifications =
    filter === "UNREAD"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-zinc-900">
      {/* ── Filter Bar & Actions ── */}
      <div className="px-6 sm:px-7 pt-1 pb-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
              filter === "ALL"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            All {total > 0 ? `(${total})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setFilter("UNREAD")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              filter === "UNREAD"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span
                className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium ${
                  filter === "UNREAD"
                    ? "bg-rose-500 text-white"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                }`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white underline decoration-zinc-300 dark:decoration-zinc-700 underline-offset-4 cursor-pointer transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* ── Scrollable Notifications List Container ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 space-y-2.5 custom-scrollbar pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {loading ? (
          /* Loading Skeletons */
          <div
            aria-label="Loading notifications"
            role="status"
            className="space-y-3 py-1 animate-pulse"
          >
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40"
              >
                <div className="size-10 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2 py-0.5">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-700 rounded" />
                    <div className="h-3 w-12 bg-zinc-100 dark:bg-zinc-800 rounded" />
                  </div>
                  <div className="h-3.5 w-3/4 bg-zinc-200 dark:bg-zinc-700 rounded" />
                  <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error && notifications.length === 0 ? (
          /* Error State */
          <div className="flex flex-col items-center justify-center text-center px-4 py-16">
            <div className="size-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mb-3">
              <svg
                className="size-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Unable to load notifications
            </p>
            <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-1 max-w-[260px]">
              {error}
            </p>
            <button
              type="button"
              onClick={() => fetchNotifications({ force: true })}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : displayedNotifications.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center text-center px-4 py-16">
            <div className="size-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-4">
              <svg
                className="size-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
            </div>
            <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
              You&apos;re all caught up
            </p>
            <p className="text-sm font-normal text-zinc-500 dark:text-zinc-400 mt-1 max-w-[240px]">
              {filter === "UNREAD"
                ? "No unread notifications right now."
                : "No new notifications right now."}
            </p>
            {filter === "UNREAD" && total > 0 && (
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className="mt-4 px-4 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
              >
                View all notifications
              </button>
            )}
          </div>
        ) : (
          /* Actual Notifications List */
          <div className="space-y-2">
            {displayedNotifications.map((item) => {
              const { label, badgeClass, icon } = resolveNotificationIcon(
                item.type,
                item.entityType,
              );
              const isUnread = !item.isRead;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotificationClick(item);
                    }
                  }}
                  className={`group relative flex items-start gap-3.5 p-3.5 rounded-2xl border transition cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:focus-visible:outline-white ${
                    isUnread
                      ? "border-amber-200/70 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/15 hover:bg-amber-50/60 dark:hover:bg-amber-950/25"
                      : "border-zinc-200/60 dark:border-zinc-800/70 bg-white dark:bg-zinc-850/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                  aria-label={`${isUnread ? "Unread notification: " : ""}${item.title}`}
                >
                  {/* Category Icon Badge */}
                  <div
                    className={`size-10 rounded-full shrink-0 flex items-center justify-center ${badgeClass}`}
                  >
                    {icon}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {label}
                      </span>
                      <span
                        className="text-zinc-300 dark:text-zinc-600 text-xs"
                        aria-hidden="true"
                      >
                        •
                      </span>
                      <span className="text-[11px] font-normal text-zinc-400 dark:text-zinc-500">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors line-clamp-1">
                      {item.title}
                    </p>

                    <p className="text-xs font-normal text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed break-words">
                      {item.message}
                    </p>
                  </div>

                  {/* Unread Indicator Dot */}
                  {isUnread && (
                    <span
                      aria-label="Unread"
                      className="size-2 rounded-full bg-rose-500 shrink-0 mt-2 self-start"
                    />
                  )}
                </div>
              );
            })}

            {/* Load More Trigger */}
            {notifications.length < total && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingMore ? "Loading more..." : "Load more notifications"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
