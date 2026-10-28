import { useCallback, useEffect, useState } from "react";
import { api, API_URL } from "./api.js";
import CustomersPage from "./components/CustomersPage.jsx";
import ChatPage from "./components/ChatPage.jsx";
import { ChatIcon, UsersIcon } from "./components/Icons.jsx";

const NAV = [
  { id: "customers", label: "Customers", icon: UsersIcon },
  { id: "assistant", label: "AI Assistant", icon: ChatIcon },
];

export default function App() {
  const [page, setPage] = useState("customers");
  const [health, setHealth] = useState(null);
  const [toasts, setToasts] = useState([]);
  // Bumped whenever the assistant changes data, so the customer list reloads.
  const [dataVersion, setDataVersion] = useState(0);

  const notify = useCallback((message, type = "success") => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    const check = () => api.health().then(setHealth).catch(() => setHealth({ status: "down" }));
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, []);

  const online = health?.status === "ok" && health?.database === "ok";

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-name">Customer Hub</div>
            <div className="brand-sub">Management console</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => setPage(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="status">
            <span className={`dot ${health === null ? "" : online ? "ok" : "bad"}`} />
            {health === null ? "Checking API…" : online ? "API connected" : "API unavailable"}
          </div>
          {health && online && !health.agentConfigured && (
            <div className="status warn">Assistant needs an API key</div>
          )}
          <a className="swagger-link" href={`${API_URL}/swagger`} target="_blank" rel="noreferrer">
            API docs (Swagger) ↗
          </a>
        </div>
      </aside>

      <main className="main">
        {/* Both pages stay mounted so the chat history survives switching tabs. */}
        <div hidden={page !== "customers"}>
          <CustomersPage notify={notify} dataVersion={dataVersion} />
        </div>
        <div hidden={page !== "assistant"} className="chat-wrap">
          <ChatPage onDataChanged={() => setDataVersion((v) => v + 1)} />
        </div>
      </main>

      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
