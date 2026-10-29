import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { ValidationError } from "./customerService.js";

// Table: app_user(id serial PK, name varchar(100), email varchar(150) UNIQUE,
//                 password_hash varchar(255), role varchar(20) DEFAULT 'sales', created_at)

// password_hash is never selected into API responses.
const COLUMNS = "id AS user_id, name, email, role, created_at";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_ROLE = "sales";
const MIN_PASSWORD = 8;
const INVALID_LOGIN = "Invalid email or password";

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export async function registerUser({ name, email, password } = {}) {
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanEmail = normalizeEmail(email);

  if (!cleanName) throw new ValidationError("name is required");
  if (cleanName.length > 100) throw new ValidationError("name must be 100 characters or fewer");
  if (!cleanEmail) throw new ValidationError("email is required");
  if (!EMAIL_RE.test(cleanEmail)) throw new ValidationError("email is not a valid email address");
  if (cleanEmail.length > 150) throw new ValidationError("email must be 150 characters or fewer");
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    throw new ValidationError(`password must be at least ${MIN_PASSWORD} characters`);
  }
  // bcrypt ignores everything past 72 bytes.
  if (Buffer.byteLength(password) > 72) throw new ValidationError("password must be 72 bytes or fewer");

  const hash = await bcrypt.hash(password, 10);
  try {
    // The role is never taken from the request.
    const { rows } = await query(
      `INSERT INTO app_user (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [cleanName, cleanEmail, hash, DEFAULT_ROLE],
    );
    return rows[0];
  } catch (err) {
    if (err.code === "23505") throw new ValidationError("An account with this email already exists", 409);
    throw err;
  }
}

// Same error for an unknown email and a wrong password, so accounts can't be enumerated.
export async function authenticate(email, password) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || typeof password !== "string" || !password) {
    throw new ValidationError(INVALID_LOGIN, 401);
  }
  const { rows } = await query(`SELECT ${COLUMNS}, password_hash FROM app_user WHERE email = $1`, [
    cleanEmail,
  ]);
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw new ValidationError(INVALID_LOGIN, 401);
  }
  const { password_hash, ...user } = row;
  return user;
}

export async function getUserById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM app_user WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
