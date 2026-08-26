// Prisma 7 config. Unlike older Prisma, .env is NOT auto-loaded — dotenv/config
// makes DATABASE_URL available to CLI commands (migrate, generate, studio, seed).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
