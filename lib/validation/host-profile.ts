import { z } from "zod";

export const HOST_INTEREST_IDS = [
  "cooking",
  "architecture",
  "history",
  "travel",
  "photography",
  "sports",
  "art",
] as const;

const promptSchema = z.object({
  homeUnique: z.string().trim().max(500).optional(),
  guestsShouldKnow: z.string().trim().max(500).optional(),
  hobbies: z.string().trim().max(300).optional(),
  education: z.string().trim().max(300).optional(),
  perfectGuest: z.string().trim().max(300).optional(),
}).strict();

export const updateHostPublicProfileSchema = z.object({
  bio: z.string().trim().max(2000).optional(),
  prompts: promptSchema.optional(),
  languages: z.array(z.string().trim().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)).max(20).optional(),
  interests: z.array(z.enum(HOST_INTEREST_IDS)).max(HOST_INTEREST_IDS.length).optional(),
  stampsVisible: z.boolean().optional(),
  selectedStamps: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "No profile fields to update" });

export type UpdateHostPublicProfileInput = z.infer<typeof updateHostPublicProfileSchema>;

export const coHostInvitationSchema = z.object({
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().min(7).max(32).optional(),
}).refine(
  (value) => Boolean(value.email) !== Boolean(value.phone),
  { message: "Enter either an email address or a phone number", path: ["email"] },
);
export type CoHostInvitationInput = z.infer<typeof coHostInvitationSchema>;
