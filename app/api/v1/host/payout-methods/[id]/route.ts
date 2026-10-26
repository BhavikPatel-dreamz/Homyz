import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { payoutService } from "@/services/payout.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
    const { id } = await params;

    const method = await payoutService.getHostPayoutMethodById(actor.id, id);
    return ok(method);
  },
);

export const PATCH = apiHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
    const { id } = await params;
    const body = await req.json();

    const updated = await payoutService.updateHostPayoutMethod(actor.id, id, {
      accountHolderName: body.accountHolderName,
      routingCode: body.routingCode,
      metadata: body.metadata,
    });
    return ok(updated);
  },
);

export const DELETE = apiHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
    const { id } = await params;

    const methods = await payoutService.deleteHostPayoutMethod(actor.id, id);
    return ok(methods);
  },
);
