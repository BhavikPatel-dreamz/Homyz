import { ForgotPasswordClient } from "./forgot-password-client";

export const metadata = {
  title: "Forgot Password | Homyz Enterprise Console",
  description: "Request a password reset link for your Homyz account.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
