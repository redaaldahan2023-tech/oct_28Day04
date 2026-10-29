# Plan 01 — User Registration, Login and Per-User Customer Access

Implements [Spec 01](../_specs/01_spec_userlogin_registration.md) (approved 2026-10-29). Open questions resolved with the spec's defaults: legacy customers stay unassigned, customer email stays globally unique, denied access returns 404, the token is kept in `localStorage`.

## 0. Preparation

- Commit all pending work, then create branch `feature/user-auth`.
- `backend`: `npm install bcryptjs jsonwebtoken`.
- `backend/.env` / `.env.example`: add `JWT_SECRET`, `JWT_EXPIRES_IN=8h`, `DATABASE_SSL`.

## 1. Database

| File | Change |
| --- | --- |
| `backend/db/migrations/001_auth.sql` | New. Idempotent: create `app_user` (spec §4.1), `ALTER TABLE customer ADD COLUMN IF NOT EXISTS sales_user_id ... REFERENCES app_user(id) ON DELETE RESTRICT`, `CREATE INDEX IF NOT EXISTS`. Also `CREATE TABLE IF NOT EXISTS customer`, so a fresh local database works. |
| `backend/scripts/migrate.js` + `npm run migrate` | New. Runs every `.sql` file in `db/migrations` in name order through `db.js`. |
| `backend/src/db.js` | SSL is configurable: off for `localhost` / `127.0.0.1` URLs or when `DATABASE_SSL=false`, otherwise on (Render). |

## 2. Auth backend

| File | Change |
| --- | --- |
| `backend/src/services/userService.js` | New. `registerUser({name,email,password})` (validates input, lower-cases the email, bcrypt cost 10, always role `sales`, 409 on duplicate email), `authenticate(email,password)` (same 401 message for both failure cases), `getUserById(id)`. Returns `user_id` and never the hash. |
| `backend/src/auth.js` | New. `signToken(user)`, `requireAuth` middleware (Bearer → verify → load user → `req.user`; 401 `Authentication required`), `authConfigured()`. Missing `JWT_SECRET` → 503. |
| `backend/src/routes/auth.js` | New. `POST /register` (201), `POST /login`, `GET /me` (requireAuth), with `@openapi` docs. |
| `backend/src/app.js` | Mount `/api/auth`. Put `requireAuth` in front of `/api/customers` and `/api/agent`. Add `authConfigured` to `/api/health`. |

## 3. Per-user customer access

| File | Change |
| --- | --- |
| `backend/src/services/customerService.js` | Every exported function takes `userId` as its first argument (required; throws if missing). All SQL is scoped with `sales_user_id = $n`. Inserts set `sales_user_id` from `userId`. `sales_user_id` is added to `COLUMNS` and is never read from input. |
| `backend/src/routes/customers.js` | Pass `req.user.id` to every call. Existing 404 handling covers other users' customers. |

## 4. Agent

| File | Change |
| --- | --- |
| `backend/src/agent/tools.js` | `executeTool(name, input, user)`; handlers receive `user.id`. The schemas are unchanged, so there's no owner field. |
| `backend/src/agent/agent.js` | `runAgent(message, history, user)`; the system prompt names the salesperson and says the scope is their own customers. |
| `backend/src/routes/agent.js` | Pass `req.user`; document security / 401. |

## 5. Swagger

`swagger.js`: `components.securitySchemes.bearerAuth`, an Auth tag, an updated description, and `persistAuthorization: true` in the UI config. Route docs: `security: [{ bearerAuth: [] }]` and 401 on the customer and agent operations, `sales_user_id` on `Customer`, plus the `User`, `RegisterInput`, `LoginInput` and `AuthResponse` schemas.

## 6. Frontend

| File | Change |
| --- | --- |
| `frontend/src/api.js` | Token in `localStorage` (try/catch). Adds the `Authorization` header and `register`/`login`/`me`. A 401 on an authenticated call fires an `onUnauthorized` callback. |
| `frontend/src/components/AuthPage.jsx` | New. Login/register form with a mode toggle and API error display. |
| `frontend/src/App.jsx` | Session state. Restores the session via `me()` on load and shows `AuthPage` when logged out. Sidebar shows the user's name and role with a Log out button. Pages remount per user, so chat history is cleared on logout. |
| `frontend/src/styles.css` | Auth page and user badge styles, using the existing tokens. |

## 7. Docs

README (setup: migrate, `JWT_SECRET`, auth endpoints, testing in Swagger), CLAUDE.md (auth architecture), `.env.example`.

## 8. Verification

1. `node --check` on every backend file; `npm run build` for the frontend.
2. With a reachable database: `npm run migrate`, then run the spec §11 acceptance criteria 1–8 with API calls as two users (A and B), and 9 in Swagger UI.
3. Frontend smoke test: register, log in, CRUD, chat, reload, log out.

Not run against the shared Render database without explicit approval.
