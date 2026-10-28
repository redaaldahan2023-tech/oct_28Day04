# Customer Hub — Lab 05

Two projects that run on separate ports:

| Project     | Stack                                                    | URL                             |
| ----------- | -------------------------------------------------------- | ------------------------------- |
| `backend/`  | Node.js, Express 5, PostgreSQL (`pg`), Swagger, Anthropic SDK | http://localhost:4000           |
| `frontend/` | React 19 + Vite                                          | http://localhost:5173           |

Swagger UI: **http://localhost:4000/swagger** (raw spec at `/swagger.json`). No authentication.

## Setup

```bash
# 1. Backend
cd backend
npm install
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
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
| `DATABASE_URL`      | PostgreSQL connection string (Render, SSL enabled)         |
| `ANTHROPIC_API_KEY` | Required for the `/api/agent/chat` endpoint                |
| `ANTHROPIC_MODEL`   | Defaults to `claude-opus-5-5`                              |
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

| Method | Path                                   | Description                          |
| ------ | -------------------------------------- | ------------------------------------ |
| GET    | `/api/customers?search=`               | List customers (optional filter)     |
| GET    | `/api/customers/search/by-name?name=`  | Find customers by partial name       |
| GET    | `/api/customers/{id}`                  | Get one customer                     |
| POST   | `/api/customers`                       | Create (`name` and unique `email` required) |
| PUT    | `/api/customers/{id}`                  | Update provided fields               |
| DELETE | `/api/customers/{id}`                  | Delete                               |
| POST   | `/api/agent/chat`                      | Natural-language assistant           |
| GET    | `/api/health`                          | API / DB / agent status              |

### Agent

`POST /api/agent/chat` with `{ "message": "Get all customers", "history": [] }`.
Claude runs a tool-use loop over these tools, which call the same service layer as the REST routes:
`get_all_customers`, `get_customer_by_name`, `get_customer_by_id`, `add_customer`, `update_customer`, `delete_customer`.
The response includes `reply` (markdown), `toolCalls`, and `dataChanged` (the frontend uses this to refresh the table).

Table: `customer(id serial primary key, name varchar(100) not null, email varchar(150) not null unique, phone varchar(20), city varchar(50), created_at default now())`.
The API returns the primary key as `customer_id`.
