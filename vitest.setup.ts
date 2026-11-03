import fs from "node:fs";
import path from "node:path";

const databasePath = path.resolve(process.cwd(), "data/test-dental.db");
process.env.DATABASE_PATH = databasePath;
process.env.PRACTICE_TIMEZONE = "America/New_York";
process.env.STAFF_WEBHOOK_URL = "";
process.env.SESSION_SECRET = "test-session-secret";
process.env.STAFF_EMAIL = "frontdesk@lakeside.test";
process.env.STAFF_PASSWORD = "frontdesk-demo";

for (const suffix of ["", "-wal", "-shm"]) {
  const file = `${databasePath}${suffix}`;
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
