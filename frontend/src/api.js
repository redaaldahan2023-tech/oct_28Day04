export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

const TOKEN_KEY = "customerHub.token";

// localStorage can be unavailable (private mode, blocked storage); the session then lasts until reload.
let token = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {}

export function setToken(value) {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export const hasToken = () => Boolean(token);

// App.jsx registers this to return to the login screen when the session expires.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, options = {}) {
  const sentToken = token;
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(sentToken ? { Authorization: `Bearer ${sentToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach the API at ${API_URL}. Is the backend running?`);
  }
  const data = await res.json().catch(() => null);
  // A 401 on a request that carried a token means the session is no longer valid.
  if (res.status === 401 && sentToken) onUnauthorized();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => request("/api/health"),
  register: (data) => request("/api/auth/register", { method: "POST", body: data }),
  login: (data) => request("/api/auth/login", { method: "POST", body: data }),
  me: () => request("/api/auth/me"),
  listCustomers: (search) =>
    request(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createCustomer: (data) => request("/api/customers", { method: "POST", body: data }),
  updateCustomer: (id, data) => request(`/api/customers/${id}`, { method: "PUT", body: data }),
  deleteCustomer: (id) => request(`/api/customers/${id}`, { method: "DELETE" }),
  chat: (message, history) => request("/api/agent/chat", { method: "POST", body: { message, history } }),
};
