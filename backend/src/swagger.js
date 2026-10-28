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
    // Relative URL so "Try it out" calls whichever host serves the docs (localhost or Vercel).
    servers: [{ url: "/" }],
    tags: [
      { name: "Customers", description: "Customer CRUD" },
      { name: "Agent", description: "Natural-language assistant" },
      { name: "System", description: "Health checks" },
    ],
  },
  apis: [`${here}/routes/*.js`, `${here}/app.js`],
});

const SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";

export const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Customer API – Swagger UI</title>
    <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" />
    <style>body { margin: 0; } .topbar { display: none; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI}/swagger-ui-bundle.js" crossorigin></script>
    <script src="${SWAGGER_UI}/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/swagger.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
      });
    </script>
  </body>
</html>`;
