import Anthropic from "@anthropic-ai/sdk";
import { tools, executeTool, MUTATING_TOOLS } from "./tools.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MAX_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are a helpful assistant for a customer management application.
You answer questions about customer data and perform actions using the provided tools, which read
from and write to the live PostgreSQL "customer" table (columns: customer_id, name, email, phone, created_at).

- Always use the tools to get data; never invent customers or field values.
- When several customers match a name, list them and ask which one is meant before updating or deleting.
- Present lists of customers as a markdown table. Keep answers concise.
- If a tool returns an error, explain it plainly to the user.`;

let client;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error("ANTHROPIC_API_KEY is not set in backend/.env");
    err.status = 503;
    throw err;
  }
  client ??= new Anthropic();
  return client;
}

/**
 * Run one chat turn through a manual tool-use loop.
 * @param {string} message  The new user message.
 * @param {{role: "user"|"assistant", content: string}[]} history  Prior text-only turns.
 */
export async function runAgent(message, history = []) {
  const anthropic = getClient();

  const messages = [
    ...history
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const toolCalls = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools,
      messages,
      output_config: { effort: "medium" },
      // Server-side refusal fallback: if the model declines, the API reroutes automatically.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue;

    if (response.stop_reason === "refusal") {
      return { reply: "Sorry, I can't help with that request.", toolCalls };
    }

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const reply = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        reply: reply || "(no response)",
        toolCalls,
        dataChanged: toolCalls.some((t) => MUTATING_TOOLS.has(t.name) && !t.error),
      };
    }

    // Execute all requested tools and return every result in a single user message.
    const results = await Promise.all(
      toolUses.map(async (tu) => {
        try {
          const output = await executeTool(tu.name, tu.input);
          toolCalls.push({ name: tu.name, input: tu.input });
          return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(output) };
        } catch (err) {
          toolCalls.push({ name: tu.name, input: tu.input, error: err.message });
          return { type: "tool_result", tool_use_id: tu.id, content: err.message, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }

  return {
    reply: "I couldn't finish that request within the step limit. Please try rephrasing.",
    toolCalls,
    dataChanged: toolCalls.some((t) => MUTATING_TOOLS.has(t.name) && !t.error),
  };
}
