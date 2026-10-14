import fs from "node:fs";
import path from "node:path";
import mariadb from "mariadb";

/**
 * Rebuilds the TEST database from the committed Prisma migration SQL before the run.
 * Safety: only touches a database whose name ends in "_test".
 */
export default async function setup() {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) throw new Error("TEST_DATABASE_URL is not set");
  const u = new URL(raw);
  const dbName = u.pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to reset "${dbName}": test database name must end with _test`);

  let conn;
  try {
    conn = await mariadb.createConnection({
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      multipleStatements: true,
    });
  } catch (err) {
    throw new Error(
      `Cannot connect to the test database server (${u.hostname}:${u.port || 3306}). Start MySQL (see README) and check TEST_DATABASE_URL.\n${String(err)}`,
    );
  }
  try {
    await conn.query(
      `DROP DATABASE IF EXISTS \`${dbName}\`; CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE \`${dbName}\`;`,
    );
    const dir = path.resolve(import.meta.dirname, "../../packages/database/prisma/migrations");
    const folders = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const f of folders) await conn.query(fs.readFileSync(path.join(dir, f, "migration.sql"), "utf8"));
  } finally {
    await conn.end();
  }
}
