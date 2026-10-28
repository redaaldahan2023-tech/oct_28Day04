import app from "./app.js";

// Local development entry point. On Vercel, api/index.js is used instead.
const PORT = process.env.PORT || 4000;

app.listen(PORT, (err) => {
  if (err) {
    console.error(`Failed to start on port ${PORT}: ${err.message}`);
    process.exit(1);
  }
  console.log(`API running on http://localhost:${PORT}`);
  console.log(`Swagger UI:   http://localhost:${PORT}/swagger`);
});
