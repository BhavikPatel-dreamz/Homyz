import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { Card } from "@/components/ui";

export default function ForgotPasswordPage() {
  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 ">
        Forgot password
      </h1>
      <p className="mb-5 text-sm text-zinc-500">
        Enter your email and we&apos;ll send a reset link
      </p>
      <ForgotPasswordForm />
    </Card>
  );
}
