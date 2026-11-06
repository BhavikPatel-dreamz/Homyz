import { NextRequest, NextResponse } from "next/server";
import { accountingSyncService } from "@/services/admin-analytics/accounting/accounting-sync.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-quickbooks-signature") || req.headers.get("x-xero-signature") || "";
  const secretKey = process.env.ACCOUNTING_WEBHOOK_SECRET || "default_dev_accounting_webhook_secret";

  const rawBody = await req.text();

  // Validate cryptographic signature
  const isValid = accountingSyncService.verifyWebhookSignature(rawBody, signature, secretKey);

  // In production, reject unsigned payloads
  if (process.env.NODE_ENV === "production" && !isValid) {
    return NextResponse.json({ success: false, error: "Invalid webhook signature" }, { status: 401 });
  }

  let eventPayload: any = {};
  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    // Malformed JSON
  }

  return NextResponse.json({
    success: true,
    message: "Accounting event acknowledged",
    receivedAt: new Date().toISOString(),
    event: eventPayload.event || "UNKNOWN",
  });
}

