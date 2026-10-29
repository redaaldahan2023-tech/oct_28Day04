-- Spec 01: user accounts and per-user customer ownership. Safe to run more than once.

CREATE TABLE IF NOT EXISTS app_user (
  id            serial PRIMARY KEY,
  name          varchar(100) NOT NULL,
  email         varchar(150) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  role          varchar(20)  NOT NULL DEFAULT 'sales' CHECK (role IN ('sales')),
  created_at    timestamp    DEFAULT now()
);

-- Matches the existing Render table, so a fresh local database works too.
CREATE TABLE IF NOT EXISTS customer (
  id         serial PRIMARY KEY,
  name       varchar(100) NOT NULL,
  email      varchar(150) NOT NULL UNIQUE,
  phone      varchar(20),
  city       varchar(50),
  created_at timestamp DEFAULT now()
);

-- Existing customers keep sales_user_id NULL and are visible to no one until assigned.
ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS sales_user_id integer REFERENCES app_user(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS customer_sales_user_id_idx ON customer (sales_user_id);
