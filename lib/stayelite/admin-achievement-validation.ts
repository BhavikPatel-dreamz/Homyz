import { z } from "zod";

export const ACHIEVEMENT_RULE_KEY = /^[A-Z][A-Z0-9_]{2,95}$/;

const nullableTrimmedText = z.string().trim().max(10_000).nullable().optional();

export const achievementDefinitionInputSchema = z.object({
  key: z.string().trim().regex(ACHIEVEMENT_RULE_KEY, "Use an uppercase stable rule key (A-Z, 0-9, _)."),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(10_000),
  icon: nullableTrimmedText,
  category: z.enum(["STAYS", "CITIES", "COUNTRIES", "STAMPS", "EXPLORER"]),
  eligibilityRule: z.string().trim().min(2).max(120),
  threshold: z.number().int().min(1).max(1_000_000),
  eligibilityMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const achievementDefinitionUpdateSchema = achievementDefinitionInputSchema
  .omit({ key: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one editable field is required.");

export type AchievementDefinitionInput = z.infer<typeof achievementDefinitionInputSchema>;
export type AchievementDefinitionUpdate = z.infer<typeof achievementDefinitionUpdateSchema>;

export function isReservedSystemDefinitionKey(key: string) {
  return /^(BADGE_|STICKER_|DESTINATION_|ACHIEVEMENT_)/.test(key);
}
