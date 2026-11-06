/**
 * Homyz Admin Analytics Web Push Service Worker
 * Handles incoming push events and background administrative alert notifications.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "Homyz Operational Alert";
    const options = {
      body: payload.body || "A critical administrative event occurred.",
      icon: payload.icon || "/icons/admin-alert.png",
      badge: "/icons/badge-72x72.png",
      data: {
        url: payload.url || "/admin/analytics",
        eventId: payload.eventId,
        timestamp: payload.timestamp,
      },
      requireInteraction: payload.priority === "URGENT",
      tag: payload.tag || "homyz-admin-alert",
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // Graceful fallback for non-JSON push payload
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("Homyz Alert", {
        body: text,
        data: { url: "/admin/analytics" },
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/admin/analytics";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes("/admin") && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

