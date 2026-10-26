import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostTaxService } from "@/services/host-tax.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
    const { id } = await params;

    const { buffer, filename, contentType } = await hostTaxService.downloadTaxDocument(
      actor,
      id,
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  },
);

