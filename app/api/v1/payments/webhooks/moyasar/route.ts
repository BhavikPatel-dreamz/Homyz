import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { processPaymentWebhook } from "@/services/payment-webhook.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/payments/webhooks/moyasar
 * Dedicated Moyasar webhook listener route.
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

