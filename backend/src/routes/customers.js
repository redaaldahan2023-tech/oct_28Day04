import { Router } from "express";
import * as customers from "../services/customerService.js";
import { buildCustomersWorkbook } from "../services/exportService.js";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       properties:
 *         customer_id: { type: integer, example: 1 }
 *         name: { type: string, example: Khalid Saeed }
 *         email: { type: string, example: khalid.saeed@example.com }
 *         phone: { type: string, nullable: true, example: "0501234567" }
 *         city: { type: string, nullable: true, example: Riyadh }
 *         created_at: { type: string, format: date-time }
 *         sales_user_id: { type: integer, description: The salesperson who owns this customer, example: 1 }
 *     CustomerInput:
 *       type: object
 *       required: [name, email]
 *       properties:
 *         name: { type: string, maxLength: 100, example: Sara Ali }
 *         email: { type: string, maxLength: 150, description: Must be unique, example: sara.ali@example.com }
 *         phone: { type: string, maxLength: 20, example: "0509876543" }
 *         city: { type: string, maxLength: 50, example: Jeddah }
 *     CustomerUpdate:
 *       type: object
 *       properties:
 *         name: { type: string, maxLength: 100, example: Sara Ali }
 *         email: { type: string, maxLength: 150, example: sara.new@example.com }
 *         phone: { type: string, maxLength: 20, example: "0509876500" }
 *         city: { type: string, maxLength: 50, example: Dammam }
 *     Error:
 *       type: object
 *       properties:
 *         error: { type: string }
 */

/**
 * @openapi
 * /api/customers:
 *   get:
 *     tags: [Customers]
 *     security: [{ bearerAuth: [] }]
 *     summary: List the logged-in user's customers
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Optional case-insensitive filter on name, email, phone or city
 *     responses:
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       200:
 *         description: Array of customers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Customer' }
 */
router.get("/", async (req, res, next) => {
  try {
    res.json(await customers.listCustomers(req.user.id, req.query.search));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/customers/search/by-name:
 *   get:
 *     tags: [Customers]
 *     security: [{ bearerAuth: [] }]
 *     summary: Find the logged-in user's customers by name (partial, case-insensitive)
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       200:
 *         description: Matching customers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Customer' }
 *       400:
 *         description: Missing name
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get("/search/by-name", async (req, res, next) => {
  try {
    res.json(await customers.findCustomersByName(req.user.id, req.query.name));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/customers/export:
 *   get:
 *     tags: [Customers]
 *     summary: Export the logged-in user's customers to Excel (.xlsx)
 *     description: |
 *       Downloads a workbook with one "Customers" sheet (Customer ID, Name, Email, Phone, City, Created)
 *       containing only the logged-in user's customers. Uses the same filter as `GET /api/customers?search=`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Optional case-insensitive filter on name, email, phone or city
 *     responses:
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       200:
 *         description: The Excel file (attachment customers_YYYY-MM-DD.xlsx)
 *         headers:
 *           X-Export-Count:
 *             description: Number of customers in the file
 *             schema: { type: integer }
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 */
// Must stay above "/:id", or "export" would be parsed as a customer id.
router.get("/export", async (req, res, next) => {
  try {
    // The same scoped query as the list: only the logged-in user's customers.
    const rows = await customers.listCustomers(req.user.id, req.query.search);
    const file = await buildCustomersWorkbook(rows, { author: req.user.name });
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="customers_${date}.xlsx"`,
      // Personal data: don't let browsers or proxies keep a copy.
      "Cache-Control": "no-store",
      "X-Export-Count": String(rows.length),
    });
    res.send(file);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/customers/{id}:
 *   get:
 *     tags: [Customers]
 *     security: [{ bearerAuth: [] }]
 *     summary: Get a customer by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       200:
 *         description: The customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Customer' }
 *       404:
 *         description: Not found, or owned by another user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get("/:id", async (req, res, next) => {
  try {
    const customer = await customers.getCustomerById(req.user.id, req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/customers:
 *   post:
 *     tags: [Customers]
 *     security: [{ bearerAuth: [] }]
 *     summary: Create a customer owned by the logged-in user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CustomerInput' }
 *     responses:
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       201:
 *         description: Created customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Customer' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await customers.createCustomer(req.user.id, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/customers/{id}:
 *   put:
 *     tags: [Customers]
 *     security: [{ bearerAuth: [] }]
 *     summary: Update a customer (only the provided fields change)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CustomerUpdate' }
 *     responses:
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       200:
 *         description: Updated customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Customer' }
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found, or owned by another user
 *       409:
 *         description: Email already in use
 */
router.put("/:id", async (req, res, next) => {
  try {
    const customer = await customers.updateCustomer(req.user.id, req.params.id, req.body ?? {});
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/customers/{id}:
 *   delete:
 *     tags: [Customers]
 *     security: [{ bearerAuth: [] }]
 *     summary: Delete a customer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       200:
 *         description: The deleted customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Customer' }
 *       404:
 *         description: Not found, or owned by another user
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const customer = await customers.deleteCustomer(req.user.id, req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

export default router;
