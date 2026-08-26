import Link from "next/link";

import { Badge, Card } from "@/components/ui";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";

function QuickLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-colors hover:border-zinc-400 dark:hover:border-zinc-600">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{desc}</p>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requirePageUser();
  const isHost = user.role === Role.HOST || user.role === Role.ADMIN;
  const isAdmin = user.role === Role.ADMIN;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <Badge>{user.role}</Badge>
      </div>
      <p className="text-sm text-zinc-500">Signed in as {user.email}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink
          href="/profile"
          title="Profile"
          desc="Update your details and password"
        />
        <QuickLink
          href="/bookings"
          title="Bookings"
          desc="Review the stays you've booked"
        />
        {isHost ? (
          <QuickLink
            href="/host/listings"
            title="My listings"
            desc="Manage the places you host"
          />
        ) : null}
        {isAdmin ? (
          <QuickLink
            href="/admin"
            title="Admin"
            desc="Users, roles and platform stats"
          />
        ) : null}
      </div>
    </div>
  );
}
