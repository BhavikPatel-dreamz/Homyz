import { z } from "zod";

export const rejectReferralRewardSchema = z.object({
  reason: z.string().trim().min(5, "Give the guest a brief reason.").max(500),
});
