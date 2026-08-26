"use server";

import { runAction } from "@/lib/actions/result";
import { sendOtpSchema, verifyOtpSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

export async function sendOtpAction(input: unknown) {
  return runAction(async () => {
    const data = sendOtpSchema.parse(input);
    return authService.sendOtp(data);
  });
}

export async function verifyOtpAction(input: unknown) {
  return runAction(async () => {
    const data = verifyOtpSchema.parse(input);
    return authService.verifyOtp(data);
  });
}
