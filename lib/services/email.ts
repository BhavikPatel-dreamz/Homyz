// Email provider abstraction. Real delivery uses Resend's REST API when
// RESEND_API_KEY is set (no SDK dependency); otherwise dev logs to the console
// and production no-ops with a warning. Verification/reset links are only ever
// printed in non-production.

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

async function deliver(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Homyz <no-reply@homyz.local>";

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `\n[email:dev] to=${msg.to}\n  subject: ${msg.subject}\n  ${msg.text}\n`,
      );
      return;
    }
    console.warn("[email] RESEND_API_KEY not set; email not sent");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      ...(msg.html ? { html: msg.html } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed: ${res.status} ${detail}`);
  }
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const url = `${appUrl()}/verify?token=${encodeURIComponent(token)}`;
  await deliver({
    to,
    subject: "Verify your email",
    text: `Confirm your email address to finish setting up your Homyz account:\n${url}`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await deliver({
    to,
    subject: "Reset your password",
    text: `Reset your Homyz password using this link (expires in 1 hour):\n${url}`,
  });
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await deliver({
    to,
    subject: "Your Homyz verification code",
    text: `Your verification code is ${code}. It expires shortly. Do not share it with anyone.`,
  });
}
