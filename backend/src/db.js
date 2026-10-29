import pg from "pg";

// Render-hosted PostgreSQL requires SSL; a local server usually doesn't support it.
// SSL is off for localhost URLs or when DATABASE_SSL=false.
const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "");
const useSsl = process.env.DATABASE_SSL ? process.env.DATABASE_SSL !== "false" : !isLocal;

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 5,
  // Serverless functions are frozen between requests while Render closes idle
  // connections, so don't keep connections around for long.
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => console.error("Unexpected PostgreSQL error:", err.message));

function isConnectionError(err) {
  return (
    ["ECONNRESET", "EPIPE", "ETIMEDOUT", "57P01"].includes(err.code) ||
    /Connection terminated|connection timeout|Client has encountered a connection error/i.test(err.message)
  );
}

// pool.query with one retry when a pooled connection turned out to be dead.
export async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    console.warn("Retrying query after connection error:", err.message);
    return pool.query(text, params);
  }
}
