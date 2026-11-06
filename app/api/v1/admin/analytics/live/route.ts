import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { analyticsEventsService, type AnalyticsEvent } from "@/services/admin-analytics/analytics-events.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Enforce administrative analytics authorization
  await requireApiPermission(req, [PERMISSIONS.ANALYTICS_VIEW]);

  const { searchParams } = new URL(req.url);
  const lastEventId = searchParams.get("lastEventId") || req.headers.get("last-event-id");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection handshake
      controller.enqueue(encoder.encode(": connected\n\n"));

      // 2. Replay recent missed events if client requested
      const missedEvents = analyticsEventsService.getRecentEvents(lastEventId);
      for (const event of missedEvents) {
        const payload = `id: ${event.id}\nevent: analytics\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // 3. Subscribe to real-time broadcasts
      const unsubscribe = analyticsEventsService.subscribe((event: AnalyticsEvent) => {
        try {
          const payload = `id: ${event.id}\nevent: analytics\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (err) {
          // Stream controller closed by client
          unsubscribe();
        }
      });

      // 4. Heartbeat ping every 20 seconds to prevent proxy / load-balancer disconnects
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeatInterval);
          unsubscribe();
        }
      }, 20000);

      // 5. Teardown on client abort
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable proxy buffering (Nginx)
    },
  });
}

