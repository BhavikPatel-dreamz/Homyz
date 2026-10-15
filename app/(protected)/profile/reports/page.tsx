import { requirePageUser } from "@/lib/permissions/page-guards";
import { MyReportsView } from "@/components/profile/my-reports-view";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfileReportsPage() {
  await requirePageUser();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/profile" className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
          ← Back to profile
        </Link>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <MyReportsView />
      </div>
    </main>
  );
}

