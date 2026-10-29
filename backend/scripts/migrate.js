import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";
import { ensureAdmin } from "../src/services/userService.js";

// Runs every db/migrations/*.sql file in name order (they are idempotent), then makes sure
// the default admin account exists.
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const DEFAULT_ADMIN_EMAIL = "admin@admin.com";
const DEFAULT_ADMIN_PASSWORD = "123456789";

try {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await pool.query(await fs.readFile(path.join(dir, file), "utf8"));
    console.log(`Applied ${file}`);
  }

  const email = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const result = await ensureAdmin(email, password);
  if (result === "conflict") {
    console.warn(`Warning: ${email} belongs to a non-admin user; no admin account was created.`);
  } else {
    console.log(`Admin account ${email}: ${result === "created" ? "created" : "already exists"}`);
    if (result === "created" && !process.env.ADMIN_PASSWORD) {
      console.warn("Warning: the admin uses the well-known default password. Set ADMIN_PASSWORD on deployed databases.");
    }
  }
} catch (err) {
  console.error(`Migration failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
