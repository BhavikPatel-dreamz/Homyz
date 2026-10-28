"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { TravelPhotoCommentDTO } from "@/types/travel";
import { toast } from "@/components/ui/toast";

export function TravelPhotoComments({ photoId, onCountChange }: { photoId: string; onCountChange?: (count: number) => void }) {
  const [comments, setComments] = useState<TravelPhotoCommentDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: "20" });
      if (cursor) query.set("cursor", cursor);
      const response = await fetch(`/api/v1/travel-media/photos/${photoId}/comments?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load comments.");
      setComments((current) => cursor ? [...current, ...data.items] : data.items);
      setNextCursor(data.nextCursor || null);
      setTotalCount(data.totalCount || 0);
      onCountChangeRef.current?.(data.totalCount || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load comments.");
    } finally { setLoading(false); }
  }, [photoId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const submit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/travel-media/photos/${photoId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to add comment.");
      setComments((current) => [data.comment, ...current]);
      setText("");
      setTotalCount((count) => { const next = count + 1; onCountChangeRef.current?.(next); return next; });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to add comment."); }
    finally { setSubmitting(false); }
  };
  const saveEdit = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/travel-media/comments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: editText }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update comment.");
      setComments((current) => current.map((comment) => comment.id === id ? data.comment : comment));
      setEditing(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update comment."); }
  };
  const remove = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/travel-media/comments/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete comment.");
      setComments((current) => current.filter((comment) => comment.id !== id));
      setTotalCount((count) => { const next = Math.max(0, count - 1); onCountChangeRef.current?.(next); return next; });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete comment."); }
  };

  return <section className="border-t border-zinc-100 pt-4" aria-label="Photo comments">
    <div className="mb-2 flex items-center justify-between"><h5 className="text-xs font-bold text-zinc-800">Comments ({totalCount})</h5></div>
    <div className="flex gap-2"><textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} rows={2} placeholder="Add a comment…" className="min-w-0 flex-1 resize-none rounded-xl border border-zinc-200 px-2.5 py-2 text-xs outline-none focus:border-amber-400" /><button type="button" onClick={() => void submit()} disabled={submitting || !text.trim()} className="self-end rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{submitting ? "Posting…" : "Post"}</button></div>
    <div className="mt-3 space-y-3">{loading && !comments.length ? <p className="text-xs text-zinc-400">Loading comments…</p> : comments.length ? comments.map((comment) => <article key={comment.id} className="flex gap-2 text-xs"><div className="relative size-7 shrink-0 overflow-hidden rounded-full bg-zinc-100">{comment.author.image ? <Image src={comment.author.image} alt="" fill sizes="28px" className="object-cover" /> : <span className="flex size-full items-center justify-center font-bold text-zinc-500">{comment.author.name?.[0] || "?"}</span>}</div><div className="min-w-0 flex-1"><div className="flex items-baseline gap-1"><span className="font-semibold text-zinc-800">{comment.author.name || "Traveler"}</span><time className="text-[10px] text-zinc-400">{new Date(comment.createdAt).toLocaleDateString()}</time></div>{editing === comment.id ? <div className="mt-1 flex gap-1"><input value={editText} onChange={(event) => setEditText(event.target.value)} maxLength={1000} className="min-w-0 flex-1 rounded border border-zinc-200 px-2 py-1" /><button type="button" onClick={() => void saveEdit(comment.id)} className="font-semibold text-amber-700">Save</button></div> : <p className="mt-0.5 whitespace-pre-wrap text-zinc-600">{comment.content}</p>}{(comment.canEdit || comment.canDelete) && <div className="mt-1 flex gap-2 text-[10px] font-semibold">{comment.canEdit && <button type="button" onClick={() => { setEditing(comment.id); setEditText(comment.content); }} className="text-zinc-500 hover:text-zinc-800">Edit</button>}{comment.canDelete && <button type="button" onClick={() => void remove(comment.id)} className="text-rose-600 hover:text-rose-700">Delete</button>}</div>}</div></article>) : <p className="text-xs text-zinc-400">No comments yet. Start the conversation.</p>}{nextCursor && <button type="button" onClick={() => void load(nextCursor)} disabled={loading} className="text-xs font-semibold text-amber-700">{loading ? "Loading…" : "Load more"}</button>}</div>
  </section>;
}
