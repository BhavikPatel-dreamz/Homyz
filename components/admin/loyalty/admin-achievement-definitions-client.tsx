"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";

type Definition = {
  id: string; key: string; name: string; description: string; category: string; eligibilityRule: string;
  threshold: number; ruleVersion: number; status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED"; awardCount: number;
};

const EMPTY = { key: "", name: "", description: "", category: "STAYS", eligibilityRule: "COMPLETED_STAYS", threshold: 1 };

export function AdminAchievementDefinitionsClient({ initialDefinitions }: { initialDefinitions: Definition[] }) {
  const [definitions, setDefinitions] = useState(initialDefinitions);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | Definition["status"]>("ALL");
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const visible = useMemo(() => definitions.filter((item) => {
    const needle = search.trim().toLowerCase();
    return (status === "ALL" || item.status === status) && (!needle || [item.key, item.name, item.description, item.eligibilityRule].some((value) => value.toLowerCase().includes(needle)));
  }), [definitions, search, status]);

  const saveDefinition = () => startTransition(async () => {
    try {
      const response = await fetch(editingId ? `/api/v1/admin/loyalty/achievements/${editingId}` : "/api/v1/admin/loyalty/achievements", { method: editingId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editingId ? (({ key: _key, ...update }) => update)(draft) : draft) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? "Unable to save definition.");
      setDefinitions((previous) => editingId ? previous.map((item) => item.id === editingId ? json.data : item) : [json.data, ...previous]);
      setDraft(EMPTY); setEditingId(null); setOpen(false); toast.success(editingId ? "Draft achievement definition updated." : "Draft achievement definition created.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save definition."); }
  });
  const edit = (item: Definition) => { setEditingId(item.id); setDraft({ key: item.key, name: item.name, description: item.description, category: item.category, eligibilityRule: item.eligibilityRule, threshold: item.threshold }); setOpen(true); };

  const lifecycle = (item: Definition, action: "publish" | "pause" | "archive") => startTransition(async () => {
    try {
      const response = await fetch(`/api/v1/admin/loyalty/achievements/${item.id}/${action}`, { method: action === "archive" ? "DELETE" : "POST", headers: { "content-type": "application/json" }, body: action === "pause" ? JSON.stringify({ paused: item.status !== "PAUSED" }) : undefined });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? "Lifecycle change failed.");
      setDefinitions((previous) => previous.map((definition) => definition.id === item.id ? json.data : definition));
      toast.success(`Definition ${action === "pause" ? (item.status === "PAUSED" ? "resumed" : "paused") : `${action}d`}.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Lifecycle change failed."); }
  });

  return <section className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-medium text-slate-900">Achievement management</h1><p className="mt-1 text-sm text-slate-600">Draft, review, publish, pause, and archive StayElite definitions. Publishing never enables automatic awards.</p></div>
      <button type="button" onClick={() => { setEditingId(null); setDraft(EMPTY); setOpen((value) => !value); }} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">{open ? "Close draft form" : "New definition"}</button>
    </div>
    {open && <form onSubmit={(event) => { event.preventDefault(); saveDefinition(); }} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
      <input required disabled={Boolean(editingId)} value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value.toUpperCase() })} placeholder="Stable key, e.g. WEEKEND_EXPLORER" className="rounded border p-2 disabled:bg-slate-100" />
      <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Display name" className="rounded border p-2" />
      <input required value={draft.eligibilityRule} onChange={(e) => setDraft({ ...draft, eligibilityRule: e.target.value })} placeholder="Approved rule adapter" className="rounded border p-2" />
      <input required type="number" min="1" value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })} className="rounded border p-2" />
      <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded border p-2"><option>STAYS</option><option>CITIES</option><option>COUNTRIES</option><option>STAMPS</option><option>EXPLORER</option></select>
      <textarea required value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Eligibility description" className="min-h-20 rounded border p-2" />
      <div className="md:col-span-2"><button disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{editingId ? "Save draft changes" : "Save disabled draft"}</button></div>
    </form>}
    <div className="flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search names, keys, and rules" className="w-full rounded border p-2 sm:max-w-md" /><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded border p-2"><option value="ALL">All states</option><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="ARCHIVED">Archived</option></select></div>
    <div className="grid gap-3 lg:hidden">{visible.map((item) => <DefinitionCard key={item.id} item={item} pending={pending} lifecycle={lifecycle} edit={edit} />)}</div>
    <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white lg:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Definition</th><th className="p-3">Rule</th><th className="p-3">Version</th><th className="p-3">State</th><th className="p-3">Actions</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t"><td className="p-3"><div className="font-medium">{item.name}</div><div className="font-mono text-xs text-slate-500">{item.key}</div></td><td className="p-3">{item.eligibilityRule} · {item.threshold}</td><td className="p-3">v{item.ruleVersion}</td><td className="p-3"><State state={item.status} /></td><td className="p-3"><Actions item={item} pending={pending} lifecycle={lifecycle} edit={edit} /></td></tr>)}</tbody></table></div>
    {!visible.length && <p className="rounded border border-dashed p-8 text-center text-sm text-slate-500">No achievement definitions match these filters.</p>}
  </section>;
}

function State({ state }: { state: Definition["status"] }) { return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{state}</span>; }
function Actions({ item, pending, lifecycle, edit }: { item: Definition; pending: boolean; lifecycle: (item: Definition, action: "publish" | "pause" | "archive") => void; edit: (item: Definition) => void }) { return <div className="flex flex-wrap gap-2">{item.status === "DRAFT" && <><button disabled={pending} onClick={() => edit(item)} className="text-slate-700">Edit</button><button disabled={pending} onClick={() => lifecycle(item, "publish")} className="text-blue-700">Publish</button></>}{(item.status === "ACTIVE" || item.status === "PAUSED") && <button disabled={pending} onClick={() => lifecycle(item, "pause")} className="text-blue-700">{item.status === "PAUSED" ? "Resume" : "Pause"}</button>}{item.status !== "ARCHIVED" && <button disabled={pending} onClick={() => lifecycle(item, "archive")} className="text-red-700">Archive</button>}</div>; }
function DefinitionCard({ item, pending, lifecycle, edit }: { item: Definition; pending: boolean; lifecycle: (item: Definition, action: "publish" | "pause" | "archive") => void; edit: (item: Definition) => void }) { return <article className="rounded-lg border bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-medium">{item.name}</h2><p className="font-mono text-xs text-slate-500">{item.key}</p></div><State state={item.status} /></div><p className="mt-3 text-sm text-slate-600">{item.eligibilityRule} · threshold {item.threshold} · v{item.ruleVersion}</p><div className="mt-4"><Actions item={item} pending={pending} lifecycle={lifecycle} edit={edit} /></div></article>; }
