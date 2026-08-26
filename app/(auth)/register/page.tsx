import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/forms/register-form";
import { Card } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Create your account
      </h1>
      <p className="mb-5 text-sm text-zinc-500">
        Join homyz to book stays or list your place
      </p>
      <RegisterForm />
    </Card>
  );
}
