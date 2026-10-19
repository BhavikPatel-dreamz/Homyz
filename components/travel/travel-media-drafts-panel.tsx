"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Draft = {
  id: string;
  originalFileName: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  thumbnailUrl: string | null;
};

export function TravelMediaDraftsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/travel-media", { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message || "Could not load private travel drafts.");
        setDrafts(Array.isArray(body?.assets) ? body.assets : []);
        setError(null);
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Could not load private travel drafts.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [refreshKey]);

  const removeDraft = async (id: string) => {
    const response = await fetch(`/api/v1/travel-media/${id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message || "Could not delete this private draft.");
      return;
    }
    setDrafts((previous) => previous.filter((draft) => draft.id !== id));
  };

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5" aria-labelledby="private-travel-drafts-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 id="private-travel-drafts-title" className="text-sm font-semibold text-zinc-950">Private travel drafts</h4>
          <p className="mt-1 text-xs text-zinc-600">Secure uploads stay private and unattached until trips are available.</p>
        </div>
        {!loading && !error && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600">{drafts.length} ready</span>}
      </div>
      {loading && <p className="mt-4 text-xs text-zinc-500" aria-live="polite">Loading private drafts…</p>}
      {error && <p className="mt-4 text-xs text-rose-700" role="alert">{error}</p>}
      {!loading && !error && drafts.length === 0 && <p className="mt-4 text-xs text-zinc-500">No private drafts uploaded yet.</p>}
      {drafts.length > 0 && <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {drafts.map((draft) => <li key={draft.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {draft.thumbnailUrl ? <Image src={draft.thumbnailUrl} alt={draft.originalFileName} width={320} height={320} unoptimized className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center bg-zinc-100 text-xs text-zinc-500">Preview unavailable</div>}
          <div className="p-2">
            <p className="truncate text-[11px] font-medium text-zinc-800">{draft.originalFileName}</p>
            <button type="button" onClick={() => void removeDraft(draft.id)} className="mt-1 text-[11px] font-semibold text-rose-700 hover:underline">Delete draft</button>
          </div>
        </li>)}
      </ul>}
    </section>
  );
}
