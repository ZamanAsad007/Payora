import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";

export function PinSetup() {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setTransactionPin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== 5 || !/^\d{5}$/.test(pin)) {
      setError("PIN must be exactly 5 numeric digits");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match. Please verify.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      await setTransactionPin(pin);
      navigate("/");
    } catch (err) {
      setError(err.message || "Failed to configure PIN");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="card" style={{ maxWidth: "420px", width: "100%", padding: "2.5rem 2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Set Transaction PIN</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Create a secure 5-digit PIN required for all money transfers and payments
          </p>
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "#f87171",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              padding: "0.75rem",
              borderRadius: "6px",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Enter 5-Digit PIN</label>
            <input
              type="password"
              maxLength={5}
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
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Confirm 5-Digit PIN</label>
            <input
              type="password"
              maxLength={5}
              className="input-field"
              placeholder="•••••"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              style={{
                letterSpacing: "0.3em",
                textAlign: "center",
                fontSize: "1.4rem",
                fontWeight: 700,
              }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "1rem", padding: "0.85rem" }}
            disabled={isLoading || pin.length !== 5 || confirmPin.length !== 5}
          >
            {isLoading ? "Saving PIN..." : "Save Transaction PIN"}
          </button>
        </form>
      </div>
    </div>
  );
}
