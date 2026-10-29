# Spec 02 — Admin Login and User Dashboard

| | |
| --- | --- |
| **Status** | Approved 2026-10-29 |
| **Date** | 2026-10-29 |
| **Builds on** | [Spec 01](01_spec_userlogin_registration.md) — registration, login and per-user customer access |
| **Affects** | `backend/` (database, auth, new admin API, Swagger), `frontend/` |

## 1. Background

Since Spec 01, every account is a `sales` user who sees only their own customers. Nobody can see the application as a whole: which salespeople exist, and how many customers each one has.

This feature adds an **admin** role with its own login and a read-only dashboard that lists every sales user and their customer count.

## 2. Goals

1. An admin role exists alongside `sales`, stored in the same `app_user` table.
2. A default admin account is created automatically: email `admin@admin.com`, password `123456789`.
3. Admins log in through a separate admin login (its own endpoint and screen), not the sales login.
4. After logging in, the admin sees a dashboard listing all **sales** users with their name, email, sign-up date and number of customers.
5. The dashboard also shows totals: sales users, customers, and customers with no owner.
6. Everything is testable in Swagger UI or with API calls, like Spec 01.

## 3. Out of scope

- Creating, editing, deleting or deactivating users from the dashboard.
- Moving customers between users, or viewing and editing individual customers as an admin.
- Creating more admins through the API. Registration still always creates `sales` users.
- Changing the admin password from the UI.
- Admin use of the AI assistant.

## 4. Data model

### 4.1 Admins live in `app_user`

There is no separate admin table. Admins are rows in `app_user` with `role = 'admin'`. Widen the check constraint to `role IN ('sales', 'admin')`. The default stays `'sales'`.

### 4.2 Default admin seed

