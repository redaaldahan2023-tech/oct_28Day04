import * as customers from "../services/customerService.js";

// Tool definitions exposed to Claude. Each one maps to a customerService call.
export const tools = [
  {
    name: "get_all_customers",
    description:
      "Return every customer in the database (id, name, email, phone, created_at). " +
      "Use for questions about all customers, counts, or listing.",
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
    description: "Create a new customer. name is required; email and phone are optional.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_customer",
    description:
      "Update an existing customer's name, email and/or phone by customer_id. " +
      "Only the fields provided are changed. Look the customer up first if you only know the name.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "integer" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
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
  get_all_customers: () => customers.listCustomers(),
  get_customer_by_name: ({ name }) => customers.findCustomersByName(name),
  get_customer_by_id: async ({ customer_id }) =>
    (await customers.getCustomerById(customer_id)) ?? { error: "Customer not found" },
  add_customer: (input) => customers.createCustomer(input),
  update_customer: async ({ customer_id, ...fields }) =>
    (await customers.updateCustomer(customer_id, fields)) ?? { error: "Customer not found" },
  delete_customer: async ({ customer_id }) =>
    (await customers.deleteCustomer(customer_id)) ?? { error: "Customer not found" },
};

export const MUTATING_TOOLS = new Set(["add_customer", "update_customer", "delete_customer"]);

export async function executeTool(name, input) {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(input ?? {});
}
