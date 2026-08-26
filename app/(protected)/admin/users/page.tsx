import { RoleForm } from "@/components/forms/role-form";
import { Card } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { adminService } from "@/services/admin.service";
import { Role } from "@/generated/prisma/enums";

export default async function AdminUsersPage() {
  await requirePageRole([Role.ADMIN]);
  const { items } = await adminService.listUsers({ skip: 0, take: 100 });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Users
      </h1>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr
                key={u.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
              >
                <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                  {u.email}
                </td>
                <td className="px-4 py-3 text-zinc-500">{u.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <RoleForm userId={u.id} currentRole={u.role} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
