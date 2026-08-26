// SMS provider abstraction. Real delivery uses Twilio's REST API when the
// TWILIO_* env vars are set (no SDK dependency); otherwise dev logs to the
// console and production no-ops with a warning. OTP codes are only ever printed
// in non-production.

export async function sendOtpSms(to: string, code: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const body = `Your Homyz verification code is ${code}`;

  if (!sid || !authToken || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[sms:dev] to=${to} ${body}`);
      return;
    }
    console.warn("[sms] Twilio not configured; SMS not sent");
    return;
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio send failed: ${res.status} ${detail}`);
  }
}
