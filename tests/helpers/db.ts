import { beforeAll, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { seedDatabase } from "@/lib/db/seed";

export function useTestDatabase() {
  beforeAll(() => {
    runMigrations();
  });

  beforeEach(() => {
    seedDatabase();
  });
}
