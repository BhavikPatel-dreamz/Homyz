import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { hostRevenueAdvisoryService } from "@/services/admin-analytics/advisory/host-revenue-advisory.service";

/**
 * Host Revenue Advisory API - Phase 11
 * GET /api/v1/host/analytics/advisory
 * POST /api/v1/host/analytics/advisory
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "prompts";

    if (action === "prompts") {
      const prompts = hostRevenueAdvisoryService.getSuggestedPrompts();
      return NextResponse.json({ success: true, count: prompts.length, prompts });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, query, actorId, hostEmail } = body;

    if (!listingId || !query) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: listingId and query are required." },
        { status: 400 }
      );
    }

    // Authenticated host context
    const user: AuthUser = {
      id: actorId || "usr_host_default",
      role: Role.HOST,
      email: hostEmail || "host@example.com",
      name: "Listing Host",
    };

    const response = await hostRevenueAdvisoryService.consultAdvisory({
      listingId,
      query,
      user,
    });

    return NextResponse.json({ success: true, advisory: response });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

