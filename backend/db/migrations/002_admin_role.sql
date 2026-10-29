-- Spec 02: admins are app_user rows with role 'admin'. Safe to run more than once.
-- The default admin account itself is seeded by scripts/migrate.js (it needs bcrypt).

ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_role_check CHECK (role IN ('sales', 'admin'));
