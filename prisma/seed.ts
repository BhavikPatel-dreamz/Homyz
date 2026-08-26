// Seed an initial ADMIN. ADMIN is NEVER assignable from client input — this
// trusted server-side script is one of the only places a user gets that role.
// Run with: pnpm db:seed  (tsx loads .env via dotenv/config below).
import "dotenv/config";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@homyz.local";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe!123";

  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      "[seed] ADMIN_PASSWORD not set — using a default dev password. " +
        "Set ADMIN_EMAIL/ADMIN_PASSWORD in .env for anything real.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: Role.ADMIN },
    create: {
      email,
      name: "Homyz Admin",
      passwordHash,
      role: Role.ADMIN,
      emailVerified: new Date(),
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`[seed] admin ready: ${admin.email} (${admin.role}) id=${admin.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("[seed] failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
