import * as customers from "../services/customerService.js";

// Tool definitions exposed to Claude. Each one maps to a customerService call.
// No tool takes an owner or user field: the server passes the logged-in user to every
// handler, so the model can only ever reach that user's customers.
export const tools = [
  {
    name: "get_all_customers",
    description:
      "Return every customer in the database (customer_id, name, email, phone, city, created_at). " +
      "Use for questions about all customers, counts, cities, or listing.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_customer_by_name",
    description:
      "Find customers whose name contains the given text (case-insensitive, partial match). " +
      "May return zero, one or several customers.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Full or partial customer name" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_customer_by_id",
    description: "Fetch a single customer by its numeric customer_id.",
    input_schema: {
      type: "object",
      properties: { customer_id: { type: "integer" } },
      required: ["customer_id"],
      additionalProperties: false,
    },
  },
  {
    name: "add_customer",
    description:
      "Create a new customer. name and email are required (email must be unique); phone and city are optional. " +
      "If the user did not give an email, ask for one instead of inventing it.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        city: { type: "string" },
      },
      required: ["name", "email"],
      additionalProperties: false,
    },
  },
  {
    name: "update_customer",
    description:
      "Update an existing customer's name, email, phone and/or city by customer_id. " +
      "Only the fields provided are changed. Look the customer up first if you only know the name.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "integer" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        city: { type: "string" },
      },
      required: ["customer_id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_customer",
    description:
      "Permanently delete a customer by customer_id. Only call this when the user has explicitly " +
      "asked to delete a specific customer and it is unambiguous which one.",
    input_schema: {
      type: "object",
      properties: { customer_id: { type: "integer" } },
      required: ["customer_id"],
      additionalProperties: false,
    },
  },
];

const handlers = {
  get_all_customers: (userId) => customers.listCustomers(userId),
  get_customer_by_name: (userId, { name }) => customers.findCustomersByName(userId, name),
  get_customer_by_id: async (userId, { customer_id }) =>
    (await customers.getCustomerById(userId, customer_id)) ?? { error: "Customer not found" },
  add_customer: (userId, { name, email, phone, city }) =>
    customers.createCustomer(userId, { name, email, phone, city }),
  update_customer: async (userId, { customer_id, name, email, phone, city }) =>
    (await customers.updateCustomer(userId, customer_id, { name, email, phone, city })) ?? {
      error: "Customer not found",
    },
  delete_customer: async (userId, { customer_id }) =>
    (await customers.deleteCustomer(userId, customer_id)) ?? { error: "Customer not found" },
};

export const MUTATING_TOOLS = new Set(["add_customer", "update_customer", "delete_customer"]);

export async function executeTool(name, input, user) {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(user.id, input ?? {});
}
