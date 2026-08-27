"use client";

import { useState, useTransition } from "react";
import { Alert, Badge } from "../ui";
import {
  createRoleAction,
  updateRoleAction,
  deleteRoleAction,
} from "@/actions/admin/adminManagement";
import type { PermissionDefinition } from "@/lib/permissions/permissions";

export interface RoleDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  permissions: string[];
}

export function RoleMatrixManager({
  initialRoles,
  allPermissions,
}: {
  initialRoles: RoleDetail[];
  allPermissions: PermissionDefinition[];
}) {
  const [roles, setRoles] = useState<RoleDetail[]>(initialRoles);
  const [activeRole, setActiveRole] = useState<RoleDetail>(initialRoles[0]);

  // Selected permissions set for the active role
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    new Set(initialRoles[0]?.permissions || []),
  );

  // Modals & form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleSlug, setNewRoleSlug] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Group permissions by module
  const modules = Array.from(new Set(allPermissions.map((p) => p.module)));

  function selectRole(role: RoleDetail) {
    setActiveRole(role);
    setSelectedPerms(new Set(role.permissions));
    setFeedback(null);
  }

  function togglePermission(slug: string) {
    const next = new Set(selectedPerms);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    setSelectedPerms(next);
  }

  function toggleAllModulePermissions(moduleName: string) {
    const modulePerms = allPermissions.filter((p) => p.module === moduleName).map((p) => p.slug);
    const allSelected = modulePerms.every((slug) => selectedPerms.has(slug));

    const next = new Set(selectedPerms);
    if (allSelected) {
      modulePerms.forEach((slug) => next.delete(slug));
    } else {
      modulePerms.forEach((slug) => next.add(slug));
    }
    setSelectedPerms(next);
  }

  function handleSavePermissions() {
    setFeedback(null);

    startTransition(async () => {
      const permsArray = Array.from(selectedPerms);
      const res = await updateRoleAction(activeRole.id, {
        permissions: permsArray,
      });

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }

      const updated = res.data as unknown as RoleDetail;
      setRoles(roles.map((r) => (r.id === activeRole.id ? { ...r, ...updated, permissionCount: permsArray.length } : r)));
      setActiveRole((prev) => ({ ...prev, ...updated, permissionCount: permsArray.length }));
      setFeedback({
        tone: "success",
        msg: `Permissions updated successfully for '${activeRole.name}'.`,
      });
    });
  }

  function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createRoleAction({
        name: newRoleName,
        slug: newRoleSlug.toLowerCase(),
        description: newRoleDesc,
        permissions: [],
      });

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }

      const created: RoleDetail = {
        ...(res.data as unknown as RoleDetail),
        userCount: 0,
        permissionCount: 0,
        permissions: [],
      };

      setRoles([...roles, created]);
      selectRole(created);
      setShowCreateModal(false);
      setNewRoleName("");
      setNewRoleSlug("");
      setNewRoleDesc("");
      setFeedback({ tone: "success", msg: `Role '${created.name}' created. You can now configure its permissions below.` });
    });
  }

  function handleDeleteRole(role: RoleDetail) {
    if (role.isSystem) return;
    if (!confirm(`Are you sure you want to delete the role '${role.name}'?`)) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await deleteRoleAction(role.id);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }

      const nextRoles = roles.filter((r) => r.id !== role.id);
      setRoles(nextRoles);
      if (activeRole.id === role.id && nextRoles[0]) {
        selectRole(nextRoles[0]);
      }
      setFeedback({ tone: "success", msg: `Role '${role.name}' deleted.` });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {feedback && (
        <Alert tone={feedback.tone}>
          <div className="flex items-center justify-between">
            <span>{feedback.msg}</span>
            <button onClick={() => setFeedback(null)} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* Role Cards List */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Configured Roles
        </h2>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center rounded-full bg-[#F8D88E] hover:bg-[#F4CF74] px-4 py-1.5 text-xs font-semibold text-zinc-900 transition-colors shadow-2xs"
        >
          + Create Role
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => {
          const isSelected = activeRole?.id === role.id;

          return (
            <div
              key={role.id}
              onClick={() => selectRole(role)}
              className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                isSelected
                  ? "border-amber-400 bg-amber-50/40 shadow-xs "
                  : "border-zinc-200 bg-white hover:border-zinc-300 "
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-zinc-900 text-sm">
                  {role.name}
                </h3>
                {role.isSystem && (
                  <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                    System
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-zinc-500 line-clamp-2 min-h-[32px]">
                {role.description || "Custom role with specific permissions"}
              </p>

              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                <span>{role.permissionCount} permissions</span>
                <span>{role.userCount} assigned users</span>
              </div>

              {!role.isSystem && (
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRole(role);
                    }}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    Delete role
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Permission Matrix Section */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100 ">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900 ">
                Permission Matrix for: <span className="text-amber-800 ">{activeRole.name}</span>
              </h2>
              {activeRole.isSystem && <Badge>System Protected</Badge>}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Check or uncheck permissions to adjust what administrators holding this role can access.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSavePermissions}
            disabled={pending}
            className="rounded-full bg-[#F8D88E] hover:bg-[#F4CF74] px-5 py-2 text-xs font-semibold text-zinc-900 transition-colors shadow-2xs disabled:opacity-50 self-start sm:self-auto"
          >
            {pending ? "Saving..." : "Save Matrix Changes"}
          </button>
        </div>

        {/* Matrix Table */}
        <div className="mt-6 flex flex-col gap-6">
          {modules.map((moduleName) => {
            const modulePerms = allPermissions.filter((p) => p.module === moduleName);
            const allChecked = modulePerms.every((p) => selectedPerms.has(p.slug));

            return (
              <div key={moduleName} className="rounded-xl border border-zinc-100 bg-zinc-50/30 p-4 ">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-800 ">
                    {moduleName} Module
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAllModulePermissions(moduleName)}
                    className="text-[11px] font-medium text-amber-800 hover:underline "
                  >
                    {allChecked ? "Uncheck all" : "Check all"}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {modulePerms.map((perm) => {
                    const isChecked = selectedPerms.has(perm.slug);

                    return (
                      <label
                        key={perm.slug}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? "border-amber-300 bg-amber-50/60 "
                            : "border-zinc-200 bg-white hover:border-zinc-300 "
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(perm.slug)}
                          className="mt-0.5 h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-zinc-900 ">
                            {perm.action}
                          </span>
                          <span className="text-[11px] text-zinc-500 ">
                            {perm.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Create Role */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 ">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">
              Create Custom Role
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Define a new administrative role with tailored operational boundaries.
            </p>

            <form onSubmit={handleCreateRole} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 ">
                  Role Name *
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => {
                    setNewRoleName(e.target.value);
                    if (!newRoleSlug) {
                      setNewRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_"));
                    }
                  }}
                  required
                  placeholder="e.g. Content Moderator"
                  className="rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-600 "
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 ">
                  Role Slug *
                </label>
                <input
                  type="text"
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value.toLowerCase())}
                  required
                  placeholder="e.g. content_moderator"
                  className="rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-600 "
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 ">
                  Description
                </label>
                <textarea
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  rows={2}
                  placeholder="Describe the operational purpose of this role..."
                  className="rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-600 resize-none"
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[#F8D88E] hover:bg-[#F4CF74] px-5 py-2 text-xs font-semibold text-zinc-900 transition-colors disabled:opacity-50"
                >
                  {pending ? "Creating..." : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
