import pg from "pg";

// Render-hosted PostgreSQL requires SSL.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

pool.on("error", (err) => console.error("Unexpected PostgreSQL error:", err));
