import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/forms/admin-login-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Admin Portal Sign In | Homyz Enterprise Console",
  description: "Secure administrative access portal for Homyz platform management, RBAC, and system compliance.",
};

export default async function AdminLoginPage() {
  const user = await getSessionUser();

  if (user && user.status !== "SUSPENDED") {
    if (user.role === "ADMIN" || user.adminRoleSlug) {
      redirect("/admin");
    }
    redirect("/dashboard");
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-[#1F1F1F]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
            <p className="text-xs font-semibold text-zinc-600">Loading...</p>
          </div>
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
