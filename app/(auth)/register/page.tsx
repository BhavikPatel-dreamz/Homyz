import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { RegisterFormClient } from "./register-form-client";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user && user.status !== "SUSPENDED") {
    if (user.role === "ADMIN" || user.adminRoleSlug) {
      redirect("/admin");
    }
    redirect("/dashboard");
  }

  const providers = {
    google: true,
    facebook: true,
    apple: true,
  };

  return (
    <RegisterFormClient
      initialMode="signup"
      callbackUrl="/dashboard"
      providers={providers}
    />
  );
}
