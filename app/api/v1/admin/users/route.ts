import { apiHandler } from "@/lib/api/handler";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { paginated } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { adminService } from "@/services/admin.service";
import { Role } from "@/generated/prisma/enums";

const ROLE_VALUES = new Set<string>([Role.USER, Role.HOST, Role.ADMIN]);

// GET /api/v1/admin/users — list users, optional ?role= filter (ADMIN only).
export const GET = apiHandler(async (req) => {
  await requireApiRole(req, [Role.ADMIN]);
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip, take } = parsePagination(sp);

  const roleParam = sp.get("role");
  const role =
    roleParam && ROLE_VALUES.has(roleParam) ? (roleParam as Role) : undefined;

  const { items, total } = await adminService.listUsers({ skip, take, role });
  return paginated(items, buildPagination(page, limit, total));
});
