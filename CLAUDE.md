# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Customer Hub: two independent npm projects in one repo, each deployed as its own Vercel project (Root Directory `backend` / `frontend`).

- `backend/` — Node ≥20, ESM, Express 5, PostgreSQL via `pg`, Swagger (swagger-jsdoc), Anthropic SDK. Port 4000.
- `frontend/` — React 19 + Vite. Port 5173 (`strictPort`, so it always matches the backend's `CORS_ORIGIN`).

## Workflow: spec-driven development

1. **Spec** — write the spec for a feature or change in `_specs/` and get the user's approval.
2. **Plan** — once the spec is approved, write the implementation plan in `_plans/`.
3. **Implement** — before writing any code, make sure the current branch has no uncommitted changes (`git status`); commit pending work first.

Don't skip ahead: no plan without an approved spec, and no implementation without a plan.

## Commands

```bash
# Backend
cd backend && npm install
npm run migrate    # applies db/migrations/*.sql in order (idempotent)
npm run dev        # nodemon src/server.js
npm start          # node src/server.js

# Frontend
cd frontend && npm install
npm run dev        # Vite dev server
npm run build      # production build
npm run preview
```

There are no tests, linter or formatter configured in either project.

Useful checks once the backend is running: `GET /api/health` (reports DB reachability and whether `ANTHROPIC_API_KEY` is set) and Swagger UI at `/swagger` (spec at `/swagger.json`).

## Configuration

Backend `.env` (see `backend/.env.example`): `PORT`, `DATABASE_URL` (Render or local PostgreSQL; SSL is off for localhost URLs unless `DATABASE_SSL` overrides it), `JWT_SECRET` (required for auth), `JWT_EXPIRES_IN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-opus-5-5`), `AGENT_EFFORT` (default `medium`; the server-side refusal fallback is skipped for Haiku models, which don't support it), `CORS_ORIGIN` (comma-separated origins or `*`).
Frontend `.env`: `VITE_API_URL` (read at build time; changing it on Vercel requires a redeploy).

## Architecture

**Auth and per-user scoping.** JWT bearer auth (`src/auth.js`, `src/routes/auth.js`, `src/services/userService.js`). `app.js` mounts `requireAuth` in front of `/api/customers` and `/api/agent`, which sets `req.user`. Every `customerService` function takes the owner's user id as its **first** argument and scopes its SQL with `sales_user_id = $n`. Another user's customer is indistinguishable from a missing one (404). Never add an unscoped query or accept `sales_user_id` from input. Schema changes go in a new numbered file in `backend/db/migrations/`.

**One service layer, two front doors.** `backend/src/services/customerService.js` holds all SQL, validation and error mapping. Both the REST routes (`src/routes/customers.js`) and the Claude agent tools (`src/agent/tools.js`) call it, so behavior changes to customers belong there, not in routes or tools.

- Validation errors are thrown as `ValidationError` with a `status` (400, or 409 for the unique-email violation `23505`); the global error handler in `src/app.js` returns `err.message` for any error carrying a `status` and hides details for plain 500s.
- The DB table is `customer` with primary key `id`, but the API always exposes it as `customer_id` (`COLUMNS` alias in the service). Field length limits (`MAX_LENGTH`) mirror the DB column sizes.
- `src/db.js` exports `query()`, which retries once on dropped connections and uses a short idle timeout — needed because Vercel freezes functions while Render closes idle connections. Use `query()` rather than `pool.query()`.

**App vs. entry points.** `src/app.js` builds the Express app without listening. `src/server.js` listens locally; `api/index.js` exports the app as a Vercel serverless function, and `vercel.json` rewrites every path to it (60 s `maxDuration`, `includeFiles: src/**`).

**Swagger.** The spec is generated from `@openapi` JSDoc comments in `src/routes/*.js` and `src/app.js` — update those comments when changing endpoints. Swagger UI assets come from the jsDelivr CDN and the spec uses a relative server URL (`/`) so it works on both localhost and Vercel.

**Agent (`POST /api/agent/chat`).** `src/agent/agent.js` runs a manual tool-use loop (max 10 iterations) with `anthropic.beta.messages.create`. History from the client is text-only `{role, content}` turns; tool calls are not replayed across turns. Tool definitions plus a `handlers` map live in `src/agent/tools.js`; `executeTool` passes the logged-in user's id to each handler, and tool schemas must never expose an owner/user field; adding a tool means adding both, and adding it to `MUTATING_TOOLS` if it writes data. The response is `{ reply, toolCalls, dataChanged }`, where `dataChanged` is true when a mutating tool succeeded. `src/routes/agent.js` maps Anthropic SDK errors to 503/429/502.

**Frontend.** `src/api.js` is the single fetch wrapper (base URL from `VITE_API_URL`, surfaces the backend's `error` field). It also holds the token (`localStorage`), adds the `Authorization` header, and calls the handler `App.jsx` registers when an authenticated request gets a 401. `App.jsx` restores the session via `/api/auth/me`, shows `AuthPage` when logged out, keys `<main>` by user id so pages reset on a new login, and keeps both `CustomersPage` and `ChatPage` mounted so chat history survives tab switches; `ChatPage` calls `onDataChanged()` when the agent reports `dataChanged`, which refreshes the customer table.
