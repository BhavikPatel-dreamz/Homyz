"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TravelFollowListItemDTO } from "@/types/travel";

export function TravelFollowListModal({ userId, kind, isOpen, onClose }: { userId: string; kind: "followers" | "following"; isOpen: boolean; onClose: () => void }) {
  const [items, setItems] = useState<TravelFollowListItemDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (cursor?: string, query = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ kind, limit: "20" });
      if (cursor) params.set("cursor", cursor); if (query.trim()) params.set("search", query.trim());
      const response = await fetch(`/api/v1/travel-profiles/${userId}/follows?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load list.");
      setItems((current) => cursor ? [...current, ...data.items] : data.items);
      setNextCursor(data.nextCursor || null);
    } finally { setLoading(false); }
  }, [kind, search, userId]);
  useEffect(() => { if (!isOpen) return; const timer = window.setTimeout(() => void load(undefined, search), 250); return () => window.clearTimeout(timer); }, [isOpen, load, search]);
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"><button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" /><div role="dialog" aria-modal="true" aria-labelledby="follow-list-title" className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-zinc-100 p-5"><h2 id="follow-list-title" className="text-base font-bold text-zinc-900">{kind === "followers" ? "Followers" : "Following"}</h2><button type="button" onClick={onClose} className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs">✕</button></header><div className="p-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400" /></div><div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{loading && !items.length ? <p className="py-6 text-center text-xs text-zinc-500">Loading…</p> : items.length ? <div className="space-y-3">{items.map((item) => <Link key={item.id} href={item.publicProfileId ? `/travelers/${encodeURIComponent(item.publicProfileId)}` : "#"} onClick={(event) => { if (!item.publicProfileId) event.preventDefault(); }} className="flex items-center gap-3 rounded-xl p-2 hover:bg-zinc-50"><div className="relative size-9 overflow-hidden rounded-full bg-zinc-100">{item.image ? <Image src={item.image} alt="" fill sizes="36px" className="object-cover" /> : <span className="flex size-full items-center justify-center text-xs font-bold text-zinc-500">{item.name?.[0] || "?"}</span>}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-zinc-800">{item.name || "Traveler"}</p>{item.handle && <p className="text-xs text-zinc-500">@{item.handle}</p>}</div></Link>)}</div> : <p className="py-6 text-center text-xs text-zinc-500">No {kind} to show.</p>}{nextCursor && <button type="button" disabled={loading} onClick={() => void load(nextCursor)} className="mt-4 text-xs font-semibold text-amber-700">{loading ? "Loading…" : "Load more"}</button>}</div></div></div>;
}
