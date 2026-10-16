import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { processPaymentWebhook } from "@/services/payment-webhook.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/payments/webhooks
 * Secure payment provider webhook listener with signature verification,
 * atomic database state updates, and idempotency protection.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-moyasar-signature") ||
    req.headers.get("webhook-signature") ||
    req.headers.get("x-signature") ||
    "";

  const result = await processPaymentWebhook(rawBody, signature);
  return ok(result);
});

