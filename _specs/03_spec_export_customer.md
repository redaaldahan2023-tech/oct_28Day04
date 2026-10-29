# Spec 03 — Export Customers to Excel

| | |
| --- | --- |
| **Status** | Approved 2026-10-29 — open questions resolved with the proposed defaults |
| **Date** | 2026-10-29 |
| **Builds on** | [Spec 01](01_spec_userlogin_registration.md) (per-user customer access), [Spec 02](02_spec_admin_login.md) (roles) |
| **Affects** | `backend/` (new export endpoint, Swagger), `frontend/` (Customers page) |

## 1. Background

Sales users can view and manage their customers in the app, but they can't take the list elsewhere, for example to share it, report on it or work on it offline. This feature adds a one-click export of the logged-in user's customers to an Excel (`.xlsx`) file.

## 2. Goals

1. A logged-in sales user can download their customers as an `.xlsx` file.
2. The file contains **only** customers assigned to the logged-in user. Other users' customers and unassigned customers are never included.
3. The export is available from the Customers page and through the API, so it can be tested in Swagger UI.
4. The file opens cleanly in Excel, LibreOffice and Google Sheets, with readable headers, sensible column widths and correct data types.

## 3. Out of scope

- Admin exports, such as all customers or one export per salesperson. Admins keep getting 403 on customer endpoints.
- Importing customers from Excel.
- Other formats (CSV, PDF), scheduled or emailed exports, and choosing which columns to include.
- Exporting through the AI assistant.

## 4. Access control

- The export reuses the Spec 01/02 rules: `requireAuth` plus `requireRole("sales")`, with the same 401/403 behaviour as the other `/api/customers` endpoints.
- The rows come from `customerService.listCustomers(req.user.id, search)`, the same scoped query as the customer list. The export adds no new SQL, so it can't bypass the `sales_user_id` filter.
- The owner always comes from the token's user. There is no parameter for exporting another user's customers.

## 5. API

### 5.1 New endpoint

| Method | Path | Auth | Query | Success |
| --- | --- | --- | --- | --- |
| GET | `/api/customers/export` | sales | `search` (optional) | `200` with the `.xlsx` file |

- **`search`:** the same case-insensitive filter as `GET /api/customers?search=` (name, email, phone, city). When it's left out, the export contains all of the user's customers.
- **Response headers:**
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="customers_YYYY-MM-DD.xlsx"`, using the server date in UTC
  - `Cache-Control: no-store`, because the file contains personal data
- **Errors:** 401 with no or an invalid token, 403 for admins, 400 for an invalid `search`, 500 if the file can't be generated. Errors are JSON, as elsewhere.
- **Route order:** `/export` must be registered before `/:id`, otherwise `export` is treated as a customer id.

### 5.2 Workbook contents

One worksheet named **Customers**.

| Column | Source | Excel type / format |
| --- | --- | --- |
| Customer ID | `customer_id` | Number |
| Name | `name` | Text |
| Email | `email` | Text |
| Phone | `phone` | **Text**, so leading zeros and `+` are kept |
| City | `city` | Text |
| Created | `created_at` | Date, formatted `yyyy-mm-dd hh:mm` |

- **Header row:** bold, frozen, with an auto-filter on all columns.
- **Columns:** widths fit the content, within sensible bounds.
- **Order:** rows are sorted by Customer ID, the same as the list.
- **Empty values:** shown as empty cells, not `null`.
- **No customers:** the workbook still downloads, with the header row only.
- **Metadata:** the workbook's author is set to the logged-in user's name, and its created date to the export time.
- **Formula injection:** every value is written as a plain value, never as a formula. A customer name such as `=HYPERLINK(...)` appears as text and is never evaluated.

### 5.3 Size

The export is built in memory, which is fine for the expected volume, up to a few thousand customers per user. Very large exports are out of scope (see Q3).

## 6. Swagger / OpenAPI

- Document `GET /api/customers/export` under the Customers tag with `bearerAuth`, the `search` parameter, and a `200` response with the xlsx media type (`type: string, format: binary`), plus 401 and 403.
- **Testing in Swagger UI:** authorize with a sales token, run the export, and Swagger shows a **Download file** link. With an admin token it returns 403.

## 7. Frontend

- **Export button:** an **Export to Excel** button in the Customers page header, next to **Add customer**.
- **How it downloads:** the request needs the bearer token, so a plain link won't work. `api.js` gets an `exportCustomers(search)` function that fetches the file with the `Authorization` header, reads it as a Blob and starts a download using the filename from `Content-Disposition`.
- **Search box:** the export uses the page's current search text, so you download what you see. The button's tooltip says when a filter is active.
- **Feedback:** the button shows "Exporting…" and is disabled while the request runs. Success and error messages use the existing toasts. A 401 logs the user out, as everywhere else.
- **Empty list:** when the user has no customers, the button is disabled and shows a hint.

## 8. Dependencies

- `exceljs` in `backend/`. It's pure JavaScript, needs no native build (so it works on Vercel), and supports column types, frozen panes and auto-filters.
- No new frontend dependencies.

## 9. Acceptance criteria

1. As sales user A with customers, `GET /api/customers/export` returns 200 with the xlsx content type and a `customers_YYYY-MM-DD.xlsx` attachment.
2. The downloaded workbook has one sheet, **Customers**, with the six columns from §5.2 in order, and exactly A's customers sorted by ID.
3. User B's customers and unassigned customers never appear in A's export, even when they match the search text.
4. `?search=riyadh` exports the same customers that `GET /api/customers?search=riyadh` returns.
5. A user with no customers gets a valid workbook containing the header row only.
6. No token returns 401, and an admin token returns 403.
7. A phone number such as `0501234567` keeps its leading zero, Created is a real date cell, and a name such as `=1+1` is stored as text, not as a formula.
8. In Swagger UI, the export can be run after **Authorize** and the file downloaded.
9. In the frontend, **Export to Excel** downloads the file, respects the current search, shows progress and success/error toasts, and is disabled when the user has no customers.
10. The file opens without warnings in Excel, LibreOffice and Google Sheets.

## 10. Open questions

| # | Question | Proposed default |
| --- | --- | --- |
| Q1 | Should the export follow the search box, or always contain all of the user's customers? | Follow the search box. With an empty search, everything is exported. |
| Q2 | Add a title row (salesperson name, export date) above the table? | No, keep row 1 as headers so filtering and re-use stay simple. The name goes in the workbook metadata instead. |
| Q3 | Upper limit on rows? | None for now. Revisit if a user has more than ~10,000 customers (that would need streaming). |
| Q4 | Should the filename include the user's name? | No, `customers_YYYY-MM-DD.xlsx`, so names never end up in file paths or URLs. |
