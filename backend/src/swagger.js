import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerJsdoc from "swagger-jsdoc";

// swagger-jsdoc globs need forward slashes, even on Windows.
const here = path.dirname(fileURLToPath(import.meta.url)).replace(/\\/g, "/");

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Customer API",
      version: "1.0.0",
      description:
        "CRUD operations on the PostgreSQL `customer` table, plus a Claude-powered agent " +
        "endpoint that answers natural-language questions about customers. No authentication required.",
    },
    servers: [{ url: `http://localhost:${process.env.PORT || 4000}` }],
    tags: [
      { name: "Customers", description: "Customer CRUD" },
      { name: "Agent", description: "Natural-language assistant" },
      { name: "System", description: "Health checks" },
    ],
  },
  apis: [`${here}/routes/*.js`, `${here}/server.js`],
});
