import fs from "node:fs";
import path from "node:path";

const databasePath = path.resolve(process.cwd(), "data/test-dental.db");
process.env.DATABASE_PATH = databasePath;
process.env.PRACTICE_TIMEZONE = "America/New_York";
process.env.STAFF_WEBHOOK_URL = "";

for (const suffix of ["", "-wal", "-shm"]) {
  const file = `${databasePath}${suffix}`;
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
