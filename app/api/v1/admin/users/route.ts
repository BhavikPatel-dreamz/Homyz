import { apiHandler } from "@/lib/api/handler";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { created, paginated } from "@/lib/api/response";
import { requireApiPermission, requireApiRole } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createAdminSchema } from "@/lib/validation/admin";
import { adminService } from "@/services/admin.service";
import { Role, UserStatus } from "@/generated/prisma/enums";

const ROLE_VALUES = new Set<string>([Role.USER, Role.HOST, Role.ADMIN]);
const STATUS_VALUES = new Set<string>([UserStatus.ACTIVE, UserStatus.SUSPENDED]);

// GET /api/v1/admin/users — list users, optional ?role=, ?status=, ?search=
export const GET = apiHandler(async (req) => {
  await requireApiRole(req, [Role.ADMIN]);
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip, take } = parsePagination(sp);

  const roleParam = sp.get("role");
  const role = roleParam && ROLE_VALUES.has(roleParam) ? (roleParam as Role) : undefined;

  const statusParam = sp.get("status");
  const status = statusParam && STATUS_VALUES.has(statusParam) ? (statusParam as UserStatus) : undefined;

  const search = sp.get("search") || undefined;

  const { items, total } = await adminService.listUsers({ skip, take, role, status, search });
  return paginated(items, buildPagination(page, limit, total));
});

// POST /api/v1/admin/users — create administrator / user
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.ADMINS_CREATE);
  const body = await req.json();
  const input = createAdminSchema.parse(body);

  const user = await adminService.createAdmin(actor, input);
  return created(user);
});
