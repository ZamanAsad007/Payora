import React, { useState } from "react";
import { Lock, AlertCircle, X } from "lucide-react";

export function PinModal({ isOpen, onClose, onConfirm, title = "Confirm Transaction", amount, recipient }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin || pin.length < 5) {
      setError("Please enter your 5-digit transaction PIN");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await onConfirm(pin);
      setPin("");
      onClose();
    } catch (err) {
      setError(err.message || "Invalid transaction PIN");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "420px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981",
              }}
            >
              <Lock size={18} />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{title}</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        {amount && (
          <div
            style={{
              backgroundColor: "#0e1526",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1.25rem",
              border: "1px solid #1e293b",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Total Debit</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#10b981" }}>৳ {amount}</div>
            {recipient && (
              <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
                Recipient: <span style={{ color: "#f8fafc", fontWeight: 600 }}>{recipient}</span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">5-Digit Transaction PIN</label>
            <input
              type="password"
              maxLength={5}
              autoFocus
              className="input-field"
              placeholder="•••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              style={{
                letterSpacing: "0.3em",
                textAlign: "center",
                fontSize: "1.4rem",
                fontWeight: 700,
              }}
            />
          </div>

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                color: "#f87171",
                marginBottom: "1rem",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                padding: "0.6rem",
                borderRadius: "6px",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || pin.length < 5}
              style={{ flex: 1 }}
            >
              {isSubmitting ? "Verifying..." : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
