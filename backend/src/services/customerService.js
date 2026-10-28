import { pool } from "../db.js";

// Shared data-access layer used by both the REST routes and the AI agent tools.

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const COLUMNS = "customer_id, name, email, phone, created_at";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function validate({ name, email, phone }, { requireName }) {
  if (requireName && !clean(name)) throw new ValidationError("name is required");
  if (name !== undefined && name !== null && String(name).length > 255) {
    throw new ValidationError("name must be 255 characters or fewer");
  }
  if (clean(email) && !EMAIL_RE.test(clean(email))) {
    throw new ValidationError("email is not a valid email address");
  }
  if (clean(phone) && !/^[0-9+\-() ]{3,30}$/.test(clean(phone))) {
    throw new ValidationError("phone may only contain digits, spaces and + - ( )");
  }
}

function parseId(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError("id must be a positive integer");
  return n;
}

export async function listCustomers(search) {
  const term = clean(search);
  if (term) {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM customer
       WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1
       ORDER BY customer_id`,
      [`%${term}%`],
    );
    return rows;
  }
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM customer ORDER BY customer_id`);
  return rows;
}

export async function getCustomerById(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM customer WHERE customer_id = $1`, [
    parseId(id),
  ]);
  return rows[0] ?? null;
}

export async function findCustomersByName(name) {
  const term = clean(name);
  if (!term) throw new ValidationError("name is required");
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM customer WHERE name ILIKE $1 ORDER BY customer_id`,
    [`%${term}%`],
  );
  return rows;
}

export async function createCustomer(data) {
  validate(data, { requireName: true });
  const { rows } = await pool.query(
    `INSERT INTO customer (name, email, phone) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [clean(data.name), clean(data.email), clean(data.phone)],
  );
  return rows[0];
}

export async function updateCustomer(id, data) {
  const customerId = parseId(id);
  validate(data, { requireName: false });

  const sets = [];
  const values = [];
  for (const field of ["name", "email", "phone"]) {
    if (data[field] !== undefined) {
      if (field === "name" && !clean(data.name)) throw new ValidationError("name cannot be empty");
      values.push(clean(data[field]));
      sets.push(`${field} = $${values.length}`);
    }
  }
  if (sets.length === 0) throw new ValidationError("provide at least one of name, email, phone");

  values.push(customerId);
  const { rows } = await pool.query(
    `UPDATE customer SET ${sets.join(", ")} WHERE customer_id = $${values.length} RETURNING ${COLUMNS}`,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteCustomer(id) {
  const { rows } = await pool.query(
    `DELETE FROM customer WHERE customer_id = $1 RETURNING ${COLUMNS}`,
    [parseId(id)],
  );
  return rows[0] ?? null;
}
