import Link from "next/link";

import { Alert, buttonClass, Card } from "@/components/ui";
import { authService } from "@/services/auth.service";

// Server-side verification: consume the token directly via the service, then
// render the outcome. No client round-trip needed.
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let success = false;
  let message = "This verification link is missing its token.";
  if (token) {
    try {
      await authService.verifyEmail(token);
      success = true;
    } catch (err) {
      message =
        err instanceof Error ? err.message : "Verification failed.";
    }
  }

  return (
    <Card>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900 ">
        Email verification
      </h1>
      {success ? (
        <Alert tone="success">
          Your email is verified. You can now sign in.
        </Alert>
      ) : (
        <Alert>{message}</Alert>
      )}
      <div className="mt-5">
        <Link href="/login" className={buttonClass}>
          Go to sign in
        </Link>
      </div>
    </Card>
  );
}
