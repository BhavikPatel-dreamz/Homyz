"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PERMISSIONS, hasPermission } from "@/lib/permissions/permissions";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { CmsVisualPreview } from "@/components/admin/cms/cms-visual-preview";
import { CmsBannerForm, BannerPayload } from "@/components/admin/cms/cms-banner-form";

export default function CmsContentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params?.id as string;

  const { data: session } = useSession();
  const user = session?.user;

  // Master Content State
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [formPayload, setFormPayload] = useState<Record<string, any>>({});
  const [payloadText, setPayloadText] = useState("{}");
  const [changeSummary, setChangeSummary] = useState("");
  const [expectedVersionNumber, setExpectedVersionNumber] = useState(1);
  const [isDirty, setIsDirty] = useState(false);

  // Editor Tabs & Panes
  const [activeTab, setActiveTab] = useState<"visual" | "json">("visual");
  const [showLivePreviewPane, setShowLivePreviewPane] = useState(true);

  // History & Drawer
  const [revisions, setRevisions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleActionType, setScheduleActionType] = useState<"PUBLISH" | "UNPUBLISH">("PUBLISH");
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // Preview Modal
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [resolvingPreview, setResolvingPreview] = useState(false);

  // Multilingual / Translations State
  const [translationsData, setTranslationsData] = useState<any>(null);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [creatingTranslationLocale, setCreatingTranslationLocale] = useState<string | null>(null);
  const [showAddTranslationModal, setShowAddTranslationModal] = useState(false);

  // Permissions
  const canPublish = hasPermission(user, PERMISSIONS.CMS_PUBLISH);
  const canUnpublish = hasPermission(user, PERMISSIONS.CMS_UNPUBLISH);
  const canEdit = hasPermission(user, PERMISSIONS.CMS_EDIT);
  const canSchedule = hasPermission(user, PERMISSIONS.CMS_SCHEDULE);
  const canRollback = hasPermission(user, PERMISSIONS.CMS_ROLLBACK);
  const canPreview = hasPermission(user, PERMISSIONS.CMS_PREVIEW);

  // Warn before leaving if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Fetch Translations Group
  const fetchTranslations = useCallback(async () => {
    if (!contentId) return;
    setLoadingTranslations(true);
    try {
      const res = await fetch(`/api/v1/admin/cms/content/${contentId}/translations`);
      if (res.ok) {
        const json = await res.json();
        setTranslationsData(json.data || json);
      }
    } catch (err) {
      console.warn("Failed to fetch translations:", err);
    } finally {
      setLoadingTranslations(false);
    }
  }, [contentId]);

  // Create Translation Variant
  const handleCreateTranslation = async (targetLocale: string) => {
    setCreatingTranslationLocale(targetLocale);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/cms/content/${contentId}/translations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLocale }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || (typeof errJson.error === "string" ? errJson.error : "Failed to create translation"));
      }
      const json = await res.json();
      const newContent = json.data || json;
      setShowAddTranslationModal(false);
      router.push(`/admin/cms/${newContent.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingTranslationLocale(null);
    }
  };

  // Fetch Content Details
  const fetchContentDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/cms/content/${contentId}`);
      if (!res.ok) throw new Error("Failed to fetch content item");
      const json = await res.json();
      const data = json.data || json;
      setContent(data);
      setTitle(data.title || "");
      setSlug(data.slug || "");

      const activeSnapshot = data.draftVersion?.payload || data.versions?.[0]?.payload || {};
      setFormPayload(activeSnapshot);
      setPayloadText(JSON.stringify(activeSnapshot, null, 2));
      setExpectedVersionNumber(data.draftVersion?.versionNumber || data.versions?.[0]?.versionNumber || 1);
      setIsDirty(false);
    } catch (err: any) {
      setError(err.message || "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  // Fetch Version History
  const fetchRevisions = async () => {
    try {
      const res = await fetch(`/api/v1/admin/cms/content/${contentId}/versions`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setRevisions(Array.isArray(data) ? data : data.versions || []);
      }
    } catch (err) {
      console.warn("Failed to fetch revisions:", err);
    }
  };

  useEffect(() => {
    if (contentId) {
      fetchContentDetails();
      fetchTranslations();
    }
  }, [contentId, fetchContentDetails, fetchTranslations]);

  // Sync Form Payload -> JSON Payload Text
  const handleFormPayloadChange = (updated: Record<string, any>) => {
    setFormPayload(updated);
    setPayloadText(JSON.stringify(updated, null, 2));
    setIsDirty(true);
    setFieldErrors({});
  };

  // Sync JSON Text -> Form Payload
  const handleJsonTextChange = (text: string) => {
    setPayloadText(text);
    setIsDirty(true);
    try {
      const parsed = JSON.parse(text);
      setFormPayload(parsed);
      setFieldErrors({});
    } catch {
      // Allow user to continue typing raw JSON until valid
    }
  };

  // Save Draft Action
  const handleSaveDraft = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    setFieldErrors({});

    let payloadToSave: Record<string, any> = formPayload;
    if (activeTab === "json") {
      try {
        payloadToSave = JSON.parse(payloadText);
      } catch {
        setError("Invalid JSON format in payload editor. Please correct JSON syntax before saving.");
        setSaving(false);
        return;
      }
    }

    try {
      const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, "");

      const res = await fetch(`/api/v1/admin/cms/content/${contentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: cleanSlug || undefined,
          payload: payloadToSave,
          changeSummary: changeSummary.trim() || undefined,
          expectedVersionNumber,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let errMsg = "Failed to save draft";
        if (typeof errData.error === "string") {
          errMsg = errData.error;
        } else if (errData.error?.message) {
          errMsg = errData.error.message;
          if (Array.isArray(errData.error.details) && errData.error.details.length > 0) {
            const fieldMap: Record<string, string> = {};
            const detailMsgs = errData.error.details.map((d: any) => {
              if (d.path) fieldMap[d.path] = d.message;
              return `${d.path}: ${d.message}`;
            }).join(", ");
            setFieldErrors(fieldMap);
            errMsg += ` (${detailMsgs})`;
          }
        }
        throw new Error(errMsg);
      }

      setChangeSummary("");
      setIsDirty(false);
      setSuccessMsg("Draft revision saved successfully.");
      await fetchContentDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Publish Live Action
  const handlePublish = async () => {
    if (!canPublish) return;
    if (!confirm("Are you sure you want to publish this content revision to the live website?")) return;

    setPublishing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // If there are unsaved changes, save first
      if (isDirty) {
        await handleSaveDraft();
      }

      const res = await fetch(`/api/v1/admin/cms/content/${contentId}/publish`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || (typeof err.error === "string" ? err.error : "Publish failed"));
      }

      setSuccessMsg("Content published live! Public cache invalidated.");
      await fetchContentDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  // Unpublish Action
  const handleUnpublish = async () => {
    if (!canUnpublish) return;
    if (!confirm("Are you sure you want to remove this content from the live website?")) return;

    setUnpublishing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/cms/content/${contentId}/unpublish`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || (typeof err.error === "string" ? err.error : "Unpublish failed"));
      }

      setSuccessMsg("Content unpublished from live site. History remains preserved.");
      await fetchContentDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUnpublishing(false);
    }
  };

  // Preview Snapshot Action
  const handlePreview = async (targetVersionId?: string) => {
    setResolvingPreview(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/cms/content/${contentId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: targetVersionId || content.draftVersionId || content.versions?.[0]?.id }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.error || "Failed to generate preview token");
      }

      const tokenJson = await res.json();
      const token = tokenJson.data?.token || tokenJson.token;
      if (!token) throw new Error("Preview token missing from server response");

      setPreviewToken(token);

      const previewRes = await fetch(`/api/v1/admin/cms/preview/${token}`);
      if (!previewRes.ok) {
        const pErr = await previewRes.json().catch(() => ({}));
        throw new Error(pErr.error || "Failed to resolve preview snapshot");
      }

      const pData = await previewRes.json();
      setPreviewData(pData.data || pData);
      setShowPreviewModal(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResolvingPreview(false);
    }
  };

  // Schedule Submit Action
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDateTime || !canSchedule) return;

    setScheduling(true);
    try {
      const res = await fetch(`/api/v1/admin/cms/content/${contentId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: scheduleActionType,
          scheduledFor: new Date(scheduledDateTime).toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || "Failed to schedule action");
      }

      setShowScheduleModal(false);
      setSuccessMsg(`Action scheduled successfully for ${new Date(scheduledDateTime).toLocaleString()}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScheduling(false);
    }
  };

  // Rollback / Restore Revision Action
  const handleRestoreRevision = async (versionId: string) => {
    if (!canRollback) return;
    if (!confirm("Restore this historical revision as a new draft? Older history will NOT be deleted.")) return;

    setRestoringVersionId(versionId);
    try {
      const res = await fetch(`/api/v1/admin/cms/content/${contentId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId,
          publishImmediately: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || "Rollback failed");
      }

      setSuccessMsg("Historical revision successfully restored as a new draft.");
      setShowHistory(false);
      await fetchContentDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRestoringVersionId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500 font-medium">Loading CMS content editor...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="py-24 text-center space-y-4">
        <h2 className="text-lg font-bold text-zinc-800">Content Item Not Found</h2>
        <p className="text-sm text-zinc-500">The requested content record does not exist or was deleted.</p>
        <Link
          href="/admin/cms"
          className="inline-flex px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800"
        >
          Return to Content List
        </Link>
      </div>
    );
  }

  const isPublished = content.status === "PUBLISHED";
  const publishedRevNumber = content.publication?.version?.versionNumber;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-[var(--border)] pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/cms"
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
            >
              ← All CMS Content
            </Link>
            <span className="text-zinc-300">•</span>
            <span className="text-xs text-zinc-400 font-mono">{content.type}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
            {title || content.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[var(--muted-foreground)]">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isPublished
                  ? "bg-emerald-100 text-emerald-800"
                  : content.status === "DRAFT"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {content.status}
            </span>
            <span>Draft Revision: <strong>#{expectedVersionNumber}</strong></span>
            <span>•</span>
            <span>
              Live Published:{" "}
              {publishedRevNumber ? (
                <strong className="text-emerald-700">Revision #{publishedRevNumber}</strong>
              ) : (
                <span className="text-zinc-400">None (Unpublished)</span>
              )}
            </span>
            {isDirty && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Unsaved changes
              </span>
            )}
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {canPreview && (
            <button
              type="button"
              disabled={resolvingPreview}
              onClick={() => handlePreview()}
              className="px-3 py-2 border border-zinc-200 bg-white text-zinc-700 rounded-xl text-xs font-semibold hover:bg-zinc-50 transition shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {resolvingPreview ? "Generating..." : "Preview Snapshot"}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              fetchRevisions();
              setShowHistory(true);
            }}
            className="px-3 py-2 border border-zinc-200 bg-white text-zinc-700 rounded-xl text-xs font-semibold hover:bg-zinc-50 transition shadow-2xs inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History ({content.versions?.length || 1})
          </button>

          {canSchedule && (
            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              className="px-3 py-2 border border-zinc-200 bg-white text-zinc-700 rounded-xl text-xs font-semibold hover:bg-zinc-50 transition shadow-2xs inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Schedule
            </button>
          )}

          {canUnpublish && isPublished && (
            <button
              type="button"
              disabled={unpublishing}
              onClick={handleUnpublish}
              className="px-3 py-2 border border-rose-200 text-rose-700 bg-rose-50/50 rounded-xl text-xs font-semibold hover:bg-rose-100/60 transition disabled:opacity-50"
            >
              {unpublishing ? "Unpublishing..." : "Unpublish"}
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveDraft()}
              className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50 transition shadow-xs"
            >
              {saving ? "Saving Draft..." : "Save Draft"}
            </button>
          )}

          {canPublish && (
            <button
              type="button"
              disabled={publishing}
              onClick={handlePublish}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs inline-flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {publishing ? "Publishing..." : "Publish Live"}
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Multilingual / Translation Bar */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              Multilingual Translations
            </span>
            {content?.locale === "ar" && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Arabic RTL Layout Active
              </span>
            )}
          </div>

          {translationsData && (
            <div className="text-xs text-zinc-500 font-medium">
              Completeness:{" "}
              <span className="font-bold text-zinc-800">
                {translationsData.translations?.length || 1} / {translationsData.supportedLocales?.length || 6}
              </span>{" "}
              languages
            </div>
          )}
        </div>

        {/* Locale Variants Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {translationsData?.translations?.map((item: any) => {
            const isCurrent = item.id === contentId;
            return (
              <Link
                key={item.id}
                href={`/admin/cms/${item.id}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  isCurrent
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                    : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300"
                }`}
              >
                <span className="font-mono uppercase font-bold text-[11px]">{item.locale}</span>
                <span className="truncate max-w-[120px]">{item.title}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    item.status === "PUBLISHED"
                      ? isCurrent
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-100 text-emerald-800"
                      : isCurrent
                      ? "bg-zinc-700 text-zinc-200"
                      : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {item.status}
                </span>
              </Link>
            );
          })}

          {/* Add Translation Button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddTranslationModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition shadow-2xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Add Language Translation</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor & Preview Layout */}
      <div className="space-y-6">
        {/* Editor Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-zinc-200 shadow-xs">
          {/* Editor Mode Tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("visual")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === "visual"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Visual Form Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("json")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === "json"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Advanced JSON
            </button>
          </div>

          {/* Live Preview Toggle */}
          <button
            type="button"
            onClick={() => setShowLivePreviewPane(!showLivePreviewPane)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              showLivePreviewPane
                ? "bg-zinc-100 border-zinc-300 text-zinc-900"
                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            <span>{showLivePreviewPane ? "Hide Live Preview" : "Show Live Preview"}</span>
          </button>
        </div>

        {/* Main Grid: Form on Left, Live Preview on Right */}
        <div className={`grid grid-cols-1 ${showLivePreviewPane ? "lg:grid-cols-12" : ""} gap-6`}>
          {/* Left Form Editor Column */}
          <div className={showLivePreviewPane ? "lg:col-span-7 space-y-6" : "space-y-6"}>
            {activeTab === "visual" && content.type === "HOMEPAGE_BANNER" && (
              <CmsBannerForm
                payload={formPayload as BannerPayload}
                onChange={handleFormPayloadChange}
                title={title}
                onTitleChange={(t) => {
                  setTitle(t);
                  setIsDirty(true);
                }}
                slug={slug}
                onSlugChange={(s) => {
                  setSlug(s);
                  setIsDirty(true);
                }}
                changeSummary={changeSummary}
                onChangeSummaryChange={setChangeSummary}
                errors={fieldErrors}
              />
            )}

            {(activeTab === "json" || content.type !== "HOMEPAGE_BANNER") && (
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <h3 className="text-sm font-bold text-zinc-900">
                    {content.type === "HOMEPAGE_BANNER" ? "Advanced JSON Configuration" : `${content.type} Attributes`}
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-mono">schema validated</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Internal Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">URL Slug</label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Structured JSON Payload</label>
                    <textarea
                      rows={14}
                      value={payloadText}
                      onChange={(e) => handleJsonTextChange(e.target.value)}
                      className="w-full font-mono text-xs p-4 bg-zinc-900 text-zinc-100 rounded-xl border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Change Summary / Revision Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Updated content fields and configuration"
                      value={changeSummary}
                      onChange={(e) => setChangeSummary(e.target.value)}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Live Preview Column */}
          {showLivePreviewPane && (
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-20 bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">Live Visual Preview</h3>
                    <p className="text-[11px] text-zinc-500">Real-time storefront presentation</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Live Reactive
                  </span>
                </div>

                <CmsVisualPreview
                  type={content.type}
                  payload={formPayload}
                  title={title}
                  versionNumber={expectedVersionNumber}
                  locale={content?.locale}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Snapshot Preview Modal */}
      {showPreviewModal && previewData && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] p-6 shadow-2xl border border-zinc-200 flex flex-col space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="inline-block px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-md mr-2">
                  SNAPSHOT PREVIEW
                </span>
                <span className="text-sm font-bold text-zinc-900">
                  {previewData.content?.title} (Revision #{previewData.version?.versionNumber})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Visual Preview */}
            <CmsVisualPreview
              type={previewData.content?.type}
              payload={previewData.version?.payload || {}}
              versionNumber={previewData.version?.versionNumber}
              locale={previewData.content?.locale || content?.locale}
            />

            {/* Shareable Token Notice */}
            {previewToken && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-zinc-600 font-semibold">
                  <span>Authorized Preview Endpoint:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/v1/admin/cms/preview/${previewToken}`);
                      alert("Preview link copied to clipboard!");
                    }}
                    className="text-emerald-600 hover:text-emerald-700 font-bold"
                  >
                    Copy Link
                  </button>
                </div>
                <p className="font-mono text-[11px] text-zinc-400 truncate">
                  /api/v1/admin/cms/preview/{previewToken}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Version History Drawer */}
      {showHistory && (
        <ModalOverlay className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="bg-white w-full max-w-lg h-full p-6 shadow-2xl flex flex-col space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Immutable Version History</h3>
                <p className="text-xs text-zinc-500">Every save creates a permanent, non-destructive snapshot.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {revisions.map((rev) => {
                const isLive = content.publishedVersionId === rev.id;
                const isCurrentDraft = content.draftVersionId === rev.id;

                return (
                  <div
                    key={rev.id}
                    className={`p-4 border rounded-2xl space-y-3 transition ${
                      isLive
                        ? "border-emerald-300 bg-emerald-50/20"
                        : isCurrentDraft
                        ? "border-amber-300 bg-amber-50/10"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-zinc-900">
                        Revision #{rev.versionNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isLive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            LIVE STOREFRONT
                          </span>
                        )}
                        {isCurrentDraft && !isLive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            CURRENT DRAFT
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 italic">
                      "{rev.changeSummary || "No change note provided"}"
                    </p>

                    <div className="text-[11px] text-zinc-400 space-y-0.5">
                      <div>Created: {new Date(rev.createdAt).toLocaleString()}</div>
                      <div>Author: {rev.createdBy?.name || rev.createdBy?.email || "System"}</div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                      <button
                        type="button"
                        onClick={() => handlePreview(rev.id)}
                        className="px-2.5 py-1 text-xs border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 font-medium"
                      >
                        Preview Snapshot
                      </button>

                      {canRollback && !isCurrentDraft && (
                        <button
                          type="button"
                          disabled={restoringVersionId === rev.id}
                          onClick={() => handleRestoreRevision(rev.id)}
                          className="px-2.5 py-1 text-xs bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 font-medium disabled:opacity-50"
                        >
                          {restoringVersionId === rev.id ? "Restoring..." : "Restore as New Draft"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Schedule Action Modal */}
      {showScheduleModal && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">Schedule Publishing Action</h3>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Action Type</label>
                <select
                  value={scheduleActionType}
                  onChange={(e) => setScheduleActionType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm bg-white"
                >
                  <option value="PUBLISH">Publish Draft Revision</option>
                  <option value="UNPUBLISH">Unpublish Live Content</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Durable cron worker triggers the action at the scheduled timestamp.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-3.5 py-2 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduling}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50"
                >
                  {scheduling ? "Scheduling..." : "Confirm Schedule"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Add Translation Modal */}
      {showAddTranslationModal && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Add Language Translation</h3>
                <p className="text-xs text-zinc-500">Clones current draft payload to a new locale</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTranslationModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-700">Choose Target Language</label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {translationsData?.supportedLocales
                  ?.filter((loc: any) => !loc.isTranslated)
                  .map((loc: any) => (
                    <div
                      key={loc.locale}
                      className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:bg-white transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono uppercase text-xs font-bold px-2 py-0.5 rounded bg-zinc-200 text-zinc-800">
                          {loc.locale}
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-zinc-900">{loc.label}</div>
                          <div className="text-[10px] text-zinc-500 uppercase">{loc.dir === "rtl" ? "Right-to-Left (RTL)" : "Left-to-Right (LTR)"}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={creatingTranslationLocale !== null}
                        onClick={() => handleCreateTranslation(loc.locale)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition shadow-2xs"
                      >
                        {creatingTranslationLocale === loc.locale ? "Creating..." : "Translate"}
                      </button>
                    </div>
                  ))}

                {translationsData?.supportedLocales?.every((loc: any) => loc.isTranslated) && (
                  <div className="p-4 text-center text-xs text-zinc-500 italic">
                    All supported languages ({translationsData?.supportedLocales?.length}) have already been translated!
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowAddTranslationModal(false)}
                className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-xl text-xs font-semibold hover:bg-zinc-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
