import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";
import { pool } from "./db.js";
import customerRoutes from "./routes/customers.js";
import agentRoutes from "./routes/agent.js";

const app = express();
const PORT = process.env.PORT || 4000;

// CORS: allow the configured frontend origin(s); "*" allows any origin.
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((o) => o.trim());
app.use(cors({ origin: origins.includes("*") ? "*" : origins }));
app.use(express.json());

app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "Customer API" }));
app.get("/swagger.json", (_req, res) => res.json(swaggerSpec));

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
    await pool.query("SELECT 1");
  } catch {
    database = "unreachable";
  }
  res.json({ status: "ok", database, agentConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.use("/api/customers", customerRoutes);
app.use("/api/agent", agentRoutes);

app.get("/", (_req, res) => res.redirect("/swagger"));

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.status ? "Internal server error" : err.message });
});

app.listen(PORT, (err) => {
  if (err) {
    console.error(`Failed to start on port ${PORT}: ${err.message}`);
    process.exit(1);
  }
  console.log(`API running on http://localhost:${PORT}`);
  console.log(`Swagger UI:   http://localhost:${PORT}/swagger`);
});
