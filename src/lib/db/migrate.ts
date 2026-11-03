import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";

export function runMigrations() {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  migrate(db, { migrationsFolder });
  console.log(`[db] migrations applied from ${migrationsFolder}`);
}

if (process.argv[1] && /migrate\.(ts|js)$/.test(process.argv[1])) {
  runMigrations();
}
