import React from "react";

/** Matches the default all-properties reservation timeline footprint. */
export default function AdminCalendarLoading() {
  const days = Array.from({ length: 14 });
  const rows = Array.from({ length: 8 });

  return (
    <div className="flex animate-pulse flex-col gap-5 pb-16 text-muted-foreground">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-5 lg:flex-row">
        <div><div className="h-7 w-60 rounded bg-[var(--surface-secondary)]" /><div className="mt-2 h-4 w-96 max-w-full rounded bg-[var(--surface-secondary)]" /></div>
        <div className="flex gap-2"><div className="h-9 w-24 rounded-xl bg-[var(--surface-secondary)]" /><div className="h-9 w-28 rounded-xl bg-[var(--surface-secondary)]" /></div>
      </div>
      <div className="h-14 rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-9 rounded-xl bg-[var(--surface-secondary)]" />)}
      </div>
      <div className="flex justify-between"><div className="h-9 w-52 rounded-xl bg-[var(--surface-secondary)]" /><div className="h-9 w-48 rounded-xl bg-[var(--surface-secondary)]" /></div>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
        <div className="min-w-[900px]">
          <div className="flex border-b border-[var(--border)]"><div className="h-12 w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface-secondary)]" /><div className="grid flex-1" style={{ gridTemplateColumns: "repeat(14, minmax(56px, 1fr))" }}>{days.map((_, index) => <div key={index} className="h-12 border-r border-[var(--border)] bg-[var(--surface-secondary)]" />)}</div></div>
          {rows.map((_, row) => <div key={row} className="flex h-16 border-b border-[var(--border)]"><div className="flex w-64 shrink-0 items-center gap-3 border-r border-[var(--border)] px-3"><div className="h-9 w-9 rounded-lg bg-[var(--surface-secondary)]" /><div className="h-4 w-36 rounded bg-[var(--surface-secondary)]" /></div><div className="grid flex-1" style={{ gridTemplateColumns: "repeat(14, minmax(56px, 1fr))" }}>{days.map((_, column) => <div key={column} className="border-r border-[var(--border)]"><div className={`mx-1 mt-2 h-5 rounded ${column === row % 7 ? "bg-emerald-100 dark:bg-emerald-950/50" : ""}`} /></div>)}</div></div>)}
        </div>
      </div>
    </div>
  );
}
