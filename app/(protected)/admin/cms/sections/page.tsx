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
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
          >
            ← Back to Content List
          </Link>
          <span className="text-xs text-zinc-500">
            {templates.length} registered template(s)
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            Loading section templates...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700">
                      {tpl.category}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {tpl.id}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-zinc-900">{tpl.name}</h3>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Listing Query Engine:</span>
                    <span className={`font-semibold ${tpl.supportsPropertyQuery ? "text-emerald-600" : "text-zinc-400"}`}>
                      {tpl.supportsPropertyQuery ? "Supported" : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Media Uploads:</span>
                    <span className={`font-semibold ${tpl.supportsMedia ? "text-emerald-600" : "text-zinc-400"}`}>
                      {tpl.supportsMedia ? "Supported" : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Call-to-Action Link:</span>
                    <span className={`font-semibold ${tpl.supportsCta ? "text-emerald-600" : "text-zinc-400"}`}>
                      {tpl.supportsCta ? "Supported" : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900 text-zinc-300 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-32">
                  <pre>{JSON.stringify(tpl.defaultConfig, null, 2)}</pre>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

