import Link from "next/link";

// Rendered by unauthorized() (401). Pages generally prefer redirect("/login"),
// but this covers any explicit unauthorized() call. Requires authInterrupts.
export default function Unauthorized() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm font-medium text-zinc-500">401</p>
      <h1>
        Sign in required
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        You need to be signed in to view this page.
      </p>
      <Link
        href="/login"
        className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-[#1F1F1F]"
      >
        Go to sign in
      </Link>
    </main>
  );
}
