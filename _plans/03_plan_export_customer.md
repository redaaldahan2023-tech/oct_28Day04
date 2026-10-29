# Plan 03 — Export Customers to Excel

Implements [Spec 03](../_specs/03_spec_export_customer.md) (approved 2026-10-29). Open questions resolved with the spec's defaults:

- The export follows the search box.
- No title row.
- No row limit.
- The filename is `customers_YYYY-MM-DD.xlsx`.

## 0. Preparation

- Make sure the current branch (`feature/admin-dashboard`) has no uncommitted changes. Commit Spec 03 and this plan, then create `feature/export-customers` from it.
- `backend`: `npm install exceljs`.

## 1. Workbook builder

| File | Change |
| --- | --- |
| `backend/src/services/exportService.js` | New. `buildCustomersWorkbook(customers, { author })` returns a `Buffer` (`workbook.xlsx.writeBuffer()`). |

What it builds:

- One sheet, `Customers`, with the columns in the spec's order.
- `id` is a number. `name`, `email`, `phone` and `city` are **strings**. `created_at` is a JS `Date` with `numFmt: "yyyy-mm-dd hh:mm"`.
- Formula injection: cells are written as plain values, never `{ formula }`. ExcelJS stores a JS string as a shared-string or inline-string cell, so a value like `=1+1` is stored as text.
- Header row: bold, `views: [{ state: "frozen", ySplit: 1 }]`, and `autoFilter` over `A1:F1`.
- Column widths: the maximum of the header and content lengths, clamped between 10 and 50.
- `null` values become empty cells.
- `workbook.creator` and `workbook.created` set from the logged-in user and the export time.

Keeping this out of the route makes the column and type logic testable without HTTP.

## 2. Route

| File | Change |
| --- | --- |
| `backend/src/routes/customers.js` | Add `GET /export` **before** `GET /:id`. It calls `customers.listCustomers(req.user.id, req.query.search)` (the existing scoped query, no new SQL), then `buildCustomersWorkbook(rows, { author: req.user.name })`. It sets `Content-Type` (xlsx), `Content-Disposition: attachment; filename="customers_<UTC date>.xlsx"` and `Cache-Control: no-store`, then sends the buffer. Errors go to `next(err)` as JSON. |
| | `@openapi` docs: Customers tag, `bearerAuth`, `search` parameter, a 200 response with the xlsx media type `{ type: string, format: binary }`, plus 401/403. |
| `backend/src/app.js` | No change. `/api/customers` is already behind `requireAuth, requireRole("sales")`. |
| `backend/src/app.js` (CORS) | Add `exposedHeaders: ["Content-Disposition"]` to the `cors()` options, so the frontend can read the filename across origins. |

## 3. Frontend

| File | Change |
| --- | --- |
| `frontend/src/api.js` | Pull the header and 401 handling out of `request()` into a small `send()` helper, so the JSON and file paths share it. Add `exportCustomers(search)`: GET `/api/customers/export?search=…` with the bearer header. On success, read `res.blob()` and parse the filename from `Content-Disposition` (falling back to `customers.xlsx`). Then trigger the download with an object URL and a temporary `<a download>`, and revoke the URL afterwards. On failure, read the JSON `error` like other calls. |
| `frontend/src/components/CustomersPage.jsx` | Add an **Export to Excel** button (ghost style) in the header before **Add customer**. It shows "Exporting…" and is disabled while running. It's disabled when the user has no customers, with a "No customers to export" tooltip; when a search is active, the tooltip reads "Exports customers matching "…"". Toasts: "Exported N customers" or the error. N is the number of customers shown after filtering. |
| `frontend/src/components/Icons.jsx` | Add a `DownloadIcon` in the same style as the existing icons. |

The page's search box also matches the customer ID on the client side, but the server-side search doesn't (spec §5.1). When a search is active, the toast count therefore uses the server's row count, taken from a custom `X-Export-Count` header. That header is also exposed through CORS.

## 4. Docs

- **README:** the export endpoint in the API table, and a Swagger step.
- **CLAUDE.md:** a one-line note that exports must go through `listCustomers(userId, …)`, and that `/export` must stay above `/:id`.

## 5. Verification

1. `node --check`, the Swagger spec parses, and `npm run build` succeeds for the frontend.
2. Scripted API checks against the local database for spec §9 criteria 1–7. Two temporary sales users with customers, including an unassigned one and edge values:
   - a phone with a leading zero,
   - a name `=1+1`,
   - `null` city.

   Download the file and parse it back with ExcelJS to check the sheet name, headers, row set, cell types, text-not-formula, frozen header and auto-filter. Check the 401 and 403 responses, and the header-only workbook for an empty user. Remove the test data afterwards.
3. Check the `Content-Disposition` and `X-Export-Count` headers from the frontend origin (CORS).
4. Restart the dev backend on port 4001, then do the manual Swagger check (criterion 8) and the frontend check (criterion 9). Criterion 10 (opening the file in Excel, LibreOffice and Google Sheets) is checked by the user.

Nothing is run against the shared Render database.
