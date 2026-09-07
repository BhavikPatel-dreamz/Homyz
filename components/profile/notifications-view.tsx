"use client";

import React, { useState } from "react";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  category: "booking" | "points" | "promo" | "account";
  unread: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Reservation Confirmed: Villa Breeze Malibu",
    description: "Your check-in is scheduled for 3:00 PM tomorrow. Tap to view arrival instructions and host lockbox code.",
    time: "2 hours ago",
    category: "booking",
    unread: true,
  },
  {
    id: "notif-2",
    title: "You Earned 250 Loyalty Points!",
    description: "Welcome to Homyz rewards. Your points can be redeemed towards discounts on your next stay.",
    time: "1 day ago",
    category: "points",
    unread: true,
  },
  {
    id: "notif-3",
    title: "15% Fall Getaway Special in Aspen",
    description: "Alpine Loft Haven and selected mountain cabins have special autumn rates this weekend.",
    time: "3 days ago",
    category: "promo",
    unread: false,
  },
  {
    id: "notif-4",
    title: "Profile Stamp Added",
    description: "Your 'Paris Eiffel Tower' travel stamp is now visible on your public guest profile.",
    time: "1 week ago",
    category: "account",
    unread: false,
  },
];

export function NotificationsView() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<string>("ALL");

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const toggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n))
    );
  };

  const filtered = notifications.filter((n) => {
    if (filter === "UNREAD") return n.unread;
    if (filter === "ALL") return true;
    return n.category === filter.toLowerCase();
  });

  return (
    <div className="flex flex-col animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:mb-8">
        <div>
          <h2 className="text-[22px] leading-[30px] font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] xl:text-[36px] xl:leading-[44px]">
            Notifications
          </h2>
          <p className="mt-1 text-sm leading-5 text-[#727272] sm:text-base sm:leading-6">
            Stay updated on your upcoming bookings, loyalty points, and special discounts.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="rounded-full border border-[#D7D7D7] bg-white px-4 py-2 text-xs font-semibold text-[#1F1F1F] hover:bg-zinc-50 transition-colors self-start sm:self-auto"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Category Pills */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {[
          { id: "ALL", label: `All (${notifications.length})` },
          { id: "UNREAD", label: `Unread (${unreadCount})` },
          { id: "BOOKING", label: "Bookings" },
          { id: "POINTS", label: "Points" },
          { id: "PROMO", label: "Offers" },
        ].map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => setFilter(btn.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              filter === btn.id
                ? "bg-[#1F1F1F] text-white"
                : "border border-[#D7D7D7] bg-white text-[#727272] hover:text-[#1F1F1F]"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Notification Items List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 py-16 text-center my-4">
          <p className="text-sm font-semibold text-[#1F1F1F]">No notifications found</p>
          <p className="mt-1 text-xs text-[#727272]">You are all caught up!</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E5E5E5] rounded-3xl border border-[#E5E5E5] bg-white overflow-hidden shadow-xs">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleRead(item.id)}
              className={`flex items-start gap-4 p-5 transition-colors cursor-pointer ${
                item.unread ? "bg-[#FFFDF7] hover:bg-[#FFF8E8]" : "hover:bg-zinc-50"
              }`}
            >
              <div className="mt-1 flex h-2 w-2 shrink-0 items-center justify-center">
                {item.unread ? (
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-transparent" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className={`text-sm ${
                      item.unread ? "font-semibold text-[#1F1F1F]" : "font-semibold text-zinc-700"
                    }`}
                  >
                    {item.title}
                  </h3>
                  <span className="shrink-0 text-[11px] text-[#727272]">{item.time}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#727272]">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
