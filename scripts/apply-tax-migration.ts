import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to PostgreSQL database.");

  try {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20261026120000_add_host_taxpayer_and_tax_documents/migration.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");

    console.log("Applying HostTaxpayerProfile and HostTaxDocument migration SQL...");
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migration executed successfully!");

    // Verify HostTaxpayerProfile table exists
    const checkProfile = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'HostTaxpayerProfile'
      ORDER BY ordinal_position;
    `);
    console.log(`HostTaxpayerProfile columns count: ${checkProfile.rows.length}`);

    // Verify HostTaxDocument table exists
    const checkDoc = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'HostTaxDocument'
      ORDER BY ordinal_position;
    `);
    console.log(`HostTaxDocument columns count: ${checkDoc.rows.length}`);

    // Verify TaxRegistration new columns
    const checkReg = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'TaxRegistration' AND column_name IN ('taxpayerProfileId', 'rejectionReason');
    `);
    console.log(`TaxRegistration new columns: ${checkReg.rows.map(r => r.column_name).join(", ")}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

