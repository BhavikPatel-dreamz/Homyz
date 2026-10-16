"use client";

import Link from "next/link";
import { Alert, buttonClass, Card } from "@/components/ui";
import { useLanguage } from "@/lib/i18n/language-context";

interface VerifyClientProps {
  success: boolean;
  message?: string;
}

export function VerifyClient({ success, message }: VerifyClientProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <h1 className="mb-4">
        {t("verify_title", "Email verification")}
      </h1>
      {success ? (
        <Alert tone="success">
          {t("verify_success", "Your email is verified. You can now sign in.")}
        </Alert>
      ) : (
        <Alert>
          {message === "This verification link is missing its token."
            ? t("verify_missing_token", "This verification link is missing its token.")
            : message === "Verification failed."
            ? t("verify_failed", "Verification failed.")
            : message || t("verify_failed", "Verification failed.")}
        </Alert>
      )}
      <div className="mt-5">
        <Link href="/login" className={buttonClass}>
          {t("verify_go_to_signin", "Go to sign in")}
        </Link>
      </div>
    </Card>
  );
}
