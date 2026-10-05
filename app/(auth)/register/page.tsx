import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { RegisterFormClient } from "./register-form-client";

import { getSafeCallbackUrl } from "@/lib/auth/redirect";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; returnUrl?: string; method?: string }>;
}) {
  const [user, resolvedParams] = await Promise.all([
    getSessionUser(),
    searchParams,
  ]);

  const rawCallbackUrl = resolvedParams?.callbackUrl || resolvedParams?.returnUrl;
  const { method } = resolvedParams || {};
  const safeCallbackUrl = getSafeCallbackUrl(rawCallbackUrl, "/");

  if (user && user.status !== "SUSPENDED") {
    if (user.role === "ADMIN" || user.adminRoleSlug) {
      redirect("/admin");
    }
    if (user.role === "HOST" && (safeCallbackUrl === "/" || safeCallbackUrl === "/dashboard")) {
      redirect("/host/today");
    }
    if (safeCallbackUrl === "/dashboard") {
      redirect("/");
    }
    redirect(safeCallbackUrl);
  }

  const providers = {
    google: true,
    facebook: true,
    apple: true,
  };

  const initialInputMethod = method === "email" ? "email" : method === "phone" ? "phone" : undefined;

  return (
    <RegisterFormClient
      initialMode="signup"
      initialInputMethod={initialInputMethod}
      callbackUrl={safeCallbackUrl}
      providers={providers}
    />
  );
}
