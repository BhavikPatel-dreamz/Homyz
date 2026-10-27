"use client";

import React, { useState, useEffect } from "react";
import { TravelProfileVisibility } from "@/types/travel";
import { updateProfileVisibilityAction, unblockUserAction, getBlockedUsersAction } from "@/actions/travel/travelPrivacy";
import { toast } from "@/components/ui/toast";

interface TravelPrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVisibility: TravelProfileVisibility;
  onVisibilityUpdated?: (newVisibility: TravelProfileVisibility) => void;
}

export function TravelPrivacySettingsModal({
  isOpen,
  onClose,
  currentVisibility,
  onVisibilityUpdated,
}: TravelPrivacySettingsModalProps) {
  const [visibility, setVisibility] = useState<TravelProfileVisibility>(currentVisibility);
  const [isSaving, setIsSaving] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; name: string | null; image: string | null }[]>([]);
  const [activeTab, setActiveTab] = useState<"visibility" | "blocking">("visibility");

  useEffect(() => {
    setVisibility(currentVisibility);
  }, [currentVisibility]);

  useEffect(() => {
    if (!isOpen) return;
    getBlockedUsersAction()
      .then((users) => setBlockedUsers(users))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfileVisibilityAction(visibility);
      onVisibilityUpdated?.(visibility);
      toast.success("Profile privacy settings updated");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update privacy settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    try {
      await unblockUserAction(blockedId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedId));
      toast.success("User unblocked");
    } catch (err: any) {
      toast.error("Failed to unblock user");
    }
  };

  const options: {
    value: TravelProfileVisibility;
    title: string;
    description: string;
    icon: string;
  }[] = [
    {
      value: TravelProfileVisibility.PUBLIC,
      title: "Public",
      description: "Anyone can view your travel profile, photos, trips, and stamps.",
      icon: "🌍",
    },
    {
      value: TravelProfileVisibility.FOLLOWERS_ONLY,
      title: "Followers Only",
      description: "Only approved followers can view your travel diary and albums.",
      icon: "👥",
    },
    {
      value: TravelProfileVisibility.PRIVATE,
      title: "Private",
      description: "Only you can view your travel photos, trips, and milestones.",
      icon: "🔒",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-modal-title"
        className="relative z-10 w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-100 flex flex-col animate-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 size-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          ✕
        </button>

        <h3 id="privacy-modal-title" className="text-xl font-bold text-zinc-900">
          Travel Privacy & Controls
        </h3>
        <p className="text-xs text-zinc-500 mt-1">
          Manage who can discover and view your travel profile and photos.
        </p>

        {/* Tab switcher: Visibility vs Blocked Users */}
        <div className="flex border-b border-zinc-200 mt-4 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("visibility")}
            className={`py-2 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "visibility"
                ? "border-amber-500 text-amber-900"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Profile Visibility
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("blocking")}
            className={`py-2 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "blocking"
                ? "border-amber-500 text-amber-900"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Blocked Users ({blockedUsers.length})
          </button>
        </div>

        {activeTab === "visibility" ? (
          <div>
            <div className="space-y-3">
              {options.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3.5 p-3.5 rounded-2xl border cursor-pointer transition ${
                    visibility === opt.value
                      ? "border-amber-500 bg-amber-50/50 shadow-2xs"
                      : "border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="profile-visibility"
                    value={opt.value}
                    checked={visibility === opt.value}
                    onChange={() => setVisibility(opt.value)}
                    className="mt-1 size-4 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-sm text-zinc-900">
                      <span>{opt.icon}</span>
                      <span>{opt.title}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save Privacy"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {blockedUsers.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {blockedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 bg-zinc-50/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-xs text-zinc-600">
                        {u.name ? u.name.charAt(0) : "U"}
                      </div>
                      <span className="text-xs font-semibold text-zinc-800">
                        {u.name || "User"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(u.id)}
                      className="px-3 py-1 rounded-lg text-[11px] font-bold text-red-600 hover:bg-red-50 border border-red-200 transition cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-zinc-500">
                You haven&apos;t blocked any travelers.
              </div>
            )}

            <div className="mt-6 flex justify-end pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

