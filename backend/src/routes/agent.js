import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { runAgent } from "../agent/agent.js";

const router = Router();

/**
 * @openapi
 * /api/agent/chat:
 *   post:
 *     tags: [Agent]
 *     summary: Ask a natural-language question about customers
 *     description: |
 *       Claude answers using tools that read and modify the customer table.
 *       Examples: "Get all customers", "Find the customer named Kannan",
 *       "Add a customer named Sara Ali with email sara@example.com".
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: Get all customers
 *               history:
 *                 type: array
 *                 description: Optional earlier turns of the conversation
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, assistant] }
 *                     content: { type: string }
 *     responses:
 *       200:
 *         description: The assistant's reply
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply: { type: string }
 *                 toolCalls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       input: { type: object }
 *                       error: { type: string }
 *                 dataChanged: { type: boolean }
 *       400:
 *         description: Missing message
 *       503:
 *         description: Anthropic API key not configured
 */
router.post("/chat", async (req, res, next) => {
  const { message, history } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  try {
    res.json(await runAgent(message.trim(), Array.isArray(history) ? history : []));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(503).json({ error: "Invalid Anthropic API key" });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Anthropic rate limit reached, try again shortly" });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `Anthropic API error: ${err.message}` });
    }
    next(err);
  }
});

export default router;
