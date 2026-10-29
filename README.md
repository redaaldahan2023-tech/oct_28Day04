# Customer Hub — Lab 05

Two projects that run on separate ports:

| Project     | Stack                                                    | URL                             |
| ----------- | -------------------------------------------------------- | ------------------------------- |
| `backend/`  | Node.js, Express 5, PostgreSQL (`pg`), Swagger, Anthropic SDK | http://localhost:4000           |
| `frontend/` | React 19 + Vite                                          | http://localhost:5173           |

Swagger UI: **http://localhost:4000/swagger** (raw spec at `/swagger.json`).

Users register and log in; every user has the role `sales` and sees and manages only the customers assigned to them — in the UI, the REST API and the AI assistant.

Admins sign in separately (the "Admin sign in" link, or open the app at `#/admin`) and get a read-only dashboard of all sales users with the number of customers each one has. `npm run migrate` creates the default admin **`admin@admin.com` / `123456789`** if it doesn't exist — set `ADMIN_PASSWORD` (and optionally `ADMIN_EMAIL`) before migrating any deployed database, since that password is well known.

## Setup

```bash
# 1. Backend
cd backend
npm install
# edit .env: DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
npm run migrate    # creates/updates the tables and the default admin (safe to re-run)
npm run dev        # or: npm start

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev
```

### Backend `.env`

| Variable            | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `PORT`              | API port (default 4000)                                    |
| `DATABASE_URL`      | PostgreSQL connection string (Render or local)             |
| `DATABASE_SSL`      | Optional. SSL is off for `localhost` URLs and on otherwise; set `false`/`true` to override |
| `JWT_SECRET`        | Required. Long random string that signs login tokens       |
| `JWT_EXPIRES_IN`    | Token lifetime, defaults to `8h`                           |
| `ADMIN_EMAIL`       | Default admin seeded by `npm run migrate`, defaults to `admin@admin.com` |
| `ADMIN_PASSWORD`    | Its initial password, defaults to `123456789` — override on deployed databases |
| `ANTHROPIC_API_KEY` | Required for the `/api/agent/chat` endpoint                |
| `ANTHROPIC_MODEL`   | Defaults to `claude-opus-5-5`                              |
| `AGENT_EFFORT`      | Agent effort level (`low`–`max`), defaults to `medium`     |
| `CORS_ORIGIN`       | Allowed frontend origin(s), comma-separated, or `*`        |

Frontend `.env`: `VITE_API_URL=http://localhost:4000`.

## Deploying to Vercel

The repo holds two apps, so create **two Vercel projects** from the same GitHub repo, each with its own **Root Directory**.

### 1. Backend (deploy first)

- New Project → import the repo → **Root Directory: `backend`** → Framework Preset: **Other** (already set by `backend/vercel.json`).
- Environment variables:

  | Name                | Value                                                      |
  | ------------------- | ---------------------------------------------------------- |
  | `DATABASE_URL`      | your PostgreSQL connection string                          |
  | `ANTHROPIC_API_KEY` | your Anthropic key                                         |
  | `JWT_SECRET`        | a long random string (different from local)                |
  | `CORS_ORIGIN`       | the frontend URL, e.g. `https://your-frontend.vercel.app` (use `*` until you know it) |

- After deploying, check `https://<backend>.vercel.app/api/health` and `https://<backend>.vercel.app/swagger`.

How it works: `backend/api/index.js` exports the Express app as a serverless function, and `vercel.json` rewrites every path to it, so `/swagger`, `/swagger.json` and `/api/*` all behave as they do locally. Swagger UI loads its assets from the jsDelivr CDN, and the spec uses a relative server URL so **Try it out** calls whatever host serves the page.

### 2. Frontend

- New Project → same repo → **Root Directory: `frontend`** → Framework Preset: **Vite** (auto-detected).
- Environment variable: `VITE_API_URL` = `https://<backend>.vercel.app` (no trailing slash). It's read at build time, so **redeploy** after changing it.
- Then set the backend's `CORS_ORIGIN` to this frontend URL and redeploy the backend.

### Notes

- `.env` files are git-ignored; secrets live only in Vercel's environment variable settings.
- The chat endpoint's function timeout is 60 s (`maxDuration` in `backend/vercel.json`).

## API

Everything under `/api/customers` and `/api/agent` needs a **sales** user's `Authorization: Bearer <token>`. Another user's customer answers `404`, the same as one that doesn't exist. Admin tokens get `403` there, and sales tokens get `403` on `/api/admin/users`.

| Method | Path                                   | Description                          |
| ------ | -------------------------------------- | ------------------------------------ |
| POST   | `/api/auth/register`                   | Create a `sales` user → `{ user, token }` |
| POST   | `/api/auth/login`                      | Sales log in → `{ user, token }`     |
| GET    | `/api/auth/me`                         | The logged-in user                   |
| POST   | `/api/admin/login`                     | Admin log in → `{ user, token }`     |
| GET    | `/api/admin/users`                     | Admin dashboard: `{ totals, users }` with each sales user's `customer_count` |
| GET    | `/api/customers?search=`               | List your customers (optional filter) |
| GET    | `/api/customers/search/by-name?name=`  | Find customers by partial name       |
| GET    | `/api/customers/{id}`                  | Get one customer                     |
| POST   | `/api/customers`                       | Create (`name` and unique `email` required) |
| PUT    | `/api/customers/{id}`                  | Update provided fields               |
| DELETE | `/api/customers/{id}`                  | Delete                               |
| POST   | `/api/agent/chat`                      | Natural-language assistant           |
| GET    | `/api/health`                          | API / DB / auth / agent status       |

### Testing authentication in Swagger UI

1. Open `/swagger`, run **POST /api/auth/register** (or **login**) and copy `token` from the response.
2. Click **Authorize**, paste the token, confirm. It's kept across page reloads.
3. The customer and agent endpoints now run as that user. Register a second user, authorize as them, and their `GET /api/customers` won't include the first user's customers; `GET/PUT/DELETE /api/customers/{id}` on those IDs returns `404`.
4. Admin: run **POST /api/admin/login** with `admin@admin.com` / `123456789`, **Authorize** with that token, then **GET /api/admin/users**. With a sales token it returns `403`.

With curl:

```bash
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"reda@example.com","password":"Passw0rd!"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s localhost:4000/api/customers -H "Authorization: Bearer $TOKEN"
```

### Agent

`POST /api/agent/chat` with `{ "message": "Get all customers", "history": [] }`.
Claude runs a tool-use loop over these tools, which call the same service layer as the REST routes:
`get_all_customers`, `get_customer_by_name`, `get_customer_by_id`, `add_customer`, `update_customer`, `delete_customer`.
The response includes `reply` (markdown), `toolCalls`, and `dataChanged` (the frontend uses this to refresh the table).

Tables (see `backend/db/migrations/001_auth.sql`):

- `app_user(id serial primary key, name, email unique, password_hash, role 'sales' | 'admin' default 'sales', created_at)` — returned as `user_id`; the hash is never returned.
- `customer(id serial primary key, name varchar(100) not null, email varchar(150) not null unique, phone varchar(20), city varchar(50), created_at default now(), sales_user_id references app_user)` — returned as `customer_id`.

Customers that existed before the migration have no `sales_user_id` and are visible to no one. To give them to a user: `UPDATE customer SET sales_user_id = <user id> WHERE sales_user_id IS NULL;`
