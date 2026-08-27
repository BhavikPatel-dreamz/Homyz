"use client";

import { useState, useTransition } from "react";
import { Alert } from "../ui";
import {
  createAdminAction,
  updateAdminAction,
  deleteAdminAction,
  toggleUserStatusAction,
  resetAdminPasswordAction,
  revokeUserSessionsAction,
} from "@/actions/admin/adminManagement";

export interface AdminUserItem {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status?: string;
  lastLoginAt?: Date | string | null;
  adminRoleId?: string | null;
  adminRole?: { name: string; slug: string } | null;
  createdAt: Date | string;
}

export interface RoleOption {
  id: string;
  name: string;
  slug: string;
}

export function AdminUserTable({
  initialUsers,
  availableRoles,
}: {
  initialUsers: AdminUserItem[];
  availableRoles: RoleOption[];
}) {
  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserItem | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<AdminUserItem | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserItem | null>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRoleSlug, setNewRoleSlug] = useState(availableRoles[0]?.slug || "admin");

  const [editRoleSlug, setEditRoleSlug] = useState("");
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || (u.status || "ACTIVE") === statusFilter;

    const matchesRole =
      roleFilter === "ALL" ||
      u.adminRole?.slug === roleFilter ||
      u.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createAdminAction({
        name: newName.trim(),
        email: newEmail.trim(),
        role: "ADMIN",
        adminRoleSlug: newRoleSlug,
      });

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }

      setUsers([res.data as AdminUserItem, ...users]);
      setShowAddModal(false);
      setNewName("");
      setNewEmail("");
      setFeedback({
        tone: "success",
        msg: `Administrator ${res.data.email} created! Auto-generated login credentials were sent to their email.`,
      });
    });
  }

  function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await updateAdminAction(editUser.id, {
        adminRoleSlug: editRoleSlug,
      });

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }

      setUsers(users.map((u) => (u.id === editUser.id ? (res.data as AdminUserItem) : u)));
      setEditUser(null);
      setFeedback({ tone: "success", msg: "Administrator role updated." });
    });
  }

  function handleToggleStatus(user: AdminUserItem) {
    const current = user.status || "ACTIVE";
    const nextStatus = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setFeedback(null);

    startTransition(async () => {
      const res = await toggleUserStatusAction(user.id, nextStatus as "ACTIVE" | "SUSPENDED");
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }

      setUsers(users.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
      setFeedback({
        tone: "success",
        msg: `User ${user.email} is now ${nextStatus.toLowerCase()}.`,
      });
    });
  }

  function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPwdUser) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await resetAdminPasswordAction(resetPwdUser.id, {
        newPassword: resetPasswordVal,
      });

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }

      setResetPwdUser(null);
      setResetPasswordVal("");
      setFeedback({
        tone: "success",
        msg: `Password reset successfully for ${resetPwdUser.email}. Sessions invalidated.`,
      });
    });
  }

  function handleRevokeSessions(user: AdminUserItem) {
    if (!confirm(`Revoke all active sessions for ${user.email}? They will be forced to log in again.`)) {
      return;
    }
    setFeedback(null);

    startTransition(async () => {
      const res = await revokeUserSessionsAction(user.id);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }
      setFeedback({ tone: "success", msg: `All active sessions revoked for ${user.email}.` });
    });
  }

  function handleDeleteAdmin() {
    if (!deleteUser) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await deleteAdminAction(deleteUser.id);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        setDeleteUser(null);
        return;
      }

      setUsers(users.filter((u) => u.id !== deleteUser.id));
      setFeedback({
        tone: "success",
        msg: `Administrator ${deleteUser.email} was permanently deleted.`,
      });
      setDeleteUser(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Action feedback */}
      {feedback && (
        <Alert tone={feedback.tone}>
          <div className="flex items-center justify-between">
            <span>{feedback.msg}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs underline ml-4 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* Controls Bar: Search, Filters, Add Admin Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-4 text-xs text-zinc-900 outline-none focus:border-zinc-500 "
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 outline-none "
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 outline-none "
          >
            <option value="ALL">All Roles</option>
            {availableRoles.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center rounded-full bg-[#F8D88E] hover:bg-[#F4CF74] px-4 py-2 text-xs font-semibold text-zinc-900 transition-colors shadow-2xs self-start sm:self-auto"
        >
          + Add Administrator
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs ">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-100 bg-zinc-50/50 text-zinc-400 font-semibold uppercase tracking-wider ">
            <tr>
              <th className="py-3 px-4">Administrator</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Last Login</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 ">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-400">
                  No administrators found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/50 :bg-zinc-900/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-900 font-semibold flex items-center justify-center text-xs">
                        {(u.name?.[0] || u.email?.[0] || "A").toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-900 ">
                          {u.name || "Unnamed Admin"}
                        </div>
                        <div className="text-[11px] text-zinc-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 ">
                      {u.adminRole?.name || u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        u.status === "SUSPENDED"
                          ? "bg-red-100 text-red-700 "
                          : "bg-emerald-100 text-emerald-800 "
                      }`}
                    >
                      {u.status || "ACTIVE"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Never"}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">
                    {new Date(u.createdAt).toLocaleDateString([], {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditUser(u);
                          setEditRoleSlug(u.adminRole?.slug || "admin");
                        }}
                        className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium hover:bg-zinc-50 :bg-zinc-900"
                      >
                        Role
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        disabled={pending}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          u.status === "SUSPENDED"
                            ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            : "border-red-200 text-red-600 hover:bg-red-50"
                        }`}
                      >
                        {u.status === "SUSPENDED" ? "Activate" : "Suspend"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setResetPwdUser(u)}
                        className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium hover:bg-zinc-50 :bg-zinc-900"
                        title="Reset Password"
                      >
                        Password
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRevokeSessions(u)}
                        disabled={pending}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-500 hover:text-red-600 hover:border-red-200"
                        title="Revoke Sessions"
                      >
                        Revoke
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteUser(u)}
                        disabled={pending}
                        className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete Administrator"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredUsers.map((u) => (
          <div
            key={u.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-900 font-semibold flex items-center justify-center text-sm">
                  {(u.name?.[0] || u.email?.[0] || "A").toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 text-sm">
                    {u.name || "Unnamed Admin"}
                  </h3>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </div>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  u.status === "SUSPENDED" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {u.status || "ACTIVE"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-100 ">
              <span>Role: <strong className="text-zinc-800 ">{u.adminRole?.name || u.role}</strong></span>
              <span>Last login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setEditUser(u);
                  setEditRoleSlug(u.adminRole?.slug || "admin");
                }}
                className="rounded-lg border border-zinc-200 py-1.5 text-center text-[10px] font-medium text-zinc-800"
              >
                Role
              </button>
              <button
                type="button"
                onClick={() => handleToggleStatus(u)}
                className={`rounded-lg border py-1.5 text-center text-[10px] font-medium ${
                  u.status === "SUSPENDED" ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-600"
                }`}
              >
                {u.status === "SUSPENDED" ? "Activate" : "Suspend"}
              </button>
              <button
                type="button"
                onClick={() => setResetPwdUser(u)}
                className="rounded-lg border border-zinc-200 py-1.5 text-center text-[10px] font-medium text-zinc-800"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => handleRevokeSessions(u)}
                className="rounded-lg border border-zinc-200 py-1.5 text-center text-[10px] font-medium text-zinc-500"
              >
                Revoke
              </button>
              <button
                type="button"
                onClick={() => setDeleteUser(u)}
                className="rounded-lg border border-red-200 py-1.5 text-center text-[10px] font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal 1: Add Administrator */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 ">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-zinc-900 ">
                Add New Administrator
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 ">Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="e.g. Alex Walker"
                  className="rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-600 "
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 ">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="alex@homyz.local"
                  className="rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-600 "
                />
              </div>

              {/* Automated Password Generation Advisory */}
              <div className="rounded-xl bg-amber-50/90 border border-amber-200/90 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200/90 text-amber-900 shrink-0 text-xs font-bold mt-0.5">
                  🔐
                </div>
                <div>
                  <p className="font-semibold text-amber-950">Auto-Generated Password & Email Dispatch</p>
                  <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                    A cryptographically secure temporary password will be automatically generated and emailed to the administrator with sign-in instructions.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 ">
                  Assign Administrative Role *
                </label>
                <select
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value)}
                  className="rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-600 "
                >
                  {availableRoles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[#F8D88E] hover:bg-[#F4CF74] px-5 py-2 text-xs font-semibold text-zinc-900 transition-colors disabled:opacity-50"
                >
                  {pending ? "Creating..." : "Create Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Role */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 ">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">
              Change Role for {editUser.name || editUser.email}
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Select the administrative permission bundle for this user.
            </p>

            <form onSubmit={handleUpdateRole} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 ">
                  Role
                </label>
                <select
                  value={editRoleSlug}
                  onChange={(e) => setEditRoleSlug(e.target.value)}
                  className="rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-900 outline-none "
                >
                  {availableRoles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[#F8D88E] hover:bg-[#F4CF74] px-5 py-2 text-xs font-semibold text-zinc-900 transition-colors disabled:opacity-50"
                >
                  {pending ? "Saving..." : "Save Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Reset Password */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 ">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">
              Reset Password
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Enter a new secure password for {resetPwdUser.email}. All their active sessions will be invalidated.
            </p>

            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 ">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    required
                    placeholder="Min 8 chars with 1 uppercase & 1 number"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 pr-9 text-xs text-zinc-900 outline-none focus:border-zinc-600 "
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    {showResetPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setResetPwdUser(null)}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[#F8D88E] hover:bg-[#F4CF74] px-5 py-2 text-xs font-semibold text-zinc-900 transition-colors disabled:opacity-50"
                >
                  {pending ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Delete Administrator Confirmation */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 shrink-0">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Delete Administrator
                </h2>
                <p className="text-xs text-zinc-500">
                  Permanent removal of administrator account
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 mb-5 leading-relaxed">
              Are you sure you want to permanently delete <strong>{deleteUser.name || deleteUser.email}</strong> ({deleteUser.email})? All active sessions and administrator access will be revoked immediately. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteUser(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAdmin}
                disabled={pending}
                className="rounded-full bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {pending ? "Deleting..." : "Delete Administrator"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
