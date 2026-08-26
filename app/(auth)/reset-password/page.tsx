import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { Card } from "@/components/ui";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Reset password
      </h1>
      <p className="mb-5 text-sm text-zinc-500">Choose a new password</p>
      <ResetPasswordForm token={token ?? ""} />
    </Card>
  );
}
