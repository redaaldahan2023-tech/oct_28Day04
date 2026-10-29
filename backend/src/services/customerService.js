import { query } from "../db.js";

// Shared data-access layer used by both the REST routes and the AI agent tools.
// Table: customer(id serial PK, name varchar(100) NOT NULL, email varchar(150) NOT NULL UNIQUE,
//                 phone varchar(20), city varchar(50), created_at timestamp DEFAULT now(),
//                 sales_user_id integer REFERENCES app_user(id))
//
// Every function takes the owning user's id first, and every query is scoped by
// sales_user_id in SQL, so a user can never read or change another user's customers.
// A customer owned by someone else behaves exactly like one that doesn't exist.

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// The API exposes the primary key as customer_id.
const COLUMNS = "id AS customer_id, name, email, phone, city, created_at, sales_user_id";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTH = { name: 100, email: 150, phone: 20, city: 50 };
const FIELDS = Object.keys(MAX_LENGTH);

function clean(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function validate(data, { isCreate }) {
  if (isCreate || data.name !== undefined) {
    if (!clean(data.name)) throw new ValidationError("name is required");
  }
  if (isCreate || data.email !== undefined) {
    if (!clean(data.email)) throw new ValidationError("email is required");
    if (!EMAIL_RE.test(clean(data.email))) throw new ValidationError("email is not a valid email address");
  }
  if (clean(data.phone) && !/^[0-9+\-() ]+$/.test(clean(data.phone))) {
    throw new ValidationError("phone may only contain digits, spaces and + - ( )");
  }
  for (const field of FIELDS) {
    const value = clean(data[field]);
    if (value && value.length > MAX_LENGTH[field]) {
      throw new ValidationError(`${field} must be ${MAX_LENGTH[field]} characters or fewer`);
    }
  }
}

function parseId(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError("id must be a positive integer");
  return n;
}

// A missing owner is a programming error, never a reason to run an unscoped query.
function ownerId(userId) {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("customerService called without a user id");
  return userId;
}

// Turn a unique-email violation into a readable 409 instead of a 500.
async function write(text, params) {
  try {
    return await query(text, params);
  } catch (err) {
    if (err.code === "23505") throw new ValidationError("A customer with this email already exists", 409);
    throw err;
  }
}

export async function listCustomers(userId, search) {
  const owner = ownerId(userId);
  const term = clean(search);
  if (term) {
    const { rows } = await query(
      `SELECT ${COLUMNS} FROM customer
       WHERE sales_user_id = $1
         AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR city ILIKE $2)
       ORDER BY id`,
      [owner, `%${term}%`],
    );
    return rows;
  }
  const { rows } = await query(`SELECT ${COLUMNS} FROM customer WHERE sales_user_id = $1 ORDER BY id`, [owner]);
  return rows;
}

export async function getCustomerById(userId, id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM customer WHERE id = $1 AND sales_user_id = $2`, [
    parseId(id),
    ownerId(userId),
  ]);
  return rows[0] ?? null;
}

export async function findCustomersByName(userId, name) {
  const owner = ownerId(userId);
  const term = clean(name);
  if (!term) throw new ValidationError("name is required");
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM customer WHERE sales_user_id = $1 AND name ILIKE $2 ORDER BY id`,
    [owner, `%${term}%`],
  );
  return rows;
}

export async function createCustomer(userId, data) {
  const owner = ownerId(userId);
  validate(data, { isCreate: true });
  // sales_user_id always comes from the logged-in user, never from the request body.
  const { rows } = await write(
    `INSERT INTO customer (name, email, phone, city, sales_user_id) VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUMNS}`,
    [clean(data.name), clean(data.email), clean(data.phone), clean(data.city), owner],
  );
  return rows[0];
}

export async function updateCustomer(userId, id, data) {
  const owner = ownerId(userId);
  const customerId = parseId(id);
  validate(data, { isCreate: false });

  // Only FIELDS can change; sales_user_id is not among them.
  const sets = [];
  const values = [];
  for (const field of FIELDS) {
    if (data[field] !== undefined) {
      values.push(clean(data[field]));
      sets.push(`${field} = $${values.length}`);
    }
  }
  if (sets.length === 0) throw new ValidationError("provide at least one of name, email, phone, city");

  values.push(customerId, owner);
  const { rows } = await write(
    `UPDATE customer SET ${sets.join(", ")}
     WHERE id = $${values.length - 1} AND sales_user_id = $${values.length}
     RETURNING ${COLUMNS}`,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteCustomer(userId, id) {
  const { rows } = await query(
    `DELETE FROM customer WHERE id = $1 AND sales_user_id = $2 RETURNING ${COLUMNS}`,
    [parseId(id), ownerId(userId)],
  );
  return rows[0] ?? null;
}
