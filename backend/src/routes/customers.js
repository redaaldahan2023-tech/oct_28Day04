import { Router } from "express";
import * as customers from "../services/customerService.js";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       properties:
 *         customer_id: { type: integer, example: 1 }
 *         name: { type: string, example: Jane Doe }
 *         email: { type: string, nullable: true, example: jane@example.com }
 *         phone: { type: string, nullable: true, example: "9876543210" }
 *         created_at: { type: string, format: date-time }
 *     CustomerInput:
 *       type: object
 *       required: [name]
 *       properties:
 *         name: { type: string, example: Jane Doe }
 *         email: { type: string, example: jane@example.com }
 *         phone: { type: string, example: "9876543210" }
 *     CustomerUpdate:
 *       type: object
 *       properties:
 *         name: { type: string, example: Jane Smith }
 *         email: { type: string, example: jane.smith@example.com }
 *         phone: { type: string, example: "9876500000" }
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
 *     summary: List all customers
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Optional case-insensitive filter on name, email or phone
 *     responses:
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
    res.json(await customers.listCustomers(req.query.search));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/customers/search/by-name:
 *   get:
 *     tags: [Customers]
 *     summary: Find customers by name (partial, case-insensitive)
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     responses:
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
    res.json(await customers.findCustomersByName(req.query.name));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/customers/{id}:
 *   get:
 *     tags: [Customers]
 *     summary: Get a customer by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Customer' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get("/:id", async (req, res, next) => {
  try {
    const customer = await customers.getCustomerById(req.params.id);
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
 *     summary: Create a customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CustomerInput' }
 *     responses:
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
 */
router.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await customers.createCustomer(req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/customers/{id}:
 *   put:
 *     tags: [Customers]
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
 *       200:
 *         description: Updated customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Customer' }
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 */
router.put("/:id", async (req, res, next) => {
  try {
    const customer = await customers.updateCustomer(req.params.id, req.body ?? {});
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
 *     summary: Delete a customer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The deleted customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Customer' }
 *       404:
 *         description: Not found
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const customer = await customers.deleteCustomer(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

export default router;
