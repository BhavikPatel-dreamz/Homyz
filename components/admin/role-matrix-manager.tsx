"use client";

import { useState, useTransition } from "react";
import { Alert, Badge } from "../ui";
import { toast } from "@/components/ui/toast";
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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleSlug, setNewRoleSlug] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const [pending, startTransition] = useTransition();

  const isSuperRole = activeRole.slug === "super_admin" || activeRole.slug === "super-admin";

  // Group permissions by module
  const modules = Array.from(new Set(allPermissions.map((p) => p.module)));

  function selectRole(role: RoleDetail) {
    setActiveRole(role);
    setSelectedPerms(new Set(role.permissions));
  }

  function togglePermission(slug: string) {
    if (isSuperRole) return;
    const next = new Set(selectedPerms);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    setSelectedPerms(next);
  }

  function toggleAllModulePermissions(moduleName: string) {
    if (isSuperRole) return;
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

  function selectAllGlobal() {
    if (isSuperRole) return;
    const allSlugs = allPermissions.map((p) => p.slug);
    setSelectedPerms(new Set(allSlugs));
  }

  function clearAllGlobal() {
    if (isSuperRole) return;
    setSelectedPerms(new Set());
  }

  function handleSavePermissions() {
    if (isSuperRole) {
      toast.error("Super Admin role permissions are fixed and cannot be modified.");
      return;
    }

    startTransition(async () => {
      const permsArray = Array.from(selectedPerms);
      const res = await updateRoleAction(activeRole.id, {
        permissions: permsArray,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      const updated = res.data as unknown as RoleDetail;
      setRoles(roles.map((r) => (r.id === activeRole.id ? { ...r, ...updated, permissionCount: permsArray.length } : r)));
      setActiveRole((prev) => ({ ...prev, ...updated, permissionCount: permsArray.length }));
      toast.success(`Permissions updated successfully for '${activeRole.name}'.`);
    });
  }

  function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    if (newRoleSlug.toLowerCase() === "super_admin" || newRoleSlug.toLowerCase() === "super-admin") {
      toast.error("Cannot create duplicate Super Admin role.");
      return;
    }

    startTransition(async () => {
      const res = await createRoleAction({
        name: newRoleName,
        slug: newRoleSlug.toLowerCase(),
        description: newRoleDesc,
        permissions: [],
      });

      if (!res.ok) {
        toast.error(res.error);
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
      toast.success(`Role '${created.name}' created. You can now configure its permissions below.`);
    });
  }

  function handleDeleteRole(role: RoleDetail) {
    if (role.isSystem || role.slug === "super_admin" || role.slug === "super-admin") {
      toast.error("Super Admin and system roles cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to delete the role '${role.name}'?`)) return;

    startTransition(async () => {
      const res = await deleteRoleAction(role.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      const nextRoles = roles.filter((r) => r.id !== role.id);
      setRoles(nextRoles);
      if (activeRole.id === role.id && nextRoles[0]) {
        selectRole(nextRoles[0]);
      }
      toast.success(`Role '${role.name}' deleted.`);
    });
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Role Cards List */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
          Configured Administrative Roles
        </h2>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-1.5 text-xs font-extrabold text-[var(--accent-foreground)] transition-all shadow-2xs cursor-pointer"
        >
          + Create Custom Role
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => {
          const isSelected = activeRole?.id === role.id;
          const isSuper = role.slug === "super_admin" || role.slug === "super-admin";

          return (
            <div
              key={role.id}
              onClick={() => selectRole(role)}
              className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-2xs ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--surface-secondary)] ring-2 ring-[var(--accent)]/20"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-subtle)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-muted-foreground text-sm">
                  {role.name}
                </h3>
                {isSuper ? (
                  <span className="text-[10px] font-extrabold bg-amber-100/90 text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    Super Admin
                  </span>
                ) : (
                  role.isSystem && (
                    <span className="text-[10px] font-bold bg-[var(--surface-secondary)] text-muted-foreground px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
                      System
                    </span>
                  )
                )}
              </div>

              <p className="mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2 min-h-[32px]">
                {role.description || "Administrative role bundle"}
              </p>

              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--muted-foreground)] font-mono">
                <span>{isSuper ? "ALL (Full Access)" : `${role.permissionCount} permissions`}</span>
                <span>{role.userCount} users</span>
              </div>

              {!role.isSystem && !isSuper && (
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRole(role);
                    }}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
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
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-muted-foreground">
                Role Matrix for: <span className="text-[var(--accent)]">{activeRole.name}</span>
              </h2>
              {isSuperRole ? (
                <span className="text-[10px] font-extrabold bg-amber-100/90 text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
                  🛡️ Fixed System Role
                </span>
              ) : (
                activeRole.isSystem && <Badge>System Role</Badge>
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {isSuperRole
                ? "Super Admin is a fixed system-level role with complete platform access."
                : "Configure default permissions granted to users holding this role."}
            </p>
          </div>

          {!isSuperRole && (
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={selectAllGlobal}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all shadow-2xs"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAllGlobal}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3 py-1.5 text-xs font-bold text-muted-foreground transition-all shadow-2xs"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={pending}
                className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 text-xs font-black text-[var(--accent-foreground)] transition-all shadow-2xs inline-flex items-center gap-2 disabled:opacity-50"
              >
                {pending && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>{pending ? "Saving..." : "Save Matrix Changes"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Super Admin Immutable Alert Notice */}
        {isSuperRole && (
          <div className="mt-6 rounded-2xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 p-4 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
            <span>🛡️ Super Admin permissions are immutable and cannot be modified or unassigned.</span>
          </div>
        )}

        {/* Matrix Table */}
        <div className="mt-6 flex flex-col gap-6">
          {modules.map((moduleName) => {
            const modulePerms = allPermissions.filter((p) => p.module === moduleName);
            const allChecked = isSuperRole || modulePerms.every((p) => selectedPerms.has(p.slug));

            return (
              <div key={moduleName} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    {moduleName} Module
                  </span>
                  {!isSuperRole && (
                    <button
                      type="button"
                      onClick={() => toggleAllModulePermissions(moduleName)}
                      className="text-[11px] font-bold text-[var(--accent)] hover:underline"
                    >
                      {allChecked ? "Uncheck module" : "Check module"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {modulePerms.map((perm) => {
                    const isChecked = isSuperRole || selectedPerms.has(perm.slug);

                    return (
                      <label
                        key={perm.slug}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all shadow-2xs ${
                          isSuperRole
                            ? "cursor-not-allowed opacity-90 border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20"
                            : isChecked
                            ? "cursor-pointer border-[var(--accent)] bg-[var(--surface)]"
                            : "cursor-pointer border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-subtle)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isSuperRole}
                          onChange={() => togglePermission(perm.slug)}
                          className="mt-0.5 h-4 w-4 rounded accent-[var(--accent)]"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-muted-foreground">
                            {perm.action}
                          </span>
                          <span className="text-[11px] text-[var(--muted-foreground)] leading-snug">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-extrabold text-muted-foreground">
                Create Administrative Role
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--muted-foreground)] hover:text-muted-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[var(--muted-foreground)]">Role Name *</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => {
                    setNewRoleName(e.target.value);
                    if (!newRoleSlug) {
                      setNewRoleSlug(e.target.value.toLowerCase().replace(/\s+/g, "_"));
                    }
                  }}
                  required
                  placeholder="e.g. Content Moderator"
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[var(--muted-foreground)]">Slug *</label>
                <input
                  type="text"
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value)}
                  required
                  placeholder="e.g. content_moderator"
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground px-3 py-2 text-xs outline-none focus:border-[var(--accent)] font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[var(--muted-foreground)]">Description</label>
                <textarea
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  rows={3}
                  placeholder="Responsibilities and permission overview..."
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={pending}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 text-xs font-extrabold text-[var(--accent-foreground)] transition-all shadow-2xs inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {pending && (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  <span>{pending ? "Creating..." : "Create Role"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
