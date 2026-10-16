"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

export default function CmsSectionTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/admin/cms/sections");
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          setTemplates(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.warn("Failed to load section templates", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border)] pb-5">
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          Homepage Section Templates
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Supported layout templates and structured query parameters for dynamic homepage building.
        </p>
      </div>
        <div className="flex items-center justify-between">
          <Link
            href="/admin/cms"
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
          >
            ← Back to Content List
          </Link>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {templates.length} registered template(s)
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                    <div className="h-3.5 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </div>
                  <div className="h-5 w-44 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                    <div className="h-3.5 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                    <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                    <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                    <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </div>
                </div>

                <div className="h-28 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 skeleton-shimmer" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {tpl.category}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                      {tpl.id}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">{tpl.name}</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Listing Query Engine:</span>
                    <span className={`font-semibold ${tpl.supportsPropertyQuery ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                      {tpl.supportsPropertyQuery ? "Supported" : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Media Uploads:</span>
                    <span className={`font-semibold ${tpl.supportsMedia ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                      {tpl.supportsMedia ? "Supported" : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Call-to-Action Link:</span>
                    <span className={`font-semibold ${tpl.supportsCta ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                      {tpl.supportsCta ? "Supported" : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900 dark:bg-zinc-950 text-zinc-300 dark:text-zinc-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-32 border border-transparent dark:border-zinc-800">
                  <pre>{JSON.stringify(tpl.defaultConfig, null, 2)}</pre>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

