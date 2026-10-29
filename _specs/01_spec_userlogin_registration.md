# Spec 01 — User Registration, Login and Per-User Customer Access

| | |
| --- | --- |
| **Status** | Approved 2026-10-29 — open questions resolved with the proposed defaults |
| **Date** | 2026-10-29 |
| **Affects** | `backend/` (database, REST API, agent, Swagger), `frontend/` |

## 1. Background

Customer Hub has no authentication today. Anyone who can reach the API can read and change every row in the `customer` table, through the REST endpoints or through the AI agent (`POST /api/agent/chat`).

This feature adds user accounts. Every customer belongs to one salesperson, and a logged-in user can see and manage only their own customers, whether they use the UI, the REST API or the agent.

## 2. Goals

1. A new user can register and then log in.
2. Every registered user gets the role `sales` by default.
3. Every customer is linked to the salesperson who owns it.
4. A logged-in user sees, creates, updates and deletes only their own customers. The CRUD features stay the same; only their scope changes.
5. The AI agent enforces the same rules and never reveals or changes another user's customers.
6. Any attempt to read or change a customer the user doesn't own is denied.
7. Swagger documents the new endpoints and the authentication, and the whole flow can be tested from Swagger UI or with plain API calls.

## 3. Out of scope

- Any role other than `sales`, such as admin or manager views of all customers. The role is stored so it can be added later.
- Password reset, email verification, changing the password, and editing the user profile.
- Moving customers from one salesperson to another.
- Social or single sign-on login, and refresh tokens.
- Rate limiting and account lockout.

## 4. Data model

### 4.1 New table `app_user`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `serial` | Primary key. The API returns it as `user_id`. |
| `name` | `varchar(100)` | Required |
| `email` | `varchar(150)` | Required, unique, stored in lower case, used to log in |
| `password_hash` | `varchar(255)` | Required, bcrypt hash. Never returned by the API. |
| `role` | `varchar(20)` | Required, default `'sales'`, check `role IN ('sales')` |
| `created_at` | `timestamp` | Default `now()` |

The table is named `app_user` because `user` is a reserved word in PostgreSQL.

### 4.2 Change to `customer`

Add `sales_user_id integer REFERENCES app_user(id) ON DELETE RESTRICT`, with an index on it.

- New customers always get `sales_user_id` from the logged-in user, never from the request body.
- Customer responses include `sales_user_id`.
- Rows that already exist have no owner (`NULL`), so no user can see them until they're assigned (see open question Q1).

### 4.3 Migration

The repo has no migration tool and the table already exists on Render. Add an idempotent SQL script (`backend/db/migrations/001_auth.sql`) that creates `app_user` and adds the column and index with `IF NOT EXISTS`. The README documents how to run it once against `DATABASE_URL`.

## 5. Authentication

- **Mechanism:** stateless JWT bearer tokens sent as `Authorization: Bearer <token>`. This works on Vercel's serverless functions, which keep no session state, and fits Swagger's **Authorize** button.
- **Token:** signed with HS256 using a new `JWT_SECRET` env var. The payload is `{ sub: user_id, role }`. The lifetime comes from `JWT_EXPIRES_IN` (default `8h`).
- **Passwords:** hashed with bcrypt at cost 10. At least 8 characters.
- **Failed logins:** a wrong email and a wrong password return the same 401 message, so the API doesn't reveal which emails are registered.
- **Middleware:** a `requireAuth` middleware checks the token, loads the user, and sets `req.user = { id, name, email, role }`. A missing, invalid or expired token returns `401 { "error": "Authentication required" }`.
- If `JWT_SECRET` is missing, the auth endpoints return 503, like the agent does when `ANTHROPIC_API_KEY` is missing. `/api/health` reports `authConfigured`.

## 6. API

### 6.1 New endpoints (public)

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `{ name, email, password }` | `201 { user, token }` |
| POST | `/api/auth/login` | `{ email, password }` | `200 { user, token }` |
| GET | `/api/auth/me` | — (needs a token) | `200 { user }` |

`user` is `{ user_id, name, email, role, created_at }`. Registration ignores any `role` in the body and always creates a `sales` user. It returns 409 if the email is already registered and 400 for invalid input.

### 6.2 Changed endpoints (require a token)

`/api/customers/*` and `/api/agent/chat` require a valid token. `/api/health`, `/swagger` and `/swagger.json` stay public.

| Endpoint | New behaviour |
| --- | --- |
| `GET /api/customers?search=` | Returns only the caller's customers |
| `GET /api/customers/search/by-name?name=` | Searches only the caller's customers |
| `GET /api/customers/{id}` | 404 if the customer doesn't exist **or** belongs to someone else |
| `POST /api/customers` | Sets `sales_user_id` to the caller. Any `sales_user_id` in the body is ignored. |
| `PUT /api/customers/{id}` | Updates only the caller's customer, otherwise 404. `sales_user_id` can't be changed. |
| `DELETE /api/customers/{id}` | Deletes only the caller's customer, otherwise 404 |

