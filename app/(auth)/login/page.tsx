import { redirect } from "next/navigation";

import { LoginForm } from "@/components/forms/login-form";
import { Card } from "@/components/ui";
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
  const target = callbackUrl || "/dashboard";
  if (user) redirect(target);

  // OAuth buttons only render for providers configured via env.
  const providers = {
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
    facebook: Boolean(
      process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET,
    ),
    apple: Boolean(
      process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET,
    ),
  };

  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Welcome back
      </h1>
      <p className="mb-5 text-sm text-zinc-500">Sign in to your account</p>
      <LoginForm providers={providers} callbackUrl={target} />
    </Card>
  );
}
