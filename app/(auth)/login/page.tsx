import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { LoginFormClient } from "./login-form-client";
import { getSafeCallbackUrl } from "@/lib/auth/redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; returnUrl?: string; error?: string; method?: string }>;
}) {
  const [user, resolvedParams] = await Promise.all([
    getSessionUser(),
    searchParams,
  ]);

  const rawCallbackUrl = resolvedParams?.callbackUrl || resolvedParams?.returnUrl;
  const { error, method } = resolvedParams || {};

  const safeCallbackUrl = getSafeCallbackUrl(rawCallbackUrl, "/");

  if (user && user.status !== "SUSPENDED") {
    if (user.role === "ADMIN" || user.adminRoleSlug) {
      redirect("/admin");
    }
    if (user.role === "HOST" && (safeCallbackUrl === "/" || safeCallbackUrl === "/dashboard")) {
      redirect("/host/dashboard");
    }
    if (safeCallbackUrl === "/dashboard") {
      redirect("/");
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
