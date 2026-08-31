import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { Role, UserStatus } from "@/generated/prisma/enums";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/permissions/permissions";

async function main() {
  console.log("[seed] Seeding permissions...");
  for (const perm of ALL_PERMISSIONS) {
    await prisma.adminPermission.upsert({
      where: { slug: perm.slug },
      update: {
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
      create: {
        slug: perm.slug,
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
    });
  }

  const allDbPerms = await prisma.adminPermission.findMany();
  const permMap = new Map(allDbPerms.map((p) => [p.slug, p.id]));

  console.log("[seed] Seeding default roles...");
  // 1. Super Admin
  const superAdminRole = await prisma.adminRole.upsert({
    where: { slug: "super_admin" },
    update: { name: "Super Admin", isSystem: true },
    create: {
      name: "Super Admin",
      slug: "super_admin",
      description: "Full, unrestricted access to all platform administrative modules and settings.",
      isSystem: true,
    },
  });

  // Assign ALL permissions to Super Admin
  await prisma.adminRolePermission.deleteMany({ where: { roleId: superAdminRole.id } });
  await prisma.adminRolePermission.createMany({
    data: allDbPerms.map((p) => ({
      roleId: superAdminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  // 2. Admin
  const adminRole = await prisma.adminRole.upsert({
    where: { slug: "admin" },
    update: { name: "Admin", isSystem: true },
    create: {
      name: "Admin",
      slug: "admin",
      description: "Standard administrative access to users, listings, bookings, reports, and activity logs.",
      isSystem: true,
    },
  });
  const adminPermSlugs = [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_EDIT,
    PERMISSIONS.USERS_EXPORT,
    PERMISSIONS.ADMINS_VIEW,
    PERMISSIONS.RESERVATIONS_VIEW,
    PERMISSIONS.RESERVATIONS_EDIT,
    PERMISSIONS.RESERVATIONS_CANCEL,
    PERMISSIONS.RESERVATIONS_EXPORT,
    PERMISSIONS.LISTINGS_VIEW,
    PERMISSIONS.LISTINGS_CREATE,
    PERMISSIONS.LISTINGS_EDIT,
    PERMISSIONS.LISTINGS_DELETE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.ACTIVITY_LOGS_VIEW,
    PERMISSIONS.SECURITY_LOGS_VIEW,
    PERMISSIONS.SESSIONS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ];
  await prisma.adminRolePermission.deleteMany({ where: { roleId: adminRole.id } });
  await prisma.adminRolePermission.createMany({
    data: adminPermSlugs
      .map((slug) => permMap.get(slug))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: adminRole.id, permissionId })),
    skipDuplicates: true,
  });

  // Seed default admin user
  const email = process.env.ADMIN_EMAIL ?? "admin@homyz.local";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe!123";
  const passwordHash = await bcrypt.hash(password, 12);

  const adminUser = await prisma.user.upsert({
    where: { email },
    update: {
      role: Role.ADMIN,
      adminRoleId: superAdminRole.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      email,
      name: "Homyz Super Admin",
      passwordHash,
      role: Role.ADMIN,
      adminRoleId: superAdminRole.id,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
    select: { id: true, email: true, role: true, adminRoleId: true },
  });

  console.log(`[seed] Admin user ready: ${adminUser.email} (Role: ${adminUser.role}, Super Admin)`);
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
