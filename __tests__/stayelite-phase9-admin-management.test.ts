import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  achievementDefinitionInputSchema,
  achievementDefinitionUpdateSchema,
  isReservedSystemDefinitionKey,
} from "@/lib/stayelite/admin-achievement-validation";

test("admin definition validation requires stable keys, positive thresholds, and explicit rules", () => {
  const definition = achievementDefinitionInputSchema.parse({
    key: "WEEKEND_EXPLORER", name: "Weekend Explorer", description: "Complete two approved weekend stays.",
    category: "STAYS", eligibilityRule: "COMPLETED_WEEKEND_STAYS", threshold: 2,
  });
  assert.equal(definition.threshold, 2);
  assert.throws(() => achievementDefinitionInputSchema.parse({ ...definition, key: "weekend explorer" }));
  assert.throws(() => achievementDefinitionInputSchema.parse({ ...definition, threshold: 0 }));
  assert.throws(() => achievementDefinitionUpdateSchema.parse({}));
});

test("system catalog namespaces are never accepted through arbitrary admin definition creation", () => {
  assert.equal(isReservedSystemDefinitionKey("BADGE_FIVE_STAR_STREAK_V1"), true);
  assert.equal(isReservedSystemDefinitionKey("STICKER_TEN_STAY_VETERAN_V1"), true);
  assert.equal(isReservedSystemDefinitionKey("WEEKEND_EXPLORER"), false);
});

test("routes are RBAC-protected and preserve safe publishing, preview, and archive boundaries", () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const service = read("services/admin-achievement.service.ts");
  const definitionRoute = read("app/api/v1/admin/loyalty/achievements/route.ts");
  const previewRoute = read("app/api/v1/admin/loyalty/achievements/[id]/preview/route.ts");
  const stampRoute = read("app/api/v1/admin/travel-stamps/[id]/route.ts");
  const schema = read("prisma/schema.prisma");
  assert.match(definitionRoute, /requireApiPermission\(req, PERMISSIONS\.LOYALTY_ACHIEVEMENTS_MANAGE\)/);
  assert.match(previewRoute, /previewAdminAchievementEligibility/);
  assert.match(service, /previewOnly: true/);
  assert.match(service, /awardEnabled: false/);
  assert.match(service, /Published, paused, and archived definitions are immutable/);
  assert.match(service, /ARCHIVED, isActive: false, awardEnabled: false/);
  assert.match(service, /ACHIEVEMENT_MANUAL_AWARD/);
  assert.match(service, /ACHIEVEMENT_AWARD_REVOKED/);
  assert.match(stampRoute, /destinationId/);
  assert.match(stampRoute, /archiveAdminTravelStamp/);
  assert.doesNotMatch(stampRoute, /deleteAdminTravelStamp/);
  assert.match(schema, /model AchievementAward/);
  assert.match(schema, /@@unique\(\[userId, achievementId, ruleVersion\]\)/);
});
