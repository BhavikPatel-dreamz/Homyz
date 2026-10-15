"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableFilterOption = {
  value: string;
  label: string;
  description?: string;
};

export type SearchableFilterPage = {
  options: SearchableFilterOption[];
  hasMore: boolean;
};

type Props = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options?: SearchableFilterOption[];
  loadOptions?: (search: string, page: number, signal: AbortSignal, selected?: string) => Promise<SearchableFilterPage>;
  /** Distinguishes cached pages when an option source is scoped by another filter. */
  cacheScope?: string;
};

const pageCache = new Map<string, { expiresAt: number; page: SearchableFilterPage }>();
const CACHE_MS = 60_000;

export function SearchableFilterCombobox({ label, placeholder, value, onChange, options: staticOptions, loadOptions, cacheScope = "" }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchableFilterOption[]>(staticOptions || []);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const visibleItems = useMemo(() => {
    if (loadOptions) return items;
    const normalized = query.trim().toLowerCase();
    return (staticOptions || []).filter((item) => !normalized || `${item.label} ${item.description || ""}`.toLowerCase().includes(normalized));
  }, [items, loadOptions, query, staticOptions]);
  const selected = [...items, ...(staticOptions || [])].find((item) => item.value === value);

  const fetchPage = async (nextQuery: string, nextPage: number, append = false, selectedValue?: string) => {
    if (!loadOptions) return;
    const cacheKey = `${id}:${cacheScope}:${nextQuery}:${nextPage}:${selectedValue || ""}`;
    const cached = pageCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setItems((previous) => append ? [...previous, ...cached.page.options.filter((option) => !previous.some((item) => item.value === option.value))] : cached.page.options);
      setHasMore(cached.page.hasMore);
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setRequestError(null);
    try {
      const result = await loadOptions(nextQuery, nextPage, controller.signal, selectedValue);
      if (controller.signal.aborted) return;
      pageCache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, page: result });
      setItems((previous) => append ? [...previous, ...result.options.filter((option) => !previous.some((item) => item.value === option.value))] : result.options);
      setHasMore(result.hasMore);
      setPage(nextPage);
      setActive(0);
    } catch (error) {
      if (!controller.signal.aborted) setRequestError(error instanceof Error ? error.message : "Could not load options.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      abort.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const timer = window.setTimeout(() => void fetchPage(query, 1), 250);
    return () => window.clearTimeout(timer);
  // fetchPage is intentionally recreated from props; opening/searching is the request boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, cacheScope]);

  // Resolve a selected URL value without loading every dropdown on page load.
  useEffect(() => {
    if (!loadOptions || !value || selected) return;
    const timer = window.setTimeout(() => void fetchPage("", 1, false, value), 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setQuery("");
    setOpen(false);
  };

  const toggle = () => {
    if (!open && root.current) {
      const bounds = root.current.getBoundingClientRect();
      setOpenUpward(window.innerHeight - bounds.bottom < 280 && bounds.top > 280);
    }
    setOpen((current) => !current);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((current) => Math.min(current + 1, Math.max(0, visibleItems.length - 1))); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => Math.max(0, current - 1)); }
    if (event.key === "Enter" && visibleItems[active]) { event.preventDefault(); choose(visibleItems[active].value); }
  };

  return (
    <div ref={root} className="relative min-w-0" onKeyDown={onKeyDown}>
      <label htmlFor={`${id}-trigger`} className="mb-1.5 block text-[11px] font-semibold text-[var(--muted-foreground)]">{label}</label>
      <button id={`${id}-trigger`} type="button" aria-expanded={open} aria-haspopup="listbox" onClick={toggle} className="flex h-10 w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 text-left text-xs text-foreground hover:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
        <span className="min-w-0 flex-1 truncate">{selected?.label || (value ? "Selected value" : placeholder)}</span>
        {value && <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); choose(""); }} className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--surface)]" aria-label={`Clear ${label}`}>×</span>}
        <span className="text-[var(--muted-foreground)]">⌄</span>
      </button>
      {open && <div className={`absolute z-40 w-full min-w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl ${openUpward ? "bottom-full mb-1.5" : "mt-1.5"}`}>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-2 text-[var(--muted-foreground)]">⌕</span>
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] pl-7 pr-7 text-xs text-foreground outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)] hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <div role="listbox" className="mt-2 max-h-56 overflow-y-auto">
          <button type="button" role="option" aria-selected={!value} onClick={() => choose("")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]"><span className="min-w-0 flex-1 truncate">{placeholder}</span>{!value && <span className="text-[var(--accent)]">✓</span>}</button>
          {value && <button type="button" onClick={() => choose("")} className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)]">Clear selection</button>}
          {loading && <p className="px-2.5 py-3 text-xs text-[var(--muted-foreground)]">Loading options…</p>}
          {!loading && requestError && <button type="button" onClick={() => void fetchPage(query, 1)} className="w-full rounded-lg px-2.5 py-3 text-left text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-300">Could not load options. Retry</button>}
          {!loading && !requestError && visibleItems.length === 0 && <p className="px-2.5 py-3 text-xs text-[var(--muted-foreground)]">No matching options.</p>}
          {!loading && !requestError && visibleItems.map((item, index) => <button key={item.value} type="button" role="option" aria-selected={item.value === value} onMouseEnter={() => setActive(index)} onClick={() => choose(item.value)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[var(--surface-secondary)] ${index === active ? "bg-[var(--surface-secondary)]" : ""}`}><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-foreground">{item.label}</span>{item.description && <span className="block truncate text-[10px] text-[var(--muted-foreground)]">{item.description}</span>}</span>{item.value === value && <span className="text-[var(--accent)]">✓</span>}</button>)}
          {!loading && loadOptions && hasMore && <button type="button" onClick={() => void fetchPage(query, page + 1, true)} className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface-secondary)]">Load more</button>}
        </div>
      </div>}
    </div>
  );
}
