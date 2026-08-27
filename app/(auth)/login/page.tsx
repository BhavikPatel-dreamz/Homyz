import { redirect } from "next/navigation";
import { HomyzAuthForm } from "@/components/forms/homyz-auth-form";
import { getSessionUser } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const [user, { callbackUrl }] = await Promise.all([
    getSessionUser(),
    searchParams,
  ]);

  if (user) {
    if (user.role === "ADMIN" || user.adminRoleSlug) {
      redirect("/admin");
    }
    redirect(callbackUrl || "/dashboard");
  }

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
    />
  );
}
