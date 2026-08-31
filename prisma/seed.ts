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
  const email = process.env.ADMIN_EMAIL ?? "admin@homyz.com";
  const password = process.env.ADMIN_PASSWORD ?? "Admin@Password123!";
  const passwordHash = await bcrypt.hash(password, 12);
  const hostPasswordHash = await bcrypt.hash("Host@Password123!", 12);

  const adminUser = await prisma.user.upsert({
    where: { email },
    update: {
      role: Role.ADMIN,
      adminRoleId: superAdminRole.id,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
    create: {
      email,
      name: "Homyz Lead Administrator",
      passwordHash,
      role: Role.ADMIN,
      adminRoleId: superAdminRole.id,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
    select: { id: true, email: true, role: true, adminRoleId: true },
  });

  console.log(`[seed] Admin user ready: ${adminUser.email} / ${password} (Role: ${adminUser.role}, Super Admin)`);

  // Seed sample Host Registration Requests & Hosts for full Admin Testing
  console.log("[seed] Seeding sample host registration requests and host data...");

  // 1. Pending Review Applicant
  const applicant1 = await prisma.user.upsert({
    where: { email: "sarah.connor@apexluxury.com" },
    update: { role: Role.USER, status: UserStatus.ACTIVE, passwordHash: hostPasswordHash },
    create: {
      email: "sarah.connor@apexluxury.com",
      name: "Sarah Connor",
      passwordHash: hostPasswordHash,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  });

  const req1 = await prisma.hostRegistrationRequest.upsert({
    where: { applicationId: "APP-PENDING-001" },
    update: { status: "PENDING", onboardingStage: "APPLICATION_REVIEW", applicantEmail: applicant1.email! },
    create: {
      applicationId: "APP-PENDING-001",
      host: { connect: { id: applicant1.id } },
      applicantName: "Sarah Connor",
      applicantEmail: applicant1.email!,
      applicantPhone: "+1 (555) 234-5678",
      businessName: "Apex Luxury Stays LLC",
      registrationType: "CORPORATION",
      propertyCount: 3,
      status: "PENDING",
      onboardingStage: "APPLICATION_REVIEW",
      complianceStatus: "UNDER_REVIEW",
    },
  });

  await prisma.hostRegistrationDocument.upsert({
    where: { id: "doc-pending-id-001" },
    update: { status: "PENDING" },
    create: {
      id: "doc-pending-id-001",
      request: { connect: { id: req1.id } },
      documentType: "GOVERNMENT_ID",
      fileUrl: "https://via.placeholder.com/600x400.png?text=Government+ID",
      fileName: "sarah_connor_passport.pdf",
      status: "PENDING",
    },
  });

  // 2. Action Required Applicant
  const applicant2 = await prisma.user.upsert({
    where: { email: "michael.scott@scrantonrentals.com" },
    update: { role: Role.USER, status: UserStatus.ACTIVE, passwordHash: hostPasswordHash },
    create: {
      email: "michael.scott@scrantonrentals.com",
      name: "Michael Scott",
      passwordHash: hostPasswordHash,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  });

  const req2 = await prisma.hostRegistrationRequest.upsert({
    where: { applicationId: "APP-ACTION-002" },
    update: { status: "WAITING_FOR_DOCUMENTS", onboardingStage: "DOCUMENT_VERIFICATION", applicantEmail: applicant2.email! },
    create: {
      applicationId: "APP-ACTION-002",
      host: { connect: { id: applicant2.id } },
      applicantName: "Michael Scott",
      applicantEmail: applicant2.email!,
      applicantPhone: "+1 (555) 345-6789",
      businessName: "Scranton Rentals LLC",
      registrationType: "INDIVIDUAL",
      propertyCount: 1,
      status: "WAITING_FOR_DOCUMENTS",
      onboardingStage: "DOCUMENT_VERIFICATION",
      complianceStatus: "ACTION_REQUIRED",
      notes: "Please re-upload a clear copy of your business permit.",
    },
  });

  await prisma.hostRegistrationDocument.upsert({
    where: { id: "doc-action-license-002" },
    update: { status: "REJECTED", rejectionReason: "Image blurry and illegible" },
    create: {
      id: "doc-action-license-002",
      request: { connect: { id: req2.id } },
      documentType: "BUSINESS_LICENSE",
      fileUrl: "https://via.placeholder.com/600x400.png?text=Blurry+License",
      fileName: "scranton_license_scan.pdf",
      status: "REJECTED",
      rejectionReason: "Image blurry and illegible",
      resubmissionRequested: true,
    },
  });

  // 3. Approved Active Host
  const activeHost = await prisma.user.upsert({
    where: { email: "elena.rostova@rostovaestates.com" },
    update: { role: Role.HOST, status: UserStatus.ACTIVE, passwordHash: hostPasswordHash },
    create: {
      email: "elena.rostova@rostovaestates.com",
      name: "Elena Rostova",
      passwordHash: hostPasswordHash,
      role: Role.HOST,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.hostRegistrationRequest.upsert({
    where: { applicationId: "APP-APPROVED-003" },
    update: { status: "APPROVED", onboardingStage: "ONBOARDING_COMPLETE", applicantEmail: activeHost.email! },
    create: {
      applicationId: "APP-APPROVED-003",
      host: { connect: { id: activeHost.id } },
      applicantName: "Elena Rostova",
      applicantEmail: activeHost.email!,
      applicantPhone: "+1 (555) 456-7890",
      businessName: "Rostova Estates Group",
      registrationType: "CORPORATION",
      propertyCount: 5,
      status: "APPROVED",
      onboardingStage: "ONBOARDING_COMPLETE",
      complianceStatus: "COMPLIANT",
      approvedAt: new Date(),
      approvedBy: { connect: { id: adminUser.id } },
    },
  });

  console.log("[seed] Sample test data seeded successfully!");
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
