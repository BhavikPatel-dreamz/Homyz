import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { LoginFormClient } from "./login-form-client";
import { getSafeCallbackUrl } from "@/lib/auth/redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; method?: string }>;
}) {
  const [user, resolvedParams] = await Promise.all([
    getSessionUser(),
    searchParams,
  ]);

  const { callbackUrl: rawCallbackUrl, error, method } = resolvedParams || {};

  const safeCallbackUrl = getSafeCallbackUrl(rawCallbackUrl, "/dashboard");

  if (user && user.status !== "SUSPENDED") {
    if (user.role === "ADMIN" || user.adminRoleSlug) {
      redirect("/admin");
    }
    redirect(safeCallbackUrl);
  }

  const errorMessage =
    error === "account_suspended" || user?.status === "SUSPENDED"
      ? "This account has been suspended by an administrator. Access has been disabled."
      : error === "session_revoked"
        ? "Your session was revoked by an administrator. Please sign in again to continue."
        : undefined;

  const providers = {
    google: true,
    facebook: true,
    apple: true,
  };

  const initialInputMethod = method === "email" ? "email" : method === "phone" ? "phone" : undefined;

  return (
    <LoginFormClient
      initialMode="login"
      initialInputMethod={initialInputMethod}
      callbackUrl={safeCallbackUrl}
      providers={providers}
      initialError={errorMessage}
    />
  );
}
