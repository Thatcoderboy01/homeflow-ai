import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Bundle workspace TS packages; keep third-party deps external (resolved from node_modules).
  noExternal: [/^@homeflow\//],
  external: [/^@prisma\//, /^@modelcontextprotocol\//, "mariadb", "zod", "dotenv"],
});
