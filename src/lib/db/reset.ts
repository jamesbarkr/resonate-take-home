import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const databasePath = path.resolve(
  process.env.DATABASE_PATH ?? "./data/dental.db",
);

for (const suffix of ["", "-wal", "-shm"]) {
  const file = `${databasePath}${suffix}`;
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`[db] removed ${file}`);
  }
}

execFileSync("npm", ["run", "db:migrate"], { stdio: "inherit" });
execFileSync("npm", ["run", "db:seed"], { stdio: "inherit" });
