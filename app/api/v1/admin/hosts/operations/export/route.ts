import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostOperationsService } from "@/services/host-operations.service";

export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_OPERATIONS_EXPORT);

  const csvContent = await hostOperationsService.exportOperationalDataCSV(actor);

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="host_operations_report_${Date.now()}.csv"`,
    },
  });
});
