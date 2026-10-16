-- Make the referral review module available immediately to the existing system
-- roles. Custom roles remain opt-in through the normal permission matrix.
INSERT INTO "AdminPermission" ("id", "slug", "module", "action", "description")
VALUES
  ('permission-referrals-view', 'referrals.view', 'Referrals', 'View', 'View referral reward activity and credit status'),
  ('permission-referrals-review', 'referrals.review', 'Referrals', 'Review', 'Approve or reject pending referral reward credits')
ON CONFLICT ("slug") DO UPDATE
SET "module" = EXCLUDED."module", "action" = EXCLUDED."action", "description" = EXCLUDED."description";

INSERT INTO "AdminRolePermission" ("id", "roleId", "permissionId")
SELECT
  'role-permission-' || role."slug" || '-' || permission."slug",
  role."id",
  permission."id"
FROM "AdminRole" AS role
CROSS JOIN "AdminPermission" AS permission
WHERE role."slug" IN ('admin', 'super_admin')
  AND permission."slug" IN ('referrals.view', 'referrals.review')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
