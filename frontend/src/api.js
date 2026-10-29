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

// Shared by JSON calls and file downloads: adds the token and handles 401s and API errors.
async function send(path, options = {}) {
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
  // A 401 on a request that carried a token means the session is no longer valid.
  if (res.status === 401 && sentToken) onUnauthorized();
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return res;
}

async function request(path, options) {
  const res = await send(path, options);
  return res.json().catch(() => null);
}

// The export needs the bearer token, so it's fetched as a Blob instead of opened as a link.
async function exportCustomers(search) {
  const res = await send(`/api/customers/export${search ? `?search=${encodeURIComponent(search)}` : ""}`);
  const blob = await res.blob();
  const filename =
    /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "customers.xlsx";
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { filename, count: Number(res.headers.get("X-Export-Count") ?? 0) };
}

export const api = {
  health: () => request("/api/health"),
  register: (data) => request("/api/auth/register", { method: "POST", body: data }),
  login: (data) => request("/api/auth/login", { method: "POST", body: data }),
  me: () => request("/api/auth/me"),
  adminLogin: (data) => request("/api/admin/login", { method: "POST", body: data }),
  adminUsers: () => request("/api/admin/users"),
  listCustomers: (search) =>
    request(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createCustomer: (data) => request("/api/customers", { method: "POST", body: data }),
  updateCustomer: (id, data) => request(`/api/customers/${id}`, { method: "PUT", body: data }),
  deleteCustomer: (id) => request(`/api/customers/${id}`, { method: "DELETE" }),
  exportCustomers,
  chat: (message, history) => request("/api/agent/chat", { method: "POST", body: { message, history } }),
};
