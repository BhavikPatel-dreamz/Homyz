import "dotenv/config";
import { prisma } from "../lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  encryptAccountIdentifier,
  generateAccountFingerprint,
} from "../lib/security/payout-encryption";
import { validateSaudiIban, maskIban } from "../services/payout.service";
import type { HostPayoutMethodStatus } from "@/generated/prisma/enums";

interface LegacyPayoutMethod {
  id?: string;
  accountHolderName?: string;
  bankName?: string;
  bankCode?: string;
  ibanMasked?: string;
  ibanLast4?: string;
  ibanFormatted?: string;
  iban?: string;
  routingCode?: string;
  currency?: string;
  country?: string;
  isDefault?: boolean;
  status?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function runBackfill() {
  console.log("=== HOMYZ PHASE 3: PAYOUT METHOD RELATIONAL BACKFILL ===");

  const usersWithPersonalInfo = await prisma.user.findMany({
    where: {
      personalInfo: { not: Prisma.JsonNull },
    },
    select: {
      id: true,
      email: true,
      name: true,
      personalInfo: true,
    },
  });

  console.log(`Found ${usersWithPersonalInfo.length} users with personalInfo.`);

  let totalMethodsFound = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const user of usersWithPersonalInfo) {
    const info = (user.personalInfo as Record<string, unknown>) || {};
    const legacyMethods: LegacyPayoutMethod[] = Array.isArray(info.payoutMethods)
      ? (info.payoutMethods as LegacyPayoutMethod[])
      : [];

    if (legacyMethods.length === 0) continue;

    console.log(`Host ${user.id} (${user.email || user.name}) has ${legacyMethods.length} legacy payout method(s).`);

    for (const m of legacyMethods) {
      totalMethodsFound++;
      try {
        const rawIban = m.iban || m.ibanFormatted || "";
        const cleanValidation = rawIban ? validateSaudiIban(rawIban) : null;
        const cleanIban = cleanValidation?.cleanIban || "";

        const ibanLast4 = m.ibanLast4 || (cleanIban ? cleanIban.slice(-4) : "0000");
        const ibanMasked = m.ibanMasked || (cleanIban ? maskIban(cleanIban) : `SA** **** **** **** **** ${ibanLast4}`);
        const fingerprint = cleanIban
          ? generateAccountFingerprint(cleanIban)
          : generateAccountFingerprint(`${user.id}-${m.bankName || "BANK"}-${ibanLast4}`);

        // Check if already in HostPayoutMethod table
        const existing = await prisma.hostPayoutMethod.findFirst({
          where: {
            OR: [
              ...(m.id ? [{ id: m.id }] : []),
              { hostId: user.id, accountFingerprint: fingerprint },
            ],
          },
        });

        if (existing) {
          totalSkipped++;
          console.log(`  - Payout method ${m.id || fingerprint.slice(0, 8)} already exists in relational DB, skipping.`);
          continue;
        }

        const encryptedIban = cleanIban ? encryptAccountIdentifier(cleanIban) : null;

        let status: HostPayoutMethodStatus = "PENDING_VERIFICATION";
        if (m.status === "VERIFIED") status = "VERIFIED";
        else if (m.status === "REJECTED") status = "REJECTED";
        else if (m.status === "DISABLED") status = "DISABLED";

        await prisma.hostPayoutMethod.create({
          data: {
            id: m.id || undefined,
            hostId: user.id,
            type: "SAUDI_IBAN",
            accountHolderName: m.accountHolderName || user.name || "Host",
            bankName: m.bankName || cleanValidation?.bankName || "Commercial Bank",
            bankCode: m.bankCode || cleanValidation?.bankCode,
            country: m.country || "SA",
            currency: m.currency?.toUpperCase() || "SAR",
            ibanMasked,
            ibanLast4,
            encryptedAccountReference: encryptedIban,
            accountFingerprint: fingerprint,
            isDefault: Boolean(m.isDefault),
            status,
            verifiedAt: m.verifiedAt ? new Date(m.verifiedAt) : (status === "VERIFIED" ? new Date() : null),
            rejectionReason: m.rejectionReason,
            metadata: m.routingCode ? { routingCode: m.routingCode } : undefined,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
          },
        });

        totalMigrated++;
        console.log(`  ✓ Successfully migrated payout method ${m.id || ibanMasked} to relational table.`);
      } catch (err) {
        totalFailed++;
        console.error(`  ✗ Failed to migrate payout method for host ${user.id}:`, err);
      }
    }
  }

  console.log("\n=== BACKFILL RECONCILIATION SUMMARY ===");
  console.log(`Total legacy methods scanned: ${totalMethodsFound}`);
  console.log(`Total migrated to relational: ${totalMigrated}`);
  console.log(`Total already present / skipped: ${totalSkipped}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log("=======================================\n");
}

if (require.main === module) {
  runBackfill()
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}
