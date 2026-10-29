import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

// Runs every db/migrations/*.sql file in name order. The migrations are idempotent.
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

try {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await pool.query(await fs.readFile(path.join(dir, file), "utf8"));
    console.log(`Applied ${file}`);
  }
} catch (err) {
  console.error(`Migration failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
