import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AdminLoginForm } from "@/components/forms/admin-login-form";

export default async function AdminLoginPage() {
  const user = await getSessionUser();
  if (user && (user.role === "ADMIN" || user.adminRoleSlug)) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 font-sans">
      <AuthHeader />
      <main className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 bg-white">
        <AdminLoginForm />
      </main>
      <AuthFooter />
    </div>
  );
}
