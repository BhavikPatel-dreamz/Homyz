"use client";

import { useState } from "react";

type Criterion = { id: string; actualValue: unknown; requiredThreshold: string; status: "PASS" | "FAIL" | "BLOCKED"; explanation: string };
type Assessment = { id: string; evaluationDate: string | Date; windowStart: string | Date; windowEnd: string | Date; qualified: boolean; failureReasons: string[] };
type Props = {
  hostId: string;
  initial: { officialStatus: boolean; qualifiedAt: string | Date | null; nextEvaluationAt: string | Date; qualification: { eligibilityStatus: string; criteria: Criterion[] } };
  history: Assessment[];
  canRerun: boolean;
};

const display = (value: unknown) => value === null ? "Not available" : typeof value === "object" ? Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${item}`).join(" · ") : String(value);
const date = (value: string | Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));

export function SuperhostAssessmentManager({ hostId, initial, history, canRerun }: Props) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const rerun = async () => {
    setRunning(true); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/superhost/evaluations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hostId }) });
      const payload = await response.json() as { success?: boolean; error?: { message?: string } };
      setMessage(payload.success ? "Assessment request completed. Refresh to view the immutable result." : payload.error?.message ?? "Unable to run assessment.");
    } catch { setMessage("Unable to run assessment."); } finally { setRunning(false); }
  };
  return <div className="space-y-6">
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Superhost</p><h1 className="mt-1 text-2xl font-medium text-zinc-950">Assessment status</h1><p className="mt-2 text-sm text-zinc-600">Official status: <strong>{initial.officialStatus ? "Superhost" : "Not Superhost"}</strong> · Qualification: <strong>{initial.qualification.eligibilityStatus}</strong></p><p className="mt-1 text-xs text-zinc-500">Next assessment: {date(initial.nextEvaluationAt)}</p></div>{canRerun && <button type="button" onClick={() => void rerun()} disabled={running} className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{running ? "Running…" : "Rerun assessment"}</button>}</div>{message && <p role="status" className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{message}</p>}</section>
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-medium text-zinc-950">Qualification criteria</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{initial.qualification.criteria.map((criterion) => <article key={criterion.id} className="rounded-xl border border-zinc-200 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-medium text-zinc-950">{criterion.id.replaceAll("_", " ")}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${criterion.status === "PASS" ? "bg-emerald-50 text-emerald-800" : criterion.status === "BLOCKED" ? "bg-amber-50 text-amber-900" : "bg-zinc-100 text-zinc-700"}`}>{criterion.status}</span></div><p className="mt-2 text-sm text-zinc-700">{criterion.explanation}</p><p className="mt-3 text-xs text-zinc-500">Actual: {display(criterion.actualValue)}<br />Target: {criterion.requiredThreshold}</p></article>)}</div></section>
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-medium text-zinc-950">Assessment history</h2>{history.length === 0 ? <p className="mt-3 text-sm text-zinc-600">No completed quarterly assessments.</p> : <div className="mt-4 space-y-3">{history.map((item) => <div key={item.id} className="rounded-xl border border-zinc-200 p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{date(item.evaluationDate)}</strong><span className={item.qualified ? "text-emerald-800" : "text-zinc-700"}>{item.qualified ? "Qualified" : item.failureReasons.some((reason) => /cannot be verified|cannot be determined/i.test(reason)) ? "Blocked" : "Not qualified"}</span></div><p className="mt-1 text-xs text-zinc-500">{date(item.windowStart)} – {date(item.windowEnd)}</p>{item.failureReasons.length > 0 && <p className="mt-2 text-xs text-zinc-600">{item.failureReasons.join(" · ")}</p>}</div>)}</div>}</section>
  </div>;
}
