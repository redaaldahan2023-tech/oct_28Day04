import { useEffect, useState } from "react";
import { api } from "../api.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_HASH = "#/admin";

const SUBTITLES = {
  login: "Sign in to your account",
  register: "Create a sales account",
  admin: "Admin console",
};

// Three separate forms: sales sign-in, sales registration and the admin sign-in (#/admin).
export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState(() => (window.location.hash === ADMIN_HASH ? "admin" : "login"));
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";
  const isAdmin = mode === "admin";

  // Keep the URL in sync so #/admin can be bookmarked, and follow manual hash changes.
  useEffect(() => {
    const onHash = () => switchMode(window.location.hash === ADMIN_HASH ? "admin" : "login");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function switchMode(next) {
    setMode(next);
    setErrors({});
    setServerError("");
    const hash = next === "admin" ? ADMIN_HASH : "";
    if (window.location.hash !== hash) history.replaceState(null, "", hash || window.location.pathname);
  }

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (isRegister && !form.name.trim()) next.name = "Name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email address";
    if (!form.password) next.password = "Password is required";
    else if (isRegister && form.password.length < 8) next.password = "At least 8 characters";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setServerError("");
    try {
      const credentials = { email: form.email.trim(), password: form.password };
      const res = isRegister
        ? await api.register({ name: form.name.trim(), ...credentials })
        : isAdmin
          ? await api.adminLogin(credentials)
          : await api.login(credentials);
      onAuthenticated(res);
    } catch (err) {
      setServerError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className={`auth-card ${isAdmin ? "admin" : ""}`} onSubmit={submit} noValidate>
        <div className="brand auth-brand">
          <div className="brand-mark">{isAdmin ? "A" : "C"}</div>
          <div>
            <div className="brand-name">Customer Hub</div>
            <div className="brand-sub">{SUBTITLES[mode]}</div>
          </div>
        </div>

        {serverError && <div className="alert">{serverError}</div>}

        {isRegister && (
          <label className="field">
            <span>
              Full name <em>*</em>
            </span>
            <input autoFocus maxLength={100} value={form.name} onChange={set("name")} autoComplete="name" />
            {errors.name && <small className="field-error">{errors.name}</small>}
          </label>
        )}
        <label className="field">
          <span>
            Email <em>*</em>
          </span>
          <input
            key={mode}
            type="email"
            autoFocus={!isRegister}
            maxLength={150}
            value={form.email}
            onChange={set("email")}
            autoComplete={isAdmin ? "off" : "email"}
          />
          {errors.email && <small className="field-error">{errors.email}</small>}
        </label>
        <label className="field">
          <span>
            Password <em>*</em>
          </span>
          <input
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
          {errors.password && <small className="field-error">{errors.password}</small>}
        </label>

        <button type="submit" className="btn primary auth-submit" disabled={busy}>
          {busy ? "Please wait…" : isRegister ? "Create account" : isAdmin ? "Sign in as admin" : "Sign in"}
        </button>

        {isAdmin ? (
          <p className="muted auth-switch">
            <button type="button" className="link-btn" onClick={() => switchMode("login")}>
              ← Back to sales sign in
            </button>
          </p>
        ) : (
          <>
            <p className="muted auth-switch">
              {isRegister ? "Already have an account?" : "New here?"}{" "}
              <button type="button" className="link-btn" onClick={() => switchMode(isRegister ? "login" : "register")}>
                {isRegister ? "Sign in" : "Create an account"}
              </button>
            </p>
            <p className="muted auth-switch auth-admin-link">
              <button type="button" className="link-btn" onClick={() => switchMode("admin")}>
                Admin sign in
              </button>
            </p>
          </>
        )}
      </form>
    </div>
  );
}
