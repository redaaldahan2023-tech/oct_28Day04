import { Router } from "express";
import { registerUser, authenticate } from "../services/userService.js";
import { signToken, requireAuth, authConfigured } from "../auth.js";

const router = Router();

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: "Paste the `token` returned by /api/auth/register or /api/auth/login."
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         user_id: { type: integer, example: 1 }
 *         name: { type: string, example: Reda Aldahan }
 *         email: { type: string, example: reda@example.com }
 *         role: { type: string, enum: [sales], example: sales }
 *         created_at: { type: string, format: date-time }
 *     RegisterInput:
 *       type: object
 *       required: [name, email, password]
 *       properties:
 *         name: { type: string, maxLength: 100, example: Reda Aldahan }
 *         email: { type: string, maxLength: 150, example: reda@example.com }
 *         password: { type: string, minLength: 8, example: Passw0rd! }
 *     LoginInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email: { type: string, example: reda@example.com }
 *         password: { type: string, example: Passw0rd! }
 *     AuthResponse:
 *       type: object
 *       properties:
 *         user: { $ref: '#/components/schemas/User' }
 *         token:
 *           type: string
 *           description: "JWT to send as `Authorization: Bearer <token>`"
 *   responses:
 *     Unauthorized:
 *       description: Missing, invalid or expired token
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Error' }
 */

// Fail early with 503 instead of creating an account we can't issue a token for.
router.use((_req, _res, next) => {
  if (authConfigured()) return next();
  const err = new Error("JWT_SECRET is not set in backend/.env");
  err.status = 503;
  next(err);
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user (role is always "sales")
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterInput' }
 *     responses:
 *       201:
 *         description: Account created; the token can be used right away
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/register", async (req, res, next) => {
  try {
    const user = await registerUser(req.body ?? {});
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive a token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginInput' }
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
    const user = await authenticate(email, password);
    res.json({ user, token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the logged-in user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get("/me", requireAuth, (req, res) => {
  const { id, ...rest } = req.user;
  res.json({ user: { user_id: id, ...rest } });
});

export default router;
