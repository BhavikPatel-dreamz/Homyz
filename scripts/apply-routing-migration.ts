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
      "prisma/migrations/20261026110000_add_payout_routing_and_distributions/migration.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");

    console.log("Applying PayoutRoutingRule and BookingPayoutDistribution migration SQL...");
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migration executed successfully!");

    // Verify PayoutRoutingRule table exists
    const checkRule = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'PayoutRoutingRule'
      ORDER BY ordinal_position;
    `);
    console.log(`PayoutRoutingRule columns count: ${checkRule.rows.length}`);

    // Verify BookingPayoutDistribution table exists
    const checkDist = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'BookingPayoutDistribution'
      ORDER BY ordinal_position;
    `);
    console.log(`BookingPayoutDistribution columns count: ${checkDist.rows.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();

