import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { registerSchema } from "../lib/validation/auth";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

console.log("\n===============================================================");
console.log("   GUEST REFERRAL: PERSISTENCE & REWARD FLOW AUDIT SUITE     ");
console.log("===============================================================\n");

const referralCode = "HMY-ABCDEFGH23";
assert.equal(
  registerSchema.safeParse({
    name: "Referred guest",
    email: "referred@example.com",
    password: "ValidPass1",
    role: "USER",
    referralCode,
  }).success,
  true,
  "Registration must accept a valid referral code",
);
assert.equal(
  registerSchema.safeParse({
    email: "referred@example.com",
    password: "ValidPass1",
    referralCode: "temporary-client-code",
  }).success,
  false,
  "Registration must reject a client-generated referral code",
);
console.log("✓ Referral input is validated at the server boundary");

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260923000002_guest_referrals/migration.sql");
const approvalMigration = read("prisma/migrations/20260924000001_referral_reward_approval/migration.sql");
assert(schema.includes("referralCode  String?    @unique"), "User referral codes must be unique");
assert(schema.includes("referredById  String?"), "Referred guests must have a persistent referrer");
assert(schema.includes("model ReferralReward"), "Referral credits need a persistent ledger");
assert(migration.includes('"ReferralReward_referredUserId_key"'), "The migration must prevent duplicate reward credits");
assert(schema.includes("enum ReferralRewardStatus"), "Referral credits must have an approval status");
assert(schema.includes("reviewedById"), "Referral credit reviews must record the administrator");
assert(approvalMigration.includes("ReferralRewardStatus"), "The approval ledger migration must be present");
console.log("✓ Referral identity and idempotent reward ledger are persisted");

const service = read("services/referral.service.ts");
assert(service.includes("ensureReferralCode"), "Referral links must be created by the backend");
assert(service.includes("resolveReferrerId"), "Signup must resolve a code server-side");
assert(service.includes("status: BookingStatus.CONFIRMED"), "Only confirmed stays can qualify");
assert(service.includes("endDate: { lte: new Date() }"), "A stay must have completed before crediting");
assert(service.includes("referredUserId: guest.id"), "The reward ledger must be keyed to the referred guest");
assert(service.includes("ReferralRewardStatus.PENDING"), "Qualified stays must enter the approval queue first");
assert(service.includes("approveReward"), "An administrator must be able to approve a pending credit");
assert(service.includes("rejectReward"), "An administrator must be able to reject a pending credit");
assert(service.includes('code !== "P2002"'), "Concurrent reward writes must be safely idempotent");
console.log("✓ Reward eligibility is server-verified after the first completed stay");

const view = read("components/profile/invite-earn-view.tsx");
assert(view.includes('fetch("/api/v1/referrals/me"'), "Invite UI must load authenticated referral data");
assert(view.includes("navigator.clipboard?.writeText"), "Copy action must copy the complete URL");
assert(view.includes("https://wa.me/?text="), "WhatsApp share must include the referral link");
assert(view.includes("Unable to load your referral details"), "Invite UI must show a controlled error state");
assert(view.includes("Invitation activity"), "Invite UI must show live invitation activity");
assert(view.includes("Credited points"), "Invite UI must show credited point totals");
assert(!view.includes("$25"), "Invite UI must not claim a hardcoded cash reward");
assert(!view.includes("Sarah Miller"), "Invite UI must not display fake referral activity");

const adminRoute = read("app/api/v1/admin/referrals/[id]/approve/route.ts");
const adminTable = read("components/admin/referral-rewards-table.tsx");
assert(adminRoute.includes("PERMISSIONS.REFERRALS_REVIEW"), "Approval must be permission-protected");
assert(adminTable.includes("ModalOverlay"), "Reject confirmation must lock background scrolling");
console.log("✓ Invite UI uses live data with supported sharing and controlled states");

console.log("\nAll guest referral flow checks passed.\n");
