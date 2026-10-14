import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/client.js";

let instance: PrismaClient | undefined;

export function parseDatabaseUrl(url: string) {
  const u = new URL(url);
  if (!["mysql:", "mariadb:"].includes(u.protocol)) {
    throw new Error("DATABASE_URL must start with mysql://");
  }
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  return {
    // MySQL 8 uses caching_sha2_password; over plain TCP the driver needs this to fetch the RSA key.
    // Only enabled automatically for loopback; for remote hosts use TLS or opt in via the URL query.
    allowPublicKeyRetrieval: loopback || u.searchParams.get("allowPublicKeyRetrieval") === "true",
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

/** Lazily creates a singleton Prisma client using the MariaDB/MySQL driver adapter. */
export function getPrisma(url = process.env.DATABASE_URL): PrismaClient {
  if (instance) return instance;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  const adapter = new PrismaMariaDb({ ...parseDatabaseUrl(url), connectionLimit: 5 });
  instance = new PrismaClient({ adapter });
  return instance;
}

export async function disconnectPrisma(): Promise<void> {
  if (instance) {
    await instance.$disconnect();
    instance = undefined;
  }
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
