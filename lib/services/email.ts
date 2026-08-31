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
  invitationUrl: string,
  roleName: string = "Administrator",
  expiresInText: string = "24 hours",
  inviterName?: string,
  customMessage?: string,
): Promise<void> {
  const text = `Hello ${name || "Administrator"},\n\nYou're invited to join the Homyz Admin Panel as a ${roleName}.\n${inviterName ? `Invited by: ${inviterName}\n` : ""}${customMessage ? `\nNote: "${customMessage}"\n` : ""}\nClick below to securely activate your account and create your own password:\n${invitationUrl}\n\nThis invitation expires in ${expiresInText}.\n\nIf you did not expect this invitation, please ignore this email.\n\nBest regards,\nHomyz Admin Team`;

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
          .role-box { background: #fafaf9; border: 1px solid #e4e4e7; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
          .role-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #71717a; margin-bottom: 3px; }
          .role-val { font-size: 16px; font-weight: 700; color: #18181b; }
          .msg-box { font-size: 13px; font-style: italic; color: #52525b; background: #f4f4f5; border-left: 3px solid #fbde9b; padding: 10px 14px; margin-top: 12px; border-radius: 4px; }
          .cta-btn { display: inline-block; background-color: #fbde9b; color: #18181b; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 9999px; margin: 20px 0 12px 0; text-align: center; shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .security-note { font-size: 12px; color: #71717a; line-height: 1.5; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f4f4f5; }
          .footer { margin-top: 24px; font-size: 11px; color: #a1a1aa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">homyz</div>
          <div class="badge">Admin Invitation</div>
          <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">You're invited to join the Admin Panel</h2>
          <p style="font-size: 14px; color: #52525b; line-height: 1.5; margin: 0;">
            Hello <strong>${name || "Administrator"}</strong>, ${inviterName ? `<strong>${inviterName}</strong> has invited you` : "you have been invited"} to join the Homyz administrative team.
          </p>
          <div class="role-box">
            <div class="role-label">Assigned Role</div>
            <div class="role-val">${roleName}</div>
            ${customMessage ? `<div class="msg-box">"${customMessage}"</div>` : ""}
          </div>
          <p style="font-size: 13px; color: #52525b; margin-bottom: 4px;">
            Click below to securely activate your account and create your own password.
          </p>
          <div>
            <a href="${invitationUrl}" class="cta-btn">Accept Invitation & Set Password</a>
          </div>
          <p style="font-size: 12px; color: #71717a; margin-top: 8px;">
            ⏱️ This invitation expires in <strong>${expiresInText}</strong>.
          </p>
          <div class="security-note">
            🔐 <strong>Security Requirement</strong>: For maximum security, you will create your own confidential password directly on Homyz. Nobody else will see or know your password.
          </div>
          <div class="footer">
            © 2026 Homyz, Inc. • High-Security Administrator Invitation
          </div>
        </div>
      </body>
    </html>
  `;

  await deliver({
    to,
    subject: `You're invited to join the Homyz Admin Panel (${roleName})`,
    text,
    html,
  });
}

export async function sendHostDocumentActionEmail(params: {
  to: string;
  applicantName: string;
  applicationId: string;
  documentType: string;
  actionType: "REJECTED" | "RESUBMISSION_REQUESTED";
  reason: string;
  instructions?: string;
}): Promise<void> {
  const { to, applicantName, applicationId, documentType, actionType, reason, instructions } = params;
  const onboardingUrl = `${appUrl()}/onboarding/hosts?appId=${encodeURIComponent(applicationId)}`;
  const title = actionType === "RESUBMISSION_REQUESTED" 
    ? "Document Re-submission Requested" 
    : "Document Update Required";

  const text = `Hello ${applicantName},\n\nRegarding your host registration application (${applicationId}):\nYour ${documentType} requires attention.\n\nReason: ${reason}\n${instructions ? `Instructions: ${instructions}\n` : ""}\nPlease log in to continue your host onboarding resubmission:\n${onboardingUrl}\n\nBest regards,\nHomyz Host Verification Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9f9f8; margin: 0; padding: 24px; color: #18181b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .logo { font-size: 20px; font-weight: 700; color: #18181b; margin-bottom: 24px; }
          .badge { display: inline-block; background-color: #fee2e2; color: #991b1b; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 9999px; margin-bottom: 16px; }
          .info-box { background: #fafaf9; border: 1px solid #e4e4e7; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
          .info-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #71717a; margin-bottom: 3px; }
          .info-val { font-size: 15px; font-weight: 700; color: #18181b; }
          .reason-box { font-size: 13px; color: #7f1d1d; background: #fef2f2; border-left: 3px solid #ef4444; padding: 10px 14px; margin-top: 12px; border-radius: 4px; }
          .cta-btn { display: inline-block; background-color: #fbde9b; color: #18181b; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 9999px; margin: 20px 0 12px 0; text-align: center; }
          .footer { margin-top: 24px; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">homyz</div>
          <div class="badge">Host Onboarding Verification</div>
          <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">${title}</h2>
          <p style="font-size: 14px; color: #52525b; line-height: 1.5; margin: 0;">
            Hello <strong>${applicantName}</strong>, our review team has checked your registration application (<strong>${applicationId}</strong>).
          </p>
          <div class="info-box">
            <div class="info-label">Document</div>
            <div class="info-val">${documentType}</div>
            <div class="reason-box">
              <strong>Reason:</strong> ${reason}
              ${instructions ? `<br/><br/><strong>Instructions:</strong> ${instructions}` : ""}
            </div>
          </div>
          <p style="font-size: 13px; color: #52525b;">
            Please click below to upload a clear replacement document and continue your onboarding.
          </p>
          <div>
            <a href="${onboardingUrl}" class="cta-btn">Update & Upload Document</a>
          </div>
          <div class="footer">
            © 2026 Homyz, Inc. • Host Registration Verification
          </div>
        </div>
      </body>
    </html>
  `;

  await deliver({
    to,
    subject: `[Homyz] ${title} for Application ${applicationId}`,
    text,
    html,
  });
}

export async function sendHostActionInfoRequestEmail(params: {
  to: string;
  applicantName: string;
  applicationId: string;
  informationRequired: string;
  reason: string;
  deadline?: string | Date | null;
}): Promise<void> {
  const { to, applicantName, applicationId, informationRequired, reason, deadline } = params;
  const onboardingUrl = `${appUrl()}/onboarding/hosts?appId=${encodeURIComponent(applicationId)}`;
  const deadlineText = deadline ? new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  const text = `Hello ${applicantName},\n\nAdditional information is required for your Homyz Host Application (${applicationId}).\n\nInformation Required: ${informationRequired}\nReason: ${reason}\n${deadlineText ? `Deadline: ${deadlineText}\n` : ""}\nPlease log in to provide the required information:\n${onboardingUrl}\n\nBest regards,\nHomyz Compliance Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f9f9f8; padding: 24px; color: #18181b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px;">
          <div style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">homyz</div>
          <div style="display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 9999px; margin-bottom: 16px;">Action Required</div>
          <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">Additional Information Needed</h2>
          <p style="font-size: 14px; color: #52525b;">Hello <strong>${applicantName}</strong>, our compliance team requires additional information to finalize your host application (<strong>${applicationId}</strong>).</p>
          <div style="background: #fafaf9; border: 1px solid #e4e4e7; border-radius: 12px; padding: 18px; margin: 20px 0;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #71717a; margin-bottom: 4px;">Information Required</div>
            <div style="font-size: 15px; font-weight: 700; color: #18181b; margin-bottom: 12px;">${informationRequired}</div>
            <div style="font-size: 13px; color: #3f3f46;"><strong>Reason:</strong> ${reason}</div>
            ${deadlineText ? `<div style="font-size: 12px; color: #b45309; margin-top: 8px;">⏱️ Please submit before <strong>${deadlineText}</strong>.</div>` : ""}
          </div>
          <div><a href="${onboardingUrl}" style="display: inline-block; background-color: #fbde9b; color: #18181b; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 9999px;">Submit Required Info</a></div>
          <div style="margin-top: 24px; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 16px;">© 2026 Homyz, Inc. • Host Compliance Team</div>
        </div>
      </body>
    </html>
  `;

  await deliver({ to, subject: `[Homyz] Action Required: Application ${applicationId}`, text, html });
}

export async function sendHostApplicationApprovalEmail(params: {
  to: string;
  applicantName: string;
  applicationId: string;
}): Promise<void> {
  const { to, applicantName, applicationId } = params;
  const hostPortalUrl = `${appUrl()}/dashboard/host`;

  const text = `Congratulations ${applicantName}!\n\nYour Homyz Host Application (${applicationId}) has been officially APPROVED.\nYour host account is now ACTIVE and you can access your host dashboard to publish listings.\n\nAccess Host Portal: ${hostPortalUrl}\n\nWelcome to Homyz!`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f9f9f8; padding: 24px; color: #18181b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px;">
          <div style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">homyz</div>
          <div style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 9999px; margin-bottom: 16px;">Application Approved</div>
          <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px 0; color: #065f46;">Welcome to Homyz Host Platform! 🎉</h2>
          <p style="font-size: 14px; color: #52525b; line-height: 1.5;">Hello <strong>${applicantName}</strong>, we are thrilled to inform you that your host registration application (<strong>${applicationId}</strong>) has passed compliance and is officially approved.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin: 20px 0; font-size: 13px; color: #14532d;">
            ✓ Your host account is fully activated.<br/>
            ✓ You can now list properties, manage calendars, and accept bookings.
          </div>
          <div><a href="${hostPortalUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 9999px;">Go to Host Portal</a></div>
          <div style="margin-top: 24px; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 16px;">© 2026 Homyz, Inc. • Host Management</div>
        </div>
      </body>
    </html>
  `;

  await deliver({ to, subject: `🎉 Approved! Welcome to Homyz Host Platform (${applicationId})`, text, html });
}

export async function sendHostApplicationRejectionEmail(params: {
  to: string;
  applicantName: string;
  applicationId: string;
  reason: string;
  explanation?: string;
}): Promise<void> {
  const { to, applicantName, applicationId, reason, explanation } = params;

  const text = `Hello ${applicantName},\n\nWe regret to inform you that your Homyz Host Application (${applicationId}) could not be approved at this time.\n\nReason: ${reason}\n${explanation ? `Details: ${explanation}\n` : ""}\nThank you for your interest in Homyz.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f9f9f8; padding: 24px; color: #18181b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px;">
          <div style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">homyz</div>
          <div style="display: inline-block; background-color: #fee2e2; color: #991b1b; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 9999px; margin-bottom: 16px;">Application Update</div>
          <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">Host Application Status</h2>
          <p style="font-size: 14px; color: #52525b;">Hello <strong>${applicantName}</strong>, after reviewing your application (<strong>${applicationId}</strong>), our review team determined we are unable to approve your host registration at this time.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 18px; margin: 20px 0; font-size: 13px; color: #991b1b;">
            <strong>Primary Reason:</strong> ${reason}<br/>
            ${explanation ? `<br/><strong>Additional Details:</strong> ${explanation}` : ""}
          </div>
          <div style="margin-top: 24px; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 16px;">© 2026 Homyz, Inc. • Host Management</div>
        </div>
      </body>
    </html>
  `;

  await deliver({ to, subject: `[Homyz] Application Status Update (${applicationId})`, text, html });
}

export async function sendHostComplianceStatusEmail(params: {
  to: string;
  applicantName: string;
  type: "EXPIRING_SOON" | "EXPIRED" | "RE_VERIFICATION_REQUESTED" | "ACTION_REQUIRED" | "ISSUE_RESOLVED" | "SUSPENDED";
  title: string;
  details: string;
  reason?: string;
  daysRemaining?: number;
}): Promise<void> {
  const { to, applicantName, type, title, details, reason, daysRemaining } = params;
  const portalUrl = `${appUrl()}/dashboard/host`;

  const badgeColor = type === "ISSUE_RESOLVED" ? "#dcfce7" : type === "EXPIRING_SOON" ? "#fef3c7" : "#fee2e2";
  const badgeTextColor = type === "ISSUE_RESOLVED" ? "#166534" : type === "EXPIRING_SOON" ? "#92400e" : "#991b1b";

  const text = `Hello ${applicantName},\n\nCompliance Notification: ${title}\n\n${details}\n${reason ? `Reason: ${reason}\n` : ""}${daysRemaining !== undefined ? `Days Remaining: ${daysRemaining}\n` : ""}\nPlease log in to your Host Portal: ${portalUrl}\n\nBest regards,\nHomyz Host Compliance Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f9f9f8; padding: 24px; color: #18181b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px;">
          <div style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">homyz</div>
          <div style="display: inline-block; background-color: ${badgeColor}; color: ${badgeTextColor}; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 9999px; margin-bottom: 16px;">
            Host Compliance & Monitoring
          </div>
          <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">${title}</h2>
          <p style="font-size: 14px; color: #52525b;">Hello <strong>${applicantName}</strong>, here is an important update regarding your host compliance status.</p>
          <div style="background: #fafaf9; border: 1px solid #e4e4e7; border-radius: 12px; padding: 18px; margin: 20px 0; font-size: 13px; color: #18181b;">
            <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${details}</p>
            ${reason ? `<div style="margin-top: 8px; color: #991b1b;"><strong>Reason / Notes:</strong> ${reason}</div>` : ""}
            ${daysRemaining !== undefined ? `<div style="margin-top: 8px; color: #b45309; font-weight: 700;">⏱️ Days Remaining: ${daysRemaining} day(s)</div>` : ""}
          </div>
          <div><a href="${portalUrl}" style="display: inline-block; background-color: #fbde9b; color: #18181b; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 9999px;">Open Host Portal</a></div>
          <div style="margin-top: 24px; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 16px;">© 2026 Homyz, Inc. • Host Compliance Team</div>
        </div>
      </body>
    </html>
  `;

  await deliver({ to, subject: `[Homyz Compliance Alert] ${title}`, text, html });
}

export async function sendHostApplicationSubmittedEmail(params: {
  to: string;
  applicantName: string;
  applicationId: string;
}): Promise<void> {
  const { to, applicantName, applicationId } = params;
  const statusUrl = `${appUrl()}/host/onboarding`;

  const text = `Hello ${applicantName},\n\nThank you for submitting your Homyz Host Application (${applicationId}).\nOur administrative review team will examine your application and verification documents.\n\nYou can view your application status anytime here:\n${statusUrl}\n\nBest regards,\nHomyz Host Operations Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f9f9f8; padding: 24px; color: #18181b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px;">
          <div style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">homyz</div>
          <div style="display: inline-block; background-color: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 9999px; margin-bottom: 16px;">Application Received</div>
          <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">Host Application Submitted</h2>
          <p style="font-size: 14px; color: #52525b;">Hello <strong>${applicantName}</strong>, thank you for submitting your host application (Application ID: <strong>${applicationId}</strong>).</p>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 18px; margin: 20px 0; font-size: 13px; color: #0369a1;">
            ✓ Your application has been logged and queued for administrative review.<br/>
            ✓ Status: <strong>Submitted / In Review</strong>
          </div>
          <div><a href="${statusUrl}" style="display: inline-block; background-color: #fbde9b; color: #18181b; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 9999px;">View Application Status</a></div>
          <div style="margin-top: 24px; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 16px;">© 2026 Homyz, Inc. • Host Operations</div>
        </div>
      </body>
    </html>
  `;

  await deliver({ to, subject: `[Homyz] Host Application Received (${applicationId})`, text, html });
}




