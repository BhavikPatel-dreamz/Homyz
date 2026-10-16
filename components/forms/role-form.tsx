"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateUserRoleAction } from "@/actions/admin/updateUserRole";

import { inputClass, secondaryButtonClass } from "../ui";

const ROLES = ["USER", "HOST", "ADMIN"] as const;

// Admin-only control to change a user's role. The trusted server-side path
// (updateUserRoleAction → adminService.setUserRole) is the only place ADMIN can
// be granted.
export function RoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, { role });
      if (!res.ok) {
        setError(res.error);
        setRole(currentRole);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className={`${inputClass} w-auto py-1`}
        aria-label="Role"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={pending || role === currentRole}
        className={secondaryButtonClass}
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
