import "dotenv/config";
import express from "express";
import cors from "cors";
import { swaggerSpec, swaggerHtml } from "./swagger.js";
import { query } from "./db.js";
import { requireAuth, requireRole, authConfigured } from "./auth.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import customerRoutes from "./routes/customers.js";
import agentRoutes from "./routes/agent.js";

// The Express app, without app.listen(): src/server.js runs it locally and
// api/index.js exports it as a Vercel serverless function.
const app = express();

// CORS: allow the configured frontend origin(s); "*" allows any origin.
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((o) => o.trim().replace(/\/$/, ""));
app.use(cors({ origin: origins.includes("*") ? "*" : origins }));
app.use(express.json());

// Swagger UI loads its assets from a CDN, so nothing has to be served from node_modules.
app.get("/swagger.json", (_req, res) => res.json(swaggerSpec));
app.get(["/swagger", "/swagger/"], (_req, res) => res.type("html").send(swaggerHtml));

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [System]
 *     summary: Check API, database and agent configuration status
 *     responses:
 *       200:
 *         description: Status report
 */
app.get("/api/health", async (_req, res) => {
  let database = "ok";
  try {
    await query("SELECT 1");
  } catch {
    database = "unreachable";
  }
  res.json({
    status: "ok",
    database,
    authConfigured: authConfigured(),
    agentConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
});

app.use("/api/auth", authRoutes);
// Admin login is public; the admin router guards its other routes itself.
app.use("/api/admin", adminRoutes);
// Sales users only; req.user scopes every query. Admins own no customers and get 403.
app.use("/api/customers", requireAuth, requireRole("sales"), customerRoutes);
app.use("/api/agent", requireAuth, requireRole("sales"), agentRoutes);

app.get("/", (_req, res) => res.redirect("/swagger"));

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.status ? "Internal server error" : err.message });
});

export default app;
