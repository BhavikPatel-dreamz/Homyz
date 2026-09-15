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

const optionalProfileText = (max: number) => z.string().trim().max(max);
const profileTagList = (maxItems: number) => z.array(z.string().trim().min(1).max(60))
  .max(maxItems)
  .transform((values) => {
    const unique = new Map<string, string>();
    for (const value of values) {
      const key = value.toLocaleLowerCase();
      if (!unique.has(key)) unique.set(key, value);
    }
    return [...unique.values()];
  });

const promptSchema = z.object({
  homeUnique: optionalProfileText(500).optional(),
  guestsShouldKnow: optionalProfileText(500).optional(),
  hobbies: profileTagList(20).optional(),
  education: optionalProfileText(300).optional(),
  perfectGuest: optionalProfileText(300).optional(),
}).strict();

export const updateHostPublicProfileSchema = z.object({
  bio: optionalProfileText(2000).optional(),
  prompts: promptSchema.optional(),
  languages: z.array(z.string().trim().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)).max(20)
    .transform((values) => [...new Set(values.map((value) => value.toLowerCase()))]).optional(),
  interests: profileTagList(20).optional(),
  stampsVisible: z.boolean().optional(),
  selectedStamps: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "No profile fields to update" });

export type UpdateHostPublicProfileInput = z.infer<typeof updateHostPublicProfileSchema>;

export const coHostInvitationSchema = z.object({
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().min(7).max(32).optional(),
}).refine(
  (value) => Boolean(value.email) !== Boolean(value.phone),
  { message: "Enter either an email address or a phone number", path: ["email"] },
);
export type CoHostInvitationInput = z.infer<typeof coHostInvitationSchema>;
