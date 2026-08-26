import type { ReactNode } from "react";

import { Nav } from "@/components/nav";
import { requirePageUser } from "@/lib/permissions/page-guards";

// Baseline guard for every authenticated page: unauthenticated visitors are
// redirected to /login before anything renders. Per-role checks live in the
// individual pages (admin, host).
export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageUser();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
