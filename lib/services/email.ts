import { Resend } from "resend";

// Email provider abstraction powered by Resend.
// When RESEND_API_KEY is configured in .env, emails are dispatched via the official Resend SDK.
// During development without a key, emails and security codes are printed to the console for testing.

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function formatFromAddress(raw?: string): string {
  if (!raw) return "Homyz <onboarding@resend.dev>";
  const trimmed = raw.trim();

  // 1. If already contains @
  if (trimmed.includes("@")) {
    if (trimmed.includes("@homyz.local") || trimmed.includes(".local")) {
      return "Homyz <onboarding@resend.dev>";
    }
    if (trimmed.includes("<") && trimmed.includes(">")) return trimmed;
    return `Homyz <${trimmed}>`;
  }

  // 2. If entered as "Name <domain.com>" without username part
  const bracketMatch = trimmed.match(/^(.*?)\s*<([^>]+)>$/);
  if (bracketMatch) {
    const name = bracketMatch[1]?.trim() || "Homyz";
    const domain = bracketMatch[2]?.trim().replace(/^@+/, "");
    return `${name} <no-reply@${domain}>`;
  }

  // 3. Plain domain without brackets, e.g. "homyz.dynamicdreamz.net"
  if (trimmed.includes(".")) {
    return `Homyz <no-reply@${trimmed}>`;
  }

  return "Homyz <onboarding@resend.dev>";
}

async function deliver(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = formatFromAddress(process.env.EMAIL_FROM);

  // 1. Deliver via Resend SDK if API key is provided
  if (apiKey) {
    const resend = getResendClient();
    if (!resend) throw new Error("Failed to initialize Resend client.");

    const { data, error } = await resend.emails.send({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      ...(msg.html ? { html: msg.html } : {}),
    });

    if (error) {
      console.warn(`[email:resend sandbox note] ${error.message}`);
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `\n[email:dev (Sandbox Fallback)] to=${msg.to}\n  subject: ${msg.subject}\n  ${msg.text}\n`,
        );
        return;
      }
      throw new Error(`Resend delivery failed: ${error.message}`);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[email:resend] Live email dispatched: id=${data?.id} to=${msg.to}`);
    }
    return;
  }

  // 2. Development console fallback when key is not yet set in .env
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `\n[email:dev (Resend not set)] to=${msg.to}\n  from=${from}\n  subject: ${msg.subject}\n  ${msg.text}\n`,
    );
    return;
  }

  console.warn(
    "[email] RESEND_API_KEY not configured in production; email not sent",
  );
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

export async function sendTwoFactorOtpEmail(
  to: string,
  code: string,
  roleName: string = "Privileged",
): Promise<void> {
  const text = `Your Homyz Two-Factor Authentication code is: ${code}\n\nThis security code expires in 5 minutes. If you did not request this login attempt for your ${roleName} account, please change your password immediately.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f8; margin: 0; padding: 24px; color: #18181b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .logo { font-size: 20px; font-weight: 700; color: #18181b; margin-bottom: 24px; }
          .badge { display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 9999px; margin-bottom: 16px; }
          .code-box { background: #fafaf9; border: 1px dashed #d4d4d8; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #18181b; }
          .expiry { font-size: 12px; color: #71717a; margin-top: 8px; }
          .footer { margin-top: 32px; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">homyz</div>
          <div class="badge">${roleName} Security Protection</div>
          <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 8px 0;">Two-Factor Authentication Code</h2>
          <p style="font-size: 13px; color: #52525b; line-height: 1.5; margin: 0;">
            Use the following 6-digit security code to complete your login to Homyz:
          </p>
          <div class="code-box">
            <div class="code">${code}</div>
            <div class="expiry">Valid for 5 minutes • Do not share this code</div>
          </div>
          <p style="font-size: 12px; color: #71717a; line-height: 1.4; margin: 0;">
            If you did not initiate this login request, your password may be compromised. Please reset your password immediately.
          </p>
          <div class="footer">
            © 2026 Homyz, Inc. • High-Security Authentication Verification
          </div>
        </div>
      </body>
    </html>
  `;

  await deliver({
    to,
    subject: `Your Homyz 2FA Code: ${code}`,
    text,
    html,
  });
}

export async function sendAdminInvitationEmail(
  to: string,
  name: string | null,
  tempPassword: string,
  roleName: string = "Administrator",
): Promise<void> {
  const loginUrl = `${appUrl()}/login`;
  const text = `Hello ${name || "Administrator"},\n\nAn administrative account has been created for you on Homyz with the role of "${roleName}".\n\nYour Login Credentials:\nEmail: ${to}\nTemporary Password: ${tempPassword}\n\nPlease sign in at:\n${loginUrl}\n\nFor security reasons, Two-Factor Authentication is active, and you will receive a 2FA verification code when logging in. Please update your temporary password immediately in Account Settings.\n\nBest regards,\nHomyz Administration Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f8; margin: 0; padding: 24px; color: #18181b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .logo { font-size: 20px; font-weight: 700; color: #18181b; margin-bottom: 24px; }
          .badge { display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 9999px; margin-bottom: 16px; }
          .cred-box { background: #fafaf9; border: 1px solid #e4e4e7; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
          .cred-row { margin-bottom: 12px; }
          .cred-row:last-child { margin-bottom: 0; }
          .cred-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #71717a; margin-bottom: 3px; }
          .cred-val { font-family: 'Courier New', Courier, monospace; font-size: 15px; font-weight: 700; color: #18181b; word-break: break-all; }
          .cta-btn { display: inline-block; background-color: #fbde9b; color: #18181b; font-weight: 600; font-size: 13px; text-decoration: none; padding: 12px 26px; border-radius: 9999px; margin: 16px 0 8px 0; }
          .security-note { font-size: 12px; color: #71717a; line-height: 1.4; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f4f4f5; }
          .footer { margin-top: 24px; font-size: 11px; color: #a1a1aa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">homyz</div>
          <div class="badge">Administrative Account Created</div>
          <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 8px 0;">Welcome to Homyz Admin Console</h2>
          <p style="font-size: 13px; color: #52525b; line-height: 1.5; margin: 0;">
            Hello <strong>${name || "Administrator"}</strong>, an administrative account has been created for you with the role of <strong>${roleName}</strong>.
          </p>
          <div class="cred-box">
            <div class="cred-row">
              <div class="cred-label">Login Email</div>
              <div class="cred-val">${to}</div>
            </div>
            <div class="cred-row">
              <div class="cred-label">Temporary Generated Password</div>
              <div class="cred-val">${tempPassword}</div>
            </div>
          </div>
          <div>
            <a href="${loginUrl}" class="cta-btn">Sign In to Admin Console</a>
          </div>
          <div class="security-note">
            🔐 <strong>Security Note</strong>: Two-Factor Authentication (2FA) is enforced for this role. You will receive a 6-digit security code via email upon logging in. Please update your temporary password after your first sign in.
          </div>
          <div class="footer">
            © 2026 Homyz, Inc. • High-Security Administrator Notification
          </div>
        </div>
      </body>
    </html>
  `;

  await deliver({
    to,
    subject: "Your Homyz Administrator Account Credentials",
    text,
    html,
  });
}
