import "dotenv/config";
import { Client } from "pg";

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "publicProfile" JSONB;`);
    console.log("Column publicProfile successfully added to User table in DB using pg!");
  } catch (err) {
    console.error("Error adding column:", err);
  } finally {
    await client.end();
    process.exit(0);
  }
}

main();
