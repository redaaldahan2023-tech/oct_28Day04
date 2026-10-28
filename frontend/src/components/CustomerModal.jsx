import { useEffect, useState } from "react";
import { CloseIcon } from "./Icons.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CustomerModal({ customer, onSave, onClose }) {
  const isEdit = Boolean(customer.customer_id);
  const [form, setForm] = useState({
    name: customer.name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email address";
    if (form.phone.trim() && !/^[0-9+\-() ]{3,30}$/.test(form.phone.trim()))
      next.phone = "Digits, spaces and + - ( ) only";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setServerError("");
    try {
      await onSave({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() });
    } catch (err) {
      setServerError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} noValidate>
        <div className="modal-header">
          <h2>{isEdit ? `Edit customer #${customer.customer_id}` : "Add customer"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          {serverError && <div className="alert">{serverError}</div>}
          <label className="field">
            <span>
              Full name <em>*</em>
            </span>
            <input autoFocus value={form.name} onChange={set("name")} placeholder="Jane Doe" />
            {errors.name && <small className="field-error">{errors.name}</small>}
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={set("email")} placeholder="jane@example.com" />
            {errors.email && <small className="field-error">{errors.email}</small>}
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={form.phone} onChange={set("phone")} placeholder="9876543210" />
            {errors.phone && <small className="field-error">{errors.phone}</small>}
          </label>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add customer"}
          </button>
        </div>
      </form>
    </div>
  );
}
