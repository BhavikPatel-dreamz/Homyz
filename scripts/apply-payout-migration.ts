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
      "prisma/migrations/20261026100000_add_host_payout_methods/migration.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");

    console.log("Applying HostPayoutMethod migration SQL...");
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migration executed successfully!");

    // Verify table exists
    const checkRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'HostPayoutMethod'
      ORDER BY ordinal_position;
    `);

    console.log(`HostPayoutMethod columns count: ${checkRes.rows.length}`);
    for (const col of checkRes.rows) {
      console.log(` - ${col.column_name}: ${col.data_type}`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

