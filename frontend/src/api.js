export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach the API at ${API_URL}. Is the backend running?`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => request("/api/health"),
  listCustomers: (search) =>
    request(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createCustomer: (data) => request("/api/customers", { method: "POST", body: data }),
  updateCustomer: (id, data) => request(`/api/customers/${id}`, { method: "PUT", body: data }),
  deleteCustomer: (id) => request(`/api/customers/${id}`, { method: "DELETE" }),
  chat: (message, history) => request("/api/agent/chat", { method: "POST", body: { message, history } }),
};
