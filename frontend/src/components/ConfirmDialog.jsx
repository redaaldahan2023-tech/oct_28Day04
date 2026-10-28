import { useState } from "react";

export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="modal small" role="alertdialog" aria-modal="true">
        <div className="modal-body">
          <h2>{title}</h2>
          <p className="muted">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
            }}
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
