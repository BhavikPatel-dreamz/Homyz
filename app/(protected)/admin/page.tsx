import Link from "next/link";

import { buttonClass, Card } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { adminService } from "@/services/admin.service";
import { Role } from "@/generated/prisma/enums";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-sm text-zinc-500">{label}</p>
    </Card>
  );
}

export default async function AdminPage() {
  await requirePageRole([Role.ADMIN]);
  const stats = await adminService.stats();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Admin
      </h1>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Users" value={stats.users} />
        <Stat label="Hosts" value={stats.hosts} />
        <Stat label="Admins" value={stats.admins} />
        <Stat label="Listings" value={stats.listings} />
        <Stat label="Bookings" value={stats.bookings} />
      </div>
      <div>
        <Link href="/admin/users" className={buttonClass}>
          Manage users
        </Link>
      </div>
    </div>
  );
}
