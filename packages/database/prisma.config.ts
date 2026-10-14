import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load the repo-root .env (Prisma 7 no longer loads .env files automatically).
dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DATABASE_URL ?? "mysql://homeflow:homeflow@localhost:3306/homeflow" },
});
