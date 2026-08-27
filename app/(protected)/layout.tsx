import type { ReactNode } from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { requirePageUser } from "@/lib/permissions/page-guards";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageUser();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
