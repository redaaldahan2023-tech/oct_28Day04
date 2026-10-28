import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../api.js";
import { SendIcon, SparkIcon, ToolIcon } from "./Icons.jsx";

const SUGGESTIONS = [
  "Get all customers",
  "Find the customer named Khalid",
  "How many customers are in each city?",
  "Add a customer named Sara Ali, email sara.ali@example.com, city Jeddah",
];

const TOOL_LABELS = {
  get_all_customers: "Fetched all customers",
  get_customer_by_name: "Searched by name",
  get_customer_by_id: "Looked up by ID",
  add_customer: "Added customer",
  update_customer: "Updated customer",
  delete_customer: "Deleted customer",
};

export default function ChatPage({ onDataChanged }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;

    // Only successful text turns are sent back as context.
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setSending(true);
    try {
      const res = await api.chat(message, history);
      setMessages((m) => [...m, { role: "assistant", content: res.reply, toolCalls: res.toolCalls }]);
      if (res.dataChanged) onDataChanged();
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: err.message, error: true }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="page chat-page">
      <header className="page-header">
        <div>
          <h1>AI Assistant</h1>
          <p className="muted">Ask questions or make changes to customer data in plain language.</p>
        </div>
        {messages.length > 0 && (
          <button className="btn ghost" onClick={() => setMessages([])} disabled={sending}>
            New conversation
          </button>
        )}
      </header>

      <section className="card chat-card">
        <div className="chat-scroll">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">
                <SparkIcon width={28} height={28} />
              </div>
              <h3>How can I help with your customers?</h3>
              <p className="muted">I can list, search, add, update and delete customers for you.</p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="suggestion" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`msg ${m.role} ${m.error ? "error" : ""}`}>
                {m.role === "assistant" && (
                  <div className="msg-avatar">
                    <SparkIcon width={16} height={16} />
                  </div>
                )}
                <div className="msg-body">
                  {m.toolCalls?.length > 0 && (
                    <div className="tool-chips">
                      {m.toolCalls.map((t, j) => (
                        <span key={j} className={`chip ${t.error ? "chip-error" : ""}`} title={JSON.stringify(t.input)}>
                          <ToolIcon /> {TOOL_LABELS[t.name] ?? t.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="bubble">
                    {m.role === "assistant" && !m.error ? (
                      <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="msg assistant">
              <div className="msg-avatar">
                <SparkIcon width={16} height={16} />
              </div>
              <div className="bubble typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            placeholder="Ask about your customers…  (Enter to send, Shift+Enter for a new line)"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="btn primary send" type="submit" disabled={sending || !input.trim()} aria-label="Send">
            <SendIcon />
          </button>
        </form>
      </section>
    </div>
  );
}
