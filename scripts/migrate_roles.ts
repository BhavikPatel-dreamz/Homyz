import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// Read .env manually to be 100% reliable
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new pg.Pool({ connectionString });
  console.log("Connecting to database...");

  const client = await pool.connect();
  try {
    console.log("Adding column roles if not exists...");
    await client.query(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roles" "Role"[] NOT NULL DEFAULT ARRAY['USER'::"Role"];
    `);
    console.log("Column added or already exists.");

    console.log("Backfilling roles from role column...");
    const res = await client.query(`
      UPDATE "User" SET "roles" = CASE
        WHEN "role" = 'ADMIN' THEN ARRAY['ADMIN'::"Role", 'HOST'::"Role", 'USER'::"Role"]
        WHEN "role" = 'HOST' THEN ARRAY['HOST'::"Role", 'USER'::"Role"]
        ELSE ARRAY['USER'::"Role"]
      END
      WHERE "roles" = ARRAY['USER'::"Role"] OR array_length("roles", 1) IS NULL OR array_length("roles", 1) = 0;
    `);
    console.log(`Updated ${res.rowCount} users.`);

    // Also ensure every ADMIN has ADMIN in roles
    const adminEnsure = await client.query(`
      UPDATE "User"
      SET "roles" = ARRAY['ADMIN'::"Role", 'HOST'::"Role", 'USER'::"Role"]
      WHERE "role" = 'ADMIN' AND NOT ('ADMIN'::"Role" = ANY("roles"));
    `);
    console.log(`Ensured ${adminEnsure.rowCount} admin roles.`);

    // Verify
    const check = await client.query(`
      SELECT id, email, role, roles FROM "User" WHERE role = 'ADMIN' LIMIT 5;
    `);
    console.log("Sample admin users:", check.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});

