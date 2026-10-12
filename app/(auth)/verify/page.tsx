import { authService } from "@/services/auth.service";
import { VerifyClient } from "./verify-client";

// Server-side verification: consume the token directly via the service, then
// render the outcome with client localization.
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

  return <VerifyClient success={success} message={message} />;
}
