import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env"), quiet: true });

const testDb = process.env.TEST_DATABASE_URL ?? "mysql://homeflow:homeflow@127.0.0.1:3306/homeflow_test";

export default defineConfig({
  test: {
    include: ["apps/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.ts"],
    globalSetup: ["tests/support/globalSetup.ts"],
    // Suites share one real database, so files must run one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDb,
      TEST_DATABASE_URL: testDb,
      MCP_AUTH_TOKEN: "test-token-0123456789abcdef",
    },
  },
});
