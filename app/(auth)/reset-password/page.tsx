import { ResetPasswordClient } from "./reset-password-client";

export const metadata = {
  title: "Reset Password | Homyz Enterprise Console",
  description: "Set a new secure password for your Homyz account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordClient token={token ?? ""} />;
}
