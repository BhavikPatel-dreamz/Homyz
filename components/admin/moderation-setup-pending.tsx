import Link from "next/link";

/** Safe admin state while the additive moderation migration is not yet present. */
export function ModerationSetupPending({ message }: { message?: string }) {
  return <main className="px-4 py-10 sm:px-6 lg:px-8">
    <section className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Moderation setup pending</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">The moderation database migration has not been applied.</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">{message || "This module stays unavailable until its approved additive database migration is present. No moderation data has been changed."}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">The current database has divergent Prisma migration history. Reconcile that history and apply the approved migration through the deployment process; do not reset or force-resolve it from this screen.</p>
      <Link href="/admin" className="mt-5 inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">Return to admin dashboard</Link>
    </section>
  </main>;
}
