import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import CustomerModal from "./CustomerModal.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { EditIcon, PlusIcon, RefreshIcon, SearchIcon, TrashIcon } from "./Icons.jsx";

const PAGE_SIZE = 10;

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

export default function CustomersPage({ notify, dataVersion }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "customer_id", dir: "asc" });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null | {} (new) | customer
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCustomers(await api.listCustomers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? customers.filter((c) =>
          [c.name, c.email, c.phone, String(c.customer_id)].some((v) => v?.toLowerCase().includes(q)),
        )
      : customers;
    const { key, dir } = sort;
    return [...list].sort((a, b) => {
      const x = a[key] ?? "";
      const y = b[key] ?? "";
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return dir === "asc" ? cmp : -cmp;
    });
  }, [customers, search, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: customers.length,
      withEmail: customers.filter((c) => c.email).length,
      recent: customers.filter((c) => c.created_at && new Date(c.created_at).getTime() >= weekAgo).length,
    };
  }, [customers]);

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const handleSave = async (data) => {
    if (editing?.customer_id) {
      const updated = await api.updateCustomer(editing.customer_id, data);
      setCustomers((list) => list.map((c) => (c.customer_id === updated.customer_id ? updated : c)));
      notify(`Updated ${updated.name}`);
    } else {
      const created = await api.createCustomer(data);
      setCustomers((list) => [...list, created]);
      notify(`Added ${created.name}`);
    }
    setEditing(null);
  };

  const handleDelete = async () => {
    const target = deleting;
    try {
      await api.deleteCustomer(target.customer_id);
      setCustomers((list) => list.filter((c) => c.customer_id !== target.customer_id));
      notify(`Deleted ${target.name}`);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setDeleting(null);
    }
  };

  const SortHeader = ({ k, children }) => (
    <th>
      <button className="th-btn" onClick={() => toggleSort(k)}>
        {children}
        <span className="sort-ind">{sort.key === k ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Customers</h1>
          <p className="muted">Create, view, update and delete customer records.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing({})}>
          <PlusIcon /> Add customer
        </button>
      </header>

      <section className="stats">
        <div className="stat">
          <div className="stat-label">Total customers</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat">
          <div className="stat-label">With email on file</div>
          <div className="stat-value">{stats.withEmail}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Added in last 7 days</div>
          <div className="stat-value">{stats.recent}</div>
        </div>
      </section>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <SearchIcon />
            <input
              placeholder="Search by name, email, phone or ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <button className="btn ghost" onClick={load} disabled={loading} title="Refresh">
            <RefreshIcon className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>

        {error ? (
          <div className="empty error-box">
            <strong>Couldn't load customers.</strong>
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
                  <SortHeader k="customer_id">ID</SortHeader>
                  <SortHeader k="name">Name</SortHeader>
                  <SortHeader k="email">Email</SortHeader>
                  <SortHeader k="phone">Phone</SortHeader>
                  <SortHeader k="created_at">Created</SortHeader>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && customers.length === 0 ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={6}>
                        <div className="skeleton" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      {search ? `No customers match "${search}".` : "No customers yet. Add your first one."}
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.customer_id}>
                      <td className="muted mono">#{c.customer_id}</td>
                      <td>
                        <div className="name-cell">
                          <span className="avatar">{initials(c.name)}</span>
                          {c.name}
                        </div>
                      </td>
                      <td>{c.email || <span className="muted">—</span>}</td>
                      <td>{c.phone || <span className="muted">—</span>}</td>
                      <td className="muted">{formatDate(c.created_at)}</td>
                      <td className="right">
                        <div className="row-actions">
                          <button className="icon-btn" title="Edit" onClick={() => setEditing(c)}>
                            <EditIcon />
                          </button>
                          <button className="icon-btn danger" title="Delete" onClick={() => setDeleting(c)}>
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!error && filtered.length > 0 && (
          <div className="pagination">
            <span className="muted">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="pager">
              <button className="btn ghost sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                Previous
              </button>
              <span className="muted">
                Page {currentPage} of {pageCount}
              </span>
              <button
                className="btn ghost sm"
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {editing && <CustomerModal customer={editing} onSave={handleSave} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete customer?"
          message={`${deleting.name} (#${deleting.customer_id}) will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
