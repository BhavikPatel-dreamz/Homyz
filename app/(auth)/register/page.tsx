import { redirect } from "next/navigation";
import { HomyzAuthForm } from "@/components/forms/homyz-auth-form";
import { getSessionUser } from "@/lib/auth/session";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user && user.status !== "SUSPENDED") {
    if (user.role === "ADMIN" || user.adminRoleSlug) {
      redirect("/admin");
    }
    redirect("/dashboard");
  }

  const providers = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    facebook: Boolean(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
    apple: Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET),
  };

  return (
    <HomyzAuthForm
      initialMode="signup"
      callbackUrl="/dashboard"
      providers={providers}
    />
  );
}
