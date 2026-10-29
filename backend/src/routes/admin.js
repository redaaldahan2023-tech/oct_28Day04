import { Router } from "express";
import { authenticate, listSalesUsersWithCustomerCounts, getDashboardTotals } from "../services/userService.js";
import { issueSession, requireAuth, requireRole, requireAuthConfigured } from "../auth.js";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     UserSummary:
 *       type: object
 *       properties:
 *         user_id: { type: integer, example: 2 }
 *         name: { type: string, example: Reda Aldahan }
 *         email: { type: string, example: reda@example.com }
 *         created_at: { type: string, format: date-time }
 *         customer_count: { type: integer, example: 9 }
 *     AdminDashboard:
 *       type: object
 *       properties:
 *         totals:
 *           type: object
 *           properties:
 *             salesUsers: { type: integer, example: 2 }
 *             customers: { type: integer, example: 14 }
 *             unassignedCustomers: { type: integer, example: 2 }
 *         users:
 *           type: array
 *           description: Sales users only, most customers first
 *           items: { $ref: '#/components/schemas/UserSummary' }
 */

router.use(requireAuthConfigured);

/**
 * @openapi
 * /api/admin/login:
 *   post:
 *     tags: [Admin]
 *     summary: Log in as an admin and receive a token
 *     description: Only admin accounts can log in here; sales users use /api/auth/login.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *           example: { email: admin@admin.com, password: "123456789" }
 *     responses:
 *       200:
 *         description: Logged in
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    res.json(issueSession(await authenticate(email, password, "admin")));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Dashboard - all sales users with their customer counts
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Totals and sales users
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AdminDashboard' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get("/users", requireAuth, requireRole("admin"), async (_req, res, next) => {
  try {
    const [totals, users] = await Promise.all([getDashboardTotals(), listSalesUsersWithCustomerCounts()]);
    res.json({ totals, users });
  } catch (err) {
    next(err);
  }
});

export default router;
