import { NextRequest, NextResponse } from "next/server";
import { accountingOAuthService } from "@/services/admin-analytics/accounting/oauth-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/analytics/accounting/oauth/callback
 * Handles OAuth 2.0 authorization code callback from QuickBooks or Xero.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId") || undefined;
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/analytics?oauthError=${encodeURIComponent(error)}`, origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/admin/analytics?oauthError=Missing+code+or+state", origin)
    );
  }

  try {
    const tokenBundle = await accountingOAuthService.handleOAuthCallback({
      code,
      state,
      realmId,
      origin,
    });

    return NextResponse.redirect(
      new URL(
        `/admin/analytics?oauthSuccess=${tokenBundle.provider}&tenant=${encodeURIComponent(
          tokenBundle.tenantName || tokenBundle.tenantId || ""
        )}`,
        origin
      )
    );
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(
        `/admin/analytics?oauthError=${encodeURIComponent(err.message || "OAuth exchange failed")}`,
        origin
      )
    );
  }
}

