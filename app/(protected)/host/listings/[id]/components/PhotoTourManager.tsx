"use client";

import React, { useRef, useState } from "react";
import { PhotosSkeleton } from "./YourSpaceSkeletons";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

interface PhotoTourManagerProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  onSave: () => void;
  isSaving: boolean;
  isLoading?: boolean;
}

export function PhotoTourManager({ photos, onChange, onSave, isSaving, isLoading }: PhotoTourManagerProps) {

  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!ACCEPTED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      throw new Error("Use JPEG, PNG, WebP, or AVIF images up to 10 MB each.");
    }
    const data = new FormData();
    data.append("file", file);
    const response = await fetch("/api/v1/upload/listing-photo", { method: "POST", body: data });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok || !result || typeof result !== "object" || !("url" in result)) {
      throw new Error(result && typeof result === "object" && "error" in result ? String((result as { error: unknown }).error) : "Photo upload failed. Please retry.");
    }
    return String((result as { url: string }).url);
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true); setError(null);
    try { onChange([...photos, ...(await Promise.all(files.map(upload)))]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Photo upload failed. Please retry."); }
    finally { setUploading(false); }
  };

  const replace = async (file: File) => {
    if (replaceIndex === null) return;
    const index = replaceIndex;
    setReplaceIndex(null); setUploading(true); setError(null);
    try { const next = [...photos]; next[index] = await upload(file); onChange(next); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Photo replacement failed. Please retry."); }
    finally { setUploading(false); }
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...photos]; const [photo] = next.splice(from, 1); next.splice(to, 0, photo); onChange(next);
  };

  return <section className="max-w-3xl space-y-5 pb-10">
    <input ref={addInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void uploadFiles(files); }} />
    <input ref={replaceInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void replace(file); }} />
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1>Photo tour</h1><p className="mt-1 text-xs text-zinc-500">Upload several photos, drag to reorder, and keep your cover photo first.</p></div><button type="button" disabled={isSaving || uploading} onClick={onSave} className="rounded-full bg-[#FEE08B] px-5 py-2 text-xs font-semibold disabled:opacity-60">{isSaving ? "Saving…" : "Save photo tour"}</button></div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error} Choose the photo again to retry.</p>}
    {uploading && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Uploading securely…</p>}
    {isLoading ? (
      <PhotosSkeleton />
    ) : (
      <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const files = Array.from(event.dataTransfer.files); if (files.length) void uploadFiles(files); }} className="grid grid-cols-2 gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-3 sm:grid-cols-3">
        {photos.map((photo, index) => <div key={`${photo}-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragIndex !== null) reorder(dragIndex, index); setDragIndex(null); }} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-200"><img src={photo} alt={index === 0 ? "Cover photo" : `Listing photo ${index + 1}`} className="h-full w-full object-cover" /><div className="absolute inset-x-1 bottom-1 flex flex-wrap gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"><button type="button" onClick={() => { const next = [...photos]; const [cover] = next.splice(index, 1); next.unshift(cover); onChange(next); }} className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold">{index === 0 ? "Cover" : "Make cover"}</button><button type="button" onClick={() => { setReplaceIndex(index); replaceInput.current?.click(); }} className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold">Replace</button><button type="button" onClick={() => onChange(photos.filter((_, itemIndex) => itemIndex !== index))} className="rounded bg-white px-1.5 py-1 text-[10px] font-semibold text-rose-700">Delete</button></div></div>)}
        <button type="button" onClick={() => addInput.current?.click()} disabled={uploading} className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-400 bg-white text-xs font-semibold text-zinc-600 disabled:opacity-60"><span className="text-xl">＋</span>Add photos</button>
      </div>
    )}
  </section>;
}
