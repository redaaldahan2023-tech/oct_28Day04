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

## API

| Method | Path                                   | Description                          |
| ------ | -------------------------------------- | ------------------------------------ |
| GET    | `/api/customers?search=`               | List customers (optional filter)     |
| GET    | `/api/customers/search/by-name?name=`  | Find customers by partial name       |
| GET    | `/api/customers/{id}`                  | Get one customer                     |
| POST   | `/api/customers`                       | Create (`name` required)             |
| PUT    | `/api/customers/{id}`                  | Update provided fields               |
| DELETE | `/api/customers/{id}`                  | Delete                               |
| POST   | `/api/agent/chat`                      | Natural-language assistant           |
| GET    | `/api/health`                          | API / DB / agent status              |

### Agent

`POST /api/agent/chat` with `{ "message": "Get all customers", "history": [] }`.
Claude runs a tool-use loop over these tools, which call the same service layer as the REST routes:
`get_all_customers`, `get_customer_by_name`, `get_customer_by_id`, `add_customer`, `update_customer`, `delete_customer`.
The response includes `reply` (markdown), `toolCalls`, and `dataChanged` (the frontend uses this to refresh the table).

Table: `customer(customer_id serial, name varchar not null, email, phone, created_at default now())`.
