import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { RefreshIcon, SearchIcon } from "./Icons.jsx";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.adminUsers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const users = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data?.users ?? [];
    if (!term) return list;
    return list.filter((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [data, search]);

  const totals = data?.totals;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Admin dashboard</h1>
          <p className="muted">All sales users and the number of customers assigned to each.</p>
        </div>
      </header>

      <section className="stats">
        <div className="stat">
          <div className="stat-label">Sales users</div>
          <div className="stat-value">{totals?.salesUsers ?? "—"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total customers</div>
          <div className="stat-value">{totals?.customers ?? "—"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Unassigned customers</div>
          <div className="stat-value">{totals?.unassignedCustomers ?? "—"}</div>
        </div>
      </section>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <SearchIcon />
            <input placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn ghost" onClick={load} disabled={loading} title="Refresh">
            <RefreshIcon className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>

        {error ? (
          <div className="empty error-box">
            <strong>Couldn't load users.</strong>
            <span>{error}</span>
            <button className="btn" onClick={load}>
              Try again
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Joined</th>
                  <th className="right">Customers</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  Array.from({ length: 4 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={4}>
                        <div className="skeleton" />
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      {search ? `No sales users match "${search}".` : "No sales users have registered yet."}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.user_id}>
                      <td>
                        <div className="name-cell">
                          <span className="avatar">{initials(u.name)}</span>
                          {u.name}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td className="muted">{formatDate(u.created_at)}</td>
                      <td className="right">
                        <span className={`count-badge ${u.customer_count ? "" : "zero"}`}>{u.customer_count}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