- After the SQL migrations, `npm run migrate` makes sure the admin exists. If no user with the admin email exists, it creates one with `role = 'admin'` and a bcrypt hash of the password.
- The defaults are email `admin@admin.com` and password `123456789`. The `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars can override them, for example for a deployed database.
- The seed never overwrites an existing account, so a password changed later in the database survives re-running the migration. An existing **sales** user with that email isn't promoted to admin; the migration prints a warning instead.
- The password is never printed or logged.

> **Security note:** `123456789` is a well-known password. On any deployed database, set `ADMIN_PASSWORD` before the first migration, or change the password straight after it.

### 4.3 Migration

`backend/db/migrations/002_admin_role.sql` is idempotent. It drops and re-creates the role check constraint with both values.

## 5. Authentication and authorization

- **Separate logins:**
  - `POST /api/admin/login` accepts only `admin` accounts.
  - `POST /api/auth/login` (Spec 01) now accepts only `sales` accounts.
  - Using an account at the wrong login returns the same `401 Invalid email or password` as wrong credentials, so neither login reveals which role an email has.
- **Tokens:** same JWT bearer format and `JWT_SECRET` as Spec 01.
- **Stale tokens:** `requireAuth` re-reads the user from the database on every request, as it already does. The role used for authorization is always the one currently in `app_user`, never the copy in the token. If a user is deleted or their role changes, an existing token stops working (401) or is checked against the new role (403) on the next request, without waiting for it to expire.
- **`requireRole(role)` middleware**, used after `requireAuth`. A logged-in user with the wrong role gets `403 { "error": "Forbidden" }`.
- **Access rules:**

| Endpoint group | sales | admin | Not logged in |
| --- | --- | --- | --- |
| `/api/customers/*`, `/api/agent/*` | ✅ own customers | 403 | 401 |
| `/api/admin/*` (except login) | 403 | ✅ | 401 |
| `/api/auth/me` | ✅ | ✅ | 401 |

Admins can't use the customer or agent endpoints because they own no customers. The dashboard shows aggregate counts only.

## 6. API

### 6.1 New endpoints

| Method | Path | Auth | Response |
| --- | --- | --- | --- |
| POST | `/api/admin/login` | public | `200 { user, token }`, or 401 |
| GET | `/api/admin/users` | admin | `200 { totals, users }` |

```json
{
  "totals": { "salesUsers": 2, "customers": 14, "unassignedCustomers": 2 },
  "users": [
    { "user_id": 2, "name": "Reda Aldahan", "email": "reda@example.com",
      "created_at": "2026-10-29T10:00:00Z", "customer_count": 9 }
  ]
}
```

- `users` contains **only sales users**. Admin accounts are never listed. The list is sorted by `customer_count` (highest first), then name.
- The counts come from a single `LEFT JOIN customer … GROUP BY` query, so sales users with no customers show `0`.
- Password hashes are never returned.

### 6.2 Changed endpoints

- `POST /api/auth/login` rejects admin accounts (§5).
- `/api/customers/*` and `/api/agent/chat` return 403 for admins.
- `/api/health` is unchanged.

## 7. Swagger / OpenAPI

- Add an **Admin** tag with both endpoints, plus the `AdminDashboard` and `UserSummary` schemas.
- `GET /api/admin/users` uses `bearerAuth` and documents 401 and 403. Customer and agent operations add 403.
- **Testing in Swagger UI:** run `POST /api/admin/login` with `admin@admin.com` / `123456789`, click **Authorize** and paste the token, then run `GET /api/admin/users`. Authorizing with a sales token instead returns 403.

## 8. Frontend

- **Separate admin login:** the sales sign-in screen has an "Admin sign in" link that opens a distinct admin login screen, styled the same but labelled "Admin console", with email and password and no registration option. It calls `api.adminLogin`. Opening the app at `#/admin` goes straight to it, and it has a link back to the sales sign-in.
- **Routing by role:** after login or session restore, `admin` users see the **Admin dashboard** and `sales` users see the existing Customers and AI Assistant pages. Neither sees the other's navigation.
- **Admin dashboard:**
  - Stat tiles: sales users, total customers, unassigned customers.
  - A sales users table with columns Name, Email, Joined and Customers.
  - A client-side search box filtering by name or email, and a **Refresh** button.
  - Loading, empty and error states that match the existing Customers page.
- **Sidebar:** shows the admin's name with the role "admin" and a Log out button.
- **Losing access:** when a request returns 401 (for example, the account was deleted), the app returns to the sign-in screen, as in Spec 01.

## 9. Configuration

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL` | Optional, default `admin@admin.com`. The account the seed makes sure exists. |
| `ADMIN_PASSWORD` | Optional, default `123456789`, at least 8 characters. Used only when the seed creates the account. |

No new dependencies.

## 10. Acceptance criteria

1. After `npm run migrate`, logging in at `POST /api/admin/login` with `admin@admin.com` / `123456789` returns 200 with `role: "admin"`.
2. Running `npm run migrate` again creates no duplicate admin and doesn't reset the password.
3. The admin's credentials at `POST /api/auth/login` return 401. A sales user's credentials at `POST /api/admin/login` return 401 with the same message.
4. `GET /api/admin/users` with an admin token returns every sales user, and no admins, with the correct `customer_count`, including `0` for users without customers. The totals match the database.
5. `GET /api/admin/users` returns 403 with a sales token and 401 without a token.
6. With an admin token, `/api/customers` and `/api/agent/chat` return 403.
7. Registration can't create an admin: sending `role: "admin"` still creates a `sales` user.
8. Stale tokens:
   - After a user's row is deleted, their existing token gets 401.
   - After a sales user's role is changed to `admin` in the database, their existing token gets 403 on `/api/customers` and 200 on `/api/admin/users`.
9. No response contains `password_hash`.
10. Swagger UI shows the Admin endpoints, and criteria 1, 4 and 5 can be completed from it.
11. In the frontend:
    - The admin logs in through the admin screen and sees the dashboard with correct counts.
    - Search filters the table.
    - Log out returns to the sign-in screen.
    - A sales user never sees the admin dashboard.

## 11. Decisions

| # | Question | Decision |
| --- | --- | --- |
| D1 | Default admin password | `123456789`, overridable with `ADMIN_PASSWORD` (see the security note in §4.2). |
| D2 | Which users appear on the dashboard? | Sales users only. Admin accounts are not listed or counted. |
| D3 | Stale tokens | Re-query the user and role from the database on every request (§5). |
| D4 | Where admins are stored | The same `app_user` table, with `role = 'admin'`. No separate table. |
| D5 | Can an admin sign in at the sales login? | No. The logins stay strictly separate. |
| D6 | Pagination of the users table | Not needed at this size. Add it if the user count grows. |
