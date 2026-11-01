import { useEffect } from "react";
import "./ConfirmDialog.css";

// Власна модалка підтвердження замість window.confirm (єдиний стиль із палітрою)
export default function ConfirmDialog({ open, title, text, confirmLabel = "Так", cancelLabel = "Скасувати", danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="cfm-backdrop" onClick={onCancel} role="presentation">
      <div className="cfm-box" role="alertdialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="cfm-title">{title}</div>
        {text && <div className="cfm-text">{text}</div>}
        <div className="cfm-actions">
          <button type="button" className="cfm-btn" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`cfm-btn ${danger ? "cfm-btn--danger" : "cfm-btn--primary"}`} onClick={onConfirm} autoFocus>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
