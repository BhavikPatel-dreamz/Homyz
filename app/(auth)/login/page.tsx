import { redirect } from "next/navigation";
import { HomyzAuthForm } from "@/components/forms/homyz-auth-form";
import { getSessionUser } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const [user, { callbackUrl, error }] = await Promise.all([
    getSessionUser(),
    searchParams,
  ]);

  if (user && user.status !== "SUSPENDED") {
    if (user.role === "ADMIN" || user.adminRoleSlug) {
      redirect("/admin");
    }
    redirect(callbackUrl || "/dashboard");
  }

  const errorMessage =
    error === "account_suspended" || user?.status === "SUSPENDED"
      ? "This account has been suspended by an administrator. Access has been disabled."
      : error === "session_revoked"
        ? "Your session was revoked by an administrator. Please sign in again to continue."
        : undefined;

  const providers = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    facebook: Boolean(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
    apple: Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET),
  };

  return (
    <HomyzAuthForm
      initialMode="login"
      callbackUrl={callbackUrl || "/dashboard"}
      providers={providers}
      initialError={errorMessage}
    />
  );
}
