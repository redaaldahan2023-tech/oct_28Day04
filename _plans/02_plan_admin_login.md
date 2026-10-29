# Plan 02 — Admin Login and User Dashboard

Implements [Spec 02](../_specs/02_spec_admin_login.md) (approved 2026-10-29), including decisions D1–D6: default password `123456789` with an env override, only sales users on the dashboard, user and role re-queried on every request, and admins stored in `app_user`.

## 0. Preparation

- Commit all pending work on the current branch (the Spec 01 implementation on `feature/user-auth`), then create `feature/admin-dashboard` from it.
- `backend/.env.example`: add commented `ADMIN_EMAIL` / `ADMIN_PASSWORD` lines with the security note.

## 1. Database and seed

| File | Change |
| --- | --- |
| `backend/db/migrations/002_admin_role.sql` | New. `ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_role_check;` then `ADD CONSTRAINT app_user_role_check CHECK (role IN ('sales','admin'))`. |
| `backend/src/services/userService.js` | `ensureAdmin(email, password)`: validates the password (8+ characters), then `INSERT … ON CONFLICT (email) DO NOTHING` with role `admin`. Returns `created`, `exists` (already an admin) or `conflict` (the email belongs to a sales user). |
| | `authenticate(email, password, role)`: adds the required role. A role mismatch throws the same 401 `Invalid email or password`. |
| | `listSalesUsersWithCustomerCounts()` and `getDashboardTotals()` (queries below). |
| `backend/scripts/migrate.js` | After the SQL files, call `ensureAdmin(ADMIN_EMAIL \|\| "admin@admin.com", ADMIN_PASSWORD \|\| "123456789")`. Print `Admin account <email>: created / already exists`, never the password. Print a warning on `conflict`, and a reminder to override the default password when the default was used to create the account. |

Dashboard queries (read-only, one round trip each):

```sql
SELECT u.id AS user_id, u.name, u.email, u.created_at, COUNT(c.id)::int AS customer_count
FROM app_user u LEFT JOIN customer c ON c.sales_user_id = u.id
WHERE u.role = 'sales'
GROUP BY u.id ORDER BY customer_count DESC, u.name;

SELECT
  (SELECT COUNT(*) FROM app_user WHERE role = 'sales')::int        AS "salesUsers",
  (SELECT COUNT(*) FROM customer)::int                             AS customers,
  (SELECT COUNT(*) FROM customer WHERE sales_user_id IS NULL)::int AS "unassignedCustomers";
```

## 2. Authorization

| File | Change |
| --- | --- |
| `backend/src/auth.js` | `requireAuth` already reloads the user on every request (D3). Keep it, and add a comment that `req.user.role` must always come from that query. Add `requireRole(role)`, which returns 403 `Forbidden` when `req.user.role !== role`. Add `issueSession(user)` → `{ user, token }`, shared by both logins. |
| `backend/src/routes/auth.js` | `/login` calls `authenticate(email, password, "sales")`. |
| `backend/src/app.js` | `/api/customers` and `/api/agent` become `requireAuth, requireRole("sales"), router`. Mount `/api/admin`. |

## 3. Admin API

| File | Change |
| --- | --- |
| `backend/src/routes/admin.js` | New. Same 503 guard as `auth.js` when `JWT_SECRET` is missing. |
| | `POST /login` → `authenticate(..., "admin")` → `{ user, token }`. |
| | `GET /users` behind `requireAuth, requireRole("admin")` → `{ totals, users }`. |
| | `@openapi` docs: Admin tag, the `UserSummary` and `AdminDashboard` schemas, 401/403 responses. |
| `backend/src/routes/auth.js` (docs) | Add a shared `components.responses.Forbidden`. |
| `backend/src/routes/customers.js`, `routes/agent.js` (docs) | Add `403: Forbidden` to every operation. |
| `backend/src/swagger.js` | Add the Admin tag and a sentence on the admin login to the description. |

## 4. Frontend

| File | Change |
| --- | --- |
| `frontend/src/api.js` | Add `adminLogin(data)` and `adminUsers()`. |
| `frontend/src/components/AuthPage.jsx` | Add a third mode, `admin`: "Admin console" subtitle, email and password only, calls `adminLogin`, with a "Back to sales sign in" link. Sales modes show an "Admin sign in" link. The initial mode is `admin` when `location.hash === "#/admin"`, and switching modes keeps the hash in sync. |
| `frontend/src/components/AdminDashboard.jsx` | New. Loads `adminUsers()` on mount and on Refresh. Three stat tiles (reusing `.stats`/`.stat`). A table (reusing `.card`/`.table-wrap`/`.avatar`/`.empty`/`.error-box`/`.skeleton`) with Name, Email, Joined and Customers, and a search box that filters by name or email. |
| `frontend/src/App.jsx` | Pick the nav and pages by `user.role`: admins get one "Dashboard" item and `AdminDashboard`, sales users keep the current nav. Logging out clears `#/admin`. |
| `frontend/src/styles.css` | Only what the new components need, using the existing tokens. |

## 5. Docs

- **README:** admin login, default credentials with the security note, `ADMIN_EMAIL` / `ADMIN_PASSWORD`, the `/api/admin/*` endpoints, and Swagger test steps for the admin.
- **CLAUDE.md:** roles, `requireRole`, the admin route group, and the rule that the role always comes from the database.

## 6. Verification

1. `node --check` on every backend file, the Swagger spec parses with no error, and `npm run build` succeeds for the frontend.
2. Run `npm run migrate` twice on the local database: the first run prints `created`, the second `already exists`. Log in with the default credentials.
3. Scripted API checks for spec §10 criteria 1–9, with temporary sales users and customers. For criterion 8, delete a user row, and change a role with SQL, then reuse the existing tokens. All temporary data is removed afterwards; the seeded admin stays.
4. Manual check in Swagger UI (criterion 10), plus a frontend smoke test on the running dev servers (criterion 11).

Nothing is run against the shared Render database without explicit approval.