**Denied access:** a request for another user's customer gets `404 Not Found`, the same response as a customer that doesn't exist, so other users' customer IDs aren't revealed (see open question Q3).

**Enforcement:** ownership is checked inside the SQL itself (`WHERE id = $1 AND sales_user_id = $2`), not by fetching the row and comparing afterwards. Every function in `customerService.js` takes the owning user's ID as a required argument, so the REST routes and the agent tools can't skip the check.

## 7. AI agent

- `POST /api/agent/chat` requires authentication. `runAgent` receives `req.user`.
- Each tool call runs with the authenticated user's ID, which the server passes to `executeTool(name, input, user)`. The tool input schemas don't accept a user or owner field, so the model can't choose whose data it reads.
- The system prompt tells the model it is helping the salesperson `<name>` and can see only that person's customers. This is guidance for the model, not the security boundary: the rules are enforced by the service layer in §6.
- When a tool is asked for a customer the user doesn't own, it returns the same "not found" result as for a missing customer, and the agent reports that.

## 8. Swagger / OpenAPI

- Add a `bearerAuth` security scheme (`type: http`, `scheme: bearer`, `bearerFormat: JWT`).
- Add an **Auth** tag with the three auth endpoints, plus request/response schemas `RegisterInput`, `LoginInput`, `User` and `AuthResponse`.
- Mark every customer and agent operation with `security: [{ bearerAuth: [] }]` and document the 401 response. Add `sales_user_id` to the `Customer` schema.
- Update the API description to say that a token is required and that access is scoped to the user's own customers.
- **Testing in Swagger UI:** call `register` or `login`, copy the `token`, click **Authorize**, paste it, and the customer and agent endpoints then run as that user. Swagger UI must keep the token between page reloads (`persistAuthorization: true`).

## 9. Frontend

- **Login and Register screens:** the app shows the login screen until the user is authenticated, with a link to switch to registration. Field errors from the API appear on the form.
- **Session:** the token and user are stored in `localStorage` and restored on load by calling `GET /api/auth/me`. Any 401 response clears the session and returns to the login screen.
- **`api.js`:** adds the `Authorization` header to every authenticated request and adds `register`, `login` and `me` calls.
- **Header:** shows the logged-in user's name and role, with a **Log out** button that clears the token and chat history.
- The Customers and Chat pages are otherwise unchanged. They automatically show only the user's own data.

## 10. Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | backend `.env` and Vercel | Required. A long random string used to sign tokens. |
| `JWT_EXPIRES_IN` | backend | Optional, default `8h` |

New backend dependencies: `bcryptjs` (pure JavaScript, so it works on Vercel without native builds) and `jsonwebtoken`.

## 11. Acceptance criteria

1. `POST /api/auth/register` with valid data returns 201 with a token and `role: "sales"`, even if the body sends `role: "admin"`.
2. Registering an email that already exists returns 409. A password shorter than 8 characters returns 400.
3. `POST /api/auth/login` with valid credentials returns a token. A wrong password or unknown email returns 401 with the same message.
4. Any `/api/customers` or `/api/agent/chat` request without a valid token returns 401.
5. User A creates a customer. `GET /api/customers` returns it for A and not for user B.
6. User B's `GET`, `PUT` and `DELETE` on A's customer ID all return 404, and A's customer is unchanged.
7. Sending `sales_user_id` in a create or update body has no effect.
8. Asking the agent, as user B, to list, find, update or delete A's customers neither returns nor changes them, and `dataChanged` stays `false`.
9. Swagger UI shows the Auth endpoints and the Authorize button. Steps 1–6 can be completed entirely from Swagger UI.
10. In the frontend, a user can register, log in, see only their own customers, use the chat, and log out. A reload keeps them logged in until the token expires.
11. Passwords and password hashes never appear in API responses or logs.

## 12. Open questions

| # | Question | Proposed default |
| --- | --- | --- |
| Q1 | What happens to the customers that already exist and have no owner? | Leave them unassigned (hidden from everyone). Optionally provide a one-off SQL snippet to assign them to a chosen user. |
| Q2 | Customer email is unique across the whole table today. Should it be unique per salesperson instead? | Keep it unique across the table. A duplicate returns 409 without saying which user owns that customer. |
| Q3 | Should denied access return 403 or 404? | 404, so the API doesn't confirm that another user's customer exists. |
| Q4 | Should the token be stored in `localStorage` or in an httpOnly cookie? | `localStorage` with a bearer header, which keeps Swagger and API testing simple. A cookie would need cross-site cookie settings between the two Vercel domains. |
