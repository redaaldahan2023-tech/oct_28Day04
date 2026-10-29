import ExcelJS from "exceljs";

// Builds the customer export workbook (Spec 03). The caller passes rows that are already
// scoped to the logged-in user (customerService.listCustomers), so this file never queries.

const COLUMNS = [
  { header: "Customer ID", key: "customer_id" },
  { header: "Name", key: "name" },
  { header: "Email", key: "email" },
  { header: "Phone", key: "phone" },
  { header: "City", key: "city" },
  { header: "Created", key: "created_at", style: { numFmt: "yyyy-mm-dd hh:mm" } },
];
const MIN_WIDTH = 10;
const MAX_WIDTH = 50;

// Plain values only, never { formula }: a string like "=1+1" is stored as text, so a customer
// name can't run as a formula when the file is opened.
function toRow(c) {
  return {
    customer_id: c.customer_id,
    name: c.name ?? null,
    email: c.email ?? null,
    // Kept as text so leading zeros and "+" survive.
    phone: c.phone == null ? null : String(c.phone),
    city: c.city ?? null,
    created_at: c.created_at ? new Date(c.created_at) : null,
  };
}

export async function buildCustomersWorkbook(customers, { author } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = author || "Customer Hub";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Customers", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: "A1", to: { row: 1, column: COLUMNS.length } };

  const rows = customers.map(toRow);
  sheet.addRows(rows);
  // Width from the longest value; "Created" dates display as "yyyy-mm-dd hh:mm" (16 characters).
  sheet.columns.forEach((col, i) => {
    const { key, header } = COLUMNS[i];
    const longest = rows.reduce(
      (max, r) => Math.max(max, key === "created_at" ? 16 : String(r[key] ?? "").length),
      header.length,
    );
    col.width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2));
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
