import Link from "next/link";

// Rendered by forbidden() (403) — authenticated but lacking the required role.
// Requires experimental.authInterrupts (enabled in next.config.ts).
export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm font-medium text-zinc-500">403</p>
      <h1>
        Access denied
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        You don&apos;t have permission to view this page.
      </p>
      <Link
        href="/dashboard"
        className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
