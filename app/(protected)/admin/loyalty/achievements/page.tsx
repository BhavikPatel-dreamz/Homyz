import { Role } from "@/generated/prisma/enums";
import { AdminAchievementDefinitionsClient } from "@/components/admin/loyalty/admin-achievement-definitions-client";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { listAdminAchievementDefinitions } from "@/services/admin-achievement.service";

export const metadata = { title: "Achievement Management | Homyz Admin" };

export default async function AdminAchievementDefinitionsPage() {
  await requirePageRole([Role.ADMIN]);
  const definitions = await listAdminAchievementDefinitions({ limit: 100 });
  return <AdminAchievementDefinitionsClient initialDefinitions={definitions.data} />;
}
